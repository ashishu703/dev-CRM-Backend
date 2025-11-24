const BaseModel = require('./BaseModel');
const { query } = require('../config/database');
const CustomerCredit = require('./CustomerCredit');

class Payment extends BaseModel {
  constructor() {
    super('payment_history');
  }

  /**
   * Get all payments for a specific lead
   * @param {number} leadId - Lead ID
   * @returns {Promise<Array>} Array of payment records
   */
  async getByLead(leadId) {
    const queryText = `
      SELECT ph.*, 
             q.quotation_number,
             q.total_amount as quotation_total,
             l.name as lead_name,
             l.phone as lead_phone,
             l.email as lead_email
      FROM payment_history ph
      LEFT JOIN quotations q ON ph.quotation_id = q.id
      LEFT JOIN leads l ON ph.lead_id = l.id
      WHERE ph.lead_id = $1
      ORDER BY ph.payment_date ASC, ph.installment_number ASC
    `;
    
    const result = await query(queryText, [leadId]);
    return result.rows;
  }

  /**
   * Get all payments for a specific quotation
   * @param {string} quotationId - Quotation UUID
   * @returns {Promise<Array>} Array of payment records
   */
  async getByQuotation(quotationId) {
    const queryText = `
      SELECT ph.*, 
             q.quotation_number,
             q.total_amount as quotation_total,
             l.name as lead_name,
             pi.pi_number,
             pi.id as pi_full_id
      FROM payment_history ph
      LEFT JOIN quotations q ON ph.quotation_id::text = q.id::text
      LEFT JOIN leads l ON ph.lead_id = l.id
      LEFT JOIN proforma_invoices pi ON ph.pi_id::text = pi.id::text
      WHERE ph.quotation_id::text = $1::text AND ph.is_refund = false
      ORDER BY ph.payment_date ASC, ph.installment_number ASC
    `;
    
    const result = await query(queryText, [quotationId]);
    return result.rows;
  }

  /**
   * Get payment summary for a lead
   * @param {number} leadId - Lead ID
   * @returns {Promise<Object>} Payment summary
   */
  async getPaymentSummaryByLead(leadId) {
    const queryText = `
      SELECT * FROM vw_payment_summary_by_lead
      WHERE lead_id = $1
    `;
    
    const result = await query(queryText, [leadId]);
    return result.rows[0] || null;
  }

  /**
   * Get payment summary for a quotation
   * @param {string} quotationId - Quotation UUID
   * @returns {Promise<Object>} Payment summary
   */
  async getPaymentSummaryByQuotation(quotationId) {
    const queryText = `
      SELECT * FROM vw_payment_summary_by_quotation
      WHERE quotation_id = $1
    `;
    
    const result = await query(queryText, [quotationId]);
    return result.rows[0] || null;
  }

  /**
   * Get all approved quotations for a lead with their payment status
   * @param {number} leadId - Lead ID
   * @returns {Promise<Array>} Array of quotations with payment info
   */
  async getQuotationsWithPayments(leadId) {
    const queryText = `
      SELECT 
        q.id,
        q.quotation_number,
        q.total_amount,
        q.status,
        q.created_at,
        q.work_order_id,
        COALESCE(SUM(CASE WHEN ph.is_refund = false THEN ph.installment_amount ELSE 0 END), 0) as paid_amount,
        COALESCE(MAX(ph.remaining_amount), q.total_amount) as remaining_amount,
        COUNT(CASE WHEN ph.is_refund = false THEN ph.id END) as installment_count,
        MAX(ph.payment_date) as last_payment_date
      FROM quotations q
      LEFT JOIN payment_history ph ON q.id = ph.quotation_id
      WHERE q.customer_id = $1 AND q.status IN ('approved', 'completed')
      GROUP BY q.id, q.quotation_number, q.total_amount, q.status, q.created_at, q.work_order_id
      ORDER BY q.created_at DESC
    `;
    
    const result = await query(queryText, [leadId]);
    return result.rows;
  }

  /**
   * Get customer credit balance
   * @param {number} leadId - Lead ID
   * @returns {Promise<number>} Credit balance
   */
  async getCreditBalance(leadId) {
    // Ensure the customer_credits table exists
    try { await CustomerCredit.ensureSchema(); } catch (_) {}
    const queryText = `
      SELECT COALESCE(balance, 0) as balance
      FROM customer_credits
      WHERE customer_id = $1
    `;
    
    const result = await query(queryText, [leadId]);
    return result.rows[0]?.balance || 0;
  }

  /**
   * Generate unique payment reference
   * @returns {Promise<string>} Payment reference
   */
  async generatePaymentReference() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PAY-${timestamp}-${random}`;
  }

  /**
   * Get next installment number for a quotation
   * @param {string} quotationId - Quotation UUID
   * @returns {Promise<number>} Next installment number
   */
  async getNextInstallmentNumber(quotationId) {
    const queryText = `
      SELECT COALESCE(MAX(installment_number), 0) + 1 as next_number
      FROM payment_history
      WHERE quotation_id = $1
    `;
    
    const result = await query(queryText, [quotationId]);
    return result.rows[0]?.next_number || 1;
  }

  /**
   * Approve a payment
   * @param {number} paymentId - Payment ID
   * @param {string} approvedBy - User who approved
   * @returns {Promise<Object>} Updated payment record
   */
  async approvePayment(paymentId, approvedBy) {
    return this.updateApprovalStatus(paymentId, 'approved', approvedBy, null);
  }

  /**
   * Update payment approval status (pending/approved/rejected)
   * @param {number} paymentId
   * @param {'pending'|'approved'|'rejected'} status
   * @param {string} actionBy
   * @param {string|null} notes
   * @returns {Promise<Object>}
   */
  async updateApprovalStatus(paymentId, status, actionBy, notes) {
    const normalizedStatus = (status || 'pending').toLowerCase();
    if (!['pending', 'approved', 'rejected'].includes(normalizedStatus)) {
      throw new Error('Invalid approval status');
    }

    const isApproved = normalizedStatus === 'approved';
    const queryText = `
      UPDATE payment_history 
      SET approval_status = $2,
          approval_action_by = $3,
          approval_notes = $4,
          payment_approved = $5,
          payment_approved_by = CASE WHEN $5 THEN $6 ELSE NULL END,
          payment_approved_at = CASE WHEN $5 THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const actionByValue = actionBy || null;
    const result = await query(queryText, [
      paymentId,
      normalizedStatus,
      actionByValue,
      notes || null,
      isApproved,
      actionByValue
    ]);

    return result.rows[0];
  }

  /**
   * Update payment receipt URL
   * @param {number} paymentId - Payment ID
   * @param {string} receiptUrl - Receipt URL
   * @returns {Promise<Object>} Updated payment record
   */
  async updateReceipt(paymentId, receiptUrl) {
    const queryText = `
      UPDATE payment_history 
      SET payment_receipt_url = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(queryText, [paymentId, receiptUrl]);
    return result.rows[0];
  }

  /**
   * Update delivery information
   * @param {number} paymentId - Payment ID
   * @param {Object} deliveryInfo - Delivery information
   * @returns {Promise<Object>} Updated payment record
   */
  async updateDeliveryInfo(paymentId, deliveryInfo) {
    const { delivery_date, revised_delivery_date, delivery_status, purchase_order_id } = deliveryInfo;
    
    const queryText = `
      UPDATE payment_history 
      SET delivery_date = COALESCE($2, delivery_date),
          revised_delivery_date = COALESCE($3, revised_delivery_date),
          delivery_status = COALESCE($4, delivery_status),
          purchase_order_id = COALESCE($5, purchase_order_id),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(queryText, [
      paymentId,
      delivery_date,
      revised_delivery_date,
      delivery_status,
      purchase_order_id
    ]);
    
    return result.rows[0];
  }
}

module.exports = new Payment();
