const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class MarketingCheckIn extends BaseModel {
  constructor() {
    super('marketing_check_ins');
  }

  /**
   * Create a new check-in
   * @param {Object} checkInData - Check-in data
   * @returns {Promise<Object>} Created check-in
   */
  async create(checkInData) {
    const {
      meeting_id,
      salesperson_id,
      salesperson_email,
      salesperson_name,
      photo_url,
      latitude,
      longitude,
      address,
      city,
      state,
      pincode,
      check_in_time,
      status = 'Pending Review',
      notes
    } = checkInData;

    const sqlQuery = `
      INSERT INTO marketing_check_ins (
        meeting_id, salesperson_id, salesperson_email, salesperson_name,
        photo_url, latitude, longitude, address, city, state, pincode,
        check_in_time, status, notes, distance_from_meeting, location_validated, validation_message, photo_taken_at, photo_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const values = [
      meeting_id, salesperson_id, salesperson_email, salesperson_name,
      photo_url, latitude, longitude, address, city, state, pincode,
      check_in_time || new Date(), status, notes,
      checkInData.distance_from_meeting || null,
      checkInData.location_validated || false,
      checkInData.validation_message || null,
      checkInData.photo_taken_at || null,
      checkInData.photo_source || 'camera'
    ];

    const result = await query(sqlQuery, values);
    return result.rows[0];
  }

  /**
   * Get all check-ins with optional filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of check-ins
   */
  async getAll(filters = {}) {
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filters.meeting_id) {
      conditions.push(`meeting_id = $${paramCount++}`);
      values.push(filters.meeting_id);
    }

    if (filters.salesperson_email) {
      conditions.push(`salesperson_email = $${paramCount++}`);
      values.push(filters.salesperson_email);
    }

    if (filters.status) {
      conditions.push(`status = $${paramCount++}`);
      values.push(filters.status);
    }

    if (filters.start_date && filters.end_date) {
      conditions.push(`check_in_time BETWEEN $${paramCount++} AND $${paramCount++}`);
      values.push(filters.start_date, filters.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sqlQuery = `
      SELECT 
        ci.*,
        m.meeting_id as meeting_identifier,
        m.customer_name,
        m.address as meeting_address
      FROM marketing_check_ins ci
      LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
      ${whereClause}
      ORDER BY ci.check_in_time DESC
    `;

    const result = await query(sqlQuery, values);
    return result.rows;
  }

  /**
   * Get check-ins for a specific meeting
   * @param {string} meetingId - Meeting UUID
   * @returns {Promise<Array>} Array of check-ins
   */
  async getByMeetingId(meetingId) {
    const sqlQuery = `
      SELECT 
        ci.*,
        m.meeting_id as meeting_identifier,
        m.customer_name,
        m.address as meeting_address
      FROM marketing_check_ins ci
      LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
      WHERE ci.meeting_id = $1
      ORDER BY ci.check_in_time DESC
    `;

    const result = await query(sqlQuery, [meetingId]);
    return result.rows;
  }

  /**
   * Get check-ins by salesperson
   * @param {string} salespersonEmail - Salesperson email/ID
   * @returns {Promise<Array>} Array of check-ins
   */
  async getBySalesperson(salespersonEmail) {
    const sqlQuery = `
      SELECT 
        ci.*,
        m.meeting_id as meeting_identifier,
        m.customer_name,
        m.address as meeting_address,
        m.meeting_date,
        m.meeting_time
      FROM marketing_check_ins ci
      LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
      WHERE ci.salesperson_email = $1
      ORDER BY ci.check_in_time DESC
    `;

    const result = await query(sqlQuery, [salespersonEmail]);
    return result.rows;
  }

  /**
   * Get check-in by ID
   * @param {string} id - Check-in UUID
   * @returns {Promise<Object|null>} Check-in or null
   */
  async getById(id) {
    const sqlQuery = `
      SELECT 
        ci.*,
        m.meeting_id as meeting_identifier,
        m.customer_name,
        m.address as meeting_address,
        m.meeting_date,
        m.meeting_time
      FROM marketing_check_ins ci
      LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
      WHERE ci.id = $1
    `;

    const result = await query(sqlQuery, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Check if a duplicate check-in exists for the same meeting and salesperson
   * @param {string} meetingId - Meeting UUID
   * @param {string} salespersonEmail - Salesperson email
   * @returns {Promise<Object|null>} Existing check-in or null
   */
  async findExistingCheckIn(meetingId, salespersonEmail) {
    const sqlQuery = `
      SELECT * FROM marketing_check_ins
      WHERE meeting_id = $1 
        AND salesperson_email = $2
        AND status != 'Rejected'
      ORDER BY check_in_time DESC
      LIMIT 1
    `;

    const result = await query(sqlQuery, [meetingId, salespersonEmail]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update check-in status
   * @param {string} id - Check-in UUID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated check-in
   */
  async update(id, updateData) {
    const allowedFields = ['status', 'notes', 'distance_from_meeting', 'location_validated', 'validation_message'];

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
      UPDATE marketing_check_ins
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(sqlQuery, values);
    if (result.rows.length === 0) {
      throw new Error('Check-in not found');
    }

    return result.rows[0];
  }
}

module.exports = new MarketingCheckIn();

