const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

/**
 * SalesOrder model class
 * Manages sales orders for Production Department Head
 * Sales orders are created from work orders
 */
class SalesOrder extends BaseModel {
  constructor() {
    super('sales_orders');
  }

  /**
   * Create a sales order from a work order
   * @param {Object} workOrder - Work order data
   * @param {Object} additionalData - Additional sales order data
   * @returns {Promise<Object>} Created sales order
   */
  async createFromWorkOrder(workOrder, additionalData = {}) {
    try {
      await query('BEGIN');

      // Generate sales order number
      const salesOrderNumber = await this.generateSalesOrderNumber();

      // Extract data from work order
      const salesOrderQuery = `
        INSERT INTO sales_orders (
          sales_order_number, work_order_id,
          customer_name, customer_phone, customer_email, customer_address, customer_gst_no,
          product_name, product_description, quantity, unit_price,
          order_date, delivery_date,
          status, payment_status, priority,
          total_amount, paid_amount, notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
        ) RETURNING *
      `;

      const values = [
        salesOrderNumber,
        workOrder.id,
        workOrder.to_company_name || '',
        workOrder.contact || '',
        workOrder.to_email || '',
        workOrder.to_address || '',
        workOrder.to_gstin || workOrder.customer_gst_no || '',
        workOrder.order_title || additionalData.productName || '',
        workOrder.order_description || additionalData.productDescription || '',
        parseFloat(workOrder.order_quantity) || additionalData.quantity || 0,
        parseFloat(workOrder.unit_rate) || additionalData.unitPrice || 0,
        workOrder.date || new Date(),
        workOrder.delivery_date || additionalData.deliveryDate || null,
        additionalData.status || 'confirmed',
        additionalData.paymentStatus || 'pending',
        additionalData.priority || 'medium',
        parseFloat(workOrder.order_total) || additionalData.totalAmount || 0,
        additionalData.paidAmount || 0,
        additionalData.notes || ''
      ];

      const result = await query(salesOrderQuery, values);
      
      await query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Generate unique sales order number
   * Format: SO-YYYY-NNN
   * @returns {Promise<string>} Generated sales order number
   */
  async generateSalesOrderNumber() {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;
    
    const result = await query(
      `SELECT sales_order_number FROM sales_orders 
       WHERE sales_order_number LIKE $1 
       ORDER BY sales_order_number DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNumber = 1;
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].sales_order_number;
      const lastSeq = parseInt(lastNumber.split('-').pop());
      nextNumber = lastSeq + 1;
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Get all sales orders with filters (including deleted if specified)
   * @param {Object} filters - Filter options
   * @param {boolean} includeDeleted - Include deleted sales orders
   * @returns {Promise<Array>} Array of sales orders
   */
  async getAll(filters = {}, includeDeleted = false) {
    let sqlQuery = `
      SELECT so.*, wo.work_order_number, wo.quotation_id
      FROM sales_orders so
      LEFT JOIN work_orders wo ON so.work_order_id = wo.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 1;

    // Include deleted orders if specified (for production view)
    if (!includeDeleted) {
      sqlQuery += ` AND so.deleted_at IS NULL`;
    }

    if (filters.status) {
      sqlQuery += ` AND so.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.paymentStatus) {
      sqlQuery += ` AND so.payment_status = $${paramCount}`;
      values.push(filters.paymentStatus);
      paramCount++;
    }

    if (filters.priority) {
      sqlQuery += ` AND so.priority = $${paramCount}`;
      values.push(filters.priority);
      paramCount++;
    }

    if (filters.search) {
      sqlQuery += ` AND (
        so.sales_order_number ILIKE $${paramCount} OR
        so.customer_name ILIKE $${paramCount} OR
        so.product_name ILIKE $${paramCount}
      )`;
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    sqlQuery += ' ORDER BY so.created_at DESC';

    if (filters.limit) {
      sqlQuery += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
      paramCount++;
    }

    if (filters.offset) {
      sqlQuery += ` OFFSET $${paramCount}`;
      values.push(filters.offset);
      paramCount++;
    }

    const result = await query(sqlQuery, values);
    return result.rows || [];
  }

  /**
   * Get sales order by ID
   * @param {number} id - Sales order ID
   * @returns {Promise<Object|null>} Sales order data
   */
  async getById(id) {
    const sqlQuery = `
      SELECT so.*, wo.work_order_number, wo.quotation_id
      FROM sales_orders so
      LEFT JOIN work_orders wo ON so.work_order_id = wo.id
      WHERE so.id = $1 AND so.deleted_at IS NULL
    `;
    const result = await query(sqlQuery, [id]);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  /**
   * Update sales order (with revision tracking)
   * @param {number} id - Sales order ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated sales order
   */
  async update(id, updateData) {
    const allowedFields = [
      'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'customer_gst_no',
      'product_name', 'product_description', 'quantity', 'unit_price',
      'delivery_date', 'status', 'payment_status', 'priority',
      'production_start_date', 'production_end_date', 'assigned_to',
      'total_amount', 'paid_amount', 'notes'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Mark as revised
    updates.push(`status = 'revised'`);
    updates.push(`revised_at = NOW()`);
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const sqlQuery = `
      UPDATE sales_orders 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await query(sqlQuery, values);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  /**
   * Update sales order from work order (auto-sync)
   * @param {Object} workOrder - Updated work order data
   * @returns {Promise<Object>} Updated sales order
   */
  async updateFromWorkOrder(workOrder) {
    const sqlQuery = `
      UPDATE sales_orders 
      SET 
        customer_name = $1,
        product_name = $2,
        product_description = $3,
        quantity = $4,
        delivery_date = $5,
        status = 'revised',
        revised_at = NOW(),
        updated_at = NOW()
      WHERE work_order_id = $6 AND deleted_at IS NULL
      RETURNING *
    `;

    const values = [
      workOrder.to_company_name || workOrder.customer_business_name || '',
      workOrder.order_title || '',
      workOrder.order_description || '',
      parseFloat(workOrder.order_quantity) || 0,
      workOrder.delivery_date || null,
      workOrder.id
    ];

    const result = await query(sqlQuery, values);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  /**
   * Mark sales order as deleted (when work order is deleted)
   * @param {number} workOrderId - Work order ID
   * @returns {Promise<boolean>} Success status
   */
  async markAsDeleted(workOrderId) {
    const sqlQuery = `
      UPDATE sales_orders 
      SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
      WHERE work_order_id = $1 AND deleted_at IS NULL
      RETURNING id
    `;
    const result = await query(sqlQuery, [workOrderId]);
    return result.rows.length > 0;
  }

  /**
   * Soft delete sales order
   * @param {number} id - Sales order ID
   * @returns {Promise<boolean>} Success status
   */
  async softDelete(id) {
    const sqlQuery = `
      UPDATE sales_orders 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;
    const result = await query(sqlQuery, [id]);
    return result.rows.length > 0;
  }

  /**
   * Get sales order statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    const sqlQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
        COUNT(CASE WHEN status = 'in_production' THEN 1 END) as in_production_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payment_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(paid_amount), 0) as total_paid
      FROM sales_orders
      WHERE deleted_at IS NULL
    `;
    const result = await query(sqlQuery);
    return result.rows[0] || {};
  }
}

module.exports = new SalesOrder();

