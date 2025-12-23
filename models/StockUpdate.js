const BaseModel = require('./BaseModel');
const { query } = require('../config/database');
const InventoryHelpers = require('../utils/inventoryHelpers');

class StockUpdate extends BaseModel {
  constructor() {
    super('stock_updates');
  }

  async findAll(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    let whereConditions = [];
    const values = [];
    let paramCount = 1;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'date_from') {
          whereConditions.push(`su.created_at >= $${paramCount++}`);
          values.push(value);
        } else if (key === 'date_to') {
          whereConditions.push(`su.created_at <= $${paramCount++}`);
          values.push(value + ' 23:59:59');
        } else if (key === 'item_id') {
          whereConditions.push(`su.item_id = $${paramCount++}`);
          values.push(value);
        } else if (key === 'store_id') {
          whereConditions.push(`su.store_id = $${paramCount++}`);
          values.push(value);
        } else if (key === 'update_type') {
          whereConditions.push(`su.update_type = $${paramCount++}`);
          values.push(value);
        }
      }
    });

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT 
        su.*,
        i.item_id,
        i.item_name,
        s.name as store_name,
        fs.name as from_store_name,
        ts.name as to_store_name
      FROM stock_updates su
      LEFT JOIN items i ON su.item_id = i.id
      LEFT JOIN stores s ON su.store_id = s.id
      LEFT JOIN stores fs ON su.from_store_id = fs.id
      LEFT JOIN stores ts ON su.to_store_id = ts.id
    `;

    const countQuery = `SELECT COUNT(*) as total FROM stock_updates su ${whereClause}`;
    const dataQuery = `${baseQuery} ${whereClause} ORDER BY su.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;

    const [countResult, dataResult] = await InventoryHelpers.executeParallelQueries([
      { sql: countQuery, params: values },
      { sql: dataQuery, params: [...values, limit, offset] }
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
    const sql = `
      SELECT 
        su.*,
        i.item_id,
        i.item_name,
        s.name as store_name,
        fs.name as from_store_name,
        ts.name as to_store_name
      FROM stock_updates su
      LEFT JOIN items i ON su.item_id = i.id
      LEFT JOIN stores s ON su.store_id = s.id
      LEFT JOIN stores fs ON su.from_store_id = fs.id
      LEFT JOIN stores ts ON su.to_store_id = ts.id
      WHERE su.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  async create(data) {
    const {
      item_id, store_id, update_type, quantity, previous_stock,
      new_stock, reference_number, comment, from_store_id, to_store_id, updated_by
    } = data;
    
    const sql = `
      INSERT INTO stock_updates (
        item_id, store_id, update_type, quantity, previous_stock, new_stock,
        reference_number, comment, from_store_id, to_store_id, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await query(sql, [
      item_id, store_id || null, update_type, quantity, previous_stock || null,
      new_stock || null, reference_number || null, comment || null,
      from_store_id || null, to_store_id || null, updated_by
    ]);
    return result.rows[0];
  }
}

module.exports = new StockUpdate();

