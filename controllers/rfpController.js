const RfpRequest = require('../models/RfpRequest');
const Quotation = require('../models/Quotation');
const WorkOrder = require('../models/WorkOrder');
const { query } = require('../config/database');

const normalizeDept = (value) => (value || '').toString().toLowerCase();
const isDepartment = (user, keyword) => normalizeDept(user?.departmentType).includes(keyword);

class RfpController {
  async create(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user.role !== 'department_user') {
        return res.status(403).json({ success: false, message: 'Only salespersons can raise RFP' });
      }

      const { leadId, productSpec, quantity, deliveryTimeline, specialRequirements, availabilityStatus } = req.body;
      if (!leadId || !productSpec) {
        return res.status(400).json({ success: false, message: 'leadId and productSpec are required' });
      }
      if (!availabilityStatus) {
        return res.status(400).json({ success: false, message: 'availabilityStatus is required' });
      }
      if (availabilityStatus === 'in_stock') {
        return res.status(409).json({ success: false, message: 'Product in stock. Use direct quotation workflow.' });
      }

      const rfp = await RfpRequest.createRequest({
        leadId,
        salespersonId: req.user.id,
        createdBy: req.user.email,
        departmentType: req.user.departmentType,
        companyName: req.user.companyName,
        productSpec,
        quantity,
        deliveryTimeline,
        specialRequirements
      });

      await RfpRequest.logAction(rfp.id, 'rfp_created', req.user.email, req.user.role, null, {
        productSpec,
        quantity,
        availabilityStatus
      });

      res.status(201).json({ success: true, data: rfp });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create RFP', error: error.message });
    }
  }

  async list(req, res) {
    try {
      const { status, search, page = 1, limit = 50 } = req.query;
      const filters = {};
      if (status) filters.status = status;
      if (search) filters.search = search;

      if (req.user?.role === 'superadmin') {
        // no extra filters
      } else if (isDepartment(req.user, 'sales')) {
        if (req.user.role === 'department_head') {
          filters.departmentType = req.user.departmentType;
          if (req.user.companyName) filters.companyName = req.user.companyName;
        } else {
          filters.createdBy = req.user.email;
        }
      } else if (req.user?.companyName) {
        filters.companyName = req.user.companyName;
      }

      const pagination = {
        limit: Math.min(parseInt(limit, 10), 200),
        offset: (parseInt(page, 10) - 1) * Math.min(parseInt(limit, 10), 200)
      };

      const data = await RfpRequest.list(filters, pagination);
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
      const current = await RfpRequest.getById(id);
      if (!current) {
        return res.status(404).json({ success: false, message: 'RFP not found' });
      }

      const rfp = await RfpRequest.approve(id, req.user.email, current.salesperson_id);
      await RfpRequest.logAction(rfp.id, 'rfp_approved', req.user.email, req.user.role, null, {
        rfpId: rfp.rfp_id
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
        rfpId: rfp.rfp_id
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
