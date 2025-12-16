const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class MarketingOrder extends BaseModel {
  constructor() {
    super('marketing_orders');
  }

  /**
   * Create a new order
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} Created order
   */
  async create(orderData) {
    const {
      lead_number,
      customer_name,
      customer_phone,
      customer_address,
      customer_gst,
      product_name,
      product_type,
      quantity,
      unit_price,
      total_amount,
      order_date,
      expected_delivery_date,
      delivered_date,
      order_status = 'Pending',
      dispatch_from = 'Plant',
      work_order,
      payment_status = 'Not Started',
      paid_amount = 0,
      pending_amount,
      notes,
      order_history = [],
      created_by
    } = orderData;

    // Calculate pending amount if not provided
    const calculatedPendingAmount = pending_amount !== undefined 
      ? pending_amount 
      : (parseFloat(total_amount) || 0) - (parseFloat(paid_amount) || 0);

    const sqlQuery = `
      INSERT INTO marketing_orders (
        lead_number, customer_name, customer_phone, customer_address, customer_gst,
        product_name, product_type, quantity, unit_price, total_amount,
        order_date, expected_delivery_date, delivered_date,
        order_status, dispatch_from, work_order,
        payment_status, paid_amount, pending_amount,
        notes, order_history, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `;

    // Normalize date values - convert empty strings to null (enhanced to handle all edge cases)
    const normalizeDate = (dateValue) => {
      // Handle all possible empty/invalid date values
      if (dateValue === null || 
          dateValue === undefined || 
          dateValue === '' || 
          dateValue === 'ND' || 
          dateValue === 'null' ||
          dateValue === 'undefined' ||
          (typeof dateValue === 'string' && dateValue.trim() === '')) {
        return null;
      }
      // Return the date value as-is if it's valid
      return dateValue;
    };

    const values = [
      lead_number,
      customer_name,
      customer_phone,
      customer_address,
      customer_gst,
      product_name,
      product_type,
      quantity,
      unit_price,
      total_amount,
      normalizeDate(order_date),
      normalizeDate(expected_delivery_date),
      normalizeDate(delivered_date),
      order_status,
      dispatch_from,
      work_order || null,
      payment_status,
      paid_amount,
      calculatedPendingAmount,
      notes || null,
      JSON.stringify(order_history),
      created_by
    ];

    const result = await query(sqlQuery, values);
    return result.rows[0];
  }

  /**
   * Get all orders with optional filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of orders
   */
  async getAll(filters = {}) {
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filters.created_by) {
      conditions.push(`created_by = $${paramCount++}`);
      values.push(filters.created_by);
    }

    if (filters.order_status) {
      conditions.push(`order_status = $${paramCount++}`);
      values.push(filters.order_status);
    }

    if (filters.payment_status) {
      conditions.push(`payment_status = $${paramCount++}`);
      values.push(filters.payment_status);
    }

    if (filters.order_date) {
      // Normalize date filter - convert empty strings to null
      const normalizedDate = filters.order_date === '' || filters.order_date === 'ND' ? null : filters.order_date;
      if (normalizedDate) {
        conditions.push(`order_date = $${paramCount++}`);
        values.push(normalizedDate);
      }
    }

    if (filters.customer_name) {
      conditions.push(`LOWER(customer_name) LIKE LOWER($${paramCount++})`);
      values.push(`%${filters.customer_name}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Use a safer query that handles potential empty strings in date fields
    // First, we'll select all fields and handle date conversion in the application layer
    const sqlQuery = `
      SELECT 
        id,
        lead_number,
        customer_name,
        customer_phone,
        customer_address,
        customer_gst,
        product_name,
        product_type,
        quantity,
        unit_price,
        total_amount,
        order_date,
        expected_delivery_date,
        delivered_date,
        order_status,
        dispatch_from,
        work_order,
        payment_status,
        paid_amount,
        pending_amount,
        notes,
        order_history,
        created_by,
        created_at,
        updated_at
      FROM marketing_orders
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await query(sqlQuery, values);
    
    // Parse order_history JSONB for each order and ensure dates are properly formatted
    return result.rows.map(row => {
      // Ensure date fields are properly handled
      const processedRow = { ...row };
      
      // Helper function to safely handle date values
      const normalizeDateValue = (dateValue) => {
        if (dateValue === null || dateValue === undefined) {
          return null;
        }
        // If it's already a Date object or valid date string, return it
        if (dateValue instanceof Date) {
          return dateValue.toISOString().split('T')[0];
        }
        // If it's an empty string, return null
        if (typeof dateValue === 'string' && dateValue.trim() === '') {
          return null;
        }
        // Return the value as-is if it's a valid date string
        return dateValue;
      };
      
      // Normalize date fields
      processedRow.order_date = normalizeDateValue(processedRow.order_date);
      processedRow.expected_delivery_date = normalizeDateValue(processedRow.expected_delivery_date);
      processedRow.delivered_date = normalizeDateValue(processedRow.delivered_date);
      
      // Add delivered_date_display for frontend compatibility
      processedRow.delivered_date_display = processedRow.delivered_date || 'ND';
      
      // Parse order_history
      processedRow.order_history = typeof processedRow.order_history === 'string' 
        ? JSON.parse(processedRow.order_history) 
        : (processedRow.order_history || []);
      
      return processedRow;
    });
  }

  /**
   * Get order by ID
   * @param {string} id - Order ID (UUID)
   * @returns {Promise<Object|null>} Order data or null
   */
  async getById(id) {
    const sqlQuery = `
      SELECT 
        *,
        CASE 
          WHEN delivered_date IS NULL OR delivered_date = '' THEN 'ND'
          ELSE delivered_date::text
        END as delivered_date_display
      FROM marketing_orders
      WHERE id = $1
    `;

    const result = await query(sqlQuery, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      order_history: typeof row.order_history === 'string' 
        ? JSON.parse(row.order_history) 
        : (row.order_history || [])
    };
  }

  /**
   * Update order
   * @param {string} id - Order ID (UUID)
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated order
   */
  async update(id, updateData) {
    const allowedFields = [
      'customer_name', 'customer_phone', 'customer_address', 'customer_gst',
      'product_name', 'product_type', 'quantity', 'unit_price', 'total_amount',
      'order_date', 'expected_delivery_date', 'delivered_date',
      'order_status', 'dispatch_from', 'work_order',
      'payment_status', 'paid_amount', 'pending_amount',
      'notes', 'order_history'
    ];

    // Normalize date values - convert empty strings to null (enhanced to handle all edge cases)
    const normalizeDate = (dateValue) => {
      // Handle all possible empty/invalid date values
      if (dateValue === null || 
          dateValue === undefined || 
          dateValue === '' || 
          dateValue === 'ND' || 
          dateValue === 'null' ||
          dateValue === 'undefined' ||
          (typeof dateValue === 'string' && dateValue.trim() === '')) {
        return null;
      }
      // Return the date value as-is if it's valid
      return dateValue;
    };

    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        if (key === 'order_history') {
          updates.push(`${key} = $${paramCount++}`);
          values.push(JSON.stringify(updateData[key]));
        } else if (key === 'order_date' || key === 'expected_delivery_date' || key === 'delivered_date') {
          // Normalize date fields
          updates.push(`${key} = $${paramCount++}`);
          values.push(normalizeDate(updateData[key]));
        } else {
          updates.push(`${key} = $${paramCount++}`);
          values.push(updateData[key]);
        }
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Recalculate pending_amount if paid_amount or total_amount is updated
    if (updateData.paid_amount !== undefined || updateData.total_amount !== undefined) {
      // We'll need to get current values first
      const currentOrder = await this.getById(id);
      if (currentOrder) {
        const totalAmount = parseFloat(updateData.total_amount || currentOrder.total_amount) || 0;
        const paidAmount = parseFloat(updateData.paid_amount || currentOrder.paid_amount) || 0;
        updates.push(`pending_amount = $${paramCount++}`);
        values.push(Math.max(0, totalAmount - paidAmount));
      }
    }

    values.push(id);

    const sqlQuery = `
      UPDATE marketing_orders
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(sqlQuery, values);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      order_history: typeof row.order_history === 'string' 
        ? JSON.parse(row.order_history) 
        : (row.order_history || [])
    };
  }

  /**
   * Delete order
   * @param {string} id - Order ID (UUID)
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const sqlQuery = `
      DELETE FROM marketing_orders
      WHERE id = $1
      RETURNING id
    `;

    const result = await query(sqlQuery, [id]);
    return result.rows.length > 0;
  }
}

module.exports = new MarketingOrder();

