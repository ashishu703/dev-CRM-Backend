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
      products, // Array of products
      deliveryTimeline,
      specialRequirements,
      masterRfpId,
      pricingDecisionRfpId, // Link to pricing decision if RFP is raised from pricing decision section
      source,
      sourcePayload
    } = data;

    // Create ONE RFP request (parent record)
    const queryText = `
      INSERT INTO rfp_requests (
        lead_id, salesperson_id, created_by, department_type, company_name,
        delivery_timeline, special_requirements, status, master_rfp_id, pricing_decision_rfp_id,
        source, source_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_dh', $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      leadId,
      salespersonId || null,
      createdBy,
      departmentType || null,
      companyName || null,
      deliveryTimeline || null,
      specialRequirements || null,
      masterRfpId || null,
      pricingDecisionRfpId || null,
      source || null,
      sourcePayload ? JSON.stringify(sourcePayload) : null
    ];
    const result = await RfpRequest.query(queryText, values);
    const rfpRequest = result.rows[0];

    // Create child product records if products array is provided
    if (products && Array.isArray(products) && products.length > 0) {
      // Insert products one by one (simpler and more reliable)
      for (const product of products) {
        const productQuery = `
          INSERT INTO rfp_request_products (
            rfp_request_id, product_spec, quantity, length, length_unit, target_price, availability_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        await RfpRequest.query(productQuery, [
          rfpRequest.id,
          product.productSpec || '',
          product.quantity || 0,
          product.length || null,
          product.lengthUnit || 'Mtr',
          product.targetPrice ? parseFloat(product.targetPrice) : null,
          product.availabilityStatus || null
        ]);
      }
    }

    return rfpRequest;
  }

  async getById(id) {
    // Get RFP request with products (child records)
    const queryText = `
      SELECT r.*, dhl.customer as customer_name, dhl.business as customer_business,
             dhl.phone as customer_phone, dhl.email as customer_email
      FROM rfp_requests r
      LEFT JOIN department_head_leads dhl ON dhl.id = r.lead_id
      WHERE r.id = $1
    `;
    const result = await RfpRequest.query(queryText, [id]);
    const rfp = result.rows[0] || null;
    
    if (rfp) {
      // Get products for this RFP
      const productsQuery = `
        SELECT id, product_spec, quantity, length, length_unit, target_price, availability_status
        FROM rfp_request_products
        WHERE rfp_request_id = $1
        ORDER BY id ASC
      `;
      const productsResult = await RfpRequest.query(productsQuery, [id]);
      rfp.products = productsResult.rows || [];
    }
    
    return rfp;
  }

  async getByRfpId(rfpId) {
    const queryText = `
      SELECT r.*, dhl.customer as customer_name, dhl.business as customer_business,
             dhl.phone as customer_phone, dhl.email as customer_email
      FROM rfp_requests r
      LEFT JOIN department_head_leads dhl ON dhl.id = r.lead_id
      WHERE r.rfp_id = $1
    `;
    const result = await RfpRequest.query(queryText, [rfpId]);
    const rfp = result.rows[0] || null;
    
    if (rfp) {
      // Get products for this RFP
      const productsQuery = `
        SELECT id, product_spec, quantity, length, length_unit, target_price, availability_status
        FROM rfp_request_products
        WHERE rfp_request_id = $1
        ORDER BY id ASC
      `;
      const productsResult = await RfpRequest.query(productsQuery, [rfp.id]);
      rfp.products = productsResult.rows || [];
    }
    
    return rfp;
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

    if (filters.salespersonId) {
      queryText += ` AND r.salesperson_id = $${paramCount++}`;
      values.push(filters.salespersonId);
    }

    if (filters.status) {
      queryText += ` AND r.status = $${paramCount++}`;
      values.push(filters.status);
    }

    if (filters.createdBy) {
      // Use case-insensitive comparison to handle email case variations
      queryText += ` AND LOWER(TRIM(r.created_by)) = LOWER(TRIM($${paramCount++}))`;
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
        dhl.customer ILIKE $${paramCount} OR
        EXISTS (
          SELECT 1 FROM rfp_request_products rp 
          WHERE rp.rfp_request_id = r.id 
          AND rp.product_spec ILIKE $${paramCount}
        )
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
    const rfps = result.rows || [];

    // Fetch products for each RFP
    if (rfps.length > 0) {
      const rfpIds = rfps.map(r => r.id);
      const productsQuery = `
        SELECT rfp_request_id, id, product_spec, quantity, length, length_unit, target_price, availability_status
        FROM rfp_request_products
        WHERE rfp_request_id = ANY($1)
        ORDER BY rfp_request_id, id ASC
      `;
      const productsResult = await RfpRequest.query(productsQuery, [rfpIds]);
      
      // Group products by rfp_request_id
      const productsByRfp = {};
      productsResult.rows.forEach(product => {
        if (!productsByRfp[product.rfp_request_id]) {
          productsByRfp[product.rfp_request_id] = [];
        }
        productsByRfp[product.rfp_request_id].push(product);
      });

      // Attach products to each RFP
      rfps.forEach(rfp => {
        rfp.products = productsByRfp[rfp.id] || [];
      });
    }

    return rfps;
  }

  async approve(id, approverEmail, salespersonId, options = {}) {
    // Algorithm-based validation: Get and validate RFP
    const current = await this.getById(id);
    const calculatorTotalPrice = options.calculatorTotalPrice ?? null;
    const calculatorDetail = options.calculatorDetail || null;
    const { validateRfpApproval } = require('../utils/rfpHelpers');
    const validation = validateRfpApproval(current);
    
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const PricingRfpDecision = require('./PricingRfpDecision');
    const { transformProductsForPricingDecision } = require('../utils/rfpHelpers');
    
    // ALWAYS generate new RFP ID on approval (one lead can have multiple RFP IDs)
    const rfpId = await PricingRfpDecision.generateRfpId(salespersonId);
    
    // Algorithm-based transformation: Convert products from child table to pricing decision format
    const products = transformProductsForPricingDecision(current.products);
    
    // Create ONE pricing decision with ALL products from this RFP
    const decision = await PricingRfpDecision.createDecision({
      leadId: current.lead_id,
      salespersonId: salespersonId || current.salesperson_id,
      createdBy: current.created_by,
      departmentType: current.department_type,
      companyName: current.company_name,
      products: products,
      deliveryTimeline: current.delivery_timeline,
      specialRequirements: current.special_requirements
    });
    
    // Update status to 'approved' after creation
    await PricingRfpDecision.updateDecision(rfpId, { status: 'approved' });

    // Update this RFP request with RFP ID
    const updateQuery = `
      UPDATE rfp_requests
      SET status = 'approved',
          rfp_id = $1,
          master_rfp_id = $1,
          approved_by = $2,
          approved_at = NOW(),
          calculator_total_price = $4,
          calculator_pricing_log = $5,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await RfpRequest.query(updateQuery, [
      rfpId,
      approverEmail,
      id,
      calculatorTotalPrice,
      calculatorDetail ? JSON.stringify(calculatorDetail) : null
    ]);
    
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
