const BaseModel = require('./BaseModel');

class SalespersonLead extends BaseModel {
  constructor() {
    super('salesperson_leads');
  }

  /**
   * Upsert by id, enforcing salesperson_leads.id equals department_head_leads.id
   */
  async upsertById(payload) {
    const {
      id,
      dh_lead_id,
      name,
      phone,
      email,
      business,
      address,
      gst_no,
      product_type,
      state,
      lead_source,
      customer_type,
      date,
      sales_status,
      whatsapp,
      created_by,
    } = payload;

    const query = `
      INSERT INTO salesperson_leads (
        id, dh_lead_id, name, phone, email, business, address, gst_no, product_type,
        state, lead_source, customer_type, date, sales_status, whatsapp,
        created_by, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        dh_lead_id = EXCLUDED.dh_lead_id,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        business = EXCLUDED.business,
        address = EXCLUDED.address,
        gst_no = EXCLUDED.gst_no,
        product_type = EXCLUDED.product_type,
        state = EXCLUDED.state,
        lead_source = EXCLUDED.lead_source,
        customer_type = EXCLUDED.customer_type,
        date = EXCLUDED.date,
        sales_status = EXCLUDED.sales_status,
        whatsapp = EXCLUDED.whatsapp,
        updated_at = NOW()
    `;

    const values = [
      id,
      dh_lead_id,
      name,
      phone,
      email,
      business,
      address,
      gst_no,
      product_type,
      state,
      lead_source,
      customer_type,
      date,
      sales_status,
      whatsapp,
      created_by,
    ];

    return await SalespersonLead.query(query, values);
  }

  /**
   * Build matching conditions for assigned_salesperson field
   * Matches against username (primary) and email (fallback)
   * @private
   */
  _buildAssignmentMatchConditions(username, userEmail, paramStart) {
    const conditions = [];
    const values = [];
    let paramCount = paramStart;
    
    const usernameLower = username ? username.toLowerCase().trim() : '';
    const emailLower = userEmail ? userEmail.toLowerCase().trim() : '';
    const emailLocal = emailLower.includes('@') ? emailLower.split('@')[0] : emailLower;
    
    if (usernameLower) {
      conditions.push(`TRIM(LOWER(COALESCE(dhl.assigned_salesperson, ''))) = $${paramCount}`);
      values.push(usernameLower);
      paramCount++;
    }
    
    if (emailLower && emailLower !== usernameLower) {
      conditions.push(`TRIM(LOWER(COALESCE(dhl.assigned_salesperson, ''))) = $${paramCount}`);
      values.push(emailLower);
      paramCount++;
    }
    
    if (emailLocal && emailLocal !== emailLower && emailLocal !== usernameLower) {
      conditions.push(`TRIM(LOWER(COALESCE(dhl.assigned_salesperson, ''))) = $${paramCount}`);
      values.push(emailLocal);
      paramCount++;
    }
    
    return { conditions, values, nextParam: paramCount };
  }

  async listForUser(username, departmentType = null, companyName = null, userEmail = null) {
    if (!username && !userEmail) {
      console.warn('[SalespersonLead.listForUser] No username or email provided, returning empty');
      return [];
    }
    
    // DEBUG: Check what values are actually stored in assigned_salesperson (for troubleshooting)
    const debugValues = [];
    let debugParamCount = 1;
    const debugConditions = ["COALESCE(dhl.assigned_salesperson, '') != ''"];
    
    // STRICT: Always filter by department and company for security
    if (departmentType) {
      debugConditions.push(`dh.department_type = $${debugParamCount}`);
      debugValues.push(departmentType);
      debugParamCount++;
    } else {
      console.warn('[SalespersonLead.listForUser] WARNING: No departmentType provided - security risk!');
    }
    
    if (companyName) {
      debugConditions.push(`dh.company_name = $${debugParamCount}`);
      debugValues.push(companyName);
      debugParamCount++;
    } else {
      console.warn('[SalespersonLead.listForUser] WARNING: No companyName provided - security risk!');
    }
    
    const debugQuery = `
      SELECT DISTINCT 
        TRIM(LOWER(COALESCE(dhl.assigned_salesperson, ''))) as assigned_value,
        COUNT(*) as lead_count
      FROM department_head_leads dhl
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE ${debugConditions.join(' AND ')}
      GROUP BY TRIM(LOWER(COALESCE(dhl.assigned_salesperson, '')))
      ORDER BY lead_count DESC
      LIMIT 10
    `;
    try {
      const debugResult = await SalespersonLead.query(debugQuery, debugValues);
      console.log('[SalespersonLead.listForUser] Sample assigned_salesperson values in DB:', JSON.stringify(debugResult.rows, null, 2));
    } catch (err) {
      console.error('[SalespersonLead.listForUser] Error checking DB values:', err.message);
    }
    
    const conditions = [];
    const values = [];
    let paramCount = 1;
    
    const matchResult = this._buildAssignmentMatchConditions(username, userEmail, paramCount);
    if (matchResult.conditions.length === 0) {
      console.warn('[SalespersonLead.listForUser] No valid matching conditions, returning empty');
      return [];
    }
    
    // Log what we're trying to match
    console.log(`[SalespersonLead.listForUser] Trying to match against:`, {
      username: username ? username.toLowerCase().trim() : null,
      email: userEmail ? userEmail.toLowerCase().trim() : null,
      emailLocal: userEmail ? userEmail.toLowerCase().trim().split('@')[0] : null,
      matchValues: matchResult.values
    });
    
    // Assignment matching: must match user AND not be empty
    conditions.push(`(${matchResult.conditions.join(' OR ')})`);
    conditions.push(`COALESCE(dhl.assigned_salesperson, '') != ''`);
    values.push(...matchResult.values);
    paramCount = matchResult.nextParam;
    
    // STRICT: Department filtering is mandatory for security
    if (departmentType) {
      conditions.push(`dh.department_type = $${paramCount}`);
      values.push(departmentType);
      paramCount++;
    } else {
      console.error('[SalespersonLead.listForUser] SECURITY ERROR: departmentType is required but not provided!');
      return [];
    }
    
    // STRICT: Company filtering is mandatory for security
    if (companyName) {
      conditions.push(`dh.company_name = $${paramCount}`);
      values.push(companyName);
      paramCount++;
    } else {
      console.error('[SalespersonLead.listForUser] SECURITY ERROR: companyName is required but not provided!');
      return [];
    }
    
    const query = `
      SELECT sl.*
      FROM salesperson_leads sl
      JOIN department_head_leads dhl ON dhl.id = sl.dh_lead_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY sl.id ASC
    `;
    
    // Debug logging
    console.log(`[SalespersonLead.listForUser] Query for username: ${username}, email: ${userEmail}, dept: ${departmentType}, company: ${companyName}`);
    console.log(`[SalespersonLead.listForUser] Query: ${query.replace(/\$\d+/g, '?')}`);
    console.log(`[SalespersonLead.listForUser] Values:`, values);
    
    const result = await SalespersonLead.query(query, values);
    const rowCount = result.rows?.length || 0;
    console.log(`[SalespersonLead.listForUser] Found ${rowCount} leads for user`);
    
    // DEBUG: Check a sample of what was actually matched (only in development, not dummy data)
    if (process.env.NODE_ENV === 'development' && rowCount > 0 && result.rows.length > 0) {
      const sampleLeadIds = result.rows.slice(0, 3).map(r => r.id);
      const sampleQuery = `
        SELECT 
          dhl.id,
          dhl.assigned_salesperson,
          TRIM(LOWER(COALESCE(dhl.assigned_salesperson, ''))) as assigned_normalized
        FROM department_head_leads dhl
        WHERE dhl.id = ANY($1)
      `;
      try {
        const sampleResult = await SalespersonLead.query(sampleQuery, [sampleLeadIds]);
        console.log('[SalespersonLead.listForUser] DEBUG: Sample matched leads (first 3) - these are REAL leads, not dummy:', sampleResult.rows);
      } catch (err) {
        console.error('[SalespersonLead.listForUser] Error checking sample leads:', err.message);
      }
    }
    
    return result.rows || [];
  }

  /**
   * Get paginated leads with document status info (quotations and PIs counts)
   * OPTIMIZED: Uses bulk queries instead of N+1 pattern
   */
  async listForUserWithDocStatus(username, departmentType = null, companyName = null, page = 1, limit = 20, userEmail = null) {
    if (!username && !userEmail) {
      console.warn('[SalespersonLead.listForUserWithDocStatus] No username or email provided, returning empty');
      return {
        leads: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
    
    const conditions = [];
    const values = [];
    let paramCount = 1;
    
    // Build assignment matching conditions (DRY principle - reuse helper method)
    const matchResult = this._buildAssignmentMatchConditions(username, userEmail, paramCount);
    if (matchResult.conditions.length === 0) {
      console.warn('[SalespersonLead.listForUserWithDocStatus] No valid matching conditions, returning empty');
      return {
        leads: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
    
    // Assignment matching: must match user AND not be empty
    conditions.push(`(${matchResult.conditions.join(' OR ')})`);
    conditions.push(`COALESCE(dhl.assigned_salesperson, '') != ''`);
    values.push(...matchResult.values);
    paramCount = matchResult.nextParam;
    
    // STRICT: Department filtering is mandatory for security
    if (departmentType) {
      conditions.push(`dh.department_type = $${paramCount}`);
      values.push(departmentType);
      paramCount++;
    } else {
      console.error('[SalespersonLead.listForUserWithDocStatus] SECURITY ERROR: departmentType is required but not provided!');
      return {
        leads: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
    
    // STRICT: Company filtering is mandatory for security
    if (companyName) {
      conditions.push(`dh.company_name = $${paramCount}`);
      values.push(companyName);
      paramCount++;
    } else {
      console.error('[SalespersonLead.listForUserWithDocStatus] SECURITY ERROR: companyName is required but not provided!');
      return {
        leads: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
    
    // Get total count first (using same conditions)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM salesperson_leads sl
      JOIN department_head_leads dhl ON dhl.id = sl.dh_lead_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE ${conditions.join(' AND ')}
    `;
    const countResult = await SalespersonLead.query(countQuery, values);
    const total = parseInt(countResult.rows[0]?.total || 0);
    
    // Debug logging
    console.log(`[SalespersonLead.listForUserWithDocStatus] Query for username: ${username}, email: ${userEmail}, dept: ${departmentType}, company: ${companyName}`);
    console.log(`[SalespersonLead.listForUserWithDocStatus] Total count: ${total}`);
    
    // Get paginated leads
    const offset = (page - 1) * limit;
    const query = `
      SELECT sl.*
      FROM salesperson_leads sl
      JOIN department_head_leads dhl ON dhl.id = sl.dh_lead_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY sl.id ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    const queryValues = [...values, limit, offset];
    
    const result = await SalespersonLead.query(query, queryValues);
    const leads = result.rows || [];
    
    console.log(`[SalespersonLead.listForUserWithDocStatus] Found ${leads.length} leads for page ${page}`);
    
    if (leads.length === 0) {
      return {
        leads: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }
    
    // Get lead IDs for bulk queries
    const leadIds = leads.map(l => l.id);
    
    // OPTIMIZED: Bulk fetch quotations for all leads in one query
    const quotationPlaceholders = leadIds.map((_, idx) => `$${idx + 1}`).join(',');
    const quotationsQuery = `
      SELECT 
        q.customer_id as lead_id,
        q.id,
        q.status,
        q.created_at,
        ROW_NUMBER() OVER (PARTITION BY q.customer_id ORDER BY q.created_at DESC) as rn
      FROM quotations q
      WHERE q.customer_id IN (${quotationPlaceholders})
    `;
    const quotationsResult = await SalespersonLead.query(quotationsQuery, leadIds);
    const allQuotations = quotationsResult.rows || [];
    
    // Get latest quotation per lead and extract quotation IDs
    const latestQuotationsByLead = {};
    const quotationIds = [];
    allQuotations.forEach(q => {
      if (q.rn === 1) {
        latestQuotationsByLead[q.lead_id] = q;
        if (q.id) quotationIds.push(q.id);
      }
    });
    
    // OPTIMIZED: Bulk fetch PIs for all quotations in one query
    let pisByQuotationId = {};
    let allPIs = [];
    if (quotationIds.length > 0) {
      const piPlaceholders = quotationIds.map((_, idx) => `$${idx + 1}`).join(',');
      const pisQuery = `
        SELECT 
          pi.quotation_id,
          pi.id,
          pi.status,
          pi.created_at,
          ROW_NUMBER() OVER (PARTITION BY pi.quotation_id ORDER BY pi.created_at DESC) as rn
        FROM proforma_invoices pi
        WHERE pi.quotation_id IN (${piPlaceholders})
      `;
      const pisResult = await SalespersonLead.query(pisQuery, quotationIds);
      allPIs = pisResult.rows || [];
      
      allPIs.forEach(pi => {
        if (pi.rn === 1) {
          pisByQuotationId[pi.quotation_id] = pi;
        }
      });
    }
    
    // Enrich leads with document status info
    const enrichedLeads = leads.map(lead => {
      const latestQuotation = latestQuotationsByLead[lead.id];
      const latestPI = latestQuotation ? pisByQuotationId[latestQuotation.id] : null;
      
      // Count quotations and PIs for this lead
      const quotationCount = allQuotations.filter(q => q.lead_id === lead.id).length;
      const piCount = latestQuotation 
        ? allPIs.filter(pi => {
            // Find all PIs for quotations of this lead
            const leadQuotations = allQuotations.filter(q => q.lead_id === lead.id);
            return leadQuotations.some(q => pi.quotation_id === q.id);
          }).length
        : 0;
      
      return {
        ...lead,
        // Document status info
        quotation_count: quotationCount,
        latest_quotation_status: latestQuotation ? (latestQuotation.status || '').toLowerCase() : null,
        latest_quotation_id: latestQuotation?.id || null,
        pi_count: piCount,
        latest_pi_status: latestPI ? (latestPI.status || '').toLowerCase() : null,
        latest_pi_id: latestPI?.id || null
      };
    });
    
    return {
      leads: enrichedLeads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getById(id) {
    const result = await SalespersonLead.query('SELECT * FROM salesperson_leads WHERE id = $1', [id]);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  async getByIdForUser(id, username, departmentType = null, companyName = null, userEmail = null) {
    if (!username && !userEmail) {
      console.warn('[SalespersonLead.getByIdForUser] No username or email provided');
      return null;
    }
    
    const conditions = [`sl.id = $1`];
    const values = [id];
    let paramCount = 2;
    
    // Build assignment matching conditions (DRY principle - reuse helper method)
    const matchResult = this._buildAssignmentMatchConditions(username, userEmail, paramCount);
    if (matchResult.conditions.length === 0) {
      console.warn('[SalespersonLead.getByIdForUser] No valid matching conditions');
      return null;
    }
    
    // Assignment matching: must match user AND not be empty
    conditions.push(`(${matchResult.conditions.join(' OR ')})`);
    conditions.push(`COALESCE(dhl.assigned_salesperson, '') != ''`);
    values.push(...matchResult.values);
    paramCount = matchResult.nextParam;
    
    // STRICT: Department filtering is mandatory for security
    if (departmentType) {
      conditions.push(`dh.department_type = $${paramCount}`);
      values.push(departmentType);
      paramCount++;
    } else {
      console.error('[SalespersonLead.getByIdForUser] SECURITY ERROR: departmentType is required but not provided!');
      return null;
    }
    
    // STRICT: Company filtering is mandatory for security
    if (companyName) {
      conditions.push(`dh.company_name = $${paramCount}`);
      values.push(companyName);
      paramCount++;
    } else {
      console.error('[SalespersonLead.getByIdForUser] SECURITY ERROR: companyName is required but not provided!');
      return null;
    }
    
    const query = `
      SELECT sl.*
      FROM salesperson_leads sl
      JOIN department_head_leads dhl ON dhl.id = sl.dh_lead_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE ${conditions.join(' AND ')}
      LIMIT 1
    `;
    
    const result = await SalespersonLead.query(query, values);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  async updateById(id, update) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = [
      'name',
      'phone',
      'email',
      'business',
      'address',
      'gst_no',
      'product_type',
      'state',
      'lead_source',
      'customer_type',
      'date',
      'whatsapp',
      'sales_status',
      'sales_status_remark',
      'follow_up_status',
      'follow_up_remark',
      'follow_up_date',
      'follow_up_time',
      'quotation_url',
      'quotation_count',
      'proforma_invoice_url',
      'payment_status',
      'payment_mode',
      'payment_receipt_url',
      'transferred_to',
      'quotation_verified_status',
      'quotation_verified_by',
      'pi_verification_status',
      'pi_verified_by'
    ];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(update, key)) {
        fields.push(`${key} = $${i++}`);
        values.push(update[key]);
      }
    }

    if (fields.length === 0) return { rowCount: 0 };
    values.push(id);

    const sql = `UPDATE salesperson_leads SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`;
    const result = await SalespersonLead.query(sql, values);
    return { rowCount: result.rowCount, row: result.rows && result.rows[0] };
  }

  async transferLead(id, transferredTo, transferredFrom, reason = '') {
    const query = `
      UPDATE salesperson_leads
      SET 
        transferred_to = $1,
        transferred_from = $2,
        transferred_at = NOW(),
        transfer_reason = $3,
        updated_at = NOW()
      WHERE id = $4
    `;
    const values = [transferredTo, transferredFrom, reason, id];
    return await SalespersonLead.query(query, values);
  }
}

module.exports = new SalespersonLead();


