const BaseModel = require('./BaseModel');

class DepartmentHeadLead extends BaseModel {
  constructor() {
    super('department_head_leads');
  }

  // Generate customer ID if not provided
  generateCustomerId() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CUST-${timestamp}${random}`;
  }

  async createFromUi(uiLead, createdBy) {
    // Prevent duplicates per creator by phone
    if (uiLead.phone) {
      const checkRes = await DepartmentHeadLead.query(
        'SELECT id FROM department_head_leads WHERE created_by = $1 AND phone = $2 LIMIT 1',
        [createdBy, uiLead.phone]
      );
      if (checkRes.rows && checkRes.rows[0]) {
        return checkRes.rows[0];
      }
    }
    const query = `
      INSERT INTO department_head_leads (
        customer_id, customer, email, business, lead_source, product_names, category,
        sales_status, created, telecaller_status, payment_status,
        phone, address, gst_no, state, customer_type, date,
        whatsapp, assigned_salesperson, assigned_telecaller,
        created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())
      RETURNING id
    `;

    // Generate customer_id if not provided
    const customerId = uiLead.customerId || this.generateCustomerId();

    const values = [
      customerId,
      uiLead.customer || null,
      uiLead.email || null,
      uiLead.business || null,
      uiLead.leadSource || null,
      uiLead.productNames || uiLead.productNamesText || 'N/A',
      uiLead.category || 'N/A',
      uiLead.salesStatus || 'PENDING',
      uiLead.createdAt || null,
      uiLead.telecallerStatus || 'INACTIVE',
      uiLead.paymentStatus || 'PENDING',
      uiLead.phone || null,
      uiLead.address || null,
      (uiLead.gstNo === undefined || uiLead.gstNo === null || String(uiLead.gstNo).trim() === '' ? 'N/A' : uiLead.gstNo),
      uiLead.state || null,
      uiLead.customerType || null,
      uiLead.date || null,
      uiLead.whatsapp || null,
      uiLead.assignedSalesperson || null,
      uiLead.assignedTelecaller || null,
      createdBy
    ];

    const result = await DepartmentHeadLead.query(query, values);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  async bulkCreateFromUi(rows, createdBy) {
    if (!Array.isArray(rows) || rows.length === 0) return { rowCount: 0 };
    // Deduplicate by phone within this creator: skip rows whose phone already exists for createdBy
    const phones = Array.from(new Set(rows.map(r => (r.phone || '').toString().trim()).filter(p => p.length > 0)));
    let existingPhoneSet = new Set();
    if (phones.length > 0) {
      const placeholdersPhones = phones.map((_, idx) => `$${idx + 2}`).join(',');
      const q = `SELECT phone FROM department_head_leads WHERE created_by = $1 AND phone IN (${placeholdersPhones})`;
      const res = await DepartmentHeadLead.query(q, [createdBy, ...phones]);
      existingPhoneSet = new Set((res.rows || []).map(r => (r.phone || '').toString().trim()));
    }

    const filteredRows = rows.filter(r => {
      const name = (r.customer || '').toString().trim();
      const p = (r.phone || '').toString().trim();
      // Skip rows that are effectively empty (no name and no phone)
      if (name.length === 0 && p.length === 0) return false;
      // If phone exists, drop duplicates for this creator
      if (p.length > 0 && existingPhoneSet.has(p)) return false;
      return true;
    });
    if (filteredRows.length === 0) {
      const duplicatesCount = rows.filter(r => {
        const p = (r.phone || '').toString().trim();
        return p.length > 0 && existingPhoneSet.has(p);
      }).length;
      return { rowCount: 0, rows: [], duplicatesCount };
    }
    let i = 1;
    const placeholders = filteredRows.map(() =>
      `($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},NOW(),NOW())`
    ).join(',');

    const query = `
      INSERT INTO department_head_leads (
        customer_id, customer, email, business, lead_source, product_names, category,
        sales_status, created, telecaller_status, payment_status,
        phone, address, gst_no, state, customer_type, date,
        whatsapp, assigned_salesperson, assigned_telecaller,
        created_by, created_at, updated_at
      ) VALUES ${placeholders}
      RETURNING id
    `;

    const values = filteredRows.flatMap((r) => [
      r.customerId || this.generateCustomerId(),
      r.customer || null,
      r.email || null,
      r.business || null,
      r.leadSource || null,
      r.productNames || r.productNamesText || 'N/A',
      r.category || 'N/A',
      r.salesStatus || 'PENDING',
      r.createdAt || null,
      r.telecallerStatus || 'INACTIVE',
      r.paymentStatus || 'PENDING',
      r.phone || null,
      r.address || null,
      (r.gstNo === undefined || r.gstNo === null || String(r.gstNo).trim() === '' ? 'N/A' : r.gstNo),
      r.state || null,
      r.customerType || null,
      r.date || null,
      r.whatsapp || null,
      r.assignedSalesperson || null,
      r.assignedTelecaller || null,
      createdBy
    ]);
    const insertResult = await DepartmentHeadLead.query(query, values);
    const duplicatesCount = rows.length - filteredRows.length;
    return { rowCount: insertResult.rowCount, rows: insertResult.rows, duplicatesCount };
  }

  async getAll(filters = {}, pagination = {}) {
    let query = `
      SELECT 
        dhl.id, dhl.customer_id, dhl.customer, dhl.email, dhl.business, dhl.lead_source, dhl.product_names, dhl.category,
        dhl.sales_status, dhl.created, dhl.telecaller_status, dhl.payment_status,
        dhl.phone, dhl.address, dhl.gst_no, dhl.state, dhl.customer_type, dhl.date,
        dhl.whatsapp, dhl.assigned_salesperson, dhl.assigned_telecaller,
        dhl.created_by, dhl.created_at, dhl.updated_at,
        sl.follow_up_status AS follow_up_status,
        sl.follow_up_remark AS follow_up_remark,
        sl.sales_status_remark AS sales_status_remark
      FROM department_head_leads dhl
      LEFT JOIN salesperson_leads sl ON sl.id = dhl.id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
    `;
    
    const conditions = [];
    const values = [];
    let paramCount = 1;

    // STRICT CHECK: Always filter by created_by (email) - mandatory
    if (filters.createdBy) {
      conditions.push(`dhl.created_by = $${paramCount}`);
      values.push(filters.createdBy);
      paramCount++;
    }

    // STRICT CHECK: Filter by department type if provided
    if (filters.departmentType) {
      conditions.push(`dh.department_type = $${paramCount}`);
      values.push(filters.departmentType);
      paramCount++;
    }

    // STRICT CHECK: Filter by company name if provided
    if (filters.companyName) {
      conditions.push(`dh.company_name = $${paramCount}`);
      values.push(filters.companyName);
      paramCount++;
    }

    // Add other filters
    if (filters.search) {
      conditions.push(`(dhl.customer ILIKE $${paramCount} OR dhl.email ILIKE $${paramCount} OR dhl.business ILIKE $${paramCount})`);
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.state) {
      conditions.push(`dhl.state = $${paramCount}`);
      values.push(filters.state);
      paramCount++;
    }

    if (filters.productType) {
      conditions.push(`dhl.product_names = $${paramCount}`);
      values.push(filters.productType);
      paramCount++;
    }

    if (filters.salesStatus) {
      conditions.push(`dhl.sales_status = $${paramCount}`);
      values.push(filters.salesStatus);
      paramCount++;
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ORDER BY (oldest first as requested)
    query += ` ORDER BY dhl.created_at ASC`;

    // Add pagination
    if (pagination.limit) {
      query += ` LIMIT $${paramCount}`;
      values.push(pagination.limit);
      paramCount++;
    }

    if (pagination.offset) {
      query += ` OFFSET $${paramCount}`;
      values.push(pagination.offset);
      paramCount++;
    }

    const result = await DepartmentHeadLead.query(query, values);
    return result.rows || [];
  }

  async getById(id, userEmail = null, departmentType = null, companyName = null) {
    let query = `
      SELECT 
        dhl.id, dhl.customer_id, dhl.customer, dhl.email, dhl.business, dhl.lead_source, dhl.product_names, dhl.category,
        dhl.sales_status, dhl.created, dhl.telecaller_status, dhl.payment_status,
        dhl.phone, dhl.address, dhl.gst_no, dhl.state, dhl.customer_type, dhl.date,
        dhl.whatsapp, dhl.assigned_salesperson, dhl.assigned_telecaller,
        dhl.created_by, dhl.created_at, dhl.updated_at,
        sl.follow_up_status AS follow_up_status,
        sl.follow_up_remark AS follow_up_remark,
        sl.sales_status_remark AS sales_status_remark,
        dh.department_type AS creator_department_type,
        dh.company_name AS creator_company_name
      FROM department_head_leads dhl
      LEFT JOIN salesperson_leads sl ON sl.id = dhl.id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE dhl.id = $1
    `;
    
    const values = [id];
    let paramCount = 2;

    // STRICT CHECK: Verify ownership if user info is provided
    if (userEmail) {
      query += ` AND dhl.created_by = $${paramCount}`;
      values.push(userEmail);
      paramCount++;
    }

    if (departmentType) {
      query += ` AND dh.department_type = $${paramCount}`;
      values.push(departmentType);
      paramCount++;
    }

    if (companyName) {
      query += ` AND dh.company_name = $${paramCount}`;
      values.push(companyName);
      paramCount++;
    }

    const result = await DepartmentHeadLead.query(query, values);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  async updateById(id, updateData, userEmail = null, departmentType = null, companyName = null) {
    const allowedFields = [
      'customer', 'email', 'business', 'leadSource', 'productNames', 'category',
      'salesStatus', 'created', 'telecallerStatus', 'paymentStatus',
      'phone', 'address', 'gstNo', 'state', 'customerType', 'date',
      'whatsapp', 'assignedSalesperson', 'assignedTelecaller'
    ];

    const fieldMap = {
      leadSource: 'lead_source',
      productNames: 'product_names',
      salesStatus: 'sales_status',
      telecallerStatus: 'telecaller_status',
      paymentStatus: 'payment_status',
      gstNo: 'gst_no',
      customerType: 'customer_type',
      assignedSalesperson: 'assigned_salesperson',
      assignedTelecaller: 'assigned_telecaller'
    };

    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach((key) => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        const column = fieldMap[key] || key;
        updates.push(`${column} = $${paramCount++}`);
        values.push(updateData[key]);
      }
    });

    if (updates.length === 0) {
      return { rowCount: 0 };
    }

    // STRICT CHECK: Add ownership verification in WHERE clause
    let query = `
      UPDATE department_head_leads dhl
      SET ${updates.join(', ')}, updated_at = NOW()
      FROM department_heads dh
      WHERE dhl.id = $${paramCount} AND dh.email = dhl.created_by
    `;
    values.push(id);
    paramCount++;

    if (userEmail) {
      query += ` AND dhl.created_by = $${paramCount}`;
      values.push(userEmail);
      paramCount++;
    }

    if (departmentType) {
      query += ` AND dh.department_type = $${paramCount}`;
      values.push(departmentType);
      paramCount++;
    }

    if (companyName) {
      query += ` AND dh.company_name = $${paramCount}`;
      values.push(companyName);
      paramCount++;
    }

    return await DepartmentHeadLead.query(query, values);
  }

  async updateManyForCreator(ids, updateData, createdBy, departmentType = null, companyName = null) {
    if (!Array.isArray(ids) || ids.length === 0) return { rowCount: 0 };
    const allowedFields = [
      'customer', 'email', 'business', 'leadSource', 'productNames', 'category',
      'salesStatus', 'created', 'telecallerStatus', 'paymentStatus',
      'phone', 'address', 'gstNo', 'state', 'customerType', 'date',
      'whatsapp', 'assignedSalesperson', 'assignedTelecaller'
    ];

    const fieldMap = {
      leadSource: 'lead_source',
      productNames: 'product_names',
      salesStatus: 'sales_status',
      telecallerStatus: 'telecaller_status',
      paymentStatus: 'payment_status',
      gstNo: 'gst_no',
      customerType: 'customer_type',
      assignedSalesperson: 'assigned_salesperson',
      assignedTelecaller: 'assigned_telecaller'
    };

    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach((key) => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        const column = fieldMap[key] || key;
        updates.push(`${column} = $${paramCount++}`);
        values.push(updateData[key]);
      }
    });

    if (updates.length === 0) return { rowCount: 0 };

    // Calculate parameter indices correctly
    // paramCount is already at the next available index after updates
    const idStartIdx = paramCount;
    const idPlaceholders = ids.map((_id, idx) => `$${idStartIdx + idx}`).join(',');
    const createdByIdx = idStartIdx + ids.length;
    let nextParamIdx = createdByIdx + 1;

    // STRICT CHECK: Add department and company verification via JOIN
    let query = `
      UPDATE department_head_leads dhl
      SET ${updates.join(', ')}, updated_at = NOW()
      FROM department_heads dh
      WHERE dhl.id IN (${idPlaceholders}) 
        AND dhl.created_by = $${createdByIdx}
        AND dh.email = dhl.created_by
    `;
    
    // Push ids and createdBy first
    values.push(...ids, createdBy);

    // Add department type check if provided
    if (departmentType) {
      query += ` AND dh.department_type = $${nextParamIdx}`;
      values.push(departmentType);
      nextParamIdx++;
    }

    // Add company name check if provided
    if (companyName) {
      query += ` AND dh.company_name = $${nextParamIdx}`;
      values.push(companyName);
    }

    return await DepartmentHeadLead.query(query, values);
  }

  async getStats(createdBy, departmentType = null, companyName = null) {
    let query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN dhl.sales_status = 'PENDING' THEN 1 END) as pending,
        COUNT(CASE WHEN dhl.sales_status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN dhl.sales_status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN dhl.telecaller_status = 'ACTIVE' THEN 1 END) as active_telecallers,
        COUNT(CASE WHEN dhl.telecaller_status = 'INACTIVE' THEN 1 END) as inactive_telecallers,
        COUNT(CASE WHEN dhl.payment_status = 'PENDING' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN dhl.payment_status = 'IN_PROGRESS' THEN 1 END) as in_progress_payments,
        COUNT(CASE WHEN dhl.payment_status = 'COMPLETED' THEN 1 END) as completed_payments
      FROM department_head_leads dhl
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE dhl.created_by = $1
    `;
    
    const values = [createdBy];
    let paramCount = 2;

    // STRICT CHECK: Add department and company filters
    if (departmentType) {
      query += ` AND dh.department_type = $${paramCount}`;
      values.push(departmentType);
      paramCount++;
    }

    if (companyName) {
      query += ` AND dh.company_name = $${paramCount}`;
      values.push(companyName);
    }

    const result = await DepartmentHeadLead.query(query, values);
    return result.rows && result.rows[0] ? result.rows[0] : {
      total: 0,
      pending: 0,
      in_progress: 0,
      completed: 0,
      active_telecallers: 0,
      inactive_telecallers: 0,
      pending_payments: 0,
      in_progress_payments: 0,
      completed_payments: 0
    };
  }
}

module.exports = new DepartmentHeadLead();


