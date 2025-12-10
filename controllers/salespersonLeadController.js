const SalespersonLead = require('../models/SalespersonLead');
const DepartmentHeadLead = require('../models/DepartmentHeadLead');
const storageService = require('../services/storageService');
const leadAssignmentService = require('../services/leadAssignmentService');
const SalespersonLeadHistory = require('../models/SalespersonLeadHistory');

function isEmptyLike(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === 'n/a' || s === 'na' || s === '-';
}

class SalespersonLeadController {
  async listForLoggedInUser(req, res) {
    try {
      const username = req.user?.username;
      if (!username) {
        return res.status(400).json({ success: false, message: 'Username not available in token' });
      }
      // STRICT CHECK: Filter by department and company to prevent cross-department access
      const departmentType = req.user?.departmentType || null;
      const companyName = req.user?.companyName || null;
      
      // OPTIMIZED: Support pagination and document status
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const includeDocStatus = req.query.includeDocStatus === 'true' || req.query.includeDocStatus === true;
      
      if (includeDocStatus) {
        // Use optimized method with document status
        const result = await SalespersonLead.listForUserWithDocStatus(username, departmentType, companyName, page, limit);
        return res.json({ 
          success: true, 
          data: result.leads,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages
          }
        });
      } else {
        // Backward compatibility: return all leads without pagination
        const rows = await SalespersonLead.listForUser(username, departmentType, companyName);
        return res.json({ success: true, data: rows });
      }
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
      // STRICT CHECK: Filter by department and company to prevent cross-department access
      const departmentType = req.user?.departmentType || null;
      const companyName = req.user?.companyName || null;
      const rows = await SalespersonLead.listForUser(username, departmentType, companyName);
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Error fetching salesperson leads (by username):', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch leads', error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const username = req.user?.username;
      if (!username) {
        return res.status(400).json({ success: false, message: 'Username not available in token' });
      }
      
      // STRICT CHECK: Verify the lead is assigned to the logged-in user
      const departmentType = req.user?.departmentType || null;
      const companyName = req.user?.companyName || null;
      const row = await SalespersonLead.getByIdForUser(id, username, departmentType, companyName);
      
      if (!row) {
        return res.status(404).json({ 
          success: false, 
          message: 'Lead not found or you do not have access to this lead' 
        });
      }
      
      return res.json({ success: true, data: row });
    } catch (error) {
      console.error('Error fetching salesperson lead by id:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch lead', error: error.message });
    }
  }

  async getHistory(req, res) {
    try {
      const { id } = req.params;
      const rows = await SalespersonLeadHistory.getByLead(id);
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Error fetching lead history:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch lead history', error: error.message });
    }
  }

  // Create a lead from salesperson UI and reflect it to DH immediately
  async createLeadFromSalesperson(req, res) {
    try {
      const DepartmentHead = require('../models/DepartmentHead');
      let createdBy = req.user?.email;
      try {
        if (req.user?.headUserId) {
          const head = await DepartmentHead.findById(req.user.headUserId);
          if (head && head.email) createdBy = head.email; // Scope to owning head
        }
      } catch (_) {}
      const username = req.user?.username;
      const ui = req.body || {};
      
      console.log('Received form data:', {
        name: ui.name,
        phone: ui.phone,
        email: ui.email,
        business: ui.business,
        address: ui.address,
        state: ui.state,
        product_type: ui.product_type,
        lead_source: ui.lead_source,
        customer_type: ui.customer_type
      });

      /**
       * Normalizes field values - preserves actual data, converts empty to 'N/A' for DB
       * Applies DRY principle for data normalization
       * @param {*} value - Field value to normalize
       * @param {boolean} isRequired - Whether field is required (defaults to 'N/A' if empty)
       * @returns {string|null} - Normalized value (actual data preserved, empty becomes 'N/A' for required fields)
       */
      const normalizeField = (value, isRequired = false) => {
        // Handle null/undefined - return 'N/A' for required fields, null for optional
        if (value === undefined || value === null) {
          return isRequired ? 'N/A' : null;
        }
        
        const trimmed = String(value).trim();
        
        // If empty string or already 'N/A' - convert to 'N/A' for required, null for optional
        if (trimmed === '' || trimmed.toLowerCase() === 'n/a' || trimmed === 'null') {
          return isRequired ? 'N/A' : null;
        }
        
        // PRESERVE ACTUAL DATA - return as-is if it has content
        return trimmed;
      };

      // Extract and normalize values - preserve actual data, convert empty to null (model will convert to 'N/A')
      // Required fields (NOT NULL in DB): phone, gst_no, customer (for DB constraint)
      // Logic: If field has data → save actual data, If field is empty → model will save 'N/A' to DB
      const customerType = normalizeField(ui.customer_type || ui.customerType);
      const phone = normalizeField(ui.phone, true); // Required field - NOT NULL
      
      // Check for duplicate lead by phone number
      const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
      const { query } = require('../config/database');
      const duplicateCheck = await query(
        `SELECT id, customer, business, assigned_salesperson 
         FROM department_head_leads 
         WHERE created_by = $1 AND phone = $2 
         LIMIT 1`,
        [createdBy, cleanedPhone]
      );
      
      if (duplicateCheck.rows && duplicateCheck.rows.length > 0) {
        const duplicate = duplicateCheck.rows[0];
        return res.status(409).json({ 
          success: false, 
          message: 'Duplicate lead found',
          isDuplicate: true,
          duplicateLead: {
            id: duplicate.id,
            business: duplicate.business || 'N/A',
            assignedSalesperson: duplicate.assigned_salesperson || null
          }
        });
      }

      const dhUi = {
        customerId: normalizeField(ui.customerId),
        customer: normalizeField(ui.name || ui.customer) || 'N/A', // Defaults to 'N/A' if empty (DB constraint)
        email: normalizeField(ui.email), // Will be converted to 'N/A' in model if null
        business: normalizeField(ui.business), // Will be converted to 'N/A' in model if null
        leadSource: normalizeField(ui.lead_source || ui.leadSource), // Will be converted to 'N/A' in model if null
        productNames: normalizeField(ui.product_type || ui.productNames), // Will be converted to 'N/A' in model if null
        // Only use category if explicitly provided - no auto-assignment from customerType
        category: normalizeField(ui.category), // Will be converted to 'N/A' in model if null
        salesStatus: normalizeField(ui.sales_status), // Will be converted to 'N/A' in model if null
        phone: phone, // Required field - NOT NULL
        address: normalizeField(ui.address), // Will be converted to 'N/A' in model if null
        gstNo: normalizeField(ui.gst_no || ui.gstNo, true), // Required for DB constraint (NOT NULL)
        state: normalizeField(ui.state), // Will be converted to 'N/A' in model if null
        customerType: customerType, // Will be converted to 'N/A' in model if null
        date: normalizeField(ui.date),
        whatsapp: normalizeField(ui.whatsapp),
        assignedSalesperson: normalizeField(username || ui.assignedSalesperson), // Will be converted to 'N/A' in model if null
        assignedTelecaller: normalizeField(ui.assignedTelecaller), // Will be converted to 'N/A' in model if null
      };

      const created = await DepartmentHeadLead.createFromUi(dhUi, createdBy);
      if (!created || !created.id) {
        return res.status(500).json({ success: false, message: 'Failed to create lead' });
      }

      await leadAssignmentService.syncSalespersonLead(created.id);
      const spRow = await SalespersonLead.getById(created.id);
      return res.json({ success: true, data: spRow || { id: created.id } });
    } catch (error) {
      console.error('Error creating salesperson lead:', error);
      return res.status(500).json({ success: false, message: 'Failed to create lead', error: error.message });
    }
  }

  // Import multiple leads from salesperson UI and reflect to DH
  async importLeadsFromSalesperson(req, res) {
    try {
      const DepartmentHead = require('../models/DepartmentHead');
      let createdBy = req.user?.email;
      try {
        if (req.user?.headUserId) {
          const head = await DepartmentHead.findById(req.user.headUserId);
          if (head && head.email) createdBy = head.email; // Scope to owning head
        }
      } catch (_) {}
      const username = req.user?.username;
      let { leads } = req.body || {};
      if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ success: false, message: 'Leads data must be a non-empty array' });
      }

      // Pre-filter: keep only rows that have at least a name or a phone
      leads = leads.filter((l) => {
        const name = (l.name || l.customer || '').toString().trim();
        const phone = (l.phone || '').toString().trim();
        return name.length > 0 || phone.length > 0;
      });

      // Normalize to DH UI rows - only import data from CSV headers, no auto-assignment
      const rows = leads.map((l) => {
        const customerType = l.customer_type || l.customerType || null;
        return {
          customerId: l.customerId || null,
          customer: l.name || l.customer || null,
          email: l.email || null,
          business: l.business || null,
          leadSource: l.lead_source || l.leadSource || null,
          productNames: l.product_type || l.productNames || null,
          // Only use category if explicitly provided in CSV - no auto-assignment from customerType
          category: l.category || null,
          salesStatus: l.sales_status || null,
          phone: l.phone || null,
          address: l.address || null,
          gstNo: l.gst_no || l.gstNo || null,
          state: l.state || null,
          customerType: customerType,
          date: l.date || null,
          whatsapp: l.whatsapp || null,
          assignedSalesperson: username || l.assignedSalesperson || null,
          assignedTelecaller: l.assignedTelecaller || null,
        };
      });

      const result = await DepartmentHeadLead.bulkCreateFromUi(rows, createdBy);
      // Sync each created id - skip errors and continue
      if (result?.rows?.length) {
        for (const r of result.rows) {
          if (r.id) {
            try {
              await leadAssignmentService.syncSalespersonLead(r.id);
            } catch (syncError) {
              console.error(`Error syncing lead ${r.id} to salesperson_leads:`, syncError.message);
              // Continue with next lead
            }
          }
        }
      }
      return res.json({ 
        success: true, 
        created: result?.rowCount || result?.rows?.length || 0, 
        duplicatesCount: result?.duplicatesCount || 0,
        skippedCount: result?.skippedRows?.length || 0,
        skippedRows: result?.skippedRows || []
      });
    } catch (error) {
      console.error('Error importing salesperson leads:', error);
      return res.status(500).json({ success: false, message: 'Failed to import leads', error: error.message });
    }
  }

  async updateById(req, res) {
    try {
      const { id } = req.params;
      const username = req.user?.username;

      const updatePayload = { ...req.body };

      // Normalize empties to null to satisfy PostgreSQL types
      const toNullIfEmpty = (v) => (v === '' || v === undefined ? null : v);
      updatePayload.date = toNullIfEmpty(updatePayload.date);
      updatePayload.follow_up_date = toNullIfEmpty(updatePayload.follow_up_date);
      updatePayload.follow_up_time = toNullIfEmpty(updatePayload.follow_up_time);
      updatePayload.whatsapp = toNullIfEmpty(updatePayload.whatsapp);
      updatePayload.sales_status_remark = toNullIfEmpty(updatePayload.sales_status_remark);
      updatePayload.follow_up_status = toNullIfEmpty(updatePayload.follow_up_status);
      updatePayload.follow_up_remark = toNullIfEmpty(updatePayload.follow_up_remark);
      updatePayload.transferred_to = toNullIfEmpty(updatePayload.transferred_to);

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
      }

      // Enforce: salesperson can only edit certain DH fields if they are empty/N/A and lead is assigned to them
      const dhRow = await DepartmentHeadLead.getById(id);
      if (dhRow) {
        const assignedToUser = [dhRow.assigned_salesperson, dhRow.assigned_telecaller].filter(Boolean).includes(username);
        const guardFields = {
          business: 'business',
          address: 'address',
          gst_no: 'gst_no',
          product_type: 'product_names',
          state: 'state',
          lead_source: 'lead_source',
        };
        if (!assignedToUser) {
          // If not assigned, strip guarded fields from update
          for (const k of Object.keys(guardFields)) {
            if (Object.prototype.hasOwnProperty.call(updatePayload, k)) delete updatePayload[k];
          }
        } else {
          // Assigned: allow only when DH value is empty-like
          for (const [spKey, dhCol] of Object.entries(guardFields)) {
            if (Object.prototype.hasOwnProperty.call(updatePayload, spKey)) {
              const existing = dhRow[dhCol];
              if (!isEmptyLike(existing)) {
                delete updatePayload[spKey];
              }
            }
          }
        }
      }

      const result = await SalespersonLead.updateById(id, updatePayload);

      // Record history when follow-up fields or sales_status present
      try {
        const historyPayload = {
          follow_up_status: updatePayload.follow_up_status,
          follow_up_remark: updatePayload.follow_up_remark,
          follow_up_date: updatePayload.follow_up_date,
          follow_up_time: updatePayload.follow_up_time,
          sales_status: updatePayload.sales_status,
        };
        await SalespersonLeadHistory.addEntry(id, historyPayload, username);
      } catch (e) {
        console.warn('Lead history write skipped:', e.message);
      }

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
        if (updatePayload.customer_type !== undefined) {
          dhUpdate.customerType = updatePayload.customer_type;
          // Map customer_type to category column (e.g., CONTRACTOR -> category)
          dhUpdate.category = updatePayload.customer_type;
        }
        if (updatePayload.date !== undefined) dhUpdate.date = updatePayload.date;
        if (updatePayload.sales_status !== undefined) dhUpdate.salesStatus = updatePayload.sales_status;
        // Do not map follow_up_status to telecaller_status: it violates DH check constraint
        if (updatePayload.whatsapp !== undefined) dhUpdate.whatsapp = updatePayload.whatsapp;

        if (Object.keys(dhUpdate).length > 0) {
          const syncRes = await DepartmentHeadLead.updateById(id, dhUpdate);
          if (!syncRes || syncRes.rowCount === 0 && (updatePayload.phone || updatePayload.email)) {
            // Optional fallback: try to find DH by phone if ids are out of sync
            try {
              const maybeDh = await DepartmentHeadLead.query('SELECT id FROM department_head_leads WHERE phone = $1 LIMIT 1', [updatePayload.phone]);
              const row = maybeDh?.rows?.[0];
              if (row?.id) await DepartmentHeadLead.updateById(row.id, dhUpdate);
            } catch (_) {}
          }
        }
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


