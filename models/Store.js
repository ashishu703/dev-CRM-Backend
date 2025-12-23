const BaseModel = require('./BaseModel');
const { query } = require('../config/database');
const InventoryHelpers = require('../utils/inventoryHelpers');

class Store extends BaseModel {
  constructor() {
    super('stores');
  }

  async findAll(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const { whereClause, values, paramCount } = InventoryHelpers.buildWhereClause(filters);
    const { countQuery, dataQuery, values: finalValues } = InventoryHelpers.buildPaginationQuery(
      'SELECT * FROM stores',
      page,
      limit,
      whereClause,
      values,
      paramCount
    );

    const [countResult, dataResult] = await InventoryHelpers.executeParallelQueries([
      { sql: countQuery, params: values },
      { sql: dataQuery, params: finalValues }
    ]);

    const total = parseInt(countResult.rows[0].total);
    
    return {
      data: dataResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async findById(id) {
    const result = await query('SELECT * FROM stores WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByName(name) {
    const result = await query('SELECT * FROM stores WHERE name = $1', [name]);
    return result.rows[0] || null;
  }

  async getStoreStats(storeId) {
    const sql = `
      SELECT 
        COUNT(DISTINCT i.id) as total_items,
        SUM(i.current_stock) as total_stock_value,
        SUM(i.reject_stock) as total_reject_stock
      FROM items i
      WHERE i.store_id = $1 AND i.is_active = TRUE
    `;
    const result = await query(sql, [storeId]);
    return result.rows[0] || { total_items: 0, total_stock_value: 0, total_reject_stock: 0 };
  }

  async create(data) {
    const {
      name, code, address, city, state, country, pincode,
      phone, email, store_type, is_active, created_by
    } = data;
    
    const sql = `
      INSERT INTO stores (
        name, code, address, city, state, country, pincode,
        phone, email, store_type, is_active, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const result = await query(sql, [
      name, code || null, address || null, city || null, state || null,
      country || 'India', pincode || null, phone || null, email || null,
      store_type || null, is_active !== undefined ? is_active : true, created_by
    ]);
    return result.rows[0];
  }

  async update(id, data) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'name', 'code', 'address', 'city', 'state', 'country', 'pincode',
      'phone', 'email', 'store_type', 'is_active'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramCount++}`);
        values.push(data[field]);
      }
    });

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const sql = `
      UPDATE stores
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query('DELETE FROM stores WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }
}

module.exports = new Store();

