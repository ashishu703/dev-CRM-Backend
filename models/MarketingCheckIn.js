const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class MarketingCheckIn extends BaseModel {
  constructor() {
    super('marketing_check_ins');
  }

  /**
   * Check if is_deleted column exists in department_head_leads table
   * @returns {Promise<boolean>}
   */
  async hasIsDeletedColumn() {
    try {
      const columnCheckQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'department_head_leads' 
        AND column_name = 'is_deleted'
      `;
      const columnCheck = await query(columnCheckQuery);
      return columnCheck.rows.length > 0;
    } catch (e) {
      return false;
    }
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

    console.log('Creating check-in record:', {
      meeting_id,
      salesperson_email,
      photo_url: photo_url ? 'present' : 'missing',
      latitude,
      longitude
    });

    const result = await query(sqlQuery, values);
    
    console.log('Check-in record created successfully:', {
      check_in_id: result.rows[0].id,
      meeting_id: result.rows[0].meeting_id,
      status: result.rows[0].status
    });

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

    // Check if is_deleted column exists
    const hasIsDeletedColumn = await this.hasIsDeletedColumn();

    // Build query based on whether column exists
    let sqlQuery;
    if (hasIsDeletedColumn) {
      sqlQuery = `
        SELECT 
          ci.id,
          ci.meeting_id,
          ci.salesperson_id,
          ci.salesperson_email,
          ci.salesperson_name,
          ci.photo_url,
          ci.latitude,
          ci.longitude,
          ci.address,
          ci.city,
          ci.state,
          ci.pincode,
          ci.check_in_time,
          ci.status,
          ci.notes,
          ci.distance_from_meeting,
          ci.location_validated,
          ci.validation_message,
          ci.photo_taken_at,
          ci.photo_source,
          ci.created_at,
          m.meeting_id as meeting_identifier,
          CASE 
            WHEN m.customer_name IS NOT NULL 
              AND m.customer_name != '' 
              AND LOWER(TRIM(m.customer_name)) NOT IN ('n/a', 'na', 'null')
            THEN m.customer_name
            WHEN dhl.customer IS NOT NULL 
              AND dhl.customer != '' 
              AND LOWER(TRIM(dhl.customer)) NOT IN ('n/a', 'na', 'null')
            THEN dhl.customer
            ELSE 'Meeting'
          END as customer_name,
          m.customer_phone,
          m.customer_email,
          m.address as meeting_address,
          m.city as meeting_city,
          m.state as meeting_state,
          m.lead_id,
          m.customer_id,
          COALESCE(dhl.is_deleted, FALSE) as lead_is_deleted,
          dhl.deleted_at as lead_deleted_at
        FROM marketing_check_ins ci
        LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
        LEFT JOIN department_head_leads dhl ON (
          (m.lead_id IS NOT NULL AND dhl.id::text = m.lead_id::text)
          OR (m.customer_id IS NOT NULL AND dhl.id::text = m.customer_id::text)
          OR (m.lead_id IS NOT NULL AND dhl.id = m.lead_id::integer)
          OR (m.customer_id IS NOT NULL AND dhl.id = m.customer_id::integer)
        )
        ${whereClause}
        ORDER BY ci.check_in_time DESC
      `;
    } else {
      sqlQuery = `
      SELECT 
          ci.id,
          ci.meeting_id,
          ci.salesperson_id,
          ci.salesperson_email,
          ci.salesperson_name,
          ci.photo_url,
          ci.latitude,
          ci.longitude,
          ci.address,
          ci.city,
          ci.state,
          ci.pincode,
          ci.check_in_time,
          ci.status,
          ci.notes,
          ci.distance_from_meeting,
          ci.location_validated,
          ci.validation_message,
          ci.photo_taken_at,
          ci.photo_source,
          ci.created_at,
        m.meeting_id as meeting_identifier,
          CASE 
            WHEN m.customer_name IS NOT NULL 
              AND m.customer_name != '' 
              AND LOWER(TRIM(m.customer_name)) NOT IN ('n/a', 'na', 'null')
            THEN m.customer_name
            WHEN dhl.customer IS NOT NULL 
              AND dhl.customer != '' 
              AND LOWER(TRIM(dhl.customer)) NOT IN ('n/a', 'na', 'null')
            THEN dhl.customer
            ELSE 'Meeting'
          END as customer_name,
          m.customer_phone,
          m.customer_email,
          m.address as meeting_address,
          m.city as meeting_city,
          m.state as meeting_state,
          m.lead_id,
          m.customer_id,
          FALSE as lead_is_deleted,
          NULL as lead_deleted_at
      FROM marketing_check_ins ci
      LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
        LEFT JOIN department_head_leads dhl ON (
          (m.lead_id IS NOT NULL AND dhl.id::text = m.lead_id::text)
          OR (m.customer_id IS NOT NULL AND dhl.id::text = m.customer_id::text)
          OR (m.lead_id IS NOT NULL AND dhl.id = m.lead_id::integer)
          OR (m.customer_id IS NOT NULL AND dhl.id = m.customer_id::integer)
        )
      ${whereClause}
      ORDER BY ci.check_in_time DESC
    `;
    }

    console.log('Fetching all check-ins with query:', sqlQuery.replace(/\$\d+/g, '?'));
    console.log('Query values:', values);

    try {
    const result = await query(sqlQuery, values);
      
      console.log('=== DATABASE QUERY RESULT ===');
      console.log('Found check-ins:', result.rows.length);
      console.log('Query executed successfully');
      
      if (result.rows.length > 0) {
        console.log('Sample check-in data (first record):', {
          id: result.rows[0].id,
          meeting_id: result.rows[0].meeting_id,
          photo_url: result.rows[0].photo_url ? (result.rows[0].photo_url.substring(0, 80) + '...') : 'MISSING - THIS IS A PROBLEM!',
          latitude: result.rows[0].latitude,
          longitude: result.rows[0].longitude,
          customer_name: result.rows[0].customer_name || 'NULL',
          salesperson_email: result.rows[0].salesperson_email,
          check_in_time: result.rows[0].check_in_time,
          status: result.rows[0].status
        });
        
        // Verify all required fields are present
        const hasPhoto = !!result.rows[0].photo_url;
        const hasLocation = !!(result.rows[0].latitude && result.rows[0].longitude);
        console.log('Data validation:', {
          has_photo: hasPhoto,
          has_location: hasLocation,
          has_customer_name: !!result.rows[0].customer_name
        });
      } else {
        console.log('⚠️ NO CHECK-INS FOUND IN DATABASE');
        console.log('This could mean:');
        console.log('1. No check-ins have been created yet');
        console.log('2. Check-ins exist but query filters are excluding them');
        console.log('3. Database connection issue');
      }

    return result.rows;
    } catch (dbError) {
      console.error('=== DATABASE QUERY ERROR ===');
      console.error('Error executing query:', dbError.message);
      console.error('SQL Query:', sqlQuery);
      console.error('Query values:', values);
      throw dbError;
    }
  }

  /**
   * Get check-ins for a specific meeting
   * @param {string} meetingId - Meeting UUID
   * @returns {Promise<Array>} Array of check-ins
   */
  async getByMeetingId(meetingId) {
    const hasIsDeletedColumn = await this.hasIsDeletedColumn();

    let sqlQuery;
    if (hasIsDeletedColumn) {
      sqlQuery = `
      SELECT 
        ci.*,
        m.meeting_id as meeting_identifier,
          CASE 
            WHEN m.customer_name IS NOT NULL 
              AND m.customer_name != '' 
              AND LOWER(TRIM(m.customer_name)) NOT IN ('n/a', 'na', 'null')
            THEN m.customer_name
            WHEN dhl.customer IS NOT NULL 
              AND dhl.customer != '' 
              AND LOWER(TRIM(dhl.customer)) NOT IN ('n/a', 'na', 'null')
            THEN dhl.customer
            ELSE 'Meeting'
          END as customer_name,
          m.address as meeting_address,
          m.lead_id,
          m.customer_id,
          COALESCE(dhl.is_deleted, FALSE) as lead_is_deleted,
          dhl.deleted_at as lead_deleted_at
      FROM marketing_check_ins ci
      LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
      LEFT JOIN department_head_leads dhl ON (
        (m.lead_id IS NOT NULL AND dhl.id::text = m.lead_id::text)
        OR (m.customer_id IS NOT NULL AND dhl.id::text = m.customer_id::text)
        OR (m.lead_id IS NOT NULL AND dhl.id = m.lead_id::integer)
        OR (m.customer_id IS NOT NULL AND dhl.id = m.customer_id::integer)
      )
      WHERE ci.meeting_id = $1
      ORDER BY ci.check_in_time DESC
    `;
    } else {
      sqlQuery = `
        SELECT 
          ci.*,
          m.meeting_id as meeting_identifier,
          CASE 
            WHEN m.customer_name IS NOT NULL 
              AND m.customer_name != '' 
              AND LOWER(TRIM(m.customer_name)) NOT IN ('n/a', 'na', 'null')
            THEN m.customer_name
            WHEN dhl.customer IS NOT NULL 
              AND dhl.customer != '' 
              AND LOWER(TRIM(dhl.customer)) NOT IN ('n/a', 'na', 'null')
            THEN dhl.customer
            ELSE 'Meeting'
          END as customer_name,
          m.address as meeting_address,
          m.lead_id,
          m.customer_id,
          FALSE as lead_is_deleted,
          NULL as lead_deleted_at
        FROM marketing_check_ins ci
        LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
        LEFT JOIN department_head_leads dhl ON (
          (m.lead_id IS NOT NULL AND dhl.id::text = m.lead_id::text)
          OR (m.customer_id IS NOT NULL AND dhl.id::text = m.customer_id::text)
          OR (m.lead_id IS NOT NULL AND dhl.id = m.lead_id::integer)
          OR (m.customer_id IS NOT NULL AND dhl.id = m.customer_id::integer)
        )
        WHERE ci.meeting_id = $1
        ORDER BY ci.check_in_time DESC
      `;
    }

    const result = await query(sqlQuery, [meetingId]);
    return result.rows;
  }

  /**
   * Get check-ins by salesperson
   * @param {string} salespersonEmail - Salesperson email/ID
   * @returns {Promise<Array>} Array of check-ins
   */
  async getBySalesperson(salespersonEmail) {
    const hasIsDeletedColumn = await this.hasIsDeletedColumn();

    // Build query based on whether column exists
    let sqlQuery;
    if (hasIsDeletedColumn) {
      sqlQuery = `
        SELECT 
          ci.*,
          m.meeting_id as meeting_identifier,
          CASE 
            WHEN m.customer_name IS NOT NULL 
              AND m.customer_name != '' 
              AND LOWER(TRIM(m.customer_name)) NOT IN ('n/a', 'na', 'null')
            THEN m.customer_name
            WHEN dhl.customer IS NOT NULL 
              AND dhl.customer != '' 
              AND LOWER(TRIM(dhl.customer)) NOT IN ('n/a', 'na', 'null')
            THEN dhl.customer
            ELSE 'Meeting'
          END as customer_name,
          m.address as meeting_address,
          m.meeting_date,
          m.meeting_time,
          m.lead_id,
          m.customer_id,
          COALESCE(dhl.is_deleted, FALSE) as lead_is_deleted,
          dhl.deleted_at as lead_deleted_at
        FROM marketing_check_ins ci
        LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
        LEFT JOIN department_head_leads dhl ON (
          (m.lead_id IS NOT NULL AND dhl.id::text = m.lead_id::text)
          OR (m.customer_id IS NOT NULL AND dhl.id::text = m.customer_id::text)
          OR (m.lead_id IS NOT NULL AND dhl.id = m.lead_id::integer)
          OR (m.customer_id IS NOT NULL AND dhl.id = m.customer_id::integer)
        )
        WHERE ci.salesperson_email = $1
        ORDER BY ci.check_in_time DESC
      `;
    } else {
      // Fallback query when is_deleted column doesn't exist yet
      sqlQuery = `
      SELECT 
        ci.*,
        m.meeting_id as meeting_identifier,
          CASE 
            WHEN m.customer_name IS NOT NULL 
              AND m.customer_name != '' 
              AND LOWER(TRIM(m.customer_name)) NOT IN ('n/a', 'na', 'null')
            THEN m.customer_name
            WHEN dhl.customer IS NOT NULL 
              AND dhl.customer != '' 
              AND LOWER(TRIM(dhl.customer)) NOT IN ('n/a', 'na', 'null')
            THEN dhl.customer
            ELSE 'Meeting'
          END as customer_name,
        m.address as meeting_address,
        m.meeting_date,
          m.meeting_time,
          m.lead_id,
          m.customer_id,
          FALSE as lead_is_deleted,
          NULL as lead_deleted_at
      FROM marketing_check_ins ci
      LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
        LEFT JOIN department_head_leads dhl ON (
          (m.lead_id IS NOT NULL AND dhl.id::text = m.lead_id::text)
          OR (m.customer_id IS NOT NULL AND dhl.id::text = m.customer_id::text)
          OR (m.lead_id IS NOT NULL AND dhl.id = m.lead_id::integer)
          OR (m.customer_id IS NOT NULL AND dhl.id = m.customer_id::integer)
        )
      WHERE ci.salesperson_email = $1
      ORDER BY ci.check_in_time DESC
    `;
    }

    const result = await query(sqlQuery, [salespersonEmail]);
    return result.rows;
  }

  /**
   * Get check-in by ID
   * @param {string} id - Check-in UUID
   * @returns {Promise<Object|null>} Check-in or null
   */
  async getById(id) {
    const hasIsDeletedColumn = await this.hasIsDeletedColumn();

    let sqlQuery;
    if (hasIsDeletedColumn) {
      sqlQuery = `
        SELECT 
          ci.*,
          m.meeting_id as meeting_identifier,
          CASE 
            WHEN m.customer_name IS NOT NULL 
              AND m.customer_name != '' 
              AND LOWER(TRIM(m.customer_name)) NOT IN ('n/a', 'na', 'null')
            THEN m.customer_name
            WHEN dhl.customer IS NOT NULL 
              AND dhl.customer != '' 
              AND LOWER(TRIM(dhl.customer)) NOT IN ('n/a', 'na', 'null')
            THEN dhl.customer
            ELSE 'Meeting'
          END as customer_name,
          m.address as meeting_address,
          m.meeting_date,
          m.meeting_time,
          m.lead_id,
          m.customer_id,
          COALESCE(dhl.is_deleted, FALSE) as lead_is_deleted,
          dhl.deleted_at as lead_deleted_at
      FROM marketing_check_ins ci
      LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
      LEFT JOIN department_head_leads dhl ON (
        (m.lead_id IS NOT NULL AND dhl.id::text = m.lead_id::text)
        OR (m.customer_id IS NOT NULL AND dhl.id::text = m.customer_id::text)
        OR (m.lead_id IS NOT NULL AND dhl.id = m.lead_id::integer)
        OR (m.customer_id IS NOT NULL AND dhl.id = m.customer_id::integer)
      )
      WHERE ci.id = $1
    `;
    } else {
      sqlQuery = `
      SELECT 
        ci.*,
        m.meeting_id as meeting_identifier,
          CASE 
            WHEN m.customer_name IS NOT NULL 
              AND m.customer_name != '' 
              AND LOWER(TRIM(m.customer_name)) NOT IN ('n/a', 'na', 'null')
            THEN m.customer_name
            WHEN dhl.customer IS NOT NULL 
              AND dhl.customer != '' 
              AND LOWER(TRIM(dhl.customer)) NOT IN ('n/a', 'na', 'null')
            THEN dhl.customer
            ELSE 'Meeting'
          END as customer_name,
        m.address as meeting_address,
        m.meeting_date,
          m.meeting_time,
          m.lead_id,
          m.customer_id,
          FALSE as lead_is_deleted,
          NULL as lead_deleted_at
      FROM marketing_check_ins ci
      LEFT JOIN marketing_meetings m ON ci.meeting_id = m.id
      LEFT JOIN department_head_leads dhl ON (
        (m.lead_id IS NOT NULL AND dhl.id::text = m.lead_id::text)
        OR (m.customer_id IS NOT NULL AND dhl.id::text = m.customer_id::text)
        OR (m.lead_id IS NOT NULL AND dhl.id = m.lead_id::integer)
        OR (m.customer_id IS NOT NULL AND dhl.id = m.customer_id::integer)
      )
      WHERE ci.id = $1
    `;
    }

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

