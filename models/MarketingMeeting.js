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
      conditions.push(`assigned_to = $${paramCount++}`);
      values.push(filters.assigned_to);
    }

    if (filters.assigned_by) {
      conditions.push(`assigned_by = $${paramCount++}`);
      values.push(filters.assigned_by);
    }

    if (filters.status) {
      conditions.push(`status = $${paramCount++}`);
      values.push(filters.status);
    }

    if (filters.meeting_date) {
      conditions.push(`meeting_date = $${paramCount++}`);
      values.push(filters.meeting_date);
    }

    if (filters.start_date && filters.end_date) {
      conditions.push(`meeting_date BETWEEN $${paramCount++} AND $${paramCount++}`);
      values.push(filters.start_date, filters.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sqlQuery = `
      SELECT * FROM marketing_meetings
      ${whereClause}
      ORDER BY meeting_date DESC, created_at DESC
    `;

    const result = await query(sqlQuery, values);
    return result.rows;
  }

  /**
   * Get meetings assigned to a specific salesperson
   * @param {string} salespersonEmail - Salesperson email/ID
   * @returns {Promise<Array>} Array of assigned meetings
   */
  async getAssignedTo(salespersonEmail) {
    const sqlQuery = `
      SELECT * FROM marketing_meetings
      WHERE assigned_to = $1
      ORDER BY meeting_date ASC, meeting_time ASC
    `;

    const result = await query(sqlQuery, [salespersonEmail]);
    return result.rows;
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

    const result = await query(sqlQuery, values);
    if (result.rows.length === 0) {
      throw new Error('Meeting not found');
    }

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
   * Generate unique meeting ID
   * @returns {Promise<string>} Unique meeting ID
   */
  async generateMeetingId() {
    const prefix = 'MTG';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Get count of meetings today
    const today = date.toISOString().split('T')[0];
    const countQuery = `
      SELECT COUNT(*) as count FROM marketing_meetings
      WHERE DATE(created_at) = $1
    `;
    const countResult = await query(countQuery, [today]);
    const count = parseInt(countResult.rows[0].count) + 1;
    
    return `${prefix}-${year}${month}${String(count).padStart(4, '0')}`;
  }
}

module.exports = new MarketingMeeting();

