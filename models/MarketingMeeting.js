const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class MarketingMeeting extends BaseModel {
  constructor() {
    super('marketing_meetings');
  }

  /**
   * Create a new meeting
   * @param {Object} meetingData - Meeting data
   * @returns {Promise<Object>} Created meeting
   */
  async create(meetingData) {
    const {
      meeting_id,
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
      assigned_by,
      meeting_date,
      meeting_time,
      scheduled_date,
      status = 'Scheduled',
      notes
    } = meetingData;

    const sqlQuery = `
      INSERT INTO marketing_meetings (
        meeting_id, customer_id, lead_id, customer_name, customer_phone, customer_email,
        address, location, city, state, pincode,
        assigned_to, assigned_by, meeting_date, meeting_time, scheduled_date,
        status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      meeting_id, customer_id, lead_id, customer_name, customer_phone, customer_email,
      address, location, city, state, pincode,
      assigned_to, assigned_by, meeting_date, meeting_time, scheduled_date,
      status, notes
    ];

    const result = await query(sqlQuery, values);
    return result.rows[0];
  }

  /**
   * Get all meetings with optional filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of meetings
   */
  async getAll(filters = {}) {
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filters.assigned_to) {
      conditions.push(`mm.assigned_to = $${paramCount++}`);
      values.push(filters.assigned_to);
    }

    if (filters.assigned_by) {
      conditions.push(`mm.assigned_by = $${paramCount++}`);
      values.push(filters.assigned_by);
    }

    if (filters.status) {
      conditions.push(`mm.status = $${paramCount++}`);
      values.push(filters.status);
    }

    if (filters.meeting_date) {
      conditions.push(`mm.meeting_date = $${paramCount++}`);
      values.push(filters.meeting_date);
    }

    if (filters.lead_id) {
      conditions.push(`(mm.lead_id = $${paramCount++} OR mm.customer_id = $${paramCount - 1})`);
      values.push(filters.lead_id);
    }

    if (filters.customer_id) {
      conditions.push(`(mm.customer_id = $${paramCount++} OR mm.lead_id = $${paramCount - 1})`);
      values.push(filters.customer_id);
    }

    if (filters.start_date && filters.end_date) {
      conditions.push(`mm.meeting_date BETWEEN $${paramCount++} AND $${paramCount++}`);
      values.push(filters.start_date, filters.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sqlQuery = `
      SELECT 
        mm.*,
        dhl.customer as lead_customer,
        dhl.phone as lead_phone,
        dhl.email as lead_email,
        dhl.address as lead_address,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM marketing_check_ins mci 
            WHERE mci.meeting_id = mm.id AND mci.status != 'Rejected'
          ) THEN true
          ELSE false
        END as has_checkin,
        (SELECT status FROM marketing_check_ins WHERE meeting_id = mm.id ORDER BY check_in_time DESC LIMIT 1) as checkin_status,
        (SELECT photo_url FROM marketing_check_ins WHERE meeting_id = mm.id ORDER BY check_in_time DESC LIMIT 1) as checkin_photo_url,
        (SELECT latitude FROM marketing_check_ins WHERE meeting_id = mm.id ORDER BY check_in_time DESC LIMIT 1) as checkin_latitude,
        (SELECT longitude FROM marketing_check_ins WHERE meeting_id = mm.id ORDER BY check_in_time DESC LIMIT 1) as checkin_longitude
      FROM marketing_meetings mm
      LEFT JOIN department_head_leads dhl ON (
        (mm.lead_id IS NOT NULL AND dhl.id = mm.lead_id)
        OR (mm.customer_id IS NOT NULL AND dhl.id = mm.customer_id)
      )
      ${whereClause}
      ORDER BY mm.meeting_date DESC, mm.created_at DESC
    `;

    const result = await query(sqlQuery, values);
    
    // Enrich meeting data with lead details
    return result.rows.map(meeting => {
      const isEmpty = (val) => !val || val === null || val === undefined || (typeof val === 'string' && val.trim() === '') || val === 'N/A' || val === 'Address not provided';
      
      return {
        ...meeting,
        // Use lead data if meeting data is missing or empty
        customer_name: !isEmpty(meeting.lead_customer) ? meeting.lead_customer : (meeting.customer_name || 'N/A'),
        customer_phone: !isEmpty(meeting.lead_phone) ? meeting.lead_phone : (meeting.customer_phone || null),
        customer_email: !isEmpty(meeting.lead_email) ? meeting.lead_email : (meeting.customer_email || null),
        address: !isEmpty(meeting.lead_address) ? meeting.lead_address : (meeting.address || 'Address not provided'),
        // Check-in status
        is_checked_in: meeting.has_checkin || meeting.status === 'Completed'
      };
    });
  }

  /**
   * Get meetings assigned to a specific salesperson
   * Only returns meetings that have valid leads (exist in department_head_leads)
   * @param {string} salespersonEmail - Salesperson email/ID
   * @returns {Promise<Array>} Array of assigned meetings
   */
  async getAssignedTo(salespersonIdentifier) {
    // Use case-insensitive matching to handle email/username variations
    // Match by both email and username by checking department_users table
    // Join with department_head_leads to get additional lead details
    // Return ALL meetings assigned to this salesperson, regardless of lead existence
    const sqlQuery = `
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
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM marketing_check_ins mci 
            WHERE mci.meeting_id = mm.id AND mci.status != 'Rejected'
          ) THEN true
          ELSE false
        END as has_checkin,
        (SELECT status FROM marketing_check_ins WHERE meeting_id = mm.id ORDER BY check_in_time DESC LIMIT 1) as checkin_status
      FROM marketing_meetings mm
      LEFT JOIN department_head_leads dhl ON (
        (mm.lead_id IS NOT NULL AND dhl.id::text = mm.lead_id::text)
        OR (mm.customer_id IS NOT NULL AND dhl.id::text = mm.customer_id::text)
        OR (mm.lead_id IS NOT NULL AND dhl.id = mm.lead_id::integer)
        OR (mm.customer_id IS NOT NULL AND dhl.id = mm.customer_id::integer)
      )
      WHERE (
        -- Direct match (case-insensitive)
        LOWER(TRIM(mm.assigned_to)) = LOWER(TRIM($1))
        -- Partial match (handles cases where assigned_to might have extra characters)
        OR LOWER(TRIM(mm.assigned_to)) LIKE LOWER(TRIM($1) || '%')
        OR LOWER(TRIM($1)) LIKE LOWER(TRIM(mm.assigned_to) || '%')
        -- Match through department_users table
        OR EXISTS (
          SELECT 1 FROM department_users du
          WHERE (
            (LOWER(TRIM(du.email)) = LOWER(TRIM($1)) OR LOWER(TRIM(du.username)) = LOWER(TRIM($1)))
            AND (
              LOWER(TRIM(du.email)) = LOWER(TRIM(mm.assigned_to)) 
              OR LOWER(TRIM(du.username)) = LOWER(TRIM(mm.assigned_to))
              OR LOWER(TRIM(du.email)) LIKE LOWER(TRIM(mm.assigned_to) || '%')
              OR LOWER(TRIM(du.username)) LIKE LOWER(TRIM(mm.assigned_to) || '%')
              OR LOWER(TRIM(mm.assigned_to)) LIKE LOWER(TRIM(du.email) || '%')
              OR LOWER(TRIM(mm.assigned_to)) LIKE LOWER(TRIM(du.username) || '%')
            )
          )
        )
      )
      ORDER BY mm.meeting_date ASC, mm.meeting_time ASC
    `;

    console.log('Fetching meetings for salesperson:', salespersonIdentifier);
    const result = await query(sqlQuery, [salespersonIdentifier]);
    console.log('Found meetings:', result.rows.length, 'for identifier:', salespersonIdentifier);
    
    // If join didn't work, fetch lead data directly for each meeting
    for (let i = 0; i < result.rows.length; i++) {
      const meeting = result.rows[i];
      // If we don't have lead data from join, fetch it directly
      if (!meeting.lead_customer && (meeting.lead_id || meeting.customer_id)) {
        try {
          const leadId = meeting.lead_id || meeting.customer_id;
          const leadQuery = 'SELECT customer, address, phone, email, state FROM department_head_leads WHERE id = $1';
          const leadResult = await query(leadQuery, [leadId]);
          if (leadResult.rows.length > 0) {
            const lead = leadResult.rows[0];
            meeting.lead_customer = lead.customer;
            meeting.lead_address = lead.address;
            meeting.lead_phone = lead.phone;
            meeting.lead_email = lead.email;
            meeting.lead_state = lead.state;
            console.log('Fetched lead data directly for meeting:', meeting.id, lead);
          }
        } catch (err) {
          console.error('Error fetching lead data for meeting:', meeting.id, err);
        }
      }
    }
    
    // Helper function to check if a value is empty
    const isEmpty = (val) => !val || val === null || val === undefined || (typeof val === 'string' && val.trim() === '') || val === 'N/A' || val === 'Address not provided';
    
    // Enrich meeting data with lead details if available
    const enrichedMeetings = result.rows.map(meeting => {
      // Log the raw meeting data for debugging
      console.log('Raw meeting data:', {
        id: meeting.id,
        customer_name: meeting.customer_name,
        lead_customer: meeting.lead_customer,
        lead_name: meeting.lead_name,
        address: meeting.address,
        lead_address: meeting.lead_address,
        location: meeting.location,
        lead_id: meeting.lead_id,
        customer_id: meeting.customer_id,
        dhl_joined: !!meeting.lead_customer
      });
      
      // Always prioritize lead data when available (lead is source of truth)
      // Priority: lead_customer > meeting.customer_name > 'N/A'
      let customerName = meeting.lead_customer;
      if (isEmpty(customerName)) {
        customerName = meeting.customer_name;
      }
      if (isEmpty(customerName)) {
        customerName = 'N/A';
      }
      
      // Priority: lead_address > location > meeting.address > 'Address not provided'
      let address = meeting.lead_address;
      if (isEmpty(address)) {
        address = meeting.location;
      }
      if (isEmpty(address)) {
        address = meeting.address;
      }
      if (isEmpty(address)) {
        address = 'Address not provided';
      }
      
      const phone = !isEmpty(meeting.customer_phone) 
        ? meeting.customer_phone 
        : (!isEmpty(meeting.lead_phone) ? meeting.lead_phone : null);
      
      const email = !isEmpty(meeting.customer_email) 
        ? meeting.customer_email 
        : (!isEmpty(meeting.lead_email) ? meeting.lead_email : null);
      
      const enriched = {
        ...meeting,
        // Always use enriched values
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        address: address,
        state: !isEmpty(meeting.state) ? meeting.state : (meeting.lead_state || null),
        // Check-in status
        is_checked_in: meeting.has_checkin || meeting.status === 'Completed' || false,
        business: meeting.lead_business || null,
        gst_no: meeting.lead_gst_no || null,
        product_names: meeting.lead_product_names || null,
        lead_source: meeting.lead_lead_source || null
      };
      
      console.log('Enriched meeting:', {
        id: enriched.id,
        customer_name: enriched.customer_name,
        address: enriched.address
      });
      
      return enriched;
    });
    
    console.log('Enriched meetings sample:', enrichedMeetings[0]);
    return enrichedMeetings;
  }

  /**
   * Get meeting by ID
   * @param {string} id - Meeting UUID
   * @returns {Promise<Object|null>} Meeting or null
   */
  async getById(id) {
    const sqlQuery = `
      SELECT * FROM marketing_meetings
      WHERE id = $1
    `;

    const result = await query(sqlQuery, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get meeting by meeting_id
   * @param {string} meetingId - Meeting ID string
   * @returns {Promise<Object|null>} Meeting or null
   */
  async getByMeetingId(meetingId) {
    const sqlQuery = `
      SELECT * FROM marketing_meetings
      WHERE meeting_id = $1
    `;

    const result = await query(sqlQuery, [meetingId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update meeting
   * @param {string} id - Meeting UUID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated meeting
   */
  async update(id, updateData) {
    const allowedFields = [
      'customer_name', 'customer_phone', 'customer_email',
      'address', 'location', 'city', 'state', 'pincode',
      'assigned_to', 'meeting_date', 'meeting_time', 'scheduled_date',
      'status', 'notes'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const sqlQuery = `
      UPDATE marketing_meetings
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    console.log('Updating meeting:', {
      id,
      updateData,
      sqlQuery: sqlQuery.replace(/\$\d+/g, '?'),
      values
    });

    const result = await query(sqlQuery, values);
    if (result.rows.length === 0) {
      console.error('Meeting not found for update:', id);
      throw new Error('Meeting not found');
    }

    console.log('Meeting updated successfully:', {
      id: result.rows[0].id,
      status: result.rows[0].status,
      updated_at: result.rows[0].updated_at
    });

    return result.rows[0];
  }

  /**
   * Delete meeting
   * @param {string} id - Meeting UUID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const sqlQuery = `
      DELETE FROM marketing_meetings
      WHERE id = $1
      RETURNING id
    `;

    const result = await query(sqlQuery, [id]);
    return result.rows.length > 0;
  }

  /**
   * Clean up orphaned meetings (meetings without valid leads)
   * @returns {Promise<number>} Number of meetings deleted
   */
  async cleanupOrphanedMeetings() {
    const sqlQuery = `
      DELETE FROM marketing_meetings
      WHERE (lead_id IS NOT NULL OR customer_id IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM department_head_leads dhl 
          WHERE (marketing_meetings.lead_id IS NOT NULL AND dhl.id = marketing_meetings.lead_id)
             OR (marketing_meetings.customer_id IS NOT NULL AND dhl.id = marketing_meetings.customer_id)
        )
      RETURNING id
    `;

    const result = await query(sqlQuery);
    return result.rows.length;
  }

  /**
   * Generate unique meeting ID with retry logic to handle duplicates
   * @returns {Promise<string>} Unique meeting ID
   */
  async generateMeetingId() {
    const prefix = 'MTG';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Use timestamp-based approach with random component to ensure uniqueness
    // This prevents race conditions when multiple meetings are created simultaneously
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // Base ID: MTG-YYMMDD-TIMESTAMP-RANDOM
    let meetingId = `${prefix}-${year}${month}${day}-${timestamp}-${random}`;
    
    // Check if this ID already exists (very unlikely but check anyway)
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const checkQuery = `
        SELECT id FROM marketing_meetings WHERE meeting_id = $1 LIMIT 1
      `;
      const checkResult = await query(checkQuery, [meetingId]);
      
      if (checkResult.rows.length === 0) {
        // ID is unique, return it
        return meetingId;
      }
      
      // If ID exists, generate a new one with updated timestamp and random
      attempts++;
      const newTimestamp = Date.now();
      const newRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      meetingId = `${prefix}-${year}${month}${day}-${newTimestamp}-${newRandom}`;
    }
    
    // Fallback: if all attempts failed (extremely unlikely), use UUID-like format
    const crypto = require('crypto');
    const uuid = crypto.randomUUID().substring(0, 8).toUpperCase();
    return `${prefix}-${year}${month}${day}-${uuid}`;
  }
}

module.exports = new MarketingMeeting();

