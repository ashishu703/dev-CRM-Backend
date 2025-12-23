const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Orders Report Service
 * Shows orders (quotations with at least 1 PI) salesperson-wise with date filtering
 */
class OrdersReportService {
  /**
   * Get Orders Report for salespersons
   * Shows all quotations that have at least 1 Proforma Invoice
   */
  static async getOrdersReport(salespersonUsername = null, startDate = null, endDate = null) {
    try {
      const dateFilter = this.buildDateFilter(startDate, endDate, 'q.created_at');
      let paramCount = 1;
      const values = [];
      
      // Base query - get quotations that have at least 1 PI
      let whereConditions = [
        `EXISTS (
          SELECT 1 FROM proforma_invoices pi 
          WHERE pi.quotation_id::text = q.id::text
        )`
      ];
      
      // Add salesperson filter if provided
      if (salespersonUsername) {
        whereConditions.push(`q.salesperson_id = (
          SELECT id FROM department_users 
          WHERE (LOWER(TRIM(username)) = LOWER(TRIM($${paramCount})) OR LOWER(TRIM(email)) = LOWER(TRIM($${paramCount}))) 
          AND is_active = true 
          LIMIT 1
        )`);
        values.push(salespersonUsername);
        paramCount++;
      }
      
      // Add date filter
      if (dateFilter.whereClause) {
        const adjustedDateFilter = dateFilter.whereClause.replace(/\$(\d+)/g, (match, num) => `$${paramCount + parseInt(num) - 1}`);
        whereConditions.push(adjustedDateFilter);
        if (dateFilter.values && dateFilter.values.length > 0) {
          values.push(...dateFilter.values);
          paramCount += dateFilter.values.length;
        }
      }
      
      const sql = `
        SELECT 
          q.id,
          q.quotation_number,
          q.quotation_date,
          q.customer_name,
          q.customer_business,
          q.customer_phone,
          q.customer_email,
          q.customer_address,
          q.customer_state,
          q.total_amount as quotation_total,
          q.status as quotation_status,
          q.created_at as quotation_created_at,
          du.username as salesperson_username,
          du.email as salesperson_email,
          du.username as salesperson_name,
          COUNT(DISTINCT pi.id) as pi_count,
          MAX(pi.pi_number) as latest_pi_number,
          MAX(pi.pi_date) as latest_pi_date,
          MAX(pi.total_amount) as latest_pi_amount,
          MAX(pi.status) as latest_pi_status,
          -- Only approved payments count as paid (exclude rejected completely)
          -- Rejected payments are already excluded in JOIN, so we only count approved
          COALESCE(SUM(CASE 
            WHEN ph.approval_status = 'approved' 
              OR (ph.approval_status IS NULL AND ph.payment_approved = true)
            THEN ph.installment_amount 
            ELSE 0 
          END), 0) as total_paid,
          -- Due = quotation total - approved payments only (rejected payments don't count)
          (q.total_amount - COALESCE(SUM(CASE 
            WHEN ph.approval_status = 'approved' 
              OR (ph.approval_status IS NULL AND ph.payment_approved = true)
            THEN ph.installment_amount 
            ELSE 0 
          END), 0)) as remaining_due,
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pi.id,
              'pi_number', pi.pi_number,
              'pi_date', pi.pi_date,
              'total_amount', pi.total_amount,
              'status', pi.status,
              'created_at', pi.created_at
            )
          ) FILTER (WHERE pi.id IS NOT NULL) as pis,
          json_agg(
            DISTINCT jsonb_build_object(
              'id', qi.id,
              'product_name', qi.product_name,
              'description', qi.description,
              'quantity', qi.quantity,
              'unit', qi.unit,
              'unit_price', qi.unit_price,
              'total_amount', qi.total_amount
            )
          ) FILTER (WHERE qi.id IS NOT NULL) as products
        FROM quotations q
        INNER JOIN proforma_invoices pi ON pi.quotation_id::text = q.id::text
        LEFT JOIN department_users du ON q.salesperson_id = du.id
        LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
        LEFT JOIN payment_history ph ON ph.quotation_id::text = q.id::text 
          AND ph.payment_status = 'completed' 
          AND (ph.is_refund = false OR ph.is_refund IS NULL)
          AND (ph.approval_status IS NULL OR ph.approval_status != 'rejected')
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY q.id, du.username, du.email
        ORDER BY q.created_at DESC, q.quotation_number DESC
      `;
      
      const result = await query(sql, values);
      
      // Calculate summary statistics - count unique quotations only
      const uniqueQuotations = new Map();
      result.rows.forEach(row => {
        if (!uniqueQuotations.has(row.id)) {
          uniqueQuotations.set(row.id, {
            quotation_total: parseFloat(row.quotation_total || 0),
            total_paid: parseFloat(row.total_paid || 0),
            remaining_due: parseFloat(row.remaining_due || 0),
            pi_count: parseInt(row.pi_count || 0)
          });
        }
      });
      
      const totalOrders = uniqueQuotations.size;
      const totalQuotationValue = Array.from(uniqueQuotations.values()).reduce((sum, q) => sum + q.quotation_total, 0);
      const totalPaid = Array.from(uniqueQuotations.values()).reduce((sum, q) => sum + q.total_paid, 0);
      const totalDue = Array.from(uniqueQuotations.values()).reduce((sum, q) => sum + q.remaining_due, 0);
      const totalPIs = Array.from(uniqueQuotations.values()).reduce((sum, q) => sum + q.pi_count, 0);
      
      // Group by salesperson - count unique quotations per salesperson
      const bySalesperson = {};
      const salespersonQuotationSet = new Map(); // Track unique quotations per salesperson
      
      result.rows.forEach(row => {
        const salespersonKey = row.salesperson_username || row.salesperson_email || 'Unknown';
        const quotationId = row.id;
        
        if (!bySalesperson[salespersonKey]) {
          bySalesperson[salespersonKey] = {
            salesperson: {
              username: row.salesperson_username,
              email: row.salesperson_email,
              name: row.salesperson_name
            },
            orders: [],
            totalOrders: 0,
            totalValue: 0,
            totalPaid: 0,
            totalDue: 0,
            totalPIs: 0
          };
          salespersonQuotationSet.set(salespersonKey, new Set());
        }
        
        // Add order only once per unique quotation
        if (!salespersonQuotationSet.get(salespersonKey).has(quotationId)) {
          bySalesperson[salespersonKey].orders.push(row);
          salespersonQuotationSet.get(salespersonKey).add(quotationId);
          bySalesperson[salespersonKey].totalOrders++;
          bySalesperson[salespersonKey].totalValue += parseFloat(row.quotation_total || 0);
          bySalesperson[salespersonKey].totalPIs += parseInt(row.pi_count || 0);
        }
        
        // Sum approved payments (already calculated per quotation in SQL)
        // But we need to ensure we don't double count
        if (!salespersonQuotationSet.get(salespersonKey).has(`paid_${quotationId}`)) {
          bySalesperson[salespersonKey].totalPaid += parseFloat(row.total_paid || 0);
          salespersonQuotationSet.get(salespersonKey).add(`paid_${quotationId}`);
        }
      });
      
      // Recalculate due for each salesperson (quotation total - approved paid per quotation)
      Object.keys(bySalesperson).forEach(key => {
        const sp = bySalesperson[key];
        // Due = sum of (quotation_total - approved_paid) for each unique quotation
        sp.totalDue = sp.orders.reduce((sum, order) => {
          const quotationTotal = parseFloat(order.quotation_total || 0);
          const approvedPaid = parseFloat(order.total_paid || 0);
          return sum + Math.max(0, quotationTotal - approvedPaid);
        }, 0);
      });
      
      return {
        dateRange: { startDate, endDate },
        salesperson: salespersonUsername,
        summary: {
          totalOrders,
          totalQuotationValue,
          totalPaid,
          totalDue,
          totalPIs,
          averageOrderValue: totalOrders > 0 ? totalQuotationValue / totalOrders : 0
        },
        bySalesperson: Object.values(bySalesperson),
        orders: result.rows
      };
    } catch (error) {
      logger.error('Error fetching orders report:', error);
      throw error;
    }
  }

  /**
   * Get all salespersons who have orders (quotations with PIs)
   */
  static async getSalespersonsWithOrders() {
    try {
      const sql = `
        SELECT DISTINCT
          du.id,
          du.username,
          du.email,
          du.username as name,
          du.department_type,
          COUNT(DISTINCT q.id) as order_count
        FROM department_users du
        INNER JOIN quotations q ON q.salesperson_id = du.id
        INNER JOIN proforma_invoices pi ON pi.quotation_id::text = q.id::text
        WHERE du.is_active = true
        GROUP BY du.id, du.username, du.email, du.department_type
        HAVING COUNT(DISTINCT q.id) > 0
        ORDER BY order_count DESC, du.username ASC
      `;
      return await query(sql, []);
    } catch (error) {
      logger.error('Error fetching salespersons with orders:', error);
      throw error;
    }
  }

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
}

module.exports = OrdersReportService;

