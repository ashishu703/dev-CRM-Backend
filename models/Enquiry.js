const BaseModel = require('./BaseModel');

class Enquiry extends BaseModel {
  constructor() {
    super('enquiries');
  }

  async ensureSchema() {
    const sql = `
      DO $do$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enquiries'
        ) THEN
          CREATE TABLE enquiries (
            id SERIAL PRIMARY KEY,
            lead_id INTEGER NOT NULL,
            customer_name VARCHAR(255) NOT NULL,
            business VARCHAR(255),
            address TEXT,
            state VARCHAR(100),
            division VARCHAR(100),
            follow_up_status VARCHAR(100),
            follow_up_remark TEXT,
            sales_status VARCHAR(50),
            sales_status_remark TEXT,
            enquired_product VARCHAR(500) NOT NULL,
            product_quantity VARCHAR(100),
            product_remark TEXT,
            salesperson VARCHAR(255),
            telecaller VARCHAR(255),
            enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_enquiries_lead_id ON enquiries(lead_id);
          CREATE INDEX IF NOT EXISTS idx_enquiries_enquiry_date ON enquiries(enquiry_date);
          CREATE INDEX IF NOT EXISTS idx_enquiries_salesperson ON enquiries(salesperson);
          CREATE INDEX IF NOT EXISTS idx_enquiries_telecaller ON enquiries(telecaller);
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END
      $do$;
      
      CREATE OR REPLACE FUNCTION update_enquiries_updated_at()
      RETURNS TRIGGER AS $enq$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $enq$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trg_enquiries_updated_at ON enquiries;
      CREATE TRIGGER trg_enquiries_updated_at
      BEFORE UPDATE ON enquiries
      FOR EACH ROW EXECUTE FUNCTION update_enquiries_updated_at();
    `;
    await Enquiry.query(sql);
  }

  /**
   * Create enquiry records for a lead
   * @param {Object} enquiryData - Enquiry data
   * @returns {Promise<Array>} Created enquiry records
   */
  async createEnquiries(enquiryData) {
    await this.ensureSchema();
    
    const {
      lead_id,
      customer_name,
      business,
      address,
      state,
      division,
      follow_up_status,
      follow_up_remark,
      sales_status,
      sales_status_remark,
      enquired_products, // Array of {product, quantity, remark}
      salesperson,
      telecaller,
      enquiry_date = new Date().toISOString().split('T')[0]
    } = enquiryData;

    // Validate required fields
    if (!lead_id) {
      throw new Error('lead_id is required for enquiry creation');
    }
    if (!customer_name || customer_name.trim() === '') {
      throw new Error('customer_name is required for enquiry creation');
    }

    // Parse enquired products if it's a string
    let products = [];
    if (typeof enquired_products === 'string') {
      try {
        if (enquired_products.trim() === '') {
          products = [];
        } else {
          products = JSON.parse(enquired_products);
        }
      } catch (e) {
        console.error('Error parsing enquired_products JSON:', e);
        throw new Error(`Invalid enquired_products format: ${e.message}`);
      }
    } else if (Array.isArray(enquired_products)) {
      products = enquired_products;
    } else if (enquired_products) {
      // If it's not null/undefined but also not string/array, try to convert
      console.warn('Unexpected enquired_products type:', typeof enquired_products);
      products = [];
    }

    // If no products, return empty array
    if (!products || products.length === 0) {
      console.log('No products to create enquiries for lead_id:', lead_id);
      return [];
    }
    
    // Filter out empty products
    products = products.filter(p => {
      if (typeof p === 'string') {
        return p && p.trim() !== '';
      }
      return (p.product || p.name) && (p.product || p.name).trim() !== '';
    });
    
    if (products.length === 0) {
      console.log('No valid products after filtering for lead_id:', lead_id);
      return [];
    }

    // Convert old format (strings) to new format (objects)
    const formattedProducts = products.map(item => {
      if (typeof item === 'string') {
        return { product: item, quantity: '', remark: '' };
      }
      return {
        product: item.product || item.name || '',
        quantity: item.quantity || '',
        remark: item.remark || ''
      };
    });

    // Create one enquiry record per product
    const createdEnquiries = [];
    for (const productItem of formattedProducts) {
      const productName = productItem.product === 'Other' 
        ? (enquiryData.other_product || 'Other')
        : productItem.product;

      const sql = `
        INSERT INTO enquiries (
          lead_id, customer_name, business, address, state, division,
          follow_up_status, follow_up_remark, sales_status, sales_status_remark,
          enquired_product, product_quantity, product_remark,
          salesperson, telecaller, enquiry_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;
      
      const values = [
        lead_id,
        customer_name,
        business || null,
        address || null,
        state || null,
        division || null,
        follow_up_status || null,
        follow_up_remark || null,
        sales_status || null,
        sales_status_remark || null,
        productName,
        productItem.quantity || null,
        productItem.remark || null,
        salesperson || null,
        telecaller || null,
        enquiry_date
      ];

      try {
        const result = await Enquiry.query(sql, values);
        if (result.rows && result.rows.length > 0) {
          createdEnquiries.push(result.rows[0]);
        } else {
          console.error('Failed to create enquiry record for product:', productName, 'lead_id:', lead_id);
        }
      } catch (error) {
        console.error('Error creating enquiry for product:', productName, 'Error:', error.message);
        throw error; // Re-throw to be caught by controller
      }
    }

    if (createdEnquiries.length === 0 && products.length > 0) {
      console.error('No enquiry records were created despite having products. Lead ID:', lead_id);
    }

    return createdEnquiries;
  }

  /**
   * Get enquiries for department head
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Enquiries with pagination
   */
  async getForDepartmentHead(filters = {}, pagination = {}) {
    await this.ensureSchema();
    
    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;
    
    const whereConditions = [];
    const values = [];
    let paramCount = 1;

    // Filter by department salespersons
    if (filters.departmentSalespersons && Array.isArray(filters.departmentSalespersons) && filters.departmentSalespersons.length > 0) {
      const placeholders = filters.departmentSalespersons.map(() => `$${paramCount++}`).join(', ');
      whereConditions.push(`(salesperson = ANY(ARRAY[${placeholders}]) OR telecaller = ANY(ARRAY[${placeholders}]))`);
      values.push(...filters.departmentSalespersons);
    }

    // Filter by date range
    if (filters.startDate) {
      whereConditions.push(`enquiry_date >= $${paramCount++}`);
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      whereConditions.push(`enquiry_date <= $${paramCount++}`);
      values.push(filters.endDate);
    }

    // Filter by specific date
    if (filters.enquiryDate) {
      whereConditions.push(`enquiry_date = $${paramCount++}`);
      values.push(filters.enquiryDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countSql = `SELECT COUNT(*) FROM enquiries ${whereClause}`;
    const countResult = await Enquiry.query(countSql, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data, grouped by date
    const dataSql = `
      SELECT * FROM enquiries 
      ${whereClause}
      ORDER BY enquiry_date DESC, created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;
    values.push(limit, offset);
    const dataResult = await Enquiry.query(dataSql, values);

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

  /**
   * Get enquiries grouped by date
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Enquiries grouped by date
   */
  async getGroupedByDate(filters = {}) {
    await this.ensureSchema();
    
    const whereConditions = [];
    const values = [];
    let paramCount = 1;

    // Filter by department salespersons
    if (filters.departmentSalespersons && Array.isArray(filters.departmentSalespersons) && filters.departmentSalespersons.length > 0) {
      const placeholders = filters.departmentSalespersons.map(() => `$${paramCount++}`).join(', ');
      whereConditions.push(`(salesperson = ANY(ARRAY[${placeholders}]) OR telecaller = ANY(ARRAY[${placeholders}]))`);
      values.push(...filters.departmentSalespersons);
    }

    // Filter by date range
    if (filters.startDate) {
      whereConditions.push(`enquiry_date >= $${paramCount++}`);
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      whereConditions.push(`enquiry_date <= $${paramCount++}`);
      values.push(filters.endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const sql = `
      SELECT * FROM enquiries 
      ${whereClause}
      ORDER BY enquiry_date DESC, created_at DESC
    `;
    
    const result = await Enquiry.query(sql, values);
    
    // Group by date
    const grouped = {};
    result.rows.forEach(enquiry => {
      const dateKey = enquiry.enquiry_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(enquiry);
    });

    return grouped;
  }

  /**
   * Update an enquiry by ID
   * @param {Number} id - Enquiry ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated enquiry
   */
  async updateById(id, updateData) {
    await this.ensureSchema();
    
    const allowedFields = [
      'customer_name', 'business', 'address', 'state', 'division',
      'follow_up_status', 'follow_up_remark', 'sales_status', 'sales_status_remark',
      'enquired_product', 'product_quantity', 'product_remark',
      'salesperson', 'telecaller', 'enquiry_date'
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount++}`);
        values.push(value === '' ? null : value);
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const sql = `
      UPDATE enquiries 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await Enquiry.query(sql, values);
    if (result.rows && result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  }

  /**
   * Delete an enquiry by ID
   * @param {Number} id - Enquiry ID
   * @returns {Promise<Boolean>} Success status
   */
  async deleteById(id) {
    await this.ensureSchema();
    
    const sql = `DELETE FROM enquiries WHERE id = $1 RETURNING id`;
    const result = await Enquiry.query(sql, [id]);
    
    return result.rows && result.rows.length > 0;
  }

  /**
   * Get enquiry by ID
   * @param {Number} id - Enquiry ID
   * @returns {Promise<Object>} Enquiry record
   */
  async getById(id) {
    await this.ensureSchema();
    
    const sql = `SELECT * FROM enquiries WHERE id = $1`;
    const result = await Enquiry.query(sql, [id]);
    
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
  }
}

module.exports = new Enquiry();

