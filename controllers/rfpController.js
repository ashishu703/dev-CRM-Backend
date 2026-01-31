const RfpRequest = require('../models/RfpRequest');
const Quotation = require('../models/Quotation');
const WorkOrder = require('../models/WorkOrder');
const { query } = require('../config/database');
const { validateRfpCreateRequest, validateRfpPermission } = require('../utils/rfpValidation');

const normalizeDept = (value) => (value || '').toString().toLowerCase();
const isDepartment = (user, keyword) => normalizeDept(user?.departmentType).includes(keyword);

class RfpController {
  async create(req, res) {
    try {
      // Algorithm-based permission validation
      const permissionCheck = validateRfpPermission(req.user, 'create');
      if (!permissionCheck.allowed) {
        return res.status(403).json({ success: false, message: permissionCheck.error });
      }

      // Algorithm-based request validation
      const validation = validateRfpCreateRequest(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ 
          success: false, 
          message: validation.error,
          field: validation.field
        });
      }

      // Extract request data
      const { leadId, products, deliveryTimeline, specialRequirements, pricingDecisionRfpId, source, sourcePayload } = req.body;
      const { productSpec, quantity, availabilityStatus, masterRfpId } = req.body; // Backward compatibility

      // Check if there's a pricing decision for this lead (if not explicitly provided)
      let pricingDecisionId = pricingDecisionRfpId;
      if (!pricingDecisionId) {
        const PricingRfpDecision = require('../models/PricingRfpDecision');
        const pricingDecision = await PricingRfpDecision.getByLeadId(leadId);
        if (pricingDecision && pricingDecision.rfp_id) {
          pricingDecisionId = pricingDecision.rfp_id;
        }
      }

      // Algorithm-based processing: Handle new format (products array) or old format (productSpec)
      if (products !== undefined && products !== null && Array.isArray(products) && products.length > 0) {
        // New format: products array (preferred)
        // Create ONE RFP with multiple products
        // Store all details from pricing decision section: products, delivery timeline, special requirements
        const rfp = await RfpRequest.createRequest({
          leadId,
          salespersonId: req.user.id,
          createdBy: req.user.email,
          departmentType: req.user.departmentType,
          companyName: req.user.companyName,
          products: products, // All product details stored in rfp_request_products table
          deliveryTimeline, // Delivery timeline stored
          specialRequirements, // Special requirements stored
          masterRfpId: masterRfpId || pricingDecisionId, // Link to master RFP or pricing decision
          pricingDecisionRfpId: pricingDecisionId, // Link to pricing decision if exists
          source: source || 'pricing_rfp_decision',
          sourcePayload: sourcePayload || null
        });

        await RfpRequest.logAction(rfp.id, 'rfp_created', req.user.email, req.user.role, null, {
          productCount: products.length,
          products: products.map(p => ({ productSpec: p.productSpec, quantity: p.quantity })),
          pricingDecisionRfpId: pricingDecisionId || null,
          raisedFromPricingDecision: !!pricingDecisionId
        });

        // Return RFP with products
        const rfpWithProducts = await RfpRequest.getById(rfp.id);
        
        // (debug log removed) avoid noisy console logs in server
        
        res.status(201).json({ success: true, data: rfpWithProducts });
      } 
      // Backward compatibility: Old single product format
      else if (productSpec) {
        if (!availabilityStatus) {
          return res.status(400).json({ success: false, message: 'availabilityStatus is required' });
        }
        
        if (availabilityStatus === 'in_stock') {
          return res.status(409).json({ success: false, message: 'Product in stock with pricing. Use direct quotation workflow.' });
        }

        // Convert single product to array format for new structure
        // Store all details from pricing decision section
        const rfp = await RfpRequest.createRequest({
          leadId,
          salespersonId: req.user.id,
          createdBy: req.user.email,
          departmentType: req.user.departmentType,
          companyName: req.user.companyName,
          products: [{
            productSpec,
            quantity: quantity || 0,
            length: '',
            lengthUnit: 'Mtr',
            availabilityStatus
          }],
          deliveryTimeline, // Delivery timeline stored
          specialRequirements, // Special requirements stored
          masterRfpId: masterRfpId || pricingDecisionId, // Link to master RFP or pricing decision
          pricingDecisionRfpId: pricingDecisionId // Link to pricing decision if exists
        });

        await RfpRequest.logAction(rfp.id, 'rfp_created', req.user.email, req.user.role, null, {
          productSpec,
          quantity,
          availabilityStatus
        });

        const rfpWithProducts = await RfpRequest.getById(rfp.id);
        res.status(201).json({ success: true, data: rfpWithProducts });
      } else {
        // This should not happen due to validation, but kept for safety
        return res.status(400).json({ 
          success: false, 
          message: 'Either products array or productSpec is required'
        });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create RFP', error: error.message });
    }
  }

  async list(req, res) {
    try {
      const { status, search, page = 1, limit = 50 } = req.query;
      const filters = {};
      // Frontend might accidentally send "undefined" as a string via query params.
      const normalizedStatus = (status === 'undefined' || status === 'null') ? undefined : status;
      const normalizedSearch = (search === 'undefined' || search === 'null') ? undefined : search;
      if (normalizedStatus) filters.status = normalizedStatus;
      if (normalizedSearch) filters.search = normalizedSearch;

      if (req.user?.role === 'superadmin') {
        // no extra filters
      } else if (isDepartment(req.user, 'sales')) {
        if (req.user.role === 'department_head') {
          filters.departmentType = req.user.departmentType;
          if (req.user.companyName) filters.companyName = req.user.companyName;
        } else {
          // For salesperson view: filter by salesperson_id (more reliable than created_by/email)
          filters.salespersonId = req.user.id;
        }
      } else if (req.user?.companyName) {
        filters.companyName = req.user.companyName;
      }

      const pagination = {
        limit: Math.min(parseInt(limit, 10), 200),
        offset: (parseInt(page, 10) - 1) * Math.min(parseInt(limit, 10), 200)
      };

      const data = await RfpRequest.list(filters, pagination);
      
      // (debug log removed) avoid noisy console logs in server
      
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch RFPs', error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const rfp = await RfpRequest.getById(id);
      if (!rfp) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }

      const prices = await RfpRequest.listPriceRevisions(id);
      const logsRes = await query(
        'SELECT * FROM rfp_audit_logs WHERE rfp_request_id = $1 ORDER BY created_at ASC',
        [id]
      );

      res.json({ success: true, data: { rfp, prices, auditLogs: logsRes.rows || [] } });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch RFP', error: error.message });
    }
  }

  async approve(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user.role !== 'department_head') {
        return res.status(403).json({ success: false, message: 'Only Sales DH can approve RFP' });
      }

      const { id } = req.params;
      const { calculatorTotalPrice, calculatorDetail } = req.body || {};
      const current = await RfpRequest.getById(id);
      if (!current) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }

      const rfp = await RfpRequest.approve(id, req.user.email, current.salesperson_id, {
        calculatorTotalPrice,
        calculatorDetail
      });
      await RfpRequest.logAction(rfp.id, 'rfp_approved', req.user.email, req.user.role, null, {
        rfpId: rfp.rfp_id,
        calculator: calculatorDetail || null
      });
      res.json({ success: true, data: rfp });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to approve RFP', error: error.message });
    }
  }

  async reject(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user.role !== 'department_head') {
        return res.status(403).json({ success: false, message: 'Only Sales DH can reject RFP' });
      }

      const { id } = req.params;
      const { reason } = req.body;
      const rfp = await RfpRequest.reject(id, req.user.email, reason);
      if (!rfp) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }

      await RfpRequest.logAction(rfp.id, 'rfp_rejected', req.user.email, req.user.role, reason);
      res.json({ success: true, data: rfp });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to reject RFP', error: error.message });
    }
  }

  async setProductCalculatorPrice(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user.role !== 'department_head') {
        return res.status(403).json({ success: false, message: 'Only Sales DH can set product calculator price' });
      }
      const { id } = req.params;
      const { productSpec, totalPrice, calculatorDetail } = req.body || {};
      const current = await RfpRequest.getById(id);
      if (!current) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }
      const updated = await RfpRequest.setProductCalculatorPrice(id, productSpec, totalPrice, calculatorDetail);
      if (!updated) {
        return res.status(400).json({ success: false, message: 'Product not found for this RFP. Check product specification.' });
      }
      const refreshed = await RfpRequest.getById(id);
      res.json({ success: true, data: refreshed });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Failed to set product price' });
    }
  }

  async clearProductCalculatorPrice(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user.role !== 'department_head') {
        return res.status(403).json({ success: false, message: 'Only Sales DH can clear product calculator price' });
      }
      const { id } = req.params;
      const { productSpec } = req.body || {};
      const current = await RfpRequest.getById(id);
      if (!current) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }
      if (!productSpec || String(productSpec).trim() === '') {
        return res.status(400).json({ success: false, message: 'productSpec is required' });
      }
      const updated = await RfpRequest.clearProductCalculatorPrice(id, productSpec);
      if (!updated) {
        return res.status(400).json({ success: false, message: 'Product not found for this RFP.' });
      }
      const refreshed = await RfpRequest.getById(id);
      res.json({ success: true, data: refreshed });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Failed to clear product price' });
    }
  }

  async addPrice(req, res) {
    try {
      if (!isDepartment(req.user, 'accounts')) {
        return res.status(403).json({ success: false, message: 'Only Accounts can update pricing' });
      }

      const { id } = req.params;
      const current = await RfpRequest.getById(id);
      if (!current) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }
      if (!current.rfp_id || !['approved', 'pricing_ready'].includes(current.status)) {
        return res.status(409).json({ success: false, message: 'RFP must be approved by DH before pricing' });
      }
      const { rawMaterialPrice, processingCost, margin, validityDate } = req.body;
      const result = await RfpRequest.addPriceRevision(id, {
        rawMaterialPrice,
        processingCost,
        margin,
        validityDate,
        createdBy: req.user.email
      });

      await RfpRequest.logAction(id, 'price_updated', req.user.email, req.user.role, null, {
        rawMaterialPrice,
        processingCost,
        margin,
        calculatedPrice: result.rfp.calculated_price
      });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update price', error: error.message });
    }
  }

  async listPrices(req, res) {
    try {
      const { id } = req.params;
      const data = await RfpRequest.listPriceRevisions(id);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch prices', error: error.message });
    }
  }

  async generateQuotation(req, res) {
    try {
      if (!isDepartment(req.user, 'sales')) {
        return res.status(403).json({ success: false, message: 'Only Sales can generate quotation' });
      }

      const { id } = req.params;
      const rfp = await RfpRequest.getById(id);
      if (!rfp) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }
      if (rfp.quotation_id) {
        return res.status(409).json({ success: false, message: 'Quotation already exists for this RFP' });
      }
      if (rfp.status !== 'pricing_ready') {
        return res.status(409).json({ success: false, message: 'Quotation can be generated only after pricing is finalized' });
      }
      if (!rfp.calculated_price) {
        return res.status(400).json({ success: false, message: 'Pricing not finalized' });
      }

      const leadRes = await query('SELECT * FROM department_head_leads WHERE id = $1', [rfp.lead_id]);
      const lead = leadRes.rows[0] || {};

      const quantity = Number(rfp.quantity || 1);
      const unitPrice = Number(rfp.calculated_price || 0);
      const taxableAmount = quantity * unitPrice;
      const gstRate = 18;
      const gstAmount = taxableAmount * gstRate / 100;
      const totalAmount = taxableAmount + gstAmount;

      const quotationData = {
        customerId: rfp.lead_id,
        salespersonId: rfp.salesperson_id || req.user.id,
        createdBy: req.user.email,
        customerName: lead.customer || lead.name || '',
        customerBusiness: lead.business || '',
        customerPhone: lead.phone || '',
        customerEmail: lead.email || '',
        customerAddress: lead.address || '',
        customerGstNo: lead.gst_no || lead.gstNo || '',
        customerState: lead.state || '',
        quotationDate: new Date().toISOString().split('T')[0],
        validUntil: rfp.price_valid_until || null,
        subtotal: taxableAmount,
        taxRate: gstRate,
        taxAmount: gstAmount,
        discountRate: 0,
        discountAmount: 0,
        totalAmount,
        status: 'draft',
        rfpRequestId: rfp.id,
        rfpId: rfp.rfp_id,
        masterRfpId: rfp.master_rfp_id || rfp.rfp_id,
        bankDetails: {
          accountHolderName: 'ANODE ELECTRIC PVT. LTD.',
          bankName: 'ICICI Bank',
          branchName: 'WRIGHT TOWN JABALPUR',
          accountNumber: '657605601783',
          ifscCode: 'ICIC0006576'
        }
      };

      const items = [
        {
          productName: rfp.product_spec,
          description: rfp.special_requirements || rfp.product_spec,
          quantity,
          unit: 'Nos',
          unitPrice,
          gstRate,
          taxableAmount,
          gstAmount,
          totalAmount
        }
      ];

      const quotation = await Quotation.createWithItems(quotationData, items);
      await RfpRequest.setQuotationLink(rfp.id, quotation);
      await RfpRequest.logAction(rfp.id, 'quotation_created', req.user.email, req.user.role, null, {
        quotationNumber: quotation.quotation_number
      });

      res.json({ success: true, data: quotation });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create quotation', error: error.message });
    }
  }

  async submitToAccounts(req, res) {
    try {
      if (!isDepartment(req.user, 'sales')) {
        return res.status(403).json({ success: false, message: 'Only Sales can submit to accounts' });
      }
      const { id } = req.params;
      const { piId, paymentId } = req.body;
      const rfp = await RfpRequest.submitToAccounts(id, { piId, paymentId });
      if (!rfp) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }

      await RfpRequest.logAction(id, 'accounts_submitted', req.user.email, req.user.role, null, {
        piId,
        paymentId
      });
      res.json({ success: true, data: rfp });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to submit to accounts', error: error.message });
    }
  }

  async updateAccountsApproval(req, res) {
    try {
      if (!isDepartment(req.user, 'accounts')) {
        return res.status(403).json({ success: false, message: 'Only Accounts can approve' });
      }

      const { id } = req.params;
      const { status, notes } = req.body;
      if (!['approved', 'credit_case'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      const rfp = await RfpRequest.updateAccountsApproval(id, status, req.user.email, notes);
      if (!rfp) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }

      await RfpRequest.logAction(id, 'accounts_decision', req.user.email, req.user.role, notes, { status });

      if (status === 'approved') {
        const quotation = await Quotation.getWithItems(rfp.quotation_id);
        const workOrder = await this._ensureWorkOrder(rfp, quotation, req.user.email);
        await RfpRequest.setWorkOrderLink(rfp.id, workOrder);
        await RfpRequest.logAction(rfp.id, 'work_order_created', req.user.email, req.user.role, null, {
          workOrderNumber: workOrder.work_order_number
        });
      }

      res.json({ success: true, data: rfp });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update accounts approval', error: error.message });
    }
  }

  async updateSeniorApproval(req, res) {
    try {
      if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Only Senior Management can approve' });
      }

      const { id } = req.params;
      const { status, notes } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      const rfp = await RfpRequest.updateSeniorApproval(id, status, req.user.email, notes);
      if (!rfp) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }

      await RfpRequest.logAction(id, 'senior_decision', req.user.email, req.user.role, notes, { status });

      if (status === 'approved') {
        const quotation = await Quotation.getWithItems(rfp.quotation_id);
        const workOrder = await this._ensureWorkOrder(rfp, quotation, req.user.email);
        await RfpRequest.setWorkOrderLink(rfp.id, workOrder);
        await RfpRequest.logAction(rfp.id, 'work_order_created', req.user.email, req.user.role, null, {
          workOrderNumber: workOrder.work_order_number
        });
      }

      res.json({ success: true, data: rfp });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update senior approval', error: error.message });
    }
  }

  async _ensureWorkOrder(rfp, quotation, performedBy) {
    if (!quotation) {
      throw new Error('Quotation not found for work order generation');
    }
    const existing = await WorkOrder.getByQuotationId(quotation.quotation_number);
    if (existing) {
      return existing;
    }

    const items = (quotation.items || []).map((item) => ({
      productName: item.product_name,
      description: item.description || item.product_name,
      quantity: item.quantity,
      unit: item.unit || 'Nos',
      unitPrice: item.unit_price,
      total: item.total_amount
    }));

    const workOrderData = {
      quotationId: quotation.quotation_number,
      quotationUuid: quotation.id,
      leadId: rfp.lead_id,
      date: new Date().toISOString().split('T')[0],
      customer: {
        businessName: quotation.customer_business || '',
        buyerName: quotation.customer_name || '',
        gst: quotation.customer_gst_no || '',
        contact: quotation.customer_phone || '',
        state: quotation.customer_state || '',
        address: quotation.customer_address || '',
        email: quotation.customer_email || ''
      },
      orderDetails: {
        title: rfp.product_spec,
        quantity: rfp.quantity || '',
        total: quotation.total_amount || 0
      },
      items,
      status: 'sent_to_operations',
      rfpRequestId: rfp.id,
      rfpId: rfp.rfp_id,
      sentToOperationsAt: new Date().toISOString(),
      preparedBy: performedBy
    };

    const result = await WorkOrder.create(workOrderData);
    return result.rows[0];
  }
}

module.exports = new RfpController();
