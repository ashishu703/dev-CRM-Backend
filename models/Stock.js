const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class Stock extends BaseModel {
  constructor() {
    super('stock');
  }

  /**
   * Get all stock records
   * @returns {Promise<Array>} Array of stock records
   */
  async getAll() {
    const sqlQuery = `
      SELECT * FROM stock
      ORDER BY product_name ASC
    `;
    
    const result = await query(sqlQuery);
    return result.rows;
  }

  /**
   * Get stock by product name
   * @param {string} productName - Product name
   * @returns {Promise<Object|null>} Stock record or null
   */
  async getByProductName(productName) {
    const sqlQuery = `
      SELECT * FROM stock
      WHERE product_name = $1
    `;
    
    const result = await query(sqlQuery, [productName]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update or insert stock record
   * @param {Object} data - Stock data
   * @returns {Promise<Object>} Updated/inserted stock record
   */
  async upsertStock(data) {
    const { product_name, quantity, unit, status, updated_by } = data;
    
    // Determine status based on quantity if not provided
    let finalStatus = status;
    if (!finalStatus) {
      if (quantity === 0) {
        finalStatus = 'out_of_stock';
      } else if (quantity < 500) {
        finalStatus = 'limited';
      } else {
        finalStatus = 'available';
      }
    }
    
    const sqlQuery = `
      INSERT INTO stock (product_name, quantity, unit, status, updated_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (product_name)
      DO UPDATE SET
        quantity = EXCLUDED.quantity,
        unit = EXCLUDED.unit,
        status = EXCLUDED.status,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [product_name, quantity, unit || 'meters', finalStatus, updated_by];
    const result = await query(sqlQuery, values);
    return result.rows[0];
  }

  /**
   * Update stock quantity and status
   * @param {string} productName - Product name
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated stock record
   */
  async updateStock(productName, data) {
    const { quantity, unit, status, updated_by } = data;
    
    // Determine status based on quantity if not provided
    let finalStatus = status;
    if (!finalStatus && quantity !== undefined) {
      if (quantity === 0) {
        finalStatus = 'out_of_stock';
      } else if (quantity < 500) {
        finalStatus = 'limited';
      } else {
        finalStatus = 'available';
      }
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (quantity !== undefined) {
      updates.push(`quantity = $${paramCount++}`);
      values.push(quantity);
    }
    
    if (unit !== undefined) {
      updates.push(`unit = $${paramCount++}`);
      values.push(unit);
    }
    
    if (finalStatus !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(finalStatus);
    }
    
    if (updated_by !== undefined) {
      updates.push(`updated_by = $${paramCount++}`);
      values.push(updated_by);
    }
    
    if (updates.length === 0) {
      throw new Error('No fields to update');
    }
    
    values.push(productName);
    const sqlQuery = `
      UPDATE stock
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE product_name = $${paramCount}
      RETURNING *
    `;
    
    const result = await query(sqlQuery, values);
    if (result.rows.length === 0) {
      throw new Error('Stock record not found');
    }
    
    return result.rows[0];
  }

  /**
   * Batch update multiple stock records
   * @param {Array} stockUpdates - Array of stock update objects
   * @returns {Promise<Array>} Array of updated stock records
   */
  async batchUpdate(stockUpdates) {
    const results = [];
    
    for (const update of stockUpdates) {
      const { product_name, quantity, unit, status, updated_by } = update;
      
      // Determine status based on quantity if not provided
      let finalStatus = status;
      if (!finalStatus && quantity !== undefined) {
        if (quantity === 0) {
          finalStatus = 'out_of_stock';
        } else if (quantity < 500) {
          finalStatus = 'limited';
        } else {
          finalStatus = 'available';
        }
      }
      
      const sqlQuery = `
        INSERT INTO stock (product_name, quantity, unit, status, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (product_name)
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          unit = EXCLUDED.unit,
          status = EXCLUDED.status,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const values = [product_name, quantity, unit || 'meters', finalStatus, updated_by];
      const result = await query(sqlQuery, values);
      results.push(result.rows[0]);
    }
    
    return results;
  }
}

module.exports = new Stock();

