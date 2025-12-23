const { query } = require('../config/database');

class InventoryHelpers {
  static buildWhereClause(filters, paramCount = 1) {
    const conditions = [];
    const values = [];
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key.includes('date')) {
          if (key === 'date_from') {
            conditions.push(`created_at >= $${paramCount++}`);
            values.push(value);
          } else if (key === 'date_to') {
            conditions.push(`created_at <= $${paramCount++}`);
            values.push(value + ' 23:59:59');
          }
        } else if (Array.isArray(value)) {
          conditions.push(`${key} = ANY($${paramCount++})`);
          values.push(value);
        } else {
          conditions.push(`${key} = $${paramCount++}`);
          values.push(value);
        }
      }
    });
    
    return {
      whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
      paramCount
    };
  }

  static buildPaginationQuery(baseQuery, page = 1, limit = 10, whereClause = '', values = [], paramCount = 1) {
    const offset = (page - 1) * limit;
    let fromPart = baseQuery.split('FROM')[1] || '';
    fromPart = fromPart.split('ORDER BY')[0]?.split('LIMIT')[0]?.trim() || '';
    const countQuery = `SELECT COUNT(*) as total FROM ${fromPart} ${whereClause}`;
    
    let dataQuery = baseQuery;
    if (dataQuery.includes('ORDER BY')) {
      dataQuery = dataQuery.split('ORDER BY')[0];
    }
    dataQuery = `${dataQuery} ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    
    return { countQuery, dataQuery, values: [...values, limit, offset], paramCount };
  }

  static async executeParallelQueries(queries) {
    return Promise.all(queries.map(q => query(q.sql, q.params || [])));
  }

  static memoize(fn, ttl = 300000) {
    const cache = new Map();
    return async (...args) => {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }
      
      const result = await fn(...args);
      cache.set(key, { data: result, timestamp: Date.now() });
      return result;
    };
  }

  static formatDateRange(dateFrom, dateTo) {
    if (!dateFrom && !dateTo) return null;
    return {
      from: dateFrom ? new Date(dateFrom) : null,
      to: dateTo ? new Date(dateTo + ' 23:59:59') : null
    };
  }

  static calculateStockStatus(currentStock, minStock, maxStock) {
    if (currentStock <= 0) return 'out_of_stock';
    if (currentStock < minStock) return 'low_stock';
    if (currentStock > maxStock) return 'over_stock';
    return 'in_stock';
  }

  static sanitizeItemData(data) {
    const allowedFields = [
      'item_id', 'item_name', 'item_type', 'category_id', 'sub_category_id',
      'micro_category_id', 'uom_id', 'store_id', 'hsn', 'price', 'tax_type',
      'tax', 'current_stock', 'min_stock', 'max_stock', 'reject_stock',
      'item_image', 'phase_in_insulation', 'description', 'is_active'
    ];
    
    const sanitized = {};
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        sanitized[field] = data[field];
      }
    });
    
    return sanitized;
  }
}

module.exports = InventoryHelpers;

