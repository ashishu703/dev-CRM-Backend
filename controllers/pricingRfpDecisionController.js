const PricingRfpDecision = require('../models/PricingRfpDecision');
const { query } = require('../config/database');

const isDepartment = (user, keyword) => {
  const dept = (user?.departmentType || '').toLowerCase();
  return dept.includes(keyword);
};

class PricingRfpDecisionController {
  async create(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user.role !== 'department_user') {
        return res.status(403).json({ success: false, message: 'Only salespersons can create pricing decisions' });
      }

      const { leadId, products, deliveryTimeline, specialRequirements } = req.body;
      
      if (!leadId || !products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ success: false, message: 'leadId and products array are required' });
      }

      // Validate each product has required fields
      for (const product of products) {
        if (!product.productSpec) {
          return res.status(400).json({ success: false, message: 'All products must have productSpec' });
        }
      }

      // Note: Backend doesn't validate stock/price availability here because:
      // - Frontend handles the logic based on conditions:
      //   1. Stock available + Price NOT available → Raise RFP
      //   2. Stock NOT available + Price available → Save directly (this API)
      //   3. Stock available + Price available → Save directly (this API)
      //   4. Custom product → Raise RFP
      //   5. Stock NOT available + Price NOT available → Raise RFP
      // - This API is called only when products can be saved directly (conditions 2 & 3)
      // - For RFP raising, frontend calls rfpService.create() separately

      const decision = await PricingRfpDecision.createDecision({
        leadId,
        salespersonId: req.user.id,
        createdBy: req.user.email,
        departmentType: req.user.departmentType,
        companyName: req.user.companyName,
        products,
        deliveryTimeline,
        specialRequirements
      });

      res.status(201).json({ success: true, data: decision });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create pricing decision', error: error.message });
    }
  }

  async getByLeadId(req, res) {
    try {
      const { leadId } = req.params;
      if (!leadId) {
        return res.status(400).json({ success: false, message: 'leadId is required' });
      }

      const decision = await PricingRfpDecision.getByLeadId(leadId);
      
      if (!decision) {
        return res.status(404).json({ success: false, message: 'Pricing decision not found for this lead' });
      }

      // Parse JSONB products if it's a string
      if (decision.products && typeof decision.products === 'string') {
        decision.products = JSON.parse(decision.products);
      }

      res.json({ success: true, data: decision });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch pricing decision', error: error.message });
    }
  }

  async getByRfpId(req, res) {
    try {
      const { rfpId } = req.params;
      if (!rfpId) {
        return res.status(400).json({ success: false, message: 'rfpId is required' });
      }

      // First check pricing_rfp_decisions
      let decision = await PricingRfpDecision.getByRfpId(rfpId);
      
      // If not found, check rfp_requests (approved RFPs)
      if (!decision) {
        const RfpRequest = require('../models/RfpRequest');
        const rfpRequest = await RfpRequest.getByRfpId(rfpId);
        
        if (rfpRequest && rfpRequest.status === 'approved') {
          // Convert rfp_request to decision format for quotation creation
          decision = {
            rfp_id: rfpRequest.rfp_id,
            lead_id: rfpRequest.lead_id,
            salesperson_id: rfpRequest.salesperson_id,
            created_by: rfpRequest.created_by,
            department_type: rfpRequest.department_type,
            company_name: rfpRequest.company_name,
            products: [{
              productSpec: rfpRequest.product_spec,
              quantity: rfpRequest.quantity || '',
              length: '',
              lengthUnit: 'Mtr',
              targetPrice: ''
            }],
            delivery_timeline: rfpRequest.delivery_timeline,
            special_requirements: rfpRequest.special_requirements,
            status: 'approved',
            rfp_created: false,
            created_at: rfpRequest.created_at,
            updated_at: rfpRequest.updated_at
          };
        }
      }
      
      if (!decision) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }

      // Parse JSONB products if it's a string
      if (decision.products && typeof decision.products === 'string') {
        decision.products = JSON.parse(decision.products);
      }

      res.json({ success: true, data: decision });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch RFP decision', error: error.message });
    }
  }

  async update(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user.role !== 'department_user') {
        return res.status(403).json({ success: false, message: 'Only salespersons can update pricing decisions' });
      }

      const { rfpId } = req.params;
      const { products, deliveryTimeline, specialRequirements } = req.body;

      if (!rfpId) {
        return res.status(400).json({ success: false, message: 'rfpId is required' });
      }

      const decision = await PricingRfpDecision.updateDecision(rfpId, {
        products,
        deliveryTimeline,
        specialRequirements
      });

      if (!decision) {
        return res.status(404).json({ success: false, message: 'RFP decision not found' });
      }

      // Parse JSONB products
      decision.products = typeof decision.products === 'string' 
        ? JSON.parse(decision.products) 
        : decision.products;

      res.json({ success: true, data: decision });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update RFP decision', error: error.message });
    }
  }

  async markRfpCreated(req, res) {
    try {
      const { rfpId } = req.params;
      if (!rfpId) {
        return res.status(400).json({ success: false, message: 'rfpId is required' });
      }

      const decision = await PricingRfpDecision.markRfpCreated(rfpId);
      if (!decision) {
        return res.status(404).json({ success: false, message: 'RFP decision not found' });
      }

      res.json({ success: true, data: decision });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to mark RFP as created', error: error.message });
    }
  }

  async getRecordsByDate(req, res) {
    try {
      const { date, page = 1, limit = 50 } = req.query;
      
      if (!date) {
        return res.status(400).json({ success: false, message: 'Date is required (format: YYYY-MM-DD)' });
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Get RFP records for the specified date
      const queryText = `
        SELECT 
          prd.*,
          dhl.customer as lead_name,
          dhl.business as lead_business,
          dhl.phone as lead_phone,
          dhl.email as lead_email,
          COUNT(DISTINCT rr.id) as rfp_request_count,
          STRING_AGG(DISTINCT rr.status, ', ') as rfp_statuses
        FROM pricing_rfp_decisions prd
        LEFT JOIN department_head_leads dhl ON prd.lead_id = dhl.id
        LEFT JOIN rfp_requests rr ON rr.lead_id = prd.lead_id 
          AND DATE(rr.created_at) = DATE(prd.created_at)
        WHERE DATE(prd.created_at) = $1
        GROUP BY prd.id, dhl.customer, dhl.business, dhl.phone, dhl.email
        ORDER BY prd.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const countQuery = `
        SELECT COUNT(DISTINCT prd.id) as total
        FROM pricing_rfp_decisions prd
        WHERE DATE(prd.created_at) = $1
      `;

      const [recordsResult, countResult] = await Promise.all([
        query(queryText, [date, parseInt(limit), offset]),
        query(countQuery, [date])
      ]);

      const records = recordsResult.rows.map(record => {
        // Parse JSONB products if it's a string
        if (record.products && typeof record.products === 'string') {
          record.products = JSON.parse(record.products);
        }
        return record;
      });

      res.json({
        success: true,
        data: records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0]?.total || 0)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch RFP records', error: error.message });
    }
  }

  async getAllRecords(req, res) {
    try {
      console.log('getAllRecords called - URL:', req.originalUrl, 'Method:', req.method);
      // Get all records - no pagination needed as frontend will handle grouping
      // This includes:
      // 1. Saved decisions (from pricing_rfp_decisions)
      // 2. Approved RFPs (from rfp_requests with status 'approved' - these create pricing_rfp_decisions on approval)
      
      const queryText = `
        SELECT 
          prd.id,
          prd.rfp_id,
          prd.lead_id,
          prd.salesperson_id,
          prd.created_by,
          prd.department_type,
          prd.company_name,
          prd.products,
          prd.delivery_timeline,
          prd.special_requirements,
          prd.status,
          prd.rfp_created,
          prd.created_at,
          prd.updated_at,
          dhl.customer as lead_name,
          dhl.business as lead_business,
          dhl.phone as lead_phone,
          dhl.email as lead_email,
          CASE 
            WHEN prd.status = 'saved' THEN 'saved'
            WHEN prd.status = 'approved' THEN 'approved'
            WHEN prd.status = 'rfp_created' THEN 'generated'
            WHEN prd.status = 'draft' THEN 'saved'
            ELSE 'saved'
          END as record_type
        FROM pricing_rfp_decisions prd
        LEFT JOIN department_head_leads dhl ON prd.lead_id = dhl.id
        ORDER BY prd.created_at DESC
      `;

      const result = await query(queryText, []);

      const records = result.rows.map(record => {
        // Parse JSONB products if it's a string
        if (record.products && typeof record.products === 'string') {
          record.products = JSON.parse(record.products);
        }
        return record;
      });

      res.json({
        success: true,
        data: records,
        pagination: {
          page: 1,
          limit: records.length,
          total: records.length
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch RFP records', error: error.message });
    }
  }
}

module.exports = new PricingRfpDecisionController();
