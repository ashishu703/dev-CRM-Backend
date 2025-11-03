const BaseModel = require('./BaseModel');
const { getClient, query } = require('../config/database');

class ProformaInvoice extends BaseModel {
  constructor() {
    super('proforma_invoices');
  }

  // Create PI from quotation
  async createFromQuotation(quotationId, piData) {
    const client = await getClient();
    
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
      
      // Create PI with dispatch details
      const piQuery = `
        INSERT INTO proforma_invoices (
          pi_number, quotation_id, customer_id, salesperson_id,
          pi_date, valid_until, status,
          subtotal, tax_amount, total_amount, remaining_balance,
          dispatch_mode, transport_name, vehicle_number, transport_id, lr_no,
          courier_name, consignment_no, by_hand, post_service,
          carrier_name, carrier_number,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
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
        piData.dispatch_mode || piData.dispatchMode || null,
        piData.transport_name || piData.transportName || null,
        piData.vehicle_number || piData.vehicleNumber || null,
        piData.transport_id || piData.transportId || null,
        piData.lr_no || piData.lrNo || null,
        piData.courier_name || piData.courierName || null,
        piData.consignment_no || piData.consignmentNo || null,
        piData.by_hand || piData.byHand || null,
        piData.post_service || piData.postService || null,
        piData.carrier_name || piData.carrierName || null,
        piData.carrier_number || piData.carrierNumber || null,
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

  // Update PI by ID
  async updateById(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Dynamic field updates
    const fieldMap = {
      dispatch_mode: updateData.dispatch_mode || updateData.dispatchMode,
      transport_name: updateData.transport_name || updateData.transportName,
      vehicle_number: updateData.vehicle_number || updateData.vehicleNumber,
      transport_id: updateData.transport_id || updateData.transportId,
      lr_no: updateData.lr_no || updateData.lrNo,
      courier_name: updateData.courier_name || updateData.courierName,
      consignment_no: updateData.consignment_no || updateData.consignmentNo,
      by_hand: updateData.by_hand || updateData.byHand,
      post_service: updateData.post_service || updateData.postService,
      carrier_name: updateData.carrier_name || updateData.carrierName,
      carrier_number: updateData.carrier_number || updateData.carrierNumber,
      status: updateData.status,
      pi_date: updateData.pi_date || updateData.piDate,
      valid_until: updateData.valid_until || updateData.validUntil
    };

    Object.entries(fieldMap).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const sql = `
      UPDATE proforma_invoices 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0];
  }

  // Send PI to customer
  async sendToCustomer(id, sentBy) {
    const sql = `
      UPDATE proforma_invoices 
      SET status = 'sent', 
          sent_to_customer_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // Customer accepts PI
  async acceptByCustomer(id, acceptedBy) {
    const sql = `
      UPDATE proforma_invoices 
      SET status = 'accepted', 
          customer_accepted_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // Update payment totals
  async updatePaymentTotals(id) {
    const sql = `
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
    
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // Get PIs by customer
  async getByCustomer(customerId) {
    const sql = `
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
    
    const result = await query(sql, [customerId]);
    return result.rows;
  }

  // Generate PI number
  async generatePINumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the latest PI number for this year and month
    const sql = `
      SELECT pi_number 
      FROM proforma_invoices 
      WHERE pi_number LIKE $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const prefix = `PI-${year}-${month}-%`;
    const result = await query(sql, [prefix]);
    
    let sequence = 1;
    if (result.rows.length > 0) {
      // Extract sequence number from last PI number (format: PI-YYYY-MM-XXX)
      const lastPiNumber = result.rows[0].pi_number;
      const lastSequence = parseInt(lastPiNumber.split('-').pop());
      sequence = lastSequence + 1;
    }
    
    return `PI-${year}-${month}-${String(sequence).padStart(4, '0')}`;
  }

  // Get PI with payments
  async getWithPayments(id) {
    const sql = 'SELECT * FROM proforma_invoices WHERE id = $1';
    const result = await query(sql, [id]);
    const pi = result.rows[0];
    if (!pi) return null;
    
    const paymentsResult = await query(
      `SELECT * FROM payment_history WHERE quotation_id = $1 AND payment_status = 'completed' AND is_refund = false ORDER BY payment_date ASC`,
      [pi.quotation_id]
    );
    
    pi.payments = paymentsResult.rows;
    return pi;
  }

  // Get PIs by quotation
  async getByQuotation(quotationId) {
    const sql = 'SELECT * FROM proforma_invoices WHERE quotation_id = $1 ORDER BY created_at DESC';
    const result = await query(sql, [quotationId]);
    return result.rows;
  }

  // Get PI by ID
  async getById(id) {
    const sql = 'SELECT * FROM proforma_invoices WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // Get all PIs (approved, rejected, pending)
  async getAll() {
    const sql = `
      SELECT pi.*, 
             dh.customer AS customer_name,
             dh.business AS customer_business
      FROM proforma_invoices pi
      LEFT JOIN department_head_leads dh ON pi.customer_id = dh.id
      ORDER BY 
        CASE 
          WHEN pi.status = 'pending_approval' THEN 1
          WHEN pi.status = 'approved' THEN 2
          WHEN pi.status = 'rejected' THEN 3
          ELSE 4
        END,
        pi.created_at DESC
    `;
    const result = await query(sql);
    return result.rows;
  }

  // Get all PIs pending approval
  async getPendingApproval() {
    const sql = `
      SELECT pi.*, 
             dh.customer AS customer_name,
             dh.business AS customer_business
      FROM proforma_invoices pi
      LEFT JOIN department_head_leads dh ON pi.customer_id = dh.id
      WHERE pi.status = 'pending_approval'
      ORDER BY pi.created_at DESC
    `;
    const result = await query(sql);
    return result.rows;
  }

  // Delete PI by ID
  async deleteById(id) {
    const sql = 'DELETE FROM proforma_invoices WHERE id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
  }
}

module.exports = new ProformaInvoice();
