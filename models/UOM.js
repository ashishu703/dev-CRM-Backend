const BaseModel = require('./BaseModel');
const { query } = require('../config/database');
const InventoryHelpers = require('../utils/inventoryHelpers');

class UOM extends BaseModel {
  constructor() {
    super('uom');
  }

  async findAll(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const { whereClause, values, paramCount } = InventoryHelpers.buildWhereClause(filters);
    const { countQuery, dataQuery, values: finalValues } = InventoryHelpers.buildPaginationQuery(
      'SELECT * FROM uom',
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
    const result = await query('SELECT * FROM uom WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByCode(code) {
    const result = await query('SELECT * FROM uom WHERE code = $1', [code]);
    return result.rows[0] || null;
  }

  async getDefault() {
    const result = await query('SELECT * FROM uom WHERE is_default = TRUE LIMIT 1');
    return result.rows[0] || null;
  }

  async create(data) {
    const { code, name, description, is_default, created_by } = data;
    
    if (is_default) {
      await query('UPDATE uom SET is_default = FALSE WHERE is_default = TRUE');
    }
    
    const sql = `
      INSERT INTO uom (code, name, description, is_default, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await query(sql, [code, name, description || null, is_default || false, created_by]);
    return result.rows[0];
  }

  async update(id, data) {
    const { code, name, description, is_default } = data;
    
    if (is_default) {
      await query('UPDATE uom SET is_default = FALSE WHERE is_default = TRUE AND id != $1', [id]);
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (code !== undefined) {
      updates.push(`code = $${paramCount++}`);
      values.push(code);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (is_default !== undefined) {
      updates.push(`is_default = $${paramCount++}`);
      values.push(is_default);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const sql = `
      UPDATE uom
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query('DELETE FROM uom WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }

  async setDefault(id) {
    await query('UPDATE uom SET is_default = FALSE WHERE is_default = TRUE');
    const result = await query('UPDATE uom SET is_default = TRUE WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }
}

module.exports = new UOM();

