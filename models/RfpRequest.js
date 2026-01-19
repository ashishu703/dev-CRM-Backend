const BaseModel = require('./BaseModel');

class RfpRequest extends BaseModel {
  constructor() {
    super('rfp_requests');
  }

  async generateRfpId(salespersonId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const keySource = (salespersonId || 'GEN').toString().replace(/-/g, '').slice(-6).toUpperCase();
    const prefix = `RFP-${keySource}-${year}${month}`;
    const queryText = `
      SELECT rfp_id
      FROM rfp_requests
      WHERE rfp_id LIKE $1
      ORDER BY rfp_id DESC
      LIMIT 1
    `;
    const result = await RfpRequest.query(queryText, [`${prefix}-%`]);
    if (!result.rows.length) {
      return `${prefix}-001`;
    }
    const lastId = result.rows[0].rfp_id || '';
    const lastSeq = parseInt(lastId.split('-').pop(), 10) || 0;
    const nextSeq = String(lastSeq + 1).padStart(3, '0');
    return `${prefix}-${nextSeq}`;
  }

  async createRequest(data) {
    const {
      leadId,
      salespersonId,
      createdBy,
      departmentType,
      companyName,
      productSpec,
      quantity,
      deliveryTimeline,
      specialRequirements
    } = data;

    const queryText = `
      INSERT INTO rfp_requests (
        lead_id, salesperson_id, created_by, department_type, company_name,
        product_spec, quantity, delivery_timeline, special_requirements, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_dh')
      RETURNING *
    `;
    const values = [
      leadId,
      salespersonId || null,
      createdBy,
      departmentType || null,
      companyName || null,
      productSpec,
      quantity || 0,
      deliveryTimeline || null,
      specialRequirements || null
    ];
    const result = await RfpRequest.query(queryText, values);
    return result.rows[0];
  }

  async getById(id) {
    const queryText = `
      SELECT r.*, dhl.customer as customer_name, dhl.business as customer_business,
             dhl.phone as customer_phone, dhl.email as customer_email
      FROM rfp_requests r
      LEFT JOIN department_head_leads dhl ON dhl.id = r.lead_id
      WHERE r.id = $1
    `;
    const result = await RfpRequest.query(queryText, [id]);
    return result.rows[0] || null;
  }

  async list(filters = {}, pagination = {}) {
    const values = [];
    let paramCount = 1;
    let queryText = `
      SELECT r.*, dhl.customer as customer_name, dhl.business as customer_business,
             dhl.phone as customer_phone, dhl.email as customer_email
      FROM rfp_requests r
      LEFT JOIN department_head_leads dhl ON dhl.id = r.lead_id
      WHERE 1=1
    `;

    if (filters.status) {
      queryText += ` AND r.status = $${paramCount++}`;
      values.push(filters.status);
    }

    if (filters.createdBy) {
      queryText += ` AND r.created_by = $${paramCount++}`;
      values.push(filters.createdBy);
    }

    if (filters.companyName) {
      queryText += ` AND r.company_name = $${paramCount++}`;
      values.push(filters.companyName);
    }

    if (filters.departmentType) {
      queryText += ` AND r.department_type = $${paramCount++}`;
      values.push(filters.departmentType);
    }

    if (filters.search) {
      queryText += ` AND (
        r.rfp_id ILIKE $${paramCount} OR
        r.product_spec ILIKE $${paramCount} OR
        dhl.customer ILIKE $${paramCount}
      )`;
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    queryText += ` ORDER BY r.created_at DESC`;

    if (pagination.limit) {
      queryText += ` LIMIT $${paramCount++}`;
      values.push(pagination.limit);
      if (pagination.offset) {
        queryText += ` OFFSET $${paramCount++}`;
        values.push(pagination.offset);
      }
    }

    const result = await RfpRequest.query(queryText, values);
    return result.rows || [];
  }

  async approve(id, approverEmail, salespersonId) {
    const rfpId = await this.generateRfpId(salespersonId);
    const queryText = `
      UPDATE rfp_requests
      SET status = 'approved',
          rfp_id = COALESCE(rfp_id, $1),
          approved_by = $2,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await RfpRequest.query(queryText, [rfpId, approverEmail, id]);
    return result.rows[0] || null;
  }

  async reject(id, rejectedBy, reason) {
    const queryText = `
      UPDATE rfp_requests
      SET status = 'rejected',
          rejected_by = $1,
          rejected_at = NOW(),
          rejection_reason = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await RfpRequest.query(queryText, [rejectedBy, reason || null, id]);
    return result.rows[0] || null;
  }

  async addPriceRevision(id, priceData) {
    const {
      rawMaterialPrice,
      processingCost,
      margin,
      validityDate,
      createdBy
    } = priceData;
    const calculatedPrice = Number(rawMaterialPrice || 0)
      + Number(processingCost || 0)
      + Number(margin || 0);

    const insertQuery = `
      INSERT INTO rfp_price_revisions (
        rfp_request_id, raw_material_price, processing_cost, margin, calculated_price,
        validity_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const insertValues = [
      id,
      rawMaterialPrice || 0,
      processingCost || 0,
      margin || 0,
      calculatedPrice,
      validityDate || null,
      createdBy
    ];
    const revisionRes = await RfpRequest.query(insertQuery, insertValues);

    const updateQuery = `
      UPDATE rfp_requests
      SET raw_material_price = $1,
          processing_cost = $2,
          margin = $3,
          calculated_price = $4,
          price_valid_until = $5,
          pricing_updated_by = $6,
          pricing_updated_at = NOW(),
          status = 'pricing_ready',
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;
    const updateValues = [
      rawMaterialPrice || 0,
      processingCost || 0,
      margin || 0,
      calculatedPrice,
      validityDate || null,
      createdBy,
      id
    ];
    const updatedRes = await RfpRequest.query(updateQuery, updateValues);

    return {
      revision: revisionRes.rows[0] || null,
      rfp: updatedRes.rows[0] || null
    };
  }

  async listPriceRevisions(id) {
    const queryText = `
      SELECT * FROM rfp_price_revisions
      WHERE rfp_request_id = $1
      ORDER BY created_at DESC
    `;
    const result = await RfpRequest.query(queryText, [id]);
    return result.rows || [];
  }

  async setQuotationLink(id, quotation) {
    const queryText = `
      UPDATE rfp_requests
      SET quotation_id = $1,
          quotation_number = $2,
          status = 'quotation_created',
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await RfpRequest.query(queryText, [quotation.id, quotation.quotation_number, id]);
    return result.rows[0] || null;
  }

  async submitToAccounts(id, data) {
    const queryText = `
      UPDATE rfp_requests
      SET pi_id = $1,
          payment_id = $2,
          accounts_approval_status = 'pending',
          status = 'accounts_pending',
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await RfpRequest.query(queryText, [data.piId || null, data.paymentId || null, id]);
    return result.rows[0] || null;
  }

  async updateAccountsApproval(id, status, approvedBy, notes) {
    const queryText = `
      UPDATE rfp_requests
      SET accounts_approval_status = $1,
          accounts_approved_by = $2,
          accounts_approved_at = NOW(),
          accounts_notes = $3,
          status = $4,
          senior_approval_status = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const nextStatus = status === 'approved' ? 'accounts_approved' : 'credit_case';
    const seniorStatus = status === 'approved' ? 'not_required' : 'pending';
    const result = await RfpRequest.query(queryText, [
      status,
      approvedBy,
      notes || null,
      nextStatus,
      seniorStatus,
      id
    ]);
    return result.rows[0] || null;
  }

  async updateSeniorApproval(id, status, approvedBy, notes) {
    const queryText = `
      UPDATE rfp_requests
      SET senior_approval_status = $1,
          senior_approved_by = $2,
          senior_approved_at = NOW(),
          senior_notes = $3,
          status = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    const nextStatus = status === 'approved' ? 'senior_approved' : 'senior_rejected';
    const result = await RfpRequest.query(queryText, [
      status,
      approvedBy,
      notes || null,
      nextStatus,
      id
    ]);
    return result.rows[0] || null;
  }

  async setWorkOrderLink(id, workOrder) {
    const queryText = `
      UPDATE rfp_requests
      SET work_order_id = $1,
          work_order_number = $2,
          status = 'sent_to_operations',
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await RfpRequest.query(queryText, [workOrder.id, workOrder.work_order_number, id]);
    return result.rows[0] || null;
  }

  async logAction(rfpRequestId, action, performedBy, performedByRole, notes, metadata) {
    const queryText = `
      INSERT INTO rfp_audit_logs (
        rfp_request_id, action, performed_by, performed_by_role, notes, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const values = [
      rfpRequestId,
      action,
      performedBy,
      performedByRole || null,
      notes || null,
      metadata ? JSON.stringify(metadata) : null
    ];
    await RfpRequest.query(queryText, values);
  }
}

module.exports = new RfpRequest();
