const MarketingCheckIn = require('../models/MarketingCheckIn');
const MarketingMeeting = require('../models/MarketingMeeting');
const cloudinaryService = require('../services/cloudinaryService');
const { validateLocationProximity, validateTimeWindow } = require('../utils/locationUtils');
const logger = require('../utils/logger');

class MarketingCheckInController {
  /**
   * Create a new check-in (with photo upload)
   * POST /api/marketing/check-ins
   */
  async create(req, res) {
    try {
      const {
        meeting_id,
        latitude,
        longitude,
        address,
        city,
        state,
        pincode,
        notes
      } = req.body;

      // Validation
      if (!meeting_id) {
        return res.status(400).json({
          success: false,
          message: 'meeting_id is required'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Photo is required for check-in'
        });
      }

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'latitude and longitude are required'
        });
      }

      // Verify meeting exists
      const meeting = await MarketingMeeting.getById(meeting_id);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Get salesperson info from authenticated user
      const salespersonEmail = req.user?.email || req.user?.username;
      const salespersonName = req.user?.name || req.user?.username || 'Unknown';
      const salespersonId = req.user?.id || null;

      if (!salespersonEmail) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      // SECURITY VALIDATION 1: Check for duplicate check-ins
      const existingCheckIn = await MarketingCheckIn.findExistingCheckIn(meeting_id, salespersonEmail);
      if (existingCheckIn) {
        return res.status(400).json({
          success: false,
          message: 'You have already checked in for this meeting. Duplicate check-ins are not allowed.',
          existing_check_in: {
            id: existingCheckIn.id,
            check_in_time: existingCheckIn.check_in_time,
            status: existingCheckIn.status
          }
        });
      }

      // SECURITY VALIDATION 2: Verify salesperson is assigned to this meeting
      if (meeting.assigned_to !== salespersonEmail) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this meeting. Only the assigned salesperson can check in.'
        });
      }

      // SECURITY VALIDATION 3: Time window validation (only allow check-in on scheduled date ± time window)
      const checkInTime = new Date();
      const timeValidation = validateTimeWindow(
        meeting.meeting_date,
        checkInTime,
        2, // Allow 2 hours before meeting date
        24  // Allow 24 hours after meeting date
      );

      if (!timeValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: timeValidation.message,
          validation_error: 'time_window'
        });
      }

      // SECURITY VALIDATION 4: Location proximity validation (if meeting has coordinates)
      const checkInLat = parseFloat(latitude);
      const checkInLon = parseFloat(longitude);
      let locationValidation = { isValid: true, distance: null, message: '' };
      
      if (meeting.meeting_latitude && meeting.meeting_longitude) {
        locationValidation = validateLocationProximity(
          checkInLat,
          checkInLon,
          parseFloat(meeting.meeting_latitude),
          parseFloat(meeting.meeting_longitude),
          500 // 500 meters max radius (configurable)
        );

        // Log validation but don't block submission - allow with warning
        // Sales Head can review and reject if location is too far
        logger.info('Location validation:', {
          meeting_id,
          distance: locationValidation.distance,
          isValid: locationValidation.isValid,
          message: locationValidation.message
        });
      }

      // Upload photo to Cloudinary
      let photoUrl;
      try {
        photoUrl = await cloudinaryService.uploadFile(req.file.buffer, {
          folder: 'marketing-check-ins',
          resourceType: 'image'
        });
        logger.info('Check-in photo uploaded to Cloudinary:', photoUrl);
      } catch (cloudinaryError) {
        logger.error('Cloudinary upload error:', cloudinaryError);
        return res.status(500).json({
          success: false,
          message: cloudinaryError.message || 'Failed to upload photo',
          error: cloudinaryError.message
        });
      }

      // SECURITY: Extract photo metadata (EXIF timestamp if available)
      // For now, we'll use current time, but this can be enhanced with EXIF parsing
      const photoTakenAt = new Date(); // In future, extract from EXIF data
      // checkInTime already defined above for time window validation

      // Create check-in record with validation data
      const checkIn = await MarketingCheckIn.create({
        meeting_id,
        salesperson_id: salespersonId,
        salesperson_email: salespersonEmail,
        salesperson_name: salespersonName,
        photo_url: photoUrl,
        latitude: checkInLat,
        longitude: checkInLon,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        check_in_time: checkInTime,
        status: 'Pending Review',
        notes: notes || null,
        distance_from_meeting: locationValidation.distance || null,
        location_validated: locationValidation.isValid,
        validation_message: locationValidation.message,
        photo_taken_at: photoTakenAt,
        photo_source: req.body.photo_source || 'camera' // 'camera' or 'upload'
      });

      // Update meeting status to 'Completed' if it was 'Scheduled' or 'In Progress'
      if (meeting.status === 'Scheduled' || meeting.status === 'In Progress') {
        await MarketingMeeting.update(meeting_id, { status: 'Completed' });
      }

      logger.info('Marketing check-in created:', {
        check_in_id: checkIn.id,
        meeting_id,
        salesperson_email: salespersonEmail
      });

      res.status(201).json({
        success: true,
        message: 'Check-in submitted successfully',
        data: checkIn
      });
    } catch (error) {
      logger.error('Error creating check-in:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create check-in',
        error: error.message
      });
    }
  }

  /**
   * Get all check-ins (for Marketing Sales Head)
   * GET /api/marketing/check-ins
   */
  async getAll(req, res) {
    try {
      const filters = {};

      // Optional query filters
      if (req.query.status) {
        filters.status = req.query.status;
      }

      if (req.query.salesperson_email) {
        filters.salesperson_email = req.query.salesperson_email;
      }

      if (req.query.start_date && req.query.end_date) {
        filters.start_date = req.query.start_date;
        filters.end_date = req.query.end_date;
      }

      const checkIns = await MarketingCheckIn.getAll(filters);

      res.json({
        success: true,
        data: checkIns,
        count: checkIns.length
      });
    } catch (error) {
      logger.error('Error fetching check-ins:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch check-ins',
        error: error.message
      });
    }
  }

  /**
   * Get check-ins for a specific meeting
   * GET /api/marketing/check-ins/meeting/:meetingId
   */
  async getByMeetingId(req, res) {
    try {
      const { meetingId } = req.params;
      const checkIns = await MarketingCheckIn.getByMeetingId(meetingId);

      res.json({
        success: true,
        data: checkIns,
        count: checkIns.length
      });
    } catch (error) {
      logger.error('Error fetching check-ins by meeting:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch check-ins',
        error: error.message
      });
    }
  }

  /**
   * Get check-ins for logged-in salesperson
   * GET /api/marketing/check-ins/my-checkins
   */
  async getMyCheckIns(req, res) {
    try {
      const salespersonEmail = req.user?.email || req.user?.username;

      if (!salespersonEmail) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const checkIns = await MarketingCheckIn.getBySalesperson(salespersonEmail);

      res.json({
        success: true,
        data: checkIns,
        count: checkIns.length
      });
    } catch (error) {
      logger.error('Error fetching my check-ins:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch check-ins',
        error: error.message
      });
    }
  }

  /**
   * Get check-in by ID
   * GET /api/marketing/check-ins/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const checkIn = await MarketingCheckIn.getById(id);

      if (!checkIn) {
        return res.status(404).json({
          success: false,
          message: 'Check-in not found'
        });
      }

      res.json({
        success: true,
        data: checkIn
      });
    } catch (error) {
      logger.error('Error fetching check-in:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch check-in',
        error: error.message
      });
    }
  }

  /**
   * Update check-in status (for Sales Head to verify/reject)
   * PUT /api/marketing/check-ins/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!status && !notes) {
        return res.status(400).json({
          success: false,
          message: 'status or notes is required'
        });
      }

      const updateData = {};
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;

      const checkIn = await MarketingCheckIn.update(id, updateData);

      logger.info('Check-in status updated:', { check_in_id: id, status });

      res.json({
        success: true,
        message: 'Check-in updated successfully',
        data: checkIn
      });
    } catch (error) {
      logger.error('Error updating check-in:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update check-in',
        error: error.message
      });
    }
  }
}

module.exports = new MarketingCheckInController();

