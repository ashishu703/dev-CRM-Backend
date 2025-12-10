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

  async listForUser(username, departmentType = null, companyName = null) {
    const conditions = [];
    const values = [username];
    let paramCount = 2;
    
    conditions.push(`COALESCE(TRIM(LOWER(dhl.assigned_salesperson)), '') = TRIM(LOWER($1))`);
    
    if (departmentType) {
      conditions.push(`dh.department_type = $${paramCount}`);
      values.push(departmentType);
      paramCount++;
    }
    
    if (companyName) {
      conditions.push(`dh.company_name = $${paramCount}`);
      values.push(companyName);
      paramCount++;
    }
    
    const query = `
      SELECT sl.*
      FROM salesperson_leads sl
      JOIN department_head_leads dhl ON dhl.id = sl.dh_lead_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY sl.id ASC
    `;
    
    const result = await SalespersonLead.query(query, values);
    return result.rows || [];
  }

  /**
   * Get paginated leads with document status info (quotations and PIs counts)
   * OPTIMIZED: Uses bulk queries instead of N+1 pattern
   */
  async listForUserWithDocStatus(username, departmentType = null, companyName = null, page = 1, limit = 20) {
    const conditions = [];
    const values = [username];
    let paramCount = 2;
    
    conditions.push(`COALESCE(TRIM(LOWER(dhl.assigned_salesperson)), '') = TRIM(LOWER($1))`);
    
    if (departmentType) {
      conditions.push(`dh.department_type = $${paramCount}`);
      values.push(departmentType);
      paramCount++;
    }
    
    if (companyName) {
      conditions.push(`dh.company_name = $${paramCount}`);
      values.push(companyName);
      paramCount++;
    }
    
    // Get total count first
    const countQuery = `
      SELECT COUNT(*) as total
      FROM salesperson_leads sl
      JOIN department_head_leads dhl ON dhl.id = sl.dh_lead_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE ${conditions.join(' AND ')}
    `;
    const countResult = await SalespersonLead.query(countQuery, values);
    const total = parseInt(countResult.rows[0]?.total || 0);
    
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
    values.push(limit, offset);
    
    const result = await SalespersonLead.query(query, values);
    const leads = result.rows || [];
    
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

  async getByIdForUser(id, username, departmentType = null, companyName = null) {
    const conditions = [];
    const values = [id, username];
    let paramCount = 3;
    
    // Check if lead is assigned to the user
    conditions.push(`COALESCE(TRIM(LOWER(dhl.assigned_salesperson)), '') = TRIM(LOWER($2))`);
    
    if (departmentType) {
      conditions.push(`dh.department_type = $${paramCount}`);
      values.push(departmentType);
      paramCount++;
    }
    
    if (companyName) {
      conditions.push(`dh.company_name = $${paramCount}`);
      values.push(companyName);
      paramCount++;
    }
    
    const query = `
      SELECT sl.*
      FROM salesperson_leads sl
      JOIN department_head_leads dhl ON dhl.id = sl.dh_lead_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE sl.id = $1 AND ${conditions.join(' AND ')}
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


