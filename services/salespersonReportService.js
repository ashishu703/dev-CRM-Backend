const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Salesperson Report Service
 * Handles data aggregation for salesperson reports with parallel queries
 * Uses DRY principle and OOP concepts
 */
class SalespersonReportService {
  /**
   * Get Activity Report for a salesperson
   * Shows all calls done date-wise with followup status, sales status, remarks, address, division, state, requirements
   */
  static async getActivityReport(salespersonUsername, startDate = null, endDate = null) {
    try {
      const dateFilter = this.buildDateFilter(startDate, endDate, 'sl.date');
      let paramCount = 1;
      const values = [];
      
      // Build WHERE clause for salesperson matching
      const salespersonCondition = `(
        (LOWER(TRIM(COALESCE(dhl.assigned_salesperson, ''))) = LOWER(TRIM($${paramCount})))
        OR (LOWER(TRIM(COALESCE(du.username, ''))) = LOWER(TRIM($${paramCount})))
        OR (LOWER(TRIM(COALESCE(du.email, ''))) = LOWER(TRIM($${paramCount})))
      )`;
      values.push(salespersonUsername);
      paramCount++;
      
      const sql = `
        SELECT 
          sl.id as lead_id,
          sl.name as customer_name,
          sl.phone,
          sl.email,
          sl.business,
          sl.address,
          sl.state,
          sl.division,
          sl.date as call_date,
          sl.follow_up_status,
          sl.follow_up_remark,
          sl.sales_status,
          sl.sales_status_remark,
          sl.product_type as requirement,
          COALESCE(e.product_remark, '') as requirement_detail,
          sl.lead_source,
          sl.created_at,
          sl.updated_at,
          e.enquired_product,
          e.product_quantity,
          e.product_remark,
          e.enquiry_date
        FROM salesperson_leads sl
        LEFT JOIN department_head_leads dhl ON sl.dh_lead_id = dhl.id
        LEFT JOIN department_users du ON dhl.assigned_salesperson = du.username OR dhl.assigned_salesperson = du.email
        LEFT JOIN enquiries e ON sl.id = e.lead_id
        WHERE ${salespersonCondition}
        ${dateFilter.whereClause ? `AND ${dateFilter.whereClause.replace(/\$(\d+)/g, (match, num) => `$${paramCount + parseInt(num) - 1}`)}` : ''}
        ORDER BY sl.date DESC NULLS LAST, e.enquiry_date DESC NULLS LAST
      `;
      
      if (dateFilter.values && dateFilter.values.length > 0) {
        values.push(...dateFilter.values);
        paramCount += dateFilter.values.length;
      }
      
      const result = await query(sql, values);
      
      // Group by date for better organization
      const groupedByDate = {};
      result.rows.forEach(row => {
        const dateKey = row.call_date ? new Date(row.call_date).toISOString().split('T')[0] : 'no-date';
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(row);
      });
      
      return {
        salesperson: salespersonUsername,
        totalCalls: result.rows.length,
        dateRange: { startDate, endDate },
        groupedByDate,
        activities: result.rows
      };
    } catch (error) {
      logger.error('Error fetching activity report:', error);
      throw error;
    }
  }

  /**
   * Get Performance Report for a salesperson
   * Shows total assigned leads, followup leads, converted, revenue, quotations, products, payments, targets, achievements
   */
  static async getPerformanceReport(salespersonUsername, startDate = null, endDate = null) {
    try {
      // Parallel queries for better performance
      const [leadsResult, quotationsResult, paymentsResult, targetResult] = await Promise.all([
        this.getLeadsData(salespersonUsername, startDate, endDate),
        this.getQuotationsData(salespersonUsername, startDate, endDate),
        this.getPaymentsData(salespersonUsername, startDate, endDate),
        this.getTargetData(salespersonUsername, startDate, endDate)
      ]);

      const leads = leadsResult.rows || [];
      const quotations = quotationsResult.rows || [];
      const payments = paymentsResult.rows || [];
      const target = targetResult.rows[0] || null;

      // Calculate metrics
      const totalAssignedLeads = leads.length;
      const followupLeads = leads.filter(l => l.follow_up_status && l.follow_up_status !== 'closed').length;
      const convertedLeads = leads.filter(l => 
        ['won', 'closed', 'converted'].includes((l.sales_status || '').toLowerCase())
      ).length;
      const closedWonLeads = leads.filter(l => 
        ['won', 'closed'].includes((l.sales_status || '').toLowerCase())
      ).length;
      const lostLeads = leads.filter(l => 
        ['lost', 'rejected'].includes((l.sales_status || '').toLowerCase())
      ).length;

      // Revenue calculations
      const totalRevenue = quotations.reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
      const totalPaid = payments
        .filter(p => (p.approval_status || '').toLowerCase() === 'approved')
        .reduce((sum, p) => sum + Number(p.installment_amount || p.paid_amount || 0), 0);
      const totalDue = totalRevenue - totalPaid;
      const totalAdvance = payments
        .filter(p => {
          const status = (p.payment_status || '').toLowerCase();
          return ['completed', 'paid', 'advance'].includes(status) && 
                 (p.approval_status || '').toLowerCase() === 'approved';
        })
        .reduce((sum, p) => sum + Number(p.installment_amount || p.paid_amount || 0), 0);

      // Target and achievement
      const targetAmount = target ? Number(target.target_amount || 0) : 0;
      const achieved = totalPaid;
      const remaining = Math.max(0, targetAmount - achieved);
      const achievementPercentage = targetAmount > 0 ? (achieved / targetAmount) * 100 : 0;

      // Group quotations with their products and payments
      const quotationDetails = quotations.map(quotation => {
        const quotationPayments = payments.filter(p => 
          String(p.quotation_id) === String(quotation.id)
        );
        
        const quotationPaid = quotationPayments
          .filter(p => (p.approval_status || '').toLowerCase() === 'approved')
          .reduce((sum, p) => sum + Number(p.installment_amount || p.paid_amount || 0), 0);
        
        const quotationDue = Number(quotation.total_amount || 0) - quotationPaid;

        return {
          ...quotation,
          products: quotation.items || [],
          payments: quotationPayments.map(p => ({
            id: p.id,
            installment_number: p.installment_number,
            installment_amount: p.installment_amount || p.paid_amount,
            payment_date: p.payment_date,
            payment_status: p.payment_status,
            approval_status: p.approval_status,
            payment_receipt_url: p.payment_receipt_url
          })),
          totalPaid: quotationPaid,
          totalDue: quotationDue
        };
      });

      return {
        salesperson: salespersonUsername,
        dateRange: { startDate, endDate },
        summary: {
          totalAssignedLeads,
          followupLeads,
          convertedLeads,
          closedWonLeads,
          lostLeads,
          totalRevenue,
          totalPaid,
          totalDue,
          totalAdvance,
          targetAmount,
          achieved,
          remaining,
          achievementPercentage: Math.round(achievementPercentage * 100) / 100
        },
        quotations: quotationDetails,
        leads: leads.map(lead => ({
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          sales_status: lead.sales_status,
          follow_up_status: lead.follow_up_status,
          created_at: lead.created_at
        }))
      };
    } catch (error) {
      logger.error('Error fetching performance report:', error);
      throw error;
    }
  }

  /**
   * Get Top Performer Comparison Report
   * Compares all salespersons and shows detailed analysis
   */
  static async getTopPerformerComparison(startDate = null, endDate = null, departmentType = null) {
    try {
      // Get all salespersons
      const salespersonsResult = await this.getAllSalespersons(departmentType);
      const salespersons = salespersonsResult.rows || [];

      // Parallel fetch for all salespersons' data
      const performancePromises = salespersons.map(sp => 
        this.getPerformanceReport(sp.username || sp.email, startDate, endDate)
          .catch(err => {
            logger.warn(`Error fetching performance for ${sp.username}:`, err);
            return null;
          })
      );

      const performances = await Promise.all(performancePromises);
      const validPerformances = performances.filter(p => p !== null);

      // Calculate comparison metrics
      const comparison = validPerformances.map(perf => ({
        salesperson: perf.salesperson,
        metrics: {
          totalLeads: perf.summary.totalAssignedLeads,
          convertedLeads: perf.summary.convertedLeads,
          conversionRate: perf.summary.totalAssignedLeads > 0 
            ? (perf.summary.convertedLeads / perf.summary.totalAssignedLeads) * 100 
            : 0,
          revenue: perf.summary.totalRevenue,
          paid: perf.summary.totalPaid,
          due: perf.summary.totalDue,
          advance: perf.summary.totalAdvance,
          target: perf.summary.targetAmount,
          achieved: perf.summary.achieved,
          achievementPercentage: perf.summary.achievementPercentage,
          closedWon: perf.summary.closedWonLeads,
          lost: perf.summary.lostLeads
        }
      }));

      // Sort by achievement percentage (top performers first)
      comparison.sort((a, b) => b.metrics.achievementPercentage - a.metrics.achievementPercentage);

      // Calculate averages
      const avgMetrics = this.calculateAverages(comparison);

      return {
        dateRange: { startDate, endDate },
        departmentType,
        totalSalespersons: comparison.length,
        comparison,
        averages: avgMetrics,
        topPerformers: comparison.slice(0, 10) // Top 10
      };
    } catch (error) {
      logger.error('Error fetching top performer comparison:', error);
      throw error;
    }
  }

  // Helper methods

  static buildDateFilter(startDate, endDate, dateColumn = 'created_at') {
    const values = [];
    const conditions = [];
    let paramCount = 1;

    if (startDate) {
      conditions.push(`${dateColumn} >= $${paramCount++}::date`);
      values.push(startDate);
    }
    if (endDate) {
      conditions.push(`${dateColumn} <= ($${paramCount++}::date + INTERVAL '1 day' - INTERVAL '1 second')`);
      values.push(endDate);
    }

    return {
      whereClause: conditions.length > 0 ? conditions.join(' AND ') : '',
      values
    };
  }

  static async getLeadsData(salespersonUsername, startDate, endDate) {
    const dateFilter = this.buildDateFilter(startDate, endDate, 'sl.created_at');
    let paramCount = 1;
    const values = [];
    
    // Build WHERE clause for salesperson matching
    const salespersonCondition = `(
      (LOWER(TRIM(COALESCE(dhl.assigned_salesperson, ''))) = LOWER(TRIM($${paramCount})))
      OR (LOWER(TRIM(COALESCE(du.username, ''))) = LOWER(TRIM($${paramCount})))
      OR (LOWER(TRIM(COALESCE(du.email, ''))) = LOWER(TRIM($${paramCount})))
    )`;
    values.push(salespersonUsername);
    paramCount++;
    
    const sql = `
      SELECT 
        sl.*,
        e.enquired_product,
        e.product_quantity,
        e.product_remark
      FROM salesperson_leads sl
      LEFT JOIN department_head_leads dhl ON sl.dh_lead_id = dhl.id
      LEFT JOIN department_users du ON dhl.assigned_salesperson = du.username OR dhl.assigned_salesperson = du.email
      LEFT JOIN enquiries e ON sl.id = e.lead_id
      WHERE ${salespersonCondition}
      ${dateFilter.whereClause ? `AND ${dateFilter.whereClause.replace(/\$(\d+)/g, (match, num) => `$${paramCount + parseInt(num) - 1}`)}` : ''}
      ORDER BY sl.created_at DESC
    `;
    
    if (dateFilter.values && dateFilter.values.length > 0) {
      values.push(...dateFilter.values);
      paramCount += dateFilter.values.length;
    }
    
    return await query(sql, values);
  }

  static async getQuotationsData(salespersonUsername, startDate, endDate) {
    const dateFilter = this.buildDateFilter(startDate, endDate, 'q.created_at');
    let paramCount = 1;
    const values = [];
    
    const salespersonIdSubquery = `(
      SELECT id FROM department_users 
      WHERE (LOWER(TRIM(username)) = LOWER(TRIM($${paramCount})) OR LOWER(TRIM(email)) = LOWER(TRIM($${paramCount}))) 
      AND is_active = true 
      LIMIT 1
    )`;
    values.push(salespersonUsername);
    paramCount++;
    
    let whereClause = `WHERE q.salesperson_id = ${salespersonIdSubquery}`;
    if (dateFilter.whereClause) {
      const adjustedDateFilter = dateFilter.whereClause.replace(/\$(\d+)/g, (match, num) => `$${paramCount + parseInt(num) - 1}`);
      whereClause += ` AND ${adjustedDateFilter}`;
      if (dateFilter.values && dateFilter.values.length > 0) {
        values.push(...dateFilter.values);
        paramCount += dateFilter.values.length;
      }
    }
    
    const sql = `
      SELECT 
        q.*,
        COALESCE(json_agg(
          json_build_object(
            'id', qi.id,
            'product_name', qi.product_name,
            'description', qi.description,
            'quantity', qi.quantity,
            'unit', qi.unit,
            'rate', qi.unit_price,
            'amount', qi.total_amount
          )
        ) FILTER (WHERE qi.id IS NOT NULL), '[]'::json) as items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      ${whereClause}
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `;
    return await query(sql, values);
  }

  static async getPaymentsData(salespersonUsername, startDate, endDate) {
    const dateFilter = this.buildDateFilter(startDate, endDate, 'ph.payment_date');
    let paramCount = 1;
    const values = [];
    
    const salespersonCondition = `(
      (LOWER(TRIM(du.username)) = LOWER(TRIM($${paramCount})) OR LOWER(TRIM(du.email)) = LOWER(TRIM($${paramCount})))
      AND du.is_active = true
    )`;
    values.push(salespersonUsername);
    paramCount++;
    
    let whereClause = `WHERE ${salespersonCondition}`;
    if (dateFilter.whereClause) {
      const adjustedDateFilter = dateFilter.whereClause.replace(/\$(\d+)/g, (match, num) => `$${paramCount + parseInt(num) - 1}`);
      whereClause += ` AND ${adjustedDateFilter}`;
      if (dateFilter.values && dateFilter.values.length > 0) {
        values.push(...dateFilter.values);
        paramCount += dateFilter.values.length;
      }
    }
    
    const sql = `
      SELECT 
        ph.*,
        q.quotation_number,
        q.total_amount as quotation_total,
        COALESCE(sl.name, dhl.customer) as lead_name
      FROM payment_history ph
      INNER JOIN quotations q ON ph.quotation_id = q.id
      INNER JOIN department_users du ON q.salesperson_id = du.id
      LEFT JOIN salesperson_leads sl ON ph.lead_id = sl.id
      LEFT JOIN department_head_leads dhl ON ph.lead_id = dhl.id
      ${whereClause}
      ORDER BY ph.payment_date DESC, ph.installment_number ASC
    `;
    return await query(sql, values);
  }

  static async getTargetData(salespersonUsername, startDate, endDate) {
    // Targets are stored in department_users table
    const sql = `
      SELECT 
        du.target as target_amount,
        du.target_start_date as start_date,
        du.target_end_date as end_date,
        du.achieved_target,
        du.sales_order_target,
        du.achieved_sales_order_target
      FROM department_users du
      WHERE (du.username = $1 OR du.email = $1) AND du.is_active = true
      ORDER BY du.target_start_date DESC NULLS LAST, du.created_at DESC
      LIMIT 1
    `;
    return await query(sql, [salespersonUsername]);
  }

  static async getAllSalespersons(departmentType = null) {
    let sql = `
      SELECT DISTINCT
        du.id,
        du.username,
        du.email,
        du.username as name,
        du.department_type
      FROM department_users du
      WHERE du.is_active = true
    `;
    const values = [];
    let paramCount = 1;

    if (departmentType) {
      sql += ` AND du.department_type = $${paramCount++}`;
      values.push(departmentType);
    }

    sql += ` ORDER BY du.username ASC`;

    return await query(sql, values);
  }

  static calculateAverages(comparison) {
    if (comparison.length === 0) {
      return {
        avgLeads: 0,
        avgConversionRate: 0,
        avgRevenue: 0,
        avgPaid: 0,
        avgAchievement: 0
      };
    }

    const totals = comparison.reduce((acc, perf) => {
      acc.leads += perf.metrics.totalLeads;
      acc.conversionRate += perf.metrics.conversionRate;
      acc.revenue += perf.metrics.revenue;
      acc.paid += perf.metrics.paid;
      acc.achievement += perf.metrics.achievementPercentage;
      return acc;
    }, {
      leads: 0,
      conversionRate: 0,
      revenue: 0,
      paid: 0,
      achievement: 0
    });

    const count = comparison.length;
    return {
      avgLeads: Math.round(totals.leads / count),
      avgConversionRate: Math.round((totals.conversionRate / count) * 100) / 100,
      avgRevenue: Math.round(totals.revenue / count),
      avgPaid: Math.round(totals.paid / count),
      avgAchievement: Math.round((totals.achievement / count) * 100) / 100
    };
  }
}

module.exports = SalespersonReportService;

