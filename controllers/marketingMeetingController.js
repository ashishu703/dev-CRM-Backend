const MarketingMeeting = require('../models/MarketingMeeting');
const logger = require('../utils/logger');

class MarketingMeetingController {
  /**
   * Create/Assign a new meeting
   * POST /api/marketing/meetings
   */
  async create(req, res) {
    try {
      const {
        customer_id,
        lead_id,
        customer_name,
        customer_phone,
        customer_email,
        address,
        location,
        city,
        state,
        pincode,
        assigned_to,
        meeting_date,
        meeting_time,
        scheduled_date,
        notes
      } = req.body;

      // Validation
      if (!customer_name || !address || !assigned_to || !meeting_date) {
        return res.status(400).json({
          success: false,
          message: 'customer_name, address, assigned_to, and meeting_date are required'
        });
      }

      const assigned_by = req.user?.email || req.user?.username || 'unknown';

      // Check if a meeting already exists for this lead/customer and salesperson
      // This prevents duplicate meetings when reassigning or importing
      if (lead_id || customer_id) {
        const existingMeetings = await MarketingMeeting.getAll({
          lead_id: lead_id || customer_id,
          assigned_to: assigned_to
        });
        
        // If there's an existing scheduled or in-progress meeting, update it instead of creating a new one
        const activeMeeting = existingMeetings.find(m => 
          m.status === 'Scheduled' || m.status === 'In Progress'
        );
        
        if (activeMeeting) {
          logger.info('Meeting already exists for this lead, updating instead of creating new one:', {
            existing_meeting_id: activeMeeting.id,
            lead_id: lead_id || customer_id,
            assigned_to
          });
          
          // Update the existing meeting with new details
          const updatedMeeting = await MarketingMeeting.update(activeMeeting.id, {
            meeting_date: meeting_date,
            scheduled_date: scheduled_date || meeting_date,
            meeting_time: meeting_time || activeMeeting.meeting_time,
            address: address || activeMeeting.address,
            city: city || activeMeeting.city,
            state: state || activeMeeting.state,
            pincode: pincode || activeMeeting.pincode,
            notes: notes || activeMeeting.notes,
            status: 'Scheduled' // Reset to Scheduled if it was In Progress
          });
          
          return res.status(200).json({
            success: true,
            message: 'Meeting updated successfully',
            data: updatedMeeting,
            wasUpdate: true
          });
        }
      }

      // Generate unique meeting ID with retry logic for duplicates
      let meeting_id;
      let meeting;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          meeting_id = await MarketingMeeting.generateMeetingId();
          
          // Use scheduled_date if provided, otherwise use meeting_date
          const finalScheduledDate = scheduled_date || meeting_date;

          meeting = await MarketingMeeting.create({
            meeting_id,
            customer_id: customer_id || null,
            lead_id: lead_id || null,
            customer_name,
            customer_phone: customer_phone || null,
            customer_email: customer_email || null,
            address,
            location: location || null,
            city: city || null,
            state: state || null,
            pincode: pincode || null,
            assigned_to,
            assigned_by,
            meeting_date,
            meeting_time: meeting_time || null,
            scheduled_date: finalScheduledDate,
            status: 'Scheduled',
            notes: notes || null
          });

          // Success - break out of retry loop
          break;
        } catch (createError) {
          // Check if it's a duplicate key error for meeting_id
          if (createError.message && createError.message.includes('marketing_meetings_meeting_id_key')) {
            attempts++;
            logger.warn(`Duplicate meeting_id detected (attempt ${attempts}/${maxAttempts}): ${meeting_id}`, {
              error: createError.message,
              lead_id: lead_id || customer_id,
              assigned_to
            });
            
            if (attempts >= maxAttempts) {
              // If we've exhausted retries, check if meeting already exists and return it
              if (lead_id || customer_id) {
                const existingMeetings = await MarketingMeeting.getAll({
                  lead_id: lead_id || customer_id,
                  assigned_to: assigned_to
                });
                
                if (existingMeetings.length > 0) {
                  logger.info('Found existing meeting after duplicate key error, returning it:', {
                    existing_meeting_id: existingMeetings[0].id,
                    meeting_id: existingMeetings[0].meeting_id
                  });
                  
                  return res.status(200).json({
                    success: true,
                    message: 'Meeting already exists',
                    data: existingMeetings[0],
                    wasExisting: true
                  });
                }
              }
              
              // If no existing meeting found, throw the error
              throw new Error(`Failed to generate unique meeting ID after ${maxAttempts} attempts. Please try again.`);
            }
            
            // Wait a small random amount before retrying to avoid collisions
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            continue; // Retry with new ID
          } else {
            // Not a duplicate key error, throw it
            throw createError;
          }
        }
      }

      logger.info('Marketing meeting created:', { meeting_id: meeting.meeting_id, assigned_to });

      res.status(201).json({
        success: true,
        message: 'Meeting assigned successfully',
        data: meeting
      });
    } catch (error) {
      logger.error('Error creating marketing meeting:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create meeting',
        error: error.message
      });
    }
  }

  /**
   * Get all meetings (for Marketing Sales Head)
   * GET /api/marketing/meetings
   */
  async getAll(req, res) {
    try {
      const filters = {};

      // Optional query filters - Marketing Sales Head can see all meetings
      // Only filter if explicitly requested via query parameters
      if (req.query.assigned_by) {
        filters.assigned_by = req.query.assigned_by;
      }

      if (req.query.status) {
        filters.status = req.query.status;
      }

      if (req.query.assigned_to) {
        filters.assigned_to = req.query.assigned_to;
      }

      if (req.query.start_date && req.query.end_date) {
        filters.start_date = req.query.start_date;
        filters.end_date = req.query.end_date;
      }

      if (req.query.meeting_date) {
        filters.meeting_date = req.query.meeting_date;
      }

      const meetings = await MarketingMeeting.getAll(filters);

      res.json({
        success: true,
        data: meetings,
        count: meetings.length
      });
    } catch (error) {
      logger.error('Error fetching marketing meetings:', error);
      logger.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch meetings',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Get meetings assigned to logged-in salesperson
   * GET /api/marketing/meetings/assigned
   */
  async getAssigned(req, res) {
    try {
      const salespersonEmail = req.user?.email || req.user?.username;

      if (!salespersonEmail) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      logger.info('=== NEW APPROACH: Fetching assigned meetings ===', { 
        salespersonEmail, 
        username: req.user?.username,
        email: req.user?.email,
        departmentType: req.user?.departmentType,
        companyName: req.user?.companyName
      });

      // STEP 1: Get ALL leads from "All Leads" section (using exact same method)
      const SalespersonLead = require('../models/SalespersonLead');
      const DepartmentHeadLead = require('../models/DepartmentHeadLead');
      const { query } = require('../config/database');
      
      const departmentType = req.user?.departmentType || 'marketing';
      const companyName = req.user?.companyName || null;
      
      logger.info('Step 1: Fetching leads from All Leads section...');
      const allLeads = await SalespersonLead.listForUser(
        req.user?.username,
        departmentType,
        companyName,
        req.user?.email
      );
      
      logger.info(`Step 1 Complete: Found ${allLeads.length} leads from All Leads section`);
      
      if (allLeads.length === 0) {
        logger.info('No leads found in All Leads, returning empty meetings array');
        return res.json({
          success: true,
          data: [],
          count: 0
        });
      }
      
      // STEP 2: Extract all lead IDs (dh_lead_id from salesperson_leads = id in department_head_leads)
      const leadIds = allLeads
        .map(lead => lead.dh_lead_id || lead.id)
        .filter(id => id != null)
        .map(id => id.toString()); // Convert to strings for SQL IN clause
      
      logger.info(`Step 2: Extracted ${leadIds.length} lead IDs from All Leads`);
      
      if (leadIds.length === 0) {
        logger.warn('No valid lead IDs found, returning empty meetings array');
        return res.json({
          success: true,
          data: [],
          count: 0
        });
      }
      
      // STEP 3: Query ALL meetings that match these lead IDs (regardless of assigned_to)
      // This ensures we get all meetings for these leads
      const meetingsQuery = `
        SELECT 
          mm.*,
          dhl.customer as lead_customer,
          dhl.phone as lead_phone,
          dhl.email as lead_email,
          dhl.business as lead_business,
          dhl.state as lead_state,
          dhl.address as lead_address,
          dhl.gst_no as lead_gst_no,
          dhl.product_names as lead_product_names,
          dhl.lead_source as lead_lead_source,
          dhl.assigned_salesperson as lead_assigned_salesperson,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM marketing_check_ins mci 
              WHERE mci.meeting_id = mm.id AND mci.status != 'Rejected'
            ) THEN true
            ELSE false
          END as has_checkin,
          (SELECT status FROM marketing_check_ins WHERE meeting_id = mm.id ORDER BY check_in_time DESC LIMIT 1) as checkin_status
        FROM marketing_meetings mm
        JOIN department_head_leads dhl ON (
          (mm.lead_id = dhl.id OR mm.customer_id = dhl.id)
        )
        WHERE (
          mm.lead_id::text = ANY($1::text[])
          OR mm.customer_id::text = ANY($1::text[])
          OR mm.lead_id = ANY($1::integer[])
          OR mm.customer_id = ANY($1::integer[])
        )
        ORDER BY mm.meeting_date ASC, mm.meeting_time ASC
      `;
      
      const meetingsResult = await query(meetingsQuery, [leadIds]);
      const existingMeetings = meetingsResult.rows || [];
      
      logger.info(`Step 3 Complete: Found ${existingMeetings.length} existing meetings for these leads`);
      
      // STEP 4: Create meetings for leads that don't have one
      const existingLeadIds = new Set();
      existingMeetings.forEach(meeting => {
        if (meeting.lead_id) existingLeadIds.add(meeting.lead_id.toString());
        if (meeting.customer_id) existingLeadIds.add(meeting.customer_id.toString());
      });
      
      const leadsWithoutMeetings = allLeads.filter(lead => {
        const leadId = (lead.dh_lead_id || lead.id)?.toString();
        return leadId && !existingLeadIds.has(leadId);
      });
      
      logger.info(`Step 4: Found ${leadsWithoutMeetings.length} leads without meetings, creating meetings...`);
      
      const newMeetings = [];
      let createdCount = 0;
      let errorCount = 0;
      
      for (const lead of leadsWithoutMeetings) {
        try {
          const leadId = lead.dh_lead_id || lead.id;
          
          if (!leadId) {
            logger.warn(`Skipping lead with no ID:`, { lead: { id: lead.id, name: lead.name } });
            errorCount++;
            continue;
          }
          
          logger.info(`Creating meeting for lead ${leadId} (${lead.name || 'unnamed'})...`);
          
          // Get full lead details
          let fullLead;
          try {
            fullLead = await DepartmentHeadLead.getById(
              leadId,
              req.user?.email,
              departmentType,
              companyName
            );
            if (!fullLead) {
              logger.warn(`Could not fetch full lead details for ${leadId}, using salesperson lead data`);
              fullLead = lead;
            }
          } catch (fetchError) {
            logger.warn(`Error fetching lead details for ${leadId}, using salesperson lead data:`, fetchError.message);
            fullLead = lead;
          }
          
          // Generate meeting ID
          let meeting_id;
          try {
            meeting_id = await MarketingMeeting.generateMeetingId();
            logger.debug(`Generated meeting_id: ${meeting_id} for lead ${leadId}`);
          } catch (idError) {
            logger.error(`Error generating meeting ID for lead ${leadId}:`, idError.message);
            // Fallback: create a simple meeting ID
            meeting_id = `MTG-${Date.now()}-${leadId}`;
            logger.warn(`Using fallback meeting_id: ${meeting_id}`);
          }
          
          const meetingDate = new Date().toISOString().split('T')[0];
          
          // Prepare meeting data with all required fields
          // Ensure all string fields are within database limits
          const meetingData = {
            meeting_id,
            customer_id: leadId,
            lead_id: leadId,
            customer_name: String(fullLead.customer || fullLead.name || 'N/A').substring(0, 255),
            customer_phone: fullLead.phone || lead.phone || null,
            customer_email: fullLead.email || lead.email || null,
            address: String(fullLead.address || lead.address || 'Address not provided').substring(0, 500),
            location: null, // Location field (can be null)
            city: fullLead.city || null,
            state: fullLead.state || lead.state || null,
            pincode: fullLead.pincode || null,
            assigned_to: String(salespersonEmail).substring(0, 255),
            assigned_by: String(req.user?.email || req.user?.username || 'system').substring(0, 255),
            meeting_date: meetingDate,
            meeting_time: null,
            scheduled_date: meetingDate,
            status: 'Scheduled',
            notes: `Auto-created from All Leads section`
          };
          
          // Validate required fields
          if (!meetingData.meeting_id) {
            throw new Error('meeting_id is required');
          }
          if (!meetingData.customer_name || meetingData.customer_name === 'N/A') {
            logger.warn(`Lead ${leadId} has no customer name, using fallback`);
            meetingData.customer_name = `Lead ${leadId}`;
          }
          if (!meetingData.assigned_to) {
            throw new Error('assigned_to is required');
          }
          if (!meetingData.meeting_date) {
            throw new Error('meeting_date is required');
          }
          
          logger.debug(`Creating meeting with data:`, {
            meeting_id: meetingData.meeting_id,
            customer_id: meetingData.customer_id,
            lead_id: meetingData.lead_id,
            customer_name: meetingData.customer_name,
            assigned_to: meetingData.assigned_to
          });
          
          const newMeeting = await MarketingMeeting.create(meetingData);
          
          logger.info(`Successfully created meeting ${newMeeting.id} for lead ${leadId}`);
          
          // Enrich the new meeting with lead data
          const enrichedMeeting = {
            ...newMeeting,
            has_checkin: false,
            checkin_status: null,
            lead_customer: fullLead.customer || fullLead.name || 'N/A',
            lead_phone: fullLead.phone || lead.phone || null,
            lead_email: fullLead.email || lead.email || null,
            lead_address: fullLead.address || lead.address || 'Address not provided',
            lead_business: fullLead.business || null,
            lead_state: fullLead.state || lead.state || null,
            lead_gst_no: fullLead.gst_no || null,
            lead_product_names: fullLead.product_names || null,
            lead_lead_source: fullLead.lead_source || null,
            lead_assigned_salesperson: fullLead.assigned_salesperson || null
          };
          
          newMeetings.push(enrichedMeeting);
          createdCount++;
          
          logger.info(`Created meeting for lead ${leadId}:`, {
            meetingId: newMeeting.id,
            customerName: newMeeting.customer_name,
            assignedTo: newMeeting.assigned_to
          });
        } catch (leadError) {
          logger.error(`CRITICAL ERROR creating meeting for lead ${lead.id || lead.dh_lead_id || 'unknown'}:`, {
            error: leadError.message,
            stack: leadError.stack,
            lead: {
              id: lead.id,
              dh_lead_id: lead.dh_lead_id,
              name: lead.name
            }
          });
          errorCount++;
        }
      }
      
      logger.info(`Step 4 Complete: Created ${createdCount} new meetings, ${errorCount} errors`);
      
      // STEP 5: Re-query ALL meetings for these leads to ensure we have complete data
      // This includes the newly created meetings with all their details
      logger.info('Step 5: Re-querying all meetings for these leads to get complete data...');
      const finalMeetingsQuery = `
        SELECT 
          mm.*,
          dhl.customer as lead_customer,
          dhl.phone as lead_phone,
          dhl.email as lead_email,
          dhl.business as lead_business,
          dhl.state as lead_state,
          dhl.address as lead_address,
          dhl.gst_no as lead_gst_no,
          dhl.product_names as lead_product_names,
          dhl.lead_source as lead_lead_source,
          dhl.assigned_salesperson as lead_assigned_salesperson,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM marketing_check_ins mci 
              WHERE mci.meeting_id = mm.id AND mci.status != 'Rejected'
            ) THEN true
            ELSE false
          END as has_checkin,
          (SELECT status FROM marketing_check_ins WHERE meeting_id = mm.id ORDER BY check_in_time DESC LIMIT 1) as checkin_status
        FROM marketing_meetings mm
        JOIN department_head_leads dhl ON (
          (mm.lead_id = dhl.id OR mm.customer_id = dhl.id)
        )
        WHERE (
          mm.lead_id::text = ANY($1::text[])
          OR mm.customer_id::text = ANY($1::text[])
          OR mm.lead_id = ANY($1::integer[])
          OR mm.customer_id = ANY($1::integer[])
        )
        ORDER BY mm.meeting_date ASC, mm.meeting_time ASC
      `;
      
      const finalMeetingsResult = await query(finalMeetingsQuery, [leadIds]);
      const finalMeetings = (finalMeetingsResult.rows || []).map(meeting => ({
        ...meeting,
        customer_name: meeting.lead_customer || meeting.customer_name || 'N/A',
        customer_phone: meeting.lead_phone || meeting.customer_phone || null,
        customer_email: meeting.lead_email || meeting.customer_email || null,
        address: meeting.lead_address || meeting.address || 'Address not provided',
      }));
      
      logger.info(`Step 5 Complete: Returning ${finalMeetings.length} total meetings`);
      logger.info(`=== SUMMARY ===`, {
        totalLeadsFromAllLeads: allLeads.length,
        existingMeetingsFound: existingMeetings.length,
        newMeetingsCreated: createdCount,
        errorsDuringCreation: errorCount,
        finalMeetingsReturned: finalMeetings.length,
        expectedMeetings: allLeads.length
      });
      
      if (finalMeetings.length < allLeads.length && errorCount === 0) {
        logger.warn(`WARNING: Only ${finalMeetings.length} meetings returned but ${allLeads.length} leads found. Some meetings may not have been created.`);
      }
      
      res.json({
        success: true,
        data: finalMeetings,
        count: finalMeetings.length
      });
      
    } catch (error) {
      logger.error('Error fetching assigned meetings:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch assigned meetings',
        error: error.message
      });
    }
  }

  /**
   * Get meeting by ID
   * GET /api/marketing/meetings/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const meeting = await MarketingMeeting.getById(id);

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      res.json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Error fetching meeting:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch meeting',
        error: error.message
      });
    }
  }

  /**
   * Update meeting
   * PUT /api/marketing/meetings/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const meeting = await MarketingMeeting.update(id, updateData);

      logger.info('Marketing meeting updated:', { meeting_id: meeting.id });

      res.json({
        success: true,
        message: 'Meeting updated successfully',
        data: meeting
      });
    } catch (error) {
      logger.error('Error updating meeting:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update meeting',
        error: error.message
      });
    }
  }

  /**
   * Delete meeting
   * DELETE /api/marketing/meetings/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await MarketingMeeting.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      logger.info('Marketing meeting deleted:', { meeting_id: id });

      res.json({
        success: true,
        message: 'Meeting deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting meeting:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete meeting',
        error: error.message
      });
    }
  }
}

module.exports = new MarketingMeetingController();

