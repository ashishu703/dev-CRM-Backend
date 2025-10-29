const BaseModel = require('./BaseModel');

class ProformaInvoice extends BaseModel {
  constructor() {
    super('proforma_invoices');
  }

  // Create PI from quotation
  async createFromQuotation(quotationId, piData) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get quotation details
      const quotationQuery = 'SELECT * FROM quotations WHERE id = $1';
      const quotationResult = await client.query(quotationQuery, [quotationId]);
      const quotation = quotationResult.rows[0];
      
      if (!quotation) {
        throw new Error('Quotation not found');
      }
      
      // Generate PI number
      const piNumber = await this.generatePINumber();
      
      // Create PI
      const piQuery = `
        INSERT INTO proforma_invoices (
          pi_number, quotation_id, customer_id, salesperson_id,
          pi_date, valid_until, status,
          subtotal, tax_amount, total_amount, remaining_balance,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `;
      
      const piValues = [
        piNumber,
        quotationId,
        quotation.customer_id,
        quotation.salesperson_id,
        piData.piDate || new Date().toISOString().split('T')[0],
        piData.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        piData.status || 'draft',
        quotation.subtotal,
        quotation.tax_amount,
        quotation.total_amount,
        quotation.total_amount, // remaining_balance = total_amount initially
        piData.createdBy
      ];
      
      const piResult = await client.query(piQuery, piValues);
      const pi = piResult.rows[0];
      
      await client.query('COMMIT');
      return pi;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Send PI to customer
  async sendToCustomer(id, sentBy) {
    const query = `
      UPDATE proforma_invoices 
      SET status = 'sent', 
          sent_to_customer_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    return await this.query(query, [id]);
  }

  // Customer accepts PI
  async acceptByCustomer(id, acceptedBy) {
    const query = `
      UPDATE proforma_invoices 
      SET status = 'accepted', 
          customer_accepted_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    return await this.query(query, [id]);
  }

  // Update payment totals
  async updatePaymentTotals(id) {
    const query = `
      UPDATE proforma_invoices 
      SET total_paid = (
        SELECT COALESCE(SUM(amount), 0) 
        FROM payments 
        WHERE pi_id = $1 AND status = 'completed'
      ),
      remaining_balance = total_amount - (
        SELECT COALESCE(SUM(amount), 0) 
        FROM payments 
        WHERE pi_id = $1 AND status = 'completed'
      ),
      updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    return await this.query(query, [id]);
  }

  // Get PIs by customer
  async getByCustomer(customerId) {
    const query = `
      SELECT pi.*, 
             q.quotation_number,
             q.customer_name,
             COUNT(ph.id) as payment_count,
             COALESCE(SUM(ph.installment_amount), 0) as total_paid
      FROM proforma_invoices pi
      LEFT JOIN quotations q ON pi.quotation_id = q.id
      LEFT JOIN payment_history ph ON pi.quotation_id = ph.quotation_id AND ph.payment_status = 'completed' AND ph.is_refund = false
      WHERE pi.customer_id = $1
      GROUP BY pi.id, q.quotation_number, q.customer_name
      ORDER BY pi.created_at DESC
    `;
    
    return await this.query(query, [customerId]);
  }

  // Get PIs by quotation
  async getByQuotation(quotationId) {
    const query = `
      SELECT pi.*, 
             COUNT(ph.id) as payment_count,
             COALESCE(SUM(ph.installment_amount), 0) as total_paid
      FROM proforma_invoices pi
      LEFT JOIN payment_history ph ON pi.quotation_id = ph.quotation_id AND ph.payment_status = 'completed' AND ph.is_refund = false
      WHERE pi.quotation_id = $1
      GROUP BY pi.id
      ORDER BY pi.created_at DESC
    `;
    
    return await this.query(query, [quotationId]);
  }

  // Generate PI number
  async generatePINumber() {
    const query = 'SELECT generate_pi_number() as pi_number';
    const result = await this.query(query);
    return result[0].pi_number;
  }

  // Get PI with payments
  async getWithPayments(id) {
    const pi = await this.getById(id);
    if (!pi) return null;
    
    const payments = await this.query(
      `SELECT * FROM payment_history WHERE quotation_id = $1 AND payment_status = 'completed' AND is_refund = false ORDER BY payment_date ASC`,
      [pi.quotation_id]
    );
    
    pi.payments = payments;
    return pi;
  }

  // Get PIs by quotation
  async getByQuotation(quotationId) {
    const query = 'SELECT * FROM proforma_invoices WHERE quotation_id = $1 ORDER BY created_at DESC';
    return await this.query(query, [quotationId]);
  }
}

module.exports = new ProformaInvoice();
