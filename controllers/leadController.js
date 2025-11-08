const Lead = require('../models/Lead');
const DepartmentHeadLead = require('../models/DepartmentHeadLead');
const { validationResult } = require('express-validator');
const leadAssignmentService = require('../services/leadAssignmentService');

class LeadController {
  // Create a new lead
  async create(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      // For Sales Department Head UI, persist to department_head_leads table
      const dhResult = await DepartmentHeadLead.createFromUi(req.body, req.user.email);

      // Ensure salesperson_leads is synced if assigned
      if (dhResult && dhResult.id) {
        await leadAssignmentService.syncSalespersonLead(dhResult.id);
      }
      
      res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data: {
          id: (dhResult && dhResult.id) || undefined,
          ...req.body
        }
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create lead',
        error: error.message
      });
    }
  }

  // Get all leads with pagination and filters
  async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        state,
        productType,
        connectedStatus
      } = req.query;

      const filters = {};
      if (search) filters.search = search;
      if (state) filters.state = state;
      if (productType) filters.productType = productType;
      if (connectedStatus) filters.connectedStatus = connectedStatus;
      
      // STRICT CHECK: Always scope to the authenticated creator (department head)
      filters.createdBy = req.user.email;
      
      // STRICT CHECK: Add department and company filters to prevent cross-department access
      if (req.user.departmentType) {
        filters.departmentType = req.user.departmentType;
      }
      if (req.user.companyName) {
        filters.companyName = req.user.companyName;
      }

      const pagination = {
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const leads = await DepartmentHeadLead.getAll(filters, pagination);
      
      // STRICT CHECK: Add department and company filters for stats
      const stats = await DepartmentHeadLead.getStats(
        req.user.email,
        req.user.departmentType,
        req.user.companyName
      );

      res.json({
        success: true,
        data: leads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leads',
        error: error.message
      });
    }
  }

  // Get lead by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      // STRICT CHECK: Verify ownership - only return lead if it belongs to logged-in user's department and company
      const lead = await DepartmentHeadLead.getById(
        id,
        req.user.email,
        req.user.departmentType,
        req.user.companyName
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found or you do not have access to this lead'
        });
      }

      res.json({
        success: true,
        data: lead
      });
    } catch (error) {
      console.error('Error fetching lead:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lead',
        error: error.message
      });
    }
  }

  // Update lead
  async update(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updateData = req.body;

      // STRICT CHECK: Verify ownership before updating - only update if lead belongs to logged-in user's department and company
      const result = await DepartmentHeadLead.updateById(
        id,
        updateData,
        req.user.email,
        req.user.departmentType,
        req.user.companyName
      );

      if (!result || result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found or you do not have permission to update this lead'
        });
      }

      // STRICT CHECK: Get updated lead with ownership verification
      const updatedLead = await DepartmentHeadLead.getById(
        id,
        req.user.email,
        req.user.departmentType,
        req.user.companyName
      );

      if (!updatedLead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found or you do not have access to this lead'
        });
      }

      // Sync salesperson lead if assignment changed or exists
      await leadAssignmentService.syncSalespersonLead(id);

      res.json({
        success: true,
        message: 'Lead updated successfully',
        data: updatedLead
      });
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update lead',
        error: error.message
      });
    }
  }

  // Batch update leads (scoped to creator)
  async batchUpdate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { ids, updateData } = req.body;
      
      // STRICT CHECK: Add department and company verification for batch updates
      const result = await DepartmentHeadLead.updateManyForCreator(
        ids,
        updateData,
        req.user.email,
        req.user.departmentType,
        req.user.companyName
      );

      // Sync salesperson leads if assignment-related fields changed
      if (result && result.rowCount > 0 && (updateData.assignedSalesperson || updateData.assignedTelecaller)) {
        for (const id of ids) {
          await leadAssignmentService.syncSalespersonLead(id);
        }
      }

      return res.json({ success: true, updated: result?.rowCount || 0 });
    } catch (error) {
      console.error('Error batch updating leads:', error);
      res.status(500).json({ success: false, message: 'Failed to batch update leads', error: error.message });
    }
  }

  // Delete lead
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await Lead.delete(id);

      if (!result || result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      res.json({
        success: true,
        message: 'Lead deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting lead:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete lead',
        error: error.message
      });
    }
  }

  // Import leads from CSV
  async importCSV(req, res) {
    try {

      if (!req.user) {
        console.log('No user found in request - authentication issue');
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!req.body.leads || !Array.isArray(req.body.leads)) {
        console.log('Invalid CSV data format - no leads array');
        return res.status(400).json({
          success: false,
          message: 'Invalid CSV data format'
        });
      }

      // Pre-filter: keep only rows that have at least a name or a phone
      const sanitizedLeads = (req.body.leads || []).filter((l) => {
        const name = (l.customer || l.customerName || '').toString().trim();
        const phone = (l.phone || l['Mobile Number'] || '').toString().trim();
        return name.length > 0 || phone.length > 0;
      });
      // Import into department_head_leads for DH workflow
      const result = await DepartmentHeadLead.bulkCreateFromUi(sanitizedLeads, req.user.email);

      // Sync salesperson leads for all inserted rows, if any assignments exist
      if (result && result.rows && result.rows.length) {
        for (const row of result.rows) {
          await leadAssignmentService.syncSalespersonLead(row.id);
        }
      }

      const importedCount = result?.rowCount ?? 0;
      const duplicatesCount = result?.duplicatesCount ?? 0;
      res.status(201).json({
        success: true,
        message: `Successfully imported ${importedCount} leads${duplicatesCount ? `, ${duplicatesCount} duplicate(s) skipped` : ''}`,
        data: { importedCount, duplicatesCount }
      });
    } catch (error) {
      console.error('Error importing CSV:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Failed to import CSV',
        error: error.message,
        details: error.stack
      });
    }
  }

  // Transfer a lead to another user
  async transferLead(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { transferredTo, reason } = req.body;
      const transferredFrom = req.user.email;

      const result = await Lead.transferLead(id, transferredTo, transferredFrom, reason);

      if (!result || result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      res.json({
        success: true,
        message: 'Lead transferred successfully'
      });
    } catch (error) {
      console.error('Error transferring lead:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to transfer lead',
        error: error.message
      });
    }
  }

  // Get lead statistics
  async getStats(req, res) {
    try {
      const stats = await Lead.getStats(req.user.email);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching lead stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lead statistics',
        error: error.message
      });
    }
  }
}

module.exports = new LeadController();
