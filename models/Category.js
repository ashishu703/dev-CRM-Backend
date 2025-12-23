const BaseModel = require('./BaseModel');
const { query } = require('../config/database');
const InventoryHelpers = require('../utils/inventoryHelpers');

class Category extends BaseModel {
  constructor() {
    super('categories');
  }

  async findAll(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const { whereClause, values, paramCount } = InventoryHelpers.buildWhereClause(filters);
    const { countQuery, dataQuery, values: finalValues } = InventoryHelpers.buildPaginationQuery(
      'SELECT * FROM categories',
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
    const result = await query('SELECT * FROM categories WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByName(name) {
    const result = await query('SELECT * FROM categories WHERE name = $1', [name]);
    return result.rows[0] || null;
  }

  async findWithChildren(parentId = null) {
    const sql = `
      SELECT id, name, description, parent_id, created_at, updated_at
      FROM categories
      ORDER BY 
        CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
        parent_id NULLS FIRST,
        name
    `;
    const result = await query(sql, []);
    return result.rows;
  }

  async create(data) {
    const { name, description, parent_id, created_by } = data;
    
    const existing = await this.findByNameAndParent(name, parent_id || null);
    if (existing) {
      throw new Error(`Category "${name}" already exists${parent_id ? ' under this parent' : ''}`);
    }
    
    const sql = `
      INSERT INTO categories (name, description, parent_id, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await query(sql, [name, description || null, parent_id || null, created_by]);
    return result.rows[0];
  }

  async findByNameAndParent(name, parent_id = null) {
    const sql = `
      SELECT * FROM categories 
      WHERE name = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL))
      LIMIT 1
    `;
    const result = await query(sql, [name, parent_id]);
    return result.rows[0] || null;
  }

  async update(id, data) {
    const { name, description, parent_id } = data;
    
    const currentCategory = await this.findById(id);
    if (!currentCategory) {
      throw new Error('Category not found');
    }

    const finalParentId = parent_id !== undefined ? parent_id : currentCategory.parent_id;
    
    if (name !== undefined && name !== currentCategory.name) {
      const existing = await this.findByNameAndParent(name, finalParentId);
      if (existing && existing.id !== id) {
        throw new Error(`Category "${name}" already exists${finalParentId ? ' under this parent' : ''}`);
      }
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (parent_id !== undefined) {
      updates.push(`parent_id = $${paramCount++}`);
      values.push(parent_id);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const sql = `
      UPDATE categories
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }
}

module.exports = new Category();

