const Lead = require('../models/Lead');
const DepartmentHeadLead = require('../models/DepartmentHeadLead');
const { validationResult } = require('express-validator');
const leadAssignmentService = require('../services/leadAssignmentService');
const SalespersonLead = require('../models/SalespersonLead');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

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

      if (dhResult && dhResult.id) {
        await leadAssignmentService.syncSalespersonLead(dhResult.id);
        
        await notificationService.notifyLeadCreated(dhResult, req.user.email);
        
        if (req.body.assignedSalesperson && req.body.assignedSalesperson !== 'N/A') {
          try {
            const { query } = require('../config/database');
            const userResult = await query(
              'SELECT email FROM department_users WHERE username = $1 OR email = $1 LIMIT 1',
              [req.body.assignedSalesperson]
            );
            
            const salespersonEmail = userResult.rows[0]?.email;
            
            if (salespersonEmail) {
              await notificationService.notifyLeadAssigned(dhResult, salespersonEmail, req.user.email);
            }
          } catch (notifError) {
            logger.error('Failed to send lead assignment notification:', notifError);
          }
        }
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
        connectedStatus,
        departmentType
      } = req.query;

      const filters = {};
      if (search) filters.search = search;
      if (state) filters.state = state;
      if (productType) filters.productType = productType;
      if (connectedStatus) filters.connectedStatus = connectedStatus;
      
      const isSuperAdmin = req.user.role === 'SUPERADMIN' || req.user.role === 'superadmin';
      
      // Allow SuperAdmin to filter by departmentType if provided in query params
      if (isSuperAdmin && departmentType) {
        filters.departmentType = departmentType;
      }
      
      if (!isSuperAdmin) {
        // If departmentType is explicitly provided in query params, treat it like SuperAdmin
        // This allows department heads to see all leads from their department (not just created by them)
        // This ensures consistency with SuperAdmin dashboard when viewing same department
        if (departmentType) {
          filters.departmentType = departmentType;
          // Still filter by companyName for department heads to ensure data isolation
          if (req.user.companyName) {
            filters.companyName = req.user.companyName;
          }
        } else {
          // Default behavior: filter by createdBy for department heads when no departmentType param
          filters.createdBy = req.user.email;
          
          if (req.user.departmentType) {
            filters.departmentType = req.user.departmentType;
          }
          if (req.user.companyName) {
            filters.companyName = req.user.companyName;
          }
        }
      }

      const pagination = {
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const leads = await DepartmentHeadLead.getAll(filters, pagination);

      // Calculate stats - if departmentType is provided in query params, use same logic as SuperAdmin
      const stats = isSuperAdmin 
        ? await DepartmentHeadLead.getStats(null, departmentType || null, null)
        : departmentType 
          ? await DepartmentHeadLead.getStats(null, departmentType, req.user.companyName || null)
          : await DepartmentHeadLead.getStats(
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

  async getById(req, res) {
    try {
      const { id } = req.params;
      
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

      await leadAssignmentService.syncSalespersonLead(id);

      await notificationService.notifyLeadUpdated(updatedLead, req.user.email, updateData);

      if (updateData.assignedSalesperson && updateData.assignedSalesperson !== 'N/A') {
        try {
          const { query } = require('../config/database');
          const userResult = await query(
            'SELECT email FROM department_users WHERE username = $1 OR email = $1 LIMIT 1',
            [updateData.assignedSalesperson]
          );
          
          const salespersonEmail = userResult.rows[0]?.email;
          
          if (salespersonEmail) {
            await notificationService.notifyLeadAssigned(updatedLead, salespersonEmail, req.user.email);
          }
        } catch (notifError) {
          logger.error('Failed to send lead assignment notification:', notifError);
        }
      }

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

      if (result && result.rowCount > 0 && (updateData.assignedSalesperson || updateData.assignedTelecaller)) {
        let salespersonEmail = null;
        if (updateData.assignedSalesperson && updateData.assignedSalesperson !== 'N/A') {
          const { query } = require('../config/database');
          const userResult = await query(
            'SELECT email FROM department_users WHERE username = $1 OR email = $1 LIMIT 1',
            [updateData.assignedSalesperson]
          );
          salespersonEmail = userResult.rows[0]?.email;
        }
        
        for (const id of ids) {
          await leadAssignmentService.syncSalespersonLead(id);
          
          if (salespersonEmail) {
            try {
              const leadData = await DepartmentHeadLead.getById(id, req.user.email, req.user.departmentType, req.user.companyName);
              if (leadData) {
                await notificationService.notifyLeadAssigned(leadData, salespersonEmail, req.user.email);
              }
            } catch (notifError) {
              logger.error('Failed to send batch lead assignment notification:', notifError);
            }
          }
        }
      }

      return res.json({ success: true, updated: result?.rowCount || 0 });
    } catch (error) {
      console.error('Error batch updating leads:', error);
      res.status(500).json({ success: false, message: 'Failed to batch update leads', error: error.message });
    }
  }

  // Delete lead (soft delete - marks as deleted but keeps in database for calendar)
  async delete(req, res) {
    try {
      const { id } = req.params;
      const { getClient } = require('../config/database');
      const client = await getClient();

      try {
        await client.query('BEGIN');

        // Soft delete: Mark lead as deleted instead of actually deleting it
        // This allows check-ins to still reference the lead in the calendar
        const dhResult = await client.query(
          `UPDATE department_head_leads 
           SET is_deleted = TRUE, deleted_at = NOW() 
           WHERE id = $1`,
          [id]
        );

        // Also soft delete from main leads table if it exists
        let leadResult = { rowCount: 0 };
        try {
          leadResult = await client.query(
            `UPDATE leads 
             SET is_deleted = TRUE, deleted_at = NOW() 
             WHERE id = $1`,
          [id]
        );
        } catch (e) {
          // Leads table might not exist or might not have is_deleted column
          console.log('Could not soft delete from leads table:', e.message);
        }

        // Soft delete associated salesperson_leads
        await client.query(
          `UPDATE salesperson_leads 
           SET is_deleted = TRUE, deleted_at = NOW() 
           WHERE dh_lead_id = $1`,
          [id]
        );

        // Note: We do NOT delete marketing_check_ins or marketing_meetings
        // These should remain so they can be displayed in the calendar with a "deleted" mark

        await client.query('COMMIT');

        // Check if any deletion was successful
        if ((dhResult && dhResult.rowCount > 0) || (leadResult && leadResult.rowCount > 0)) {
          return res.json({
            success: true,
            message: 'Lead deleted successfully'
          });
        } else {
          return res.status(404).json({
            success: false,
            message: 'Lead not found'
          });
        }
      } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete lead',
        error: error.message
      });
    }
  }

  // Bulk delete leads (scoped to creator)
  async bulkDelete(req, res) {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Lead IDs array is required'
        });
      }

      // STRICT CHECK: Verify ownership before deleting
      const result = await DepartmentHeadLead.deleteManyForCreator(
        ids,
        req.user.email,
        req.user.departmentType,
        req.user.companyName
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No leads found or you do not have permission to delete these leads'
        });
      }

      return res.json({
        success: true,
        message: `Successfully deleted ${result.rowCount} lead(s)`,
        deletedCount: result.rowCount
      });
    } catch (error) {
      console.error('Error bulk deleting leads:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete leads',
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

      // Sync salesperson leads and create meetings for all inserted rows, if any assignments exist
      if (result && result.rows && result.rows.length) {
        const MarketingMeeting = require('../models/MarketingMeeting');
        for (const row of result.rows) {
          try {
          await leadAssignmentService.syncSalespersonLead(row.id);
            
            // Create meeting for imported lead if assigned to a salesperson
            if (row.assigned_salesperson || row.assignedSalesperson) {
              try {
                const assignedSalesperson = row.assigned_salesperson || row.assignedSalesperson;
                const meetingDate = row.date || new Date().toISOString().split('T')[0];
                const leadAddress = row.address || 'Address not provided';
                const meeting_id = await MarketingMeeting.generateMeetingId();
                
                await MarketingMeeting.create({
                  meeting_id,
                  customer_id: row.id,
                  lead_id: row.id,
                  customer_name: row.customer || row.customer_name || row.name || 'N/A',
                  customer_phone: row.phone || null,
                  customer_email: row.email || null,
                  address: leadAddress,
                  city: row.city || null,
                  state: row.state || null,
                  pincode: row.pincode || null,
                  assigned_to: assignedSalesperson,
                  assigned_by: req.user.email || req.user.username || 'unknown',
                  meeting_date: meetingDate,
                  meeting_time: null,
                  scheduled_date: meetingDate,
                  status: 'Scheduled',
                  notes: `Imported and assigned from CSV`
                });
              } catch (meetingError) {
                console.error(`Error creating meeting for imported lead ${row.id}:`, meetingError);
                // Don't block import if meeting creation fails
              }
            }
          } catch (syncError) {
            console.error(`Error syncing lead ${row.id}:`, syncError);
            // Continue with other leads even if one fails
          }
        }
      }

      const importedCount = result?.rowCount ?? 0;
      const duplicatesCount = result?.duplicatesCount ?? 0;
      const skippedRows = result?.skippedRows || [];
      let message = `Successfully imported ${importedCount} lead(s)`;
      if (duplicatesCount > 0) {
        message += `, ${duplicatesCount} duplicate(s) skipped`;
      }
      if (skippedRows.length > 0) {
        message += `, ${skippedRows.length} row(s) skipped due to validation errors`;
      }
      
      res.status(201).json({
        success: true,
        message,
        data: { 
          importedCount, 
          duplicatesCount,
          skippedCount: skippedRows.length,
          skippedRows: skippedRows.slice(0, 50)
        }
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

      let result = await Lead.transferLead(id, transferredTo, transferredFrom, reason);

      if (!result || result.rowCount === 0) {
        result = await SalespersonLead.transferLead(id, transferredTo, transferredFrom, reason);
      if (!result || result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
        }
      }

      // Update assigned salesperson and transfer info on department_head_leads
      try {
        await DepartmentHeadLead.transferLead(id, transferredTo, transferredFrom, reason);
        await leadAssignmentService.syncSalespersonLead(id);
      } catch (syncError) {
        console.error('Lead transfer sync warning:', syncError);
        // Fallback: just update assigned salesperson
        try {
          await DepartmentHeadLead.updateById(
            id,
            { assignedSalesperson: transferredTo },
            null,
            null,
            null
          );
          await leadAssignmentService.syncSalespersonLead(id);
        } catch (fallbackError) {
          console.error('Lead transfer fallback error:', fallbackError);
        }
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
