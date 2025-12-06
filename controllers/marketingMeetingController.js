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

      // Generate unique meeting ID
      const meeting_id = await MarketingMeeting.generateMeetingId();

      // Use scheduled_date if provided, otherwise use meeting_date
      const finalScheduledDate = scheduled_date || meeting_date;

      const meeting = await MarketingMeeting.create({
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

      const meetings = await MarketingMeeting.getAssignedTo(salespersonEmail);

      res.json({
        success: true,
        data: meetings,
        count: meetings.length
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

