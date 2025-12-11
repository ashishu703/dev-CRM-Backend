const db = require('../config/database');

class TargetCalculationService {
  /**
   * Get user information for lead matching
   * @private
   * @param {string} userId - Department user ID
   * @returns {Promise<Object|null>} User email, username, department, and company
   */
  static async _getUserInfo(userId) {
    const userInfo = await db.query(
      `SELECT du.username, du.email, du.department_type, du.company_name 
       FROM department_users du WHERE du.id = $1`,
      [userId]
    );
    if (userInfo.rows.length === 0) return null;
    return {
      email: userInfo.rows[0].email,
      username: userInfo.rows[0].username,
      departmentType: userInfo.rows[0].department_type,
      companyName: userInfo.rows[0].company_name
    };
  }

  /**
   * Build matching conditions for assigned_salesperson field (same as SalespersonLead model)
   * @private
   * @param {string} username - User username
   * @param {string} userEmail - User email
   * @param {number} paramStart - Starting parameter index
   * @returns {Object} Conditions, values, and next parameter index
   */
  static _buildAssignmentMatchConditions(username, userEmail, paramStart) {
    const conditions = [];
    const values = [];
    let paramCount = paramStart;
    
    const usernameLower = username ? username.toLowerCase().trim() : '';
    const emailLower = userEmail ? userEmail.toLowerCase().trim() : '';
    const emailLocal = emailLower.includes('@') ? emailLower.split('@')[0] : emailLower;
    
    if (usernameLower) {
      conditions.push(`TRIM(LOWER(COALESCE(dhl.assigned_salesperson, ''))) = $${paramCount}`);
      values.push(usernameLower);
      paramCount++;
    }
    
    if (emailLower && emailLower !== usernameLower) {
      conditions.push(`TRIM(LOWER(COALESCE(dhl.assigned_salesperson, ''))) = $${paramCount}`);
      values.push(emailLower);
      paramCount++;
    }
    
    if (emailLocal && emailLocal !== emailLower && emailLocal !== usernameLower) {
      conditions.push(`TRIM(LOWER(COALESCE(dhl.assigned_salesperson, ''))) = $${paramCount}`);
      values.push(emailLocal);
      paramCount++;
    }
    
    return { conditions, values, nextParam: paramCount };
  }

  /**
   * Find all lead IDs associated with a user
   * Uses the SAME logic as SalespersonLead.listForUser (matching dashboard)
   * @private
   * @param {string} userEmail - User email
   * @param {string} username - User username
   * @param {string} departmentType - User department type
   * @param {string} companyName - User company name
   * @returns {Promise<Array<number>>} Array of lead IDs
   */
  static async _findUserLeadIds(userEmail, username, departmentType, companyName) {
    if (!username && !userEmail) {
      return [];
    }

    const conditions = [];
    const values = [];
    let paramCount = 1;

    // Build assignment matching conditions (same as SalespersonLead model)
    const matchResult = this._buildAssignmentMatchConditions(username, userEmail, paramCount);
    if (matchResult.conditions.length === 0) {
      return [];
    }

    // Assignment matching: must match user AND not be empty
    conditions.push(`(${matchResult.conditions.join(' OR ')})`);
    conditions.push(`COALESCE(dhl.assigned_salesperson, '') != ''`);
    values.push(...matchResult.values);
    paramCount = matchResult.nextParam;

    // STRICT: Department filtering is mandatory (same as dashboard)
    if (departmentType) {
      conditions.push(`dh.department_type = $${paramCount}`);
      values.push(departmentType);
      paramCount++;
    } else {
      console.warn('[TargetCalculation] WARNING: No departmentType provided');
      return [];
    }

    // STRICT: Company filtering is mandatory (same as dashboard)
    if (companyName) {
      conditions.push(`dh.company_name = $${paramCount}`);
      values.push(companyName);
      paramCount++;
    } else {
      console.warn('[TargetCalculation] WARNING: No companyName provided');
      return [];
    }

    // Query to get lead IDs from department_head_leads (same logic as dashboard)
    const query = `
      SELECT DISTINCT sl.id
      FROM salesperson_leads sl
      JOIN department_head_leads dhl ON dhl.id = sl.dh_lead_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY sl.id ASC
    `;

    const result = await db.query(query, values);
    return result.rows.map(r => r.id);
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
      `SELECT DISTINCT id as quotation_id 
       FROM quotations 
       WHERE customer_id = ANY($1::integer[])`,
      [leadIds]
    );
    return quotationsResult.rows.map(r => r.quotation_id);
  }

  /**
   * Build base payment filter conditions (DRY principle)
   * @private
   * @returns {string} Base WHERE clause for approved payments
   */
  static _getBasePaymentFilters() {
    return `
      installment_amount > 0
      AND (payment_status = 'completed' OR payment_status = 'advance')
      AND is_refund = false
      AND (approval_status = 'approved' OR (approval_status IS NULL AND payment_approved = true))
    `;
  }

  /**
   * Build date filter clause
   * @private
   * @param {string|null} startDate - Start date (YYYY-MM-DD format)
   * @param {string|null} endDate - End date (YYYY-MM-DD format)
   * @param {number} paramIndex - Current parameter index
   * @returns {Object} Date filter clause and updated param index
   */
  static _buildDateFilter(startDate, endDate, paramIndex) {
    if (startDate && endDate) {
      return {
        clause: ` AND payment_date::date >= $${paramIndex}::date AND payment_date::date <= $${paramIndex + 1}::date`,
        paramIndex: paramIndex + 2
      };
    } else if (startDate) {
      return {
        clause: ` AND payment_date::date >= $${paramIndex}::date`,
        paramIndex: paramIndex + 1
      };
    } else if (endDate) {
      return {
        clause: ` AND payment_date::date <= $${paramIndex}::date`,
        paramIndex: paramIndex + 1
      };
    }
    return { clause: '', paramIndex };
  }

  /**
   * Build payment query with date filtering
   * Only counts payments approved by accounts department
   * @private
   * @param {Array<number>} leadIds - Array of lead IDs
   * @param {Array<string>} quotationIds - Array of quotation IDs
   * @param {string|null} startDate - Start date (YYYY-MM-DD format)
   * @param {string|null} endDate - End date (YYYY-MM-DD format)
   * @returns {Object} Query string and parameters
   */
  static _buildPaymentQuery(leadIds, quotationIds, startDate = null, endDate = null) {
    const baseFilters = this._getBasePaymentFilters();
    const params = [];
    let paramIndex = 1;
    let whereConditions = baseFilters;

    // Build ID matching conditions
    // quotation_id is UUID in payment_history, so use UUID array
    if (leadIds.length > 0 && quotationIds.length > 0) {
      whereConditions += ` AND (lead_id = ANY($${paramIndex}::integer[]) OR quotation_id = ANY($${paramIndex + 1}::uuid[]))`;
      params.push(leadIds, quotationIds);
      paramIndex += 2;
    } else if (leadIds.length > 0) {
      whereConditions += ` AND lead_id = ANY($${paramIndex}::integer[])`;
      params.push(leadIds);
      paramIndex += 1;
    } else if (quotationIds.length > 0) {
      whereConditions += ` AND quotation_id = ANY($${paramIndex}::uuid[])`;
      params.push(quotationIds);
      paramIndex += 1;
    } else {
      return { query: null, params: [] };
    }

    // Add date filters
    const dateFilter = this._buildDateFilter(startDate, endDate, paramIndex);
    whereConditions += dateFilter.clause;
    params.push(...(startDate && endDate ? [startDate, endDate] : startDate ? [startDate] : endDate ? [endDate] : []));

    const query = `
      SELECT COALESCE(SUM(installment_amount), 0) as total_paid
      FROM payment_history
      WHERE ${whereConditions}
    `;

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

      // Use same logic as dashboard - match by assigned_salesperson with department/company filter
      const leadIds = await this._findUserLeadIds(
        userInfo.email, 
        userInfo.username, 
        userInfo.departmentType, 
        userInfo.companyName
      );
      const quotationIds = await this._findQuotationIds(leadIds);

      const { query, params } = this._buildPaymentQuery(leadIds, quotationIds, startDate, endDate);
      if (!query) return 0;

      const result = await db.query(query, params);
      const totalPaid = parseFloat(result.rows[0]?.total_paid || 0);
      // Ensure we never return a negative value and round to 2 decimal places
      return totalPaid >= 0 ? Math.round(totalPaid * 100) / 100 : 0;
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

      // Use same logic as dashboard - match by assigned_salesperson with department/company filter
      const leadIds = await this._findUserLeadIds(
        userInfo.email, 
        userInfo.username, 
        userInfo.departmentType, 
        userInfo.companyName
      );
      if (leadIds.length === 0) return 0;

      let query = `
        SELECT COALESCE(SUM(total_amount), 0) as total_quotation
        FROM quotations
        WHERE customer_id = ANY($1::integer[])
          AND status IN ('approved', 'completed')
      `;
      const params = [leadIds];
      let paramIndex = 2;

      // Add date filters using helper method (DRY principle)
      const dateFilter = this._buildDateFilter(startDate, endDate, paramIndex);
      query += dateFilter.clause.replace('payment_date', 'quotation_date');
      params.push(...(startDate && endDate ? [startDate, endDate] : startDate ? [startDate] : endDate ? [endDate] : []));

      const result = await db.query(query, params);
      const totalQuotation = parseFloat(result.rows[0]?.total_quotation || 0);
      // Round to 2 decimal places
      return Math.round(totalQuotation * 100) / 100;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate due payment (remaining amounts from approved quotations with PIs)
   * Same logic as dashboard: approved quotations with PIs - approved payments (date filtered)
   * IMPORTANT: Quotations are NOT filtered by date, only payments are filtered by date
   * @param {string} userId - Department user ID
   * @param {string|null} startDate - Target start date (YYYY-MM-DD format, optional) - filters payments only
   * @param {string|null} endDate - Target end date (YYYY-MM-DD format, optional) - filters payments only
   * @returns {Promise<number>} Total due payment amount
   */
  static async calculateDuePayment(userId, startDate = null, endDate = null) {
    try {
      const userInfo = await this._getUserInfo(userId);
      if (!userInfo) return 0;

      // Get user's leads (same logic as achieved target)
      const leadIds = await this._findUserLeadIds(
        userInfo.email,
        userInfo.username,
        userInfo.departmentType,
        userInfo.companyName
      );
      if (leadIds.length === 0) return 0;

      // Get ALL approved quotations for these leads (NO date filter on quotations)
      const quotationQuery = `
        SELECT q.id, q.total_amount, q.customer_id
        FROM quotations q
        WHERE q.customer_id = ANY($1::integer[])
          AND q.status = 'approved'
      `;
      const quotationsResult = await db.query(quotationQuery, [leadIds]);
      const quotations = quotationsResult.rows;
      if (quotations.length === 0) {
        console.log('[TargetCalculation] No approved quotations found for user leads');
        return 0;
      }

      // Get quotation IDs that have PIs
      const quotationIds = quotations.map(q => q.id);
      if (quotationIds.length === 0) return 0;

      // Check which quotations have PIs (quotation_id in proforma_invoices can be TEXT or UUID)
      const piQuery = `
        SELECT DISTINCT quotation_id
        FROM proforma_invoices
        WHERE quotation_id::text = ANY($1::text[])
      `;
      const piResult = await db.query(piQuery, [quotationIds.map(id => id.toString())]);
      const quotationIdsWithPI = new Set(piResult.rows.map(r => r.quotation_id?.toString()));

      // Filter quotations to only those with PIs
      const quotationsWithPI = quotations.filter(q => quotationIdsWithPI.has(q.id.toString()));
      if (quotationsWithPI.length === 0) {
        console.log('[TargetCalculation] No quotations with PIs found');
        return 0;
      }

      console.log(`[TargetCalculation] Found ${quotationsWithPI.length} approved quotations with PIs for due payment calculation`);

      let totalDue = 0;

      // For each quotation with PI, calculate remaining amount
      for (const quotation of quotationsWithPI) {
        const quotationTotal = parseFloat(quotation.total_amount || 0);
        if (quotationTotal <= 0) continue;

        // Get approved payments for this quotation (date filter applied to payments only)
        // Match payments by quotation_id OR lead_id (same as dashboard)
        // quotation_id is UUID in payment_history, so compare as UUID
        let paymentQuery = `
          SELECT COALESCE(SUM(installment_amount), 0) as total_paid
          FROM payment_history
          WHERE (
            quotation_id = $1::uuid
            OR (lead_id = $2 AND lead_id IS NOT NULL)
          )
            AND installment_amount > 0
            AND (payment_status = 'completed' OR payment_status = 'advance')
            AND is_refund = false
            AND (approval_status = 'approved' OR (approval_status IS NULL AND payment_approved = true))
        `;
        const paymentParams = [quotation.id, quotation.customer_id];
        let paymentParamIndex = 3;

        // Add date filter for payments ONLY (not quotations)
        if (startDate && endDate) {
          paymentQuery += ` AND payment_date::date >= $${paymentParamIndex}::date AND payment_date::date <= $${paymentParamIndex + 1}::date`;
          paymentParams.push(startDate, endDate);
        } else if (startDate) {
          paymentQuery += ` AND payment_date::date >= $${paymentParamIndex}::date`;
          paymentParams.push(startDate);
        } else if (endDate) {
          paymentQuery += ` AND payment_date::date <= $${paymentParamIndex}::date`;
          paymentParams.push(endDate);
        }

        const paymentResult = await db.query(paymentQuery, paymentParams);
        const paidTotal = parseFloat(paymentResult.rows[0]?.total_paid || 0);

        // Calculate remaining (due payment) = quotation total - paid amount (within date range)
        const remaining = quotationTotal - paidTotal;
        if (remaining > 0) {
          totalDue += remaining;
          console.log(`[TargetCalculation] Quotation ${quotation.id}: total=${quotationTotal}, paid=${paidTotal}, due=${remaining}`);
        }
      }

      // Round to 2 decimal places
      const finalDue = Math.round(totalDue * 100) / 100;
      console.log(`[TargetCalculation] Total due payment calculated: ${finalDue}`);
      return finalDue;
    } catch (error) {
      console.error('[TargetCalculation] Error calculating due payment:', error);
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
