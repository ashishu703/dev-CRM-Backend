const SalespersonLead = require('../models/SalespersonLead');
const DepartmentHeadLead = require('../models/DepartmentHeadLead');
const storageService = require('../services/storageService');

class SalespersonLeadController {
  async listForLoggedInUser(req, res) {
    try {
      const username = req.user?.username;
      if (!username) {
        return res.status(400).json({ success: false, message: 'Username not available in token' });
      }
      const rows = await SalespersonLead.listForUser(username);
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Error fetching salesperson leads (self):', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch leads', error: error.message });
    }
  }

  async listForUsername(req, res) {
    try {
      const { username } = req.params;
      if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required' });
      }
      const rows = await SalespersonLead.listForUser(username);
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Error fetching salesperson leads (by username):', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch leads', error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const row = await SalespersonLead.getById(id);
      if (!row) return res.status(404).json({ success: false, message: 'Lead not found' });
      return res.json({ success: true, data: row });
    } catch (error) {
      console.error('Error fetching salesperson lead by id:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch lead', error: error.message });
    }
  }

  async updateById(req, res) {
    try {
      const { id } = req.params;

      const updatePayload = { ...req.body };

      // Clean up empty strings for integer fields - convert to null
      if (updatePayload.call_duration_seconds === '' || updatePayload.call_duration_seconds === undefined) {
        updatePayload.call_duration_seconds = null;
      } else {
        updatePayload.call_duration_seconds = parseInt(updatePayload.call_duration_seconds);
      }
      
      if (updatePayload.quotation_count === '' || updatePayload.quotation_count === undefined) {
        updatePayload.quotation_count = null;
      } else {
        updatePayload.quotation_count = parseInt(updatePayload.quotation_count);
      }

      if (req.files) {
        if (req.files.quotation?.[0]) {
          const file = req.files.quotation[0];
          const url = await storageService.uploadBuffer(file.buffer, {
            folder: `salesperson_leads/${id}/quotation`,
            filename: `${Date.now()}_${file.originalname}`,
            mimeType: file.mimetype,
          });
          updatePayload.quotation_url = url;
        }
        if (req.files.proforma_invoice?.[0]) {
          const file = req.files.proforma_invoice[0];
          const url = await storageService.uploadBuffer(file.buffer, {
            folder: `salesperson_leads/${id}/proforma_invoice`,
            filename: `${Date.now()}_${file.originalname}`,
            mimeType: file.mimetype,
          });
          updatePayload.proforma_invoice_url = url;
        }
        if (req.files.payment_receipt?.[0]) {
          const file = req.files.payment_receipt[0];
          const url = await storageService.uploadBuffer(file.buffer, {
            folder: `salesperson_leads/${id}/payment_receipt`,
            filename: `${Date.now()}_${file.originalname}`,
            mimeType: file.mimetype,
          });
          updatePayload.payment_receipt_url = url;
        }
        if (req.files.call_recording?.[0]) {
          const file = req.files.call_recording[0];
          const url = await storageService.uploadBuffer(file.buffer, {
            folder: `salesperson_leads/${id}/call_recording`,
            filename: `${Date.now()}_${file.originalname}`,
            mimeType: file.mimetype,
          });
          updatePayload.call_recording_url = url;
        }
      }

      const result = await SalespersonLead.updateById(id, updatePayload);

      // Sync updates back to Department Head lead record (same id)
      try {
        const dhUpdate = {};
        if (updatePayload.name !== undefined) dhUpdate.customer = updatePayload.name;
        if (updatePayload.phone !== undefined) dhUpdate.phone = updatePayload.phone;
        if (updatePayload.email !== undefined) dhUpdate.email = updatePayload.email;
        if (updatePayload.business !== undefined) dhUpdate.business = updatePayload.business;
        if (updatePayload.address !== undefined) dhUpdate.address = updatePayload.address;
        if (updatePayload.gst_no !== undefined) dhUpdate.gstNo = updatePayload.gst_no;
        if (updatePayload.product_type !== undefined) dhUpdate.productNames = updatePayload.product_type;
        if (updatePayload.state !== undefined) dhUpdate.state = updatePayload.state;
        if (updatePayload.lead_source !== undefined) dhUpdate.leadSource = updatePayload.lead_source;
        if (updatePayload.customer_type !== undefined) dhUpdate.customerType = updatePayload.customer_type;
        if (updatePayload.date !== undefined) dhUpdate.date = updatePayload.date;
        if (updatePayload.connected_status !== undefined) dhUpdate.connectedStatus = updatePayload.connected_status;
        if (updatePayload.final_status !== undefined) dhUpdate.finalStatus = updatePayload.final_status;
        if (updatePayload.whatsapp !== undefined) dhUpdate.whatsapp = updatePayload.whatsapp;

        await DepartmentHeadLead.updateById(id, dhUpdate);
      } catch (syncError) {
        console.warn('DH sync skipped due to error:', syncError.message);
      }
      if (!result || result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Lead not found or no changes' });
      }
      return res.json({ success: true, message: 'Lead updated successfully', data: result.row });
    } catch (error) {
      console.error('Error updating salesperson lead:', error);
      return res.status(500).json({ success: false, message: 'Failed to update lead', error: error.message });
    }
  }
}

module.exports = new SalespersonLeadController();


