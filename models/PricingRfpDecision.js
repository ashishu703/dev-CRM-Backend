const BaseModel = require('./BaseModel');

class PricingRfpDecision extends BaseModel {
  constructor() {
    super('pricing_rfp_decisions');
  }

  async generateRfpId(salespersonId) {
    const prefix = 'RFP';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the last sequence number for this month
    const queryText = `
      SELECT rfp_id 
      FROM pricing_rfp_decisions 
      WHERE rfp_id LIKE $1 
      ORDER BY rfp_id DESC 
      LIMIT 1
    `;
    const pattern = `${prefix}-${year}${month}-%`;
    const result = await PricingRfpDecision.query(queryText, [pattern]);
    
    let nextSeq = 1;
    if (result.rows.length > 0) {
      const lastId = result.rows[0].rfp_id;
      const seqMatch = lastId.match(/-(\d+)$/);
      if (seqMatch) {
        nextSeq = parseInt(seqMatch[1]) + 1;
      }
    }
    
    return `${prefix}-${year}${month}-${String(nextSeq).padStart(4, '0')}`;
  }

  async createDecision(data) {
    const {
      leadId,
      salespersonId,
      createdBy,
      departmentType,
      companyName,
      products,
      deliveryTimeline,
      specialRequirements
    } = data;

    const rfpId = await this.generateRfpId(salespersonId);

    const queryText = `
      INSERT INTO pricing_rfp_decisions (
        rfp_id, lead_id, salesperson_id, created_by, department_type, company_name,
        products, delivery_timeline, special_requirements, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'saved')
      RETURNING *
    `;
    const values = [
      rfpId,
      leadId,
      salespersonId || null,
      createdBy,
      departmentType || null,
      companyName || null,
      JSON.stringify(products),
      deliveryTimeline || null,
      specialRequirements || null
    ];
    const result = await PricingRfpDecision.query(queryText, values);
    return result.rows[0];
  }

  async getByRfpId(rfpId) {
    const queryText = `
      SELECT * FROM pricing_rfp_decisions WHERE rfp_id = $1
    `;
    const result = await PricingRfpDecision.query(queryText, [rfpId]);
    return result.rows[0] || null;
  }

  async getByLeadId(leadId) {
    const queryText = `
      SELECT * FROM pricing_rfp_decisions WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1
    `;
    const result = await PricingRfpDecision.query(queryText, [leadId]);
    return result.rows[0] || null;
  }

  async updateDecision(rfpId, data) {
    const {
      products,
      deliveryTimeline,
      specialRequirements,
      status
    } = data;

    const queryText = `
      UPDATE pricing_rfp_decisions 
      SET products = COALESCE($1, products),
          delivery_timeline = COALESCE($2, delivery_timeline),
          special_requirements = COALESCE($3, special_requirements),
          status = COALESCE($4, status),
          updated_at = NOW()
      WHERE rfp_id = $5
      RETURNING *
    `;
    const values = [
      products ? JSON.stringify(products) : null,
      deliveryTimeline || null,
      specialRequirements || null,
      status || null,
      rfpId
    ];
    const result = await PricingRfpDecision.query(queryText, values);
    return result.rows[0] || null;
  }

  async markRfpCreated(rfpId) {
    const queryText = `
      UPDATE pricing_rfp_decisions 
      SET rfp_created = TRUE, status = 'rfp_created', updated_at = NOW()
      WHERE rfp_id = $1
      RETURNING *
    `;
    const result = await PricingRfpDecision.query(queryText, [rfpId]);
    return result.rows[0] || null;
  }
}

module.exports = new PricingRfpDecision();
