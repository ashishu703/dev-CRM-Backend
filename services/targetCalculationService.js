const db = require('../config/database');

class TargetCalculationService {
  /**
   * Get user information for lead matching
   * @private
   * @param {string} userId - Department user ID
   * @returns {Promise<Object|null>} User email and username
   */
  static async _getUserInfo(userId) {
    const userInfo = await db.query(
      'SELECT username, email FROM department_users WHERE id = $1',
      [userId]
    );
    if (userInfo.rows.length === 0) return null;
    return {
      email: userInfo.rows[0].email,
      username: userInfo.rows[0].username
    };
  }

  /**
   * Find all lead IDs associated with a user
   * @private
   * @param {string} userEmail - User email
   * @param {string} username - User username
   * @returns {Promise<Array<number>>} Array of lead IDs
   */
  static async _findUserLeadIds(userEmail, username) {
    let leadIds = [];

    // Find leads in salesperson_leads
    const salespersonLeads = await db.query(
      'SELECT id FROM salesperson_leads WHERE created_by = $1 OR created_by = $2',
      [userEmail, username]
    );
    leadIds = leadIds.concat(salespersonLeads.rows.map(r => r.id));

    // Find leads in department_head_leads
    const deptHeadLeads = await db.query(
      `SELECT id FROM department_head_leads 
       WHERE assigned_salesperson = $1 OR assigned_salesperson = $2 OR created_by = $3`,
      [userEmail, username, userEmail]
    );
    leadIds = leadIds.concat(deptHeadLeads.rows.map(r => r.id));

    // Find linked leads via joins
    const linkedLeads = await db.query(
      `SELECT DISTINCT sl.id 
       FROM salesperson_leads sl
       JOIN department_head_leads dhl ON sl.dh_lead_id = dhl.id
       WHERE dhl.assigned_salesperson = $1 OR dhl.assigned_salesperson = $2
       UNION
       SELECT DISTINCT sl.id
       FROM salesperson_leads sl
       WHERE sl.created_by = $3 OR sl.created_by = $4`,
      [userEmail, username, userEmail, username]
    );
    leadIds = leadIds.concat(linkedLeads.rows.map(r => r.id));

    // Find leads from main leads table matching by name/email/phone
    const mainLeadsQuery = await db.query(
      `SELECT DISTINCT l.id
       FROM leads l
       WHERE EXISTS (
         SELECT 1 FROM salesperson_leads sl 
         WHERE (sl.name = l.name OR sl.email = l.email OR sl.phone = l.phone)
           AND (sl.created_by = $1 OR sl.created_by = $2)
       )
       OR EXISTS (
         SELECT 1 FROM department_head_leads dhl
         WHERE (dhl.customer = l.name OR dhl.email = l.email)
           AND (dhl.assigned_salesperson = $3 OR dhl.assigned_salesperson = $4 OR dhl.created_by = $5)
       )
       OR l.created_by = $6`,
      [userEmail, username, userEmail, username, userEmail, userEmail]
    );
    leadIds = leadIds.concat(mainLeadsQuery.rows.map(r => r.id));

    return [...new Set(leadIds)];
  }

  /**
   * Find quotation IDs for given lead IDs
   * @private
   * @param {Array<number>} leadIds - Array of lead IDs
   * @returns {Promise<Array<string>>} Array of quotation IDs
   */
  static async _findQuotationIds(leadIds) {
    if (leadIds.length === 0) return [];

    const quotationsResult = await db.query(
      `SELECT DISTINCT id::text as quotation_id 
       FROM quotations 
       WHERE customer_id = ANY($1::integer[])`,
      [leadIds]
    );
    return quotationsResult.rows.map(r => r.quotation_id);
  }

  /**
   * Build payment query with date filtering
   * @private
   * @param {Array<number>} leadIds - Array of lead IDs
   * @param {Array<string>} quotationIds - Array of quotation IDs
   * @param {string|null} startDate - Start date (YYYY-MM-DD format)
   * @param {string|null} endDate - End date (YYYY-MM-DD format)
   * @returns {Object} Query string and parameters
   */
  static _buildPaymentQuery(leadIds, quotationIds, startDate = null, endDate = null) {
    let query = '';
    const params = [];
    let paramIndex = 1;

    if (leadIds.length > 0 && quotationIds.length > 0) {
      query = `
        SELECT COALESCE(SUM(paid_amount), 0) as total_paid
        FROM payment_history
        WHERE paid_amount > 0
          AND (payment_status = 'completed' OR payment_status = 'advance')
          AND (
            lead_id = ANY($${paramIndex}::integer[])
            OR quotation_id::text = ANY($${paramIndex + 1}::text[])
          )
      `;
      params.push(leadIds, quotationIds);
      paramIndex += 2;
    } else if (leadIds.length > 0) {
      query = `
        SELECT COALESCE(SUM(paid_amount), 0) as total_paid
        FROM payment_history
        WHERE paid_amount > 0
          AND (payment_status = 'completed' OR payment_status = 'advance')
          AND lead_id = ANY($${paramIndex}::integer[])
      `;
      params.push(leadIds);
      paramIndex += 1;
    } else if (quotationIds.length > 0) {
      query = `
        SELECT COALESCE(SUM(paid_amount), 0) as total_paid
        FROM payment_history
        WHERE paid_amount > 0
          AND (payment_status = 'completed' OR payment_status = 'advance')
          AND quotation_id::text = ANY($${paramIndex}::text[])
      `;
      params.push(quotationIds);
      paramIndex += 1;
    } else {
      return { query: null, params: [] };
    }

    // Add date filters - include payments within target date range (inclusive)
    if (startDate && endDate) {
      query += ` AND payment_date::date >= $${paramIndex}::date AND payment_date::date <= $${paramIndex + 1}::date`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` AND payment_date::date >= $${paramIndex}::date`;
      params.push(startDate);
    } else if (endDate) {
      query += ` AND payment_date::date <= $${paramIndex}::date`;
      params.push(endDate);
    }

    return { query, params };
  }

  /**
   * Calculate achieved target from payment_history for a user
   * @param {string} userId - Department user ID
   * @param {string|null} startDate - Target start date (YYYY-MM-DD format, optional)
   * @param {string|null} endDate - Target end date (YYYY-MM-DD format, optional)
   * @returns {Promise<number>} Total paid amount within date range
   */
  static async calculateAchievedTarget(userId, startDate = null, endDate = null) {
    try {
      const userInfo = await this._getUserInfo(userId);
      if (!userInfo) return 0;

      const leadIds = await this._findUserLeadIds(userInfo.email, userInfo.username);
      const quotationIds = await this._findQuotationIds(leadIds);

      const { query, params } = this._buildPaymentQuery(leadIds, quotationIds, startDate, endDate);
      if (!query) return 0;

      const result = await db.query(query, params);
      return parseFloat(result.rows[0]?.total_paid || 0);
    } catch (error) {
      // Only log errors, not debug info
      if (error.message) {
        // Silent error handling - return 0 on failure
      }
      return 0;
    }
  }

  /**
   * Calculate achieved sales order target from quotations
   * @param {string} userId - Department user ID
   * @param {string|null} startDate - Target start date (YYYY-MM-DD format, optional)
   * @param {string|null} endDate - Target end date (YYYY-MM-DD format, optional)
   * @returns {Promise<number>} Total quotation amount within date range
   */
  static async calculateAchievedSalesOrderTarget(userId, startDate = null, endDate = null) {
    try {
      const userInfo = await this._getUserInfo(userId);
      if (!userInfo) return 0;

      const leadIds = await this._findUserLeadIds(userInfo.email, userInfo.username);
      if (leadIds.length === 0) return 0;

      let query = `
        SELECT COALESCE(SUM(total_amount), 0) as total_quotation
        FROM quotations
        WHERE customer_id = ANY($1::integer[])
          AND status IN ('approved', 'completed')
      `;
      const params = [leadIds];
      let paramIndex = 2;

      // Add date filters - CRITICAL: Only include quotations within target date range
      if (startDate && endDate) {
        query += ` AND quotation_date >= $${paramIndex}::date AND quotation_date <= $${paramIndex + 1}::date`;
        params.push(startDate, endDate);
      } else if (startDate) {
        query += ` AND quotation_date >= $${paramIndex}::date`;
        params.push(startDate);
      } else if (endDate) {
        query += ` AND quotation_date <= $${paramIndex}::date`;
        params.push(endDate);
      }

      const result = await db.query(query, params);
      return parseFloat(result.rows[0]?.total_quotation || 0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Update target status based on dates and achievement
   * @param {string} userId - Department user ID
   * @returns {Promise<string>} Updated target status
   */
  static async updateTargetStatus(userId) {
    try {
      const userResult = await db.query(
        `SELECT id, target, achieved_target, target_start_date, target_end_date, target_status
         FROM department_users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) return 'active';
      
      const user = userResult.rows[0];
      const target = parseFloat(user.target || 0);
      const achieved = parseFloat(user.achieved_target || 0);
      const endDate = user.target_end_date;
      const currentStatus = user.target_status || 'active';

      // If target period has ended
      if (endDate && new Date(endDate) < new Date()) {
        if (achieved >= target) {
          return achieved > target * 1.1 ? 'overachieved' : 'achieved';
        }
        return 'unachieved';
      }

      // If still active and period hasn't ended
      if (currentStatus === 'active' && (!endDate || new Date(endDate) >= new Date())) {
        return 'active';
      }

      return currentStatus;
    } catch (error) {
      return 'active';
    }
  }

  /**
   * Auto-close expired targets and update status
   * This should be called periodically (via cron job or scheduler)
   */
  static async autoCloseExpiredTargets() {
    try {
      const now = new Date();
      
      const expiredUsers = await db.query(
        `SELECT id, target, achieved_target
         FROM department_users
         WHERE target_status = 'active'
           AND target_end_date IS NOT NULL
           AND target_end_date < $1`,
        [now]
      );

      for (const user of expiredUsers.rows) {
        const target = parseFloat(user.target || 0);
        const achieved = parseFloat(user.achieved_target || 0);
        let status = 'unachieved';

        if (achieved >= target) {
          status = achieved > target * 1.1 ? 'overachieved' : 'achieved';
        }

        await db.query(
          `UPDATE department_users 
           SET target_status = $1, updated_at = NOW()
           WHERE id = $2`,
          [status, user.id]
        );
      }

      return { updated: expiredUsers.rows.length };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = TargetCalculationService;
