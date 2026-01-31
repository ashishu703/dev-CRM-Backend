const ProformaInvoice = require('../models/ProformaInvoice');

class ProformaInvoiceController {
  // Get all PIs (for department head)
  async getAll(req, res) {
    try {
      const pis = await ProformaInvoice.getAll(
        req.user.departmentType,
        req.user.companyName,
        req.user.email
      );
      
      res.json({
        success: true,
        data: pis
      });
    } catch (error) {
      console.error('Error fetching all PIs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch Proforma Invoices',
        error: error.message
      });
    }
  }

  // Get all PIs pending approval
  async getPendingApproval(req, res) {
    try {
      const pis = await ProformaInvoice.getPendingApproval();
      
      res.json({
        success: true,
        data: pis
      });
    } catch (error) {
      console.error('Error fetching pending PIs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending Proforma Invoices',
        error: error.message
      });
    }
  }

  // Create PI from quotation
  async createFromQuotation(req, res) {
    try {
      const { quotationId } = req.params;
      const piData = {
        piDate: req.body.piDate,
        validUntil: req.body.validUntil,
        status: req.body.status || 'draft',
        createdBy: req.user.email,
        // Template key - REQUIRED for PI rendering
        template: req.body.template,
        // Adjusted amounts for remaining amount PIs (if provided)
        subtotal: req.body.subtotal,
        taxAmount: req.body.taxAmount || req.body.tax_amount,
        totalAmount: req.body.totalAmount || req.body.total_amount,
        // Template selection
        template: req.body.template || 'template1',
        // Dispatch details
        dispatchMode: req.body.dispatchMode || req.body.dispatch_mode,
        transportName: req.body.transportName || req.body.transport_name,
        vehicleNumber: req.body.vehicleNumber || req.body.vehicle_number,
        transportId: req.body.transportId || req.body.transport_id,
        lrNo: req.body.lrNo || req.body.lr_no,
        courierName: req.body.courierName || req.body.courier_name,
        consignmentNo: req.body.consignmentNo || req.body.consignment_no,
        byHand: req.body.byHand || req.body.by_hand,
        postService: req.body.postService || req.body.post_service,
        carrierName: req.body.carrierName || req.body.carrier_name,
        carrierNumber: req.body.carrierNumber || req.body.carrier_number
      };

      const pi = await ProformaInvoice.createFromQuotation(quotationId, piData);
      
      res.json({
        success: true,
        message: 'Proforma Invoice created successfully',
        data: pi
      });
    } catch (error) {
      console.error('Error creating PI:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create Proforma Invoice',
        error: error.message
      });
    }
  }

  // Get PI by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const pi = await ProformaInvoice.getById(id);
      
      if (!pi) {
        return res.status(404).json({
          success: false,
          message: 'Proforma Invoice not found'
        });
      }
      
      res.json({
        success: true,
        data: pi
      });
    } catch (error) {
      console.error('Error fetching PI:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch Proforma Invoice',
        error: error.message
      });
    }
  }

  /** Lightweight PI summary for fast View open. No products/payments. */
  async getSummary(req, res) {
    try {
      const { id } = req.params;
      const pi = await ProformaInvoice.getSummary(id);
      if (!pi) {
        return res.status(404).json({ success: false, message: 'Proforma Invoice not found' });
      }
      res.json({ success: true, data: pi });
    } catch (error) {
      console.error('Error fetching PI summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch PI summary',
        error: error.message
      });
    }
  }

  /** PI products (quotation items with amendment applied for revised PI). Lazy-load. */
  async getProducts(req, res) {
    try {
      const { id } = req.params;
      const result = await ProformaInvoice.getProducts(id);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Proforma Invoice not found' });
      }
      res.json({ success: true, data: result.items, pi: result.pi });
    } catch (error) {
      console.error('Error fetching PI products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch PI products',
        error: error.message
      });
    }
  }

  /** PI payments only (by quotation_id). Lazy-load. */
  async getPaymentsOnly(req, res) {
    try {
      const { id } = req.params;
      const payments = await ProformaInvoice.getPaymentsOnly(id);
      if (payments === null) {
        return res.status(404).json({ success: false, message: 'Proforma Invoice not found' });
      }
      res.json({ success: true, data: payments });
    } catch (error) {
      console.error('Error fetching PI payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch PI payments',
        error: error.message
      });
    }
  }

  // Get PI with payments
  async getWithPayments(req, res) {
    try {
      const { id } = req.params;
      const pi = await ProformaInvoice.getWithPayments(id);
      
      if (!pi) {
        return res.status(404).json({
          success: false,
          message: 'Proforma Invoice not found'
        });
      }
      
      res.json({
        success: true,
        data: pi
      });
    } catch (error) {
      console.error('Error fetching PI with payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch Proforma Invoice with payments',
        error: error.message
      });
    }
  }

  // Send PI to customer
  async sendToCustomer(req, res) {
    try {
      const { id } = req.params;
      const pi = await ProformaInvoice.sendToCustomer(id, req.user.email);
      
      res.json({
        success: true,
        message: 'Proforma Invoice sent to customer',
        data: pi
      });
    } catch (error) {
      console.error('Error sending PI:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send Proforma Invoice',
        error: error.message
      });
    }
  }

  // Get PIs by quotation
  async getByQuotation(req, res) {
    try {
      const { quotationId } = req.params;
      const pis = await ProformaInvoice.getByQuotation(quotationId);
      
      res.json({
        success: true,
        data: pis
      });
    } catch (error) {
      console.error('Error fetching PIs by quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch Proforma Invoices',
        error: error.message
      });
    }
  }

  // Get active PI for quotation (for payment tracking: latest approved, not superseded)
  async getActivePI(req, res) {
    try {
      const { quotationId } = req.params;
      const pi = await ProformaInvoice.getActivePI(quotationId);
      res.json({
        success: true,
        data: pi
      });
    } catch (error) {
      console.error('Error fetching active PI:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active PI',
        error: error.message
      });
    }
  }

  // Create revised PI (amendment) from approved parent PI
  async createRevisedPI(req, res) {
    try {
      const { parentPiId } = req.params;
      const payload = {
        removedItemIds: req.body.removedItemIds || [],
        reducedItems: req.body.reducedItems || [],
        subtotal: req.body.subtotal,
        taxAmount: req.body.taxAmount,
        totalAmount: req.body.totalAmount,
        createdBy: req.user.email
      };
      const pi = await ProformaInvoice.createRevisedPI(parentPiId, payload);
      res.status(201).json({
        success: true,
        message: 'Revised PI created. Submit for department head approval.',
        data: pi
      });
    } catch (error) {
      console.error('Error creating revised PI:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create revised PI',
        error: error.message
      });
    }
  }

  // Submit revised PI for DH approval
  async submitRevisedPI(req, res) {
    try {
      const { id } = req.params;
      const pi = await ProformaInvoice.submitRevisedPI(id);
      res.json({
        success: true,
        message: 'Revised PI submitted for approval',
        data: pi
      });
    } catch (error) {
      console.error('Error submitting revised PI:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit revised PI',
        error: error.message
      });
    }
  }

  // DH: List pending revised PIs
  async getPendingRevisedPIs(req, res) {
    try {
      const list = await ProformaInvoice.getPendingRevisedPIs();
      res.json({
        success: true,
        data: list
      });
    } catch (error) {
      console.error('Error fetching pending revised PIs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending revised PIs',
        error: error.message
      });
    }
  }

  // DH: Approve revised PI
  async approveRevisedPI(req, res) {
    try {
      const { id } = req.params;
      const pi = await ProformaInvoice.approveRevisedPI(id, req.user.email);
      res.json({
        success: true,
        message: 'Revised PI approved. It is now the active PI for this quotation.',
        data: pi
      });
    } catch (error) {
      console.error('Error approving revised PI:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to approve revised PI',
        error: error.message
      });
    }
  }

  // DH: Reject revised PI
  async rejectRevisedPI(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const pi = await ProformaInvoice.rejectRevisedPI(id, req.user.email, reason);
      res.json({
        success: true,
        message: 'Revised PI rejected',
        data: pi
      });
    } catch (error) {
      console.error('Error rejecting revised PI:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to reject revised PI',
        error: error.message
      });
    }
  }

  /**
   * Update PI. Only draft (or pending_approval) PI is editable; approved/superseded are read-only.
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const pi = await ProformaInvoice.updateById(id, updateData);
      
      if (!pi) {
        return res.status(404).json({
          success: false,
          message: 'Proforma Invoice not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Proforma Invoice updated successfully',
        data: pi
      });
    } catch (error) {
      if (error.message && error.message.includes('read-only')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      console.error('Error updating PI:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update Proforma Invoice',
        error: error.message
      });
    }
  }

  // Delete PI
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await ProformaInvoice.deleteById(id);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Proforma Invoice not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Proforma Invoice deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting PI:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete Proforma Invoice',
        error: error.message
      });
    }
  }

  // Get PIs for multiple quotations (bulk)
  // OPTIMIZED: Supports both GET (query) and POST (body) to handle large arrays
  async getBulkByQuotations(req, res) {
    try {
      // Support both GET (query) and POST (body) for backward compatibility and large arrays
      const quotationIds = req.body?.quotationIds || req.query?.quotationIds;
      
      if (!quotationIds) {
        return res.status(400).json({
          success: false,
          message: 'quotationIds is required (query parameter for GET or body for POST)'
        });
      }

      // Parse quotationIds
      let idsArray = [];
      try {
        if (typeof quotationIds === 'string') {
          if (quotationIds.startsWith('[')) {
            idsArray = JSON.parse(quotationIds);
          } else {
            idsArray = quotationIds.split(',').map(id => id.trim()).filter(id => id);
          }
        } else if (Array.isArray(quotationIds)) {
          idsArray = quotationIds;
        }
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid quotationIds format'
        });
      }

      if (idsArray.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }

      // Build query with IN clause
      const placeholders = idsArray.map((_, index) => `$${index + 1}`).join(',');
      const pisQuery = `
        SELECT 
          pi.*
        FROM proforma_invoices pi
        WHERE pi.quotation_id IN (${placeholders})
        ORDER BY pi.created_at DESC
      `;
      
      const { query } = require('../config/database');
      const pisResult = await query(pisQuery, idsArray);
      const pis = pisResult.rows || [];
      
      res.json({
        success: true,
        data: pis
      });
    } catch (error) {
      console.error('Error fetching bulk PIs by quotations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bulk PIs',
        error: error.message
      });
    }
  }
}

module.exports = new ProformaInvoiceController();
