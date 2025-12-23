const BaseModel = require('./BaseModel');
const { query } = require('../config/database');
const InventoryHelpers = require('../utils/inventoryHelpers');

class Item extends BaseModel {
  constructor() {
    super('items');
  }

  async findAll(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    let whereConditions = [];
    const values = [];
    let paramCount = 1;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'date_from') {
          whereConditions.push(`i.created_at >= $${paramCount++}`);
          values.push(value);
        } else if (key === 'date_to') {
          whereConditions.push(`i.created_at <= $${paramCount++}`);
          values.push(value + ' 23:59:59');
        } else if (key === 'item_type') {
          whereConditions.push(`i.item_type = $${paramCount++}`);
          values.push(value);
        } else if (key === 'category_id') {
          whereConditions.push(`i.category_id = $${paramCount++}`);
          values.push(value);
        } else if (key === 'store_id') {
          whereConditions.push(`i.store_id = $${paramCount++}`);
          values.push(value);
        } else if (key === 'search') {
          whereConditions.push(`(i.item_name ILIKE $${paramCount} OR i.item_id ILIKE $${paramCount})`);
          values.push(`%${value}%`);
          paramCount++;
        }
      }
    });

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT 
        i.*,
        c.name as category_name,
        sc.name as sub_category_name,
        mc.name as micro_category_name,
        u.code as uom_code,
        u.name as uom_name,
        s.name as store_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN categories sc ON i.sub_category_id = sc.id
      LEFT JOIN categories mc ON i.micro_category_id = mc.id
      LEFT JOIN uom u ON i.uom_id = u.id
      LEFT JOIN stores s ON i.store_id = s.id
    `;

    const countQuery = `SELECT COUNT(*) as total FROM items i ${whereClause}`;
    const dataQuery = `${baseQuery} ${whereClause} ORDER BY i.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;

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
        i.*,
        c.name as category_name,
        sc.name as sub_category_name,
        mc.name as micro_category_name,
        u.code as uom_code,
        u.name as uom_name,
        s.name as store_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN categories sc ON i.sub_category_id = sc.id
      LEFT JOIN categories mc ON i.micro_category_id = mc.id
      LEFT JOIN uom u ON i.uom_id = u.id
      LEFT JOIN stores s ON i.store_id = s.id
      WHERE i.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  async findByItemId(itemId) {
    const sql = `
      SELECT 
        i.*,
        c.name as category_name,
        sc.name as sub_category_name,
        mc.name as micro_category_name,
        u.code as uom_code,
        u.name as uom_name,
        s.name as store_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN categories sc ON i.sub_category_id = sc.id
      LEFT JOIN categories mc ON i.micro_category_id = mc.id
      LEFT JOIN uom u ON i.uom_id = u.id
      LEFT JOIN stores s ON i.store_id = s.id
      WHERE i.item_id = $1
    `;
    const result = await query(sql, [itemId]);
    return result.rows[0] || null;
  }

  async create(data) {
    const sanitized = InventoryHelpers.sanitizeItemData(data);
    const fields = Object.keys(sanitized);
    const values = Object.values(sanitized);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO items (${fields.join(', ')}, created_by)
      VALUES (${placeholders}, $${fields.length + 1})
      RETURNING *
    `;
    const result = await query(sql, [...values, data.created_by]);
    return result.rows[0];
  }

  async update(id, data) {
    const sanitized = InventoryHelpers.sanitizeItemData(data);
    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.entries(sanitized).forEach(([key, value]) => {
      updates.push(`${key} = $${paramCount++}`);
      values.push(value);
    });

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const sql = `
      UPDATE items
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }

  async updateStock(itemId, quantity, updateType, updatedBy, comment = null, fromStoreId = null, toStoreId = null) {
    const client = await require('../config/database').getClient();
    try {
      await client.query('BEGIN');
      
      const item = await this.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      const previousStock = parseFloat(item.current_stock);
      let newStock = previousStock;
      const qty = parseFloat(quantity);
      
      const normalizedType = updateType.charAt(0).toUpperCase() + updateType.slice(1).toLowerCase();

      if (normalizedType === 'Add') {
        newStock = previousStock + qty;
      } else if (normalizedType === 'Reduce') {
        if (previousStock < qty) {
          throw new Error('Not enough stock to reduce');
        }
        newStock = previousStock - qty;
      } else if (normalizedType === 'Transfer') {
        if (previousStock < qty) {
          throw new Error('Not enough stock to transfer');
        }
        newStock = previousStock;
      } else if (normalizedType === 'Adjustment') {
        newStock = qty;
      } else {
        throw new Error(`Invalid update type: ${updateType}`);
      }

      await client.query(
        'UPDATE items SET current_stock = $1 WHERE id = $2',
        [newStock, itemId]
      );

      const storeId = updateType === 'transfer' || updateType === 'Transfer' ? fromStoreId : (item.store_id || fromStoreId);

      await client.query(
        `INSERT INTO stock_updates (item_id, store_id, update_type, quantity, previous_stock, new_stock, comment, from_store_id, to_store_id, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [itemId, storeId, normalizedType, qty, previousStock, newStock, comment, fromStoreId, toStoreId, updatedBy]
      );

      await client.query('COMMIT');
      return { previousStock, newStock };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getHistory(itemId, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const [countResult, dataResult] = await InventoryHelpers.executeParallelQueries([
      { sql: 'SELECT COUNT(*) as total FROM item_history WHERE item_id = $1', params: [itemId] },
      { sql: 'SELECT * FROM item_history WHERE item_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', params: [itemId, limit, offset] }
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
}

module.exports = new Item();

