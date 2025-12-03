const BaseModel = require('./BaseModel');

/**
 * WorkOrder model class
 * Follows OOP principles for work order data management
 */
class WorkOrder extends BaseModel {
  constructor() {
    super('work_orders');
  }

  /**
   * Create a new work order
   * @param {Object} workOrderData - Work order data
   * @returns {Promise<Object>} Created work order
   */
  async create(workOrderData) {
    const {
      workOrderNumber,
      bnaNumber,
      date,
      deliveryDate,
      contact,
      from,
      to,
      orderDetails,
      unitRate,
      terms,
      preparedBy,
      receivedBy,
      paymentId,
      quotationId,
      leadId
    } = workOrderData;

    const query = `
      INSERT INTO work_orders (
        work_order_number, bna_number, date, delivery_date, contact,
        from_company_name, from_address, from_email, from_gstin,
        to_company_name, to_address, to_email,
        order_title, order_description, order_quantity, order_type,
        order_length, order_colour, order_print, order_total,
        unit_rate, terms, prepared_by, received_by,
        payment_id, quotation_id, lead_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), NOW()
      ) RETURNING *
    `;

    const values = [
      workOrderNumber,
      bnaNumber,
      date,
      deliveryDate,
      contact,
      from?.companyName || '',
      from?.address || '',
      from?.email || '',
      from?.gstin || '',
      to?.companyName || '',
      to?.address || '',
      to?.email || '',
      orderDetails?.title || '',
      orderDetails?.description || '',
      orderDetails?.quantity || '',
      orderDetails?.type || '',
      orderDetails?.length || '',
      orderDetails?.colour || '',
      orderDetails?.print || '',
      orderDetails?.total || 0,
      unitRate || '0',
      JSON.stringify(terms || []),
      preparedBy || '',
      receivedBy || '',
      paymentId || null,
      quotationId || null,
      leadId || null
    ];

    return await WorkOrder.query(query, values);
  }

  /**
   * Get work order by ID
   * @param {number} id - Work order ID
   * @returns {Promise<Object>} Work order data
   */
  async getById(id) {
    const query = `
      SELECT * FROM work_orders WHERE id = $1
    `;
    const result = await WorkOrder.query(query, [id]);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  /**
   * Get all work orders
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of work orders
   */
  async getAll(filters = {}) {
    let query = 'SELECT * FROM work_orders WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.paymentId) {
      query += ` AND payment_id = $${paramCount}`;
      values.push(filters.paymentId);
      paramCount++;
    }

    if (filters.quotationId) {
      query += ` AND quotation_id = $${paramCount}`;
      values.push(filters.quotationId);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await WorkOrder.query(query, values);
    return result.rows || [];
  }
}

module.exports = new WorkOrder();

