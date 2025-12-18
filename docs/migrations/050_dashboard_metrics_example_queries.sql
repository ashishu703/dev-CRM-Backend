-- ============================================================================
-- Dashboard Metrics - Example Queries
-- ============================================================================
-- This file contains example SELECT queries for different user roles:
-- 1. Super Admin - Can see all companies, departments, and salespersons
-- 2. Department Head - Can see only their company and department(s)
-- 3. Salesperson - Can see only their own data
-- ============================================================================

-- ============================================================================
-- SUPER ADMIN QUERIES
-- ============================================================================

-- 1. Super Admin: Get total metrics across ALL companies for a specific date
--    Returns global totals (all companies combined)
SELECT 
    snapshot_date,
    SUM(total_leads) AS global_total_leads,
    SUM(open_leads) AS global_open_leads,
    SUM(closed_leads) AS global_closed_leads,
    SUM(converted_leads) AS global_converted_leads,
    SUM(total_revenue) AS global_total_revenue,
    SUM(total_quotations) AS global_total_quotations,
    SUM(total_followups) AS global_total_followups,
    SUM(total_orders) AS global_total_orders,
    SUM(total_payments) AS global_total_payments,
    AVG(conversion_rate) AS avg_conversion_rate
FROM dashboard_metrics
WHERE snapshot_date = CURRENT_DATE
    AND department_type IS NULL 
    AND salesperson_id IS NULL  -- Company-level metrics only
GROUP BY snapshot_date;

-- 2. Super Admin: Get total metrics across ALL companies for a date range
SELECT 
    snapshot_date,
    SUM(total_leads) AS global_total_leads,
    SUM(open_leads) AS global_open_leads,
    SUM(closed_leads) AS global_closed_leads,
    SUM(total_revenue) AS global_total_revenue,
    SUM(total_quotations) AS global_total_quotations,
    SUM(total_orders) AS global_total_orders
FROM dashboard_metrics
WHERE snapshot_date BETWEEN :start_date AND :end_date
    AND department_type IS NULL 
    AND salesperson_id IS NULL
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;

-- 3. Super Admin: Get metrics grouped by company (for a specific date)
SELECT 
    o.id AS organization_id,
    o.organization_name,
    dm.snapshot_date,
    dm.total_leads,
    dm.open_leads,
    dm.closed_leads,
    dm.converted_leads,
    dm.total_revenue,
    dm.total_quotations,
    dm.total_followups,
    dm.total_orders,
    dm.total_payments,
    dm.conversion_rate
FROM dashboard_metrics dm
LEFT JOIN organizations o ON dm.organization_id = o.id
WHERE dm.snapshot_date = :selected_date
    AND dm.department_type IS NULL 
    AND dm.salesperson_id IS NULL
ORDER BY dm.total_revenue DESC;

-- 4. Super Admin: Get metrics grouped by company + department (for a specific date)
SELECT 
    o.id AS organization_id,
    o.organization_name,
    dm.department_type,
    dm.snapshot_date,
    dm.total_leads,
    dm.open_leads,
    dm.closed_leads,
    dm.total_revenue,
    dm.total_quotations,
    dm.total_followups,
    dm.conversion_rate
FROM dashboard_metrics dm
LEFT JOIN organizations o ON dm.organization_id = o.id
WHERE dm.snapshot_date = :selected_date
    AND dm.department_type IS NOT NULL 
    AND dm.salesperson_id IS NULL  -- Department-level metrics
ORDER BY o.organization_name, dm.department_type;

-- 5. Super Admin: Get company summary with department breakdown (nested view)
--    Shows company totals and department details side by side
SELECT 
    o.id AS organization_id,
    o.organization_name,
    dm.snapshot_date,
    -- Company-level metrics
    MAX(CASE WHEN dm.department_type IS NULL THEN dm.total_leads END) AS company_total_leads,
    MAX(CASE WHEN dm.department_type IS NULL THEN dm.total_revenue END) AS company_total_revenue,
    -- Department-level metrics (aggregated)
    SUM(CASE WHEN dm.department_type IS NOT NULL THEN dm.total_leads ELSE 0 END) AS dept_total_leads,
    SUM(CASE WHEN dm.department_type IS NOT NULL THEN dm.total_revenue ELSE 0 END) AS dept_total_revenue
FROM dashboard_metrics dm
LEFT JOIN organizations o ON dm.organization_id = o.id
WHERE dm.snapshot_date = :selected_date
    AND dm.salesperson_id IS NULL  -- Company and department level only
GROUP BY o.id, o.organization_name, dm.snapshot_date
ORDER BY o.organization_name;

-- 6. Super Admin: Get top performing salespersons across all companies
SELECT 
    du.id AS salesperson_id,
    du.username AS salesperson_name,
    du.email,
    o.organization_name,
    du.department_type,
    dm.snapshot_date,
    dm.total_leads,
    dm.converted_leads,
    dm.total_revenue,
    dm.total_quotations,
    dm.conversion_rate
FROM dashboard_metrics dm
JOIN department_users du ON dm.salesperson_id = du.id
LEFT JOIN organizations o ON dm.organization_id = o.id
WHERE dm.snapshot_date = :selected_date
    AND dm.salesperson_id IS NOT NULL
ORDER BY dm.total_revenue DESC
LIMIT 20;

-- ============================================================================
-- DEPARTMENT HEAD QUERIES
-- ============================================================================
-- Note: Department Head should only see data for their own company and department(s)
-- Use WHERE clauses: organization_id = :organization_id AND department_type = :department_type

-- 7. Department Head: Get total metrics for their department (specific date)
SELECT 
    snapshot_date,
    total_leads,
    open_leads,
    closed_leads,
    converted_leads,
    total_revenue,
    total_quotations,
    approved_quotations,
    rejected_quotations,
    total_followups,
    pending_followups,
    completed_followups,
    total_orders,
    total_payments,
    pending_payments,
    conversion_rate
FROM dashboard_metrics
WHERE snapshot_date = :selected_date
    AND organization_id = :organization_id  -- Department Head's company
    AND department_type = :department_type  -- Department Head's department
    AND salesperson_id IS NULL  -- Department-level aggregate
LIMIT 1;

-- 8. Department Head: Get department metrics for a date range
SELECT 
    snapshot_date,
    total_leads,
    open_leads,
    closed_leads,
    total_revenue,
    total_quotations,
    total_followups,
    total_orders,
    conversion_rate
FROM dashboard_metrics
WHERE snapshot_date BETWEEN :start_date AND :end_date
    AND organization_id = :organization_id
    AND department_type = :department_type
    AND salesperson_id IS NULL
ORDER BY snapshot_date DESC;

-- 9. Department Head: Get metrics grouped by salesperson in their department (specific date)
SELECT 
    du.id AS salesperson_id,
    du.username AS salesperson_name,
    du.email,
    dm.snapshot_date,
    dm.total_leads,
    dm.open_leads,
    dm.closed_leads,
    dm.converted_leads,
    dm.total_revenue,
    dm.total_quotations,
    dm.total_followups,
    dm.total_orders,
    dm.conversion_rate,
    dm.average_response_time_minutes
FROM dashboard_metrics dm
JOIN department_users du ON dm.salesperson_id = du.id
WHERE dm.snapshot_date = :selected_date
    AND dm.organization_id = :organization_id
    AND dm.department_type = :department_type
    AND dm.salesperson_id IS NOT NULL  -- Salesperson-level metrics
ORDER BY dm.total_revenue DESC;

-- 10. Department Head: Get salesperson performance summary (last 30 days)
SELECT 
    du.id AS salesperson_id,
    du.username AS salesperson_name,
    SUM(dm.total_leads) AS total_leads_30d,
    SUM(dm.converted_leads) AS converted_leads_30d,
    SUM(dm.total_revenue) AS total_revenue_30d,
    SUM(dm.total_quotations) AS total_quotations_30d,
    SUM(dm.total_followups) AS total_followups_30d,
    AVG(dm.conversion_rate) AS avg_conversion_rate_30d,
    COUNT(DISTINCT dm.snapshot_date) AS active_days
FROM dashboard_metrics dm
JOIN department_users du ON dm.salesperson_id = du.id
WHERE dm.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
    AND dm.organization_id = :organization_id
    AND dm.department_type = :department_type
    AND dm.salesperson_id IS NOT NULL
GROUP BY du.id, du.username
ORDER BY total_revenue_30d DESC;

-- 11. Department Head: Get department trend (daily metrics for last 7 days)
SELECT 
    snapshot_date,
    total_leads,
    open_leads,
    closed_leads,
    total_revenue,
    total_quotations,
    total_followups,
    conversion_rate
FROM dashboard_metrics
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
    AND organization_id = :organization_id
    AND department_type = :department_type
    AND salesperson_id IS NULL
ORDER BY snapshot_date ASC;

-- ============================================================================
-- SALESPERSON QUERIES
-- ============================================================================
-- Note: Salesperson should only see their own data
-- Use WHERE clause: salesperson_id = :salesperson_id

-- 12. Salesperson: Get their metrics for today
SELECT 
    snapshot_date,
    total_leads,
    open_leads,
    closed_leads,
    converted_leads,
    total_revenue,
    total_quotations,
    approved_quotations,
    rejected_quotations,
    total_followups,
    pending_followups,
    completed_followups,
    total_orders,
    total_payments,
    pending_payments,
    conversion_rate,
    average_response_time_minutes
FROM dashboard_metrics
WHERE snapshot_date = CURRENT_DATE
    AND salesperson_id = :salesperson_id
LIMIT 1;

-- 13. Salesperson: Get their metrics for a specific date
SELECT 
    snapshot_date,
    total_leads,
    open_leads,
    closed_leads,
    converted_leads,
    total_revenue,
    total_quotations,
    total_followups,
    total_orders,
    conversion_rate
FROM dashboard_metrics
WHERE snapshot_date = :selected_date
    AND salesperson_id = :salesperson_id
LIMIT 1;

-- 14. Salesperson: Get their metrics for the last 30 days (grouped by date)
SELECT 
    snapshot_date,
    total_leads,
    open_leads,
    closed_leads,
    converted_leads,
    total_revenue,
    total_quotations,
    total_followups,
    total_orders,
    conversion_rate
FROM dashboard_metrics
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
    AND salesperson_id = :salesperson_id
ORDER BY snapshot_date DESC;

-- 15. Salesperson: Get their performance summary (last 30 days aggregated)
SELECT 
    COUNT(DISTINCT snapshot_date) AS active_days,
    SUM(total_leads) AS total_leads_30d,
    SUM(open_leads) AS open_leads_30d,
    SUM(closed_leads) AS closed_leads_30d,
    SUM(converted_leads) AS converted_leads_30d,
    SUM(total_revenue) AS total_revenue_30d,
    SUM(total_quotations) AS total_quotations_30d,
    SUM(total_followups) AS total_followups_30d,
    SUM(total_orders) AS total_orders_30d,
    AVG(conversion_rate) AS avg_conversion_rate_30d,
    AVG(average_response_time_minutes) AS avg_response_time_minutes
FROM dashboard_metrics
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
    AND salesperson_id = :salesperson_id;

-- 16. Salesperson: Get their weekly trend (last 4 weeks)
SELECT 
    DATE_TRUNC('week', snapshot_date) AS week_start,
    COUNT(DISTINCT snapshot_date) AS days_in_week,
    SUM(total_leads) AS weekly_total_leads,
    SUM(converted_leads) AS weekly_converted_leads,
    SUM(total_revenue) AS weekly_total_revenue,
    SUM(total_quotations) AS weekly_total_quotations,
    AVG(conversion_rate) AS avg_weekly_conversion_rate
FROM dashboard_metrics
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '28 days'
    AND salesperson_id = :salesperson_id
GROUP BY DATE_TRUNC('week', snapshot_date)
ORDER BY week_start DESC;

-- 17. Salesperson: Get their monthly summary (current month)
SELECT 
    DATE_TRUNC('month', snapshot_date) AS month,
    SUM(total_leads) AS monthly_total_leads,
    SUM(converted_leads) AS monthly_converted_leads,
    SUM(total_revenue) AS monthly_total_revenue,
    SUM(total_quotations) AS monthly_total_quotations,
    SUM(total_orders) AS monthly_total_orders,
    AVG(conversion_rate) AS avg_monthly_conversion_rate
FROM dashboard_metrics
WHERE DATE_TRUNC('month', snapshot_date) = DATE_TRUNC('month', CURRENT_DATE)
    AND salesperson_id = :salesperson_id
GROUP BY DATE_TRUNC('month', snapshot_date);

-- ============================================================================
-- UTILITY QUERIES
-- ============================================================================

-- 18. Check if snapshot exists for a specific date and level
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN true 
        ELSE false 
    END AS snapshot_exists
FROM dashboard_metrics
WHERE snapshot_date = :check_date
    AND (
        -- Check for company level
        (organization_id = :org_id AND department_type IS NULL AND salesperson_id IS NULL) OR
        -- Check for department level
        (organization_id = :org_id AND department_type = :dept_type AND salesperson_id IS NULL) OR
        -- Check for salesperson level
        (salesperson_id = :salesperson_id)
    );

-- 19. Get latest snapshot date for each aggregation level
SELECT 
    'company' AS level,
    MAX(snapshot_date) AS latest_snapshot_date
FROM dashboard_metrics
WHERE department_type IS NULL AND salesperson_id IS NULL
UNION ALL
SELECT 
    'department' AS level,
    MAX(snapshot_date) AS latest_snapshot_date
FROM dashboard_metrics
WHERE department_type IS NOT NULL AND salesperson_id IS NULL
UNION ALL
SELECT 
    'salesperson' AS level,
    MAX(snapshot_date) AS latest_snapshot_date
FROM dashboard_metrics
WHERE salesperson_id IS NOT NULL;

-- 20. Get date range of available snapshots
SELECT 
    MIN(snapshot_date) AS earliest_snapshot,
    MAX(snapshot_date) AS latest_snapshot,
    COUNT(DISTINCT snapshot_date) AS total_snapshot_days
FROM dashboard_metrics;

