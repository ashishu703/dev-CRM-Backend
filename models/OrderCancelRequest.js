const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class OrderCancelRequest extends BaseModel {
  constructor() {
    super('order_cancel_requests');
  }

  static async createRequest(data) {
    const {
      quotationId,
      customerId,
      requestedBy,
      reason
    } = data;
    const sql = `
      INSERT INTO order_cancel_requests (quotation_id, customer_id, requested_by, reason, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *
    `;
    const result = await query(sql, [quotationId, customerId, requestedBy, reason || null]);
    return result.rows[0];
  }

  static async getByQuotationId(quotationId) {
    const result = await query(
      'SELECT * FROM order_cancel_requests WHERE quotation_id = $1 ORDER BY created_at DESC LIMIT 1',
      [quotationId]
    );
    return result.rows[0] || null;
  }

  static async getByCustomerId(customerId) {
    const result = await query(
      'SELECT * FROM order_cancel_requests WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId]
    );
    return result.rows || [];
  }

  static async getPending() {
    const result = await query(`
      SELECT ocr.*,
        q.quotation_number,
        q.customer_name,
        q.total_amount
      FROM order_cancel_requests ocr
      LEFT JOIN quotations q ON q.id::text = ocr.quotation_id
      WHERE ocr.status = 'pending'
      ORDER BY ocr.created_at ASC
    `);
    return result.rows || [];
  }

  static async getById(id) {
    const result = await query(
      'SELECT * FROM order_cancel_requests WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async approve(id, approvedBy) {
    const result = await query(`
      UPDATE order_cancel_requests
      SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `, [id, approvedBy]);
    return result.rows[0] || null;
  }

  static async reject(id, rejectedBy, rejectionReason) {
    const result = await query(`
      UPDATE order_cancel_requests
      SET status = 'rejected', approved_by = $2, rejected_at = NOW(), rejection_reason = $3, updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `, [id, rejectedBy, rejectionReason || null]);
    return result.rows[0] || null;
  }
}

module.exports = OrderCancelRequest;
