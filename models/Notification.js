const { query } = require('../config/database');

class Notification {
  /**
   * Create a new notification
   * @param {Object} data - Notification data
   * @returns {Promise<Object>} Created notification
   */
  static async create(data) {
    const {
      userEmail,
      userId = null,
      type,
      title,
      message,
      details = null,
      referenceId = null,
      referenceType = null
    } = data;

    const result = await query(
      `INSERT INTO notifications 
       (user_email, user_id, type, title, message, details, reference_id, reference_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userEmail, userId, type, title, message, JSON.stringify(details), referenceId, referenceType]
    );

    return result.rows[0];
  }

  /**
   * Get notifications for a user
   * @param {string} userEmail - User email
   * @param {Object} options - Query options (limit, offset, isRead)
   * @returns {Promise<Array>} List of notifications
   */
  static async getByUserEmail(userEmail, options = {}) {
    const { limit = 50, offset = 0, isRead = null } = options;
    
    // Use created_at as-is (PostgreSQL handles timezone conversion)
    let queryText = `
      SELECT 
        id, user_email, user_id, type, title, message, details, 
        is_read, read_at, reference_id, reference_type,
        created_at
      FROM notifications 
      WHERE LOWER(user_email) = LOWER($1)
    `;
    const params = [userEmail];
    
    if (isRead !== null) {
      queryText += ` AND is_read = $${params.length + 1}`;
      params.push(isRead);
    }
    
    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await query(queryText, params);
    return result.rows;
  }

  /**
   * Get unread count for a user
   * @param {string} userEmail - User email
   * @returns {Promise<number>} Unread count
   */
  static async getUnreadCount(userEmail) {
    const result = await query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE LOWER(user_email) = LOWER($1) AND is_read = FALSE`,
      [userEmail]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Mark notification as read
   * @param {number} id - Notification ID
   * @param {string} userEmail - User email (for security)
   * @returns {Promise<Object>} Updated notification
   */
  static async markAsRead(id, userEmail) {
    const result = await query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND LOWER(user_email) = LOWER($2)
       RETURNING *`,
      [id, userEmail]
    );
    return result.rows[0];
  }

  /**
   * Mark notification as unread
   * @param {number} id - Notification ID
   * @param {string} userEmail - User email (for security)
   * @returns {Promise<Object>} Updated notification
   */
  static async markAsUnread(id, userEmail) {
    const result = await query(
      `UPDATE notifications 
       SET is_read = FALSE, read_at = NULL
       WHERE id = $1 AND LOWER(user_email) = LOWER($2)
       RETURNING *`,
      [id, userEmail]
    );
    return result.rows[0];
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userEmail - User email
   * @returns {Promise<number>} Count of updated notifications
   */
  static async markAllAsRead(userEmail) {
    const result = await query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE LOWER(user_email) = LOWER($1) AND is_read = FALSE
       RETURNING id`,
      [userEmail]
    );
    return result.rowCount;
  }

  /**
   * Delete old notifications (cleanup)
   * @param {number} daysOld - Delete notifications older than this many days
   * @returns {Promise<number>} Count of deleted notifications
   */
  static async deleteOld(daysOld = 90) {
    const result = await query(
      `DELETE FROM notifications 
       WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
       RETURNING id`
    );
    return result.rowCount;
  }

  /**
   * Get notification by ID
   * @param {number} id - Notification ID
   * @returns {Promise<Object>} Notification
   */
  static async getById(id) {
    const result = await query(
      `SELECT * FROM notifications WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }
}

module.exports = Notification;

