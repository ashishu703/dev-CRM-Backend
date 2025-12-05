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

  // Update PI
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
  async getBulkByQuotations(req, res) {
    try {
      const { quotationIds } = req.query;
      
      if (!quotationIds) {
        return res.status(400).json({
          success: false,
          message: 'quotationIds query parameter is required'
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
