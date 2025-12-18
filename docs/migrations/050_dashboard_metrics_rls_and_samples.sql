-- ============================================================================
-- Dashboard Metrics - Row Level Security (RLS) Policies and Sample Data
-- ============================================================================
-- This file contains:
-- 1. RLS policies for role-based access control
-- 2. Sample INSERT statements demonstrating different aggregation levels
-- ============================================================================

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Note: RLS requires enabling it on the table and creating policies
-- You can also implement access control in your API layer using WHERE clauses

-- Enable RLS on the table
ALTER TABLE dashboard_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Policy 1: Super Admin - Can see ALL rows
-- ============================================================================
-- Assumes you have a function or session variable to check if user is super admin
-- Example: current_setting('app.user_role') = 'super_admin'

CREATE POLICY super_admin_all_access ON dashboard_metrics
    FOR ALL
    TO PUBLIC  -- Adjust role as needed
    USING (
        -- Check if current user is super admin
        -- This assumes you set a session variable or use a function
        current_setting('app.user_role', true) = 'super_admin'
    )
    WITH CHECK (
        current_setting('app.user_role', true) = 'super_admin'
    );

-- ============================================================================
-- Policy 2: Department Head - Can see only their company and department(s)
-- ============================================================================
-- Assumes session variables: app.user_role, app.user_organization_id, app.user_department_type

CREATE POLICY department_head_restricted_access ON dashboard_metrics
    FOR SELECT
    TO PUBLIC
    USING (
        current_setting('app.user_role', true) = 'department_head' AND
        (
            -- Can see department-level aggregates for their department
            (
                organization_id::text = current_setting('app.user_organization_id', true) AND
                department_type = current_setting('app.user_department_type', true) AND
                salesperson_id IS NULL
            ) OR
            -- Can see salesperson-level data for salespersons in their department
            (
                organization_id::text = current_setting('app.user_organization_id', true) AND
                department_type = current_setting('app.user_department_type', true) AND
                salesperson_id IS NOT NULL
            )
        )
    );

-- ============================================================================
-- Policy 3: Salesperson - Can see only their own data
-- ============================================================================
-- Assumes session variables: app.user_role, app.user_salesperson_id

CREATE POLICY salesperson_own_data_only ON dashboard_metrics
    FOR SELECT
    TO PUBLIC
    USING (
        current_setting('app.user_role', true) = 'salesperson' AND
        salesperson_id::text = current_setting('app.user_salesperson_id', true)
    );

-- ============================================================================
-- ALTERNATIVE: API Layer WHERE Clauses (Recommended for most applications)
-- ============================================================================
-- Instead of RLS, you can implement access control in your API/application layer
-- Here are example WHERE clause patterns:

-- Super Admin: No restrictions (or optional date filtering)
-- WHERE clause: (none) or WHERE snapshot_date = :date

-- Department Head: Filter by organization_id and department_type
-- WHERE clause: 
--   organization_id = :organization_id 
--   AND department_type = :department_type
--   AND (salesperson_id IS NULL OR salesperson_id IN (
--       SELECT id FROM department_users 
--       WHERE head_user_id = :department_head_id
--   ))

-- Salesperson: Filter by salesperson_id only
-- WHERE clause: salesperson_id = :salesperson_id

-- ============================================================================
-- HELPER FUNCTION: Get accessible organization IDs for a user
-- ============================================================================
-- This function can be used in your API to determine which organizations
-- a user can access based on their role

CREATE OR REPLACE FUNCTION get_accessible_organization_ids(
    p_user_role TEXT,
    p_user_id UUID,
    p_organization_id INTEGER DEFAULT NULL
)
RETURNS TABLE(organization_id INTEGER) AS $$
BEGIN
    IF p_user_role = 'super_admin' THEN
        -- Super admin can see all organizations
        RETURN QUERY
        SELECT DISTINCT o.id
        FROM organizations o
        WHERE o.is_active = true;
        
    ELSIF p_user_role = 'department_head' THEN
        -- Department head can see only their organization
        RETURN QUERY
        SELECT DISTINCT o.id
        FROM organizations o
        JOIN department_heads dh ON o.organization_name = dh.company_name
        WHERE dh.id = p_user_id
            AND dh.is_active = true
            AND o.is_active = true;
            
    ELSIF p_user_role = 'salesperson' THEN
        -- Salesperson can see only their organization
        RETURN QUERY
        SELECT DISTINCT o.id
        FROM organizations o
        JOIN department_users du ON o.organization_name = du.company_name
        WHERE du.id = p_user_id
            AND du.is_active = true
            AND o.is_active = true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Get accessible department types for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_accessible_department_types(
    p_user_role TEXT,
    p_user_id UUID,
    p_organization_id INTEGER
)
RETURNS TABLE(department_type VARCHAR) AS $$
BEGIN
    IF p_user_role = 'super_admin' THEN
        -- Super admin can see all departments
        RETURN QUERY
        SELECT DISTINCT department_type
        FROM dashboard_metrics
        WHERE organization_id = p_organization_id
            AND department_type IS NOT NULL;
            
    ELSIF p_user_role = 'department_head' THEN
        -- Department head can see only their department
        RETURN QUERY
        SELECT DISTINCT dh.department_type
        FROM department_heads dh
        WHERE dh.id = p_user_id
            AND dh.is_active = true;
            
    ELSIF p_user_role = 'salesperson' THEN
        -- Salesperson can see only their department
        RETURN QUERY
        SELECT DISTINCT du.department_type
        FROM department_users du
        WHERE du.id = p_user_id
            AND du.is_active = true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SAMPLE DATA INSERTS
-- ============================================================================
-- These examples show how to insert metrics at different aggregation levels

-- ============================================================================
-- Sample 1: Company-Level Metrics (organization_id = 1, no department, no salesperson)
-- ============================================================================
-- This represents aggregated metrics for the entire company

INSERT INTO dashboard_metrics (
    snapshot_date,
    organization_id,
    company_name,
    department_type,
    salesperson_id,
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
) VALUES (
    CURRENT_DATE,
    1,  -- organization_id
    'Anode Electric Pvt. Ltd.',  -- company_name
    NULL,  -- department_type IS NULL for company level
    NULL,  -- salesperson_id IS NULL for company level
    150,   -- total_leads
    45,    -- open_leads
    105,   -- closed_leads
    75,    -- converted_leads
    1250000.00,  -- total_revenue
    120,   -- total_quotations
    80,    -- approved_quotations
    40,    -- rejected_quotations
    200,   -- total_followups
    30,    -- pending_followups
    170,   -- completed_followups
    50,    -- total_orders
    1000000.00,  -- total_payments
    250000.00,   -- pending_payments
    50.00  -- conversion_rate (50%)
);

-- ============================================================================
-- Sample 2: Department-Level Metrics (has department_type, no salesperson)
-- ============================================================================
-- This represents aggregated metrics for a specific department within a company

INSERT INTO dashboard_metrics (
    snapshot_date,
    organization_id,
    company_name,
    department_type,
    salesperson_id,
    total_leads,
    open_leads,
    closed_leads,
    converted_leads,
    total_revenue,
    total_quotations,
    total_followups,
    total_orders,
    conversion_rate
) VALUES (
    CURRENT_DATE,
    1,  -- organization_id
    'Anode Electric Pvt. Ltd.',
    'marketing_sales',  -- department_type IS NOT NULL for department level
    NULL,  -- salesperson_id IS NULL for department level
    80,    -- total_leads
    25,    -- open_leads
    55,    -- closed_leads
    40,    -- converted_leads
    750000.00,  -- total_revenue
    65,    -- total_quotations
    100,   -- total_followups
    30,    -- total_orders
    50.00  -- conversion_rate
);

-- ============================================================================
-- Sample 3: Salesperson-Level Metrics (has salesperson_id)
-- ============================================================================
-- This represents metrics for a specific salesperson
-- Note: You'll need to replace :salesperson_uuid with an actual UUID from department_users

INSERT INTO dashboard_metrics (
    snapshot_date,
    organization_id,
    company_name,
    department_type,
    salesperson_id,
    total_leads,
    open_leads,
    closed_leads,
    converted_leads,
    total_revenue,
    total_quotations,
    total_followups,
    total_orders,
    conversion_rate,
    average_response_time_minutes
) VALUES (
    CURRENT_DATE,
    1,  -- organization_id
    'Anode Electric Pvt. Ltd.',
    'marketing_sales',  -- department_type should match the salesperson's department
    '550e8400-e29b-41d4-a716-446655440000'::UUID,  -- salesperson_id (replace with actual UUID)
    25,   -- total_leads
    8,    -- open_leads
    17,   -- closed_leads
    12,   -- converted_leads
    250000.00,  -- total_revenue
    20,   -- total_quotations
    35,   -- total_followups
    10,   -- total_orders
    48.00,  -- conversion_rate
    15    -- average_response_time_minutes
);

-- ============================================================================
-- Sample 4: Multiple Salespersons in the Same Department (Same Date)
-- ============================================================================

-- Salesperson 1
INSERT INTO dashboard_metrics (
    snapshot_date, organization_id, company_name, department_type, salesperson_id,
    total_leads, open_leads, closed_leads, converted_leads, total_revenue,
    total_quotations, total_followups, conversion_rate
) VALUES (
    CURRENT_DATE, 1, 'Anode Electric Pvt. Ltd.', 'marketing_sales',
    '550e8400-e29b-41d4-a716-446655440001'::UUID,
    30, 10, 20, 15, 300000.00, 25, 40, 50.00
);

-- Salesperson 2
INSERT INTO dashboard_metrics (
    snapshot_date, organization_id, company_name, department_type, salesperson_id,
    total_leads, open_leads, closed_leads, converted_leads, total_revenue,
    total_quotations, total_followups, conversion_rate
) VALUES (
    CURRENT_DATE, 1, 'Anode Electric Pvt. Ltd.', 'marketing_sales',
    '550e8400-e29b-41d4-a716-446655440002'::UUID,
    20, 5, 15, 10, 200000.00, 18, 30, 50.00
);

-- Salesperson 3
INSERT INTO dashboard_metrics (
    snapshot_date, organization_id, company_name, department_type, salesperson_id,
    total_leads, open_leads, closed_leads, converted_leads, total_revenue,
    total_quotations, total_followups, conversion_rate
) VALUES (
    CURRENT_DATE, 1, 'Anode Electric Pvt. Ltd.', 'marketing_sales',
    '550e8400-e29b-41d4-a716-446655440003'::UUID,
    15, 3, 12, 8, 150000.00, 12, 25, 53.33
);

-- ============================================================================
-- Sample 5: Historical Data (Different Dates)
-- ============================================================================

-- Company-level metrics for yesterday
INSERT INTO dashboard_metrics (
    snapshot_date, organization_id, company_name, department_type, salesperson_id,
    total_leads, open_leads, closed_leads, total_revenue, total_quotations
) VALUES (
    CURRENT_DATE - INTERVAL '1 day', 1, 'Anode Electric Pvt. Ltd.', NULL, NULL,
    140, 50, 90, 1200000.00, 115
);

-- Company-level metrics for 7 days ago
INSERT INTO dashboard_metrics (
    snapshot_date, organization_id, company_name, department_type, salesperson_id,
    total_leads, open_leads, closed_leads, total_revenue, total_quotations
) VALUES (
    CURRENT_DATE - INTERVAL '7 days', 1, 'Anode Electric Pvt. Ltd.', NULL, NULL,
    130, 55, 75, 1100000.00, 110
);

-- ============================================================================
-- Sample 6: Multiple Companies
-- ============================================================================

-- Company 2 (Anode Metals) - Company level
INSERT INTO dashboard_metrics (
    snapshot_date, organization_id, company_name, department_type, salesperson_id,
    total_leads, open_leads, closed_leads, total_revenue, total_quotations
) VALUES (
    CURRENT_DATE, 2, 'Anode Metals', NULL, NULL,
    100, 30, 70, 800000.00, 90
);

-- Company 2 - Department level (office_sales)
INSERT INTO dashboard_metrics (
    snapshot_date, organization_id, company_name, department_type, salesperson_id,
    total_leads, open_leads, closed_leads, total_revenue, total_quotations
) VALUES (
    CURRENT_DATE, 2, 'Anode Metals', 'office_sales', NULL,
    60, 20, 40, 500000.00, 55
);

-- ============================================================================
-- NOTES ON DATA POPULATION
-- ============================================================================
-- 
-- 1. **Daily Snapshot Approach**: Insert one row per day per aggregation level
--    - Company level: 1 row per company per day
--    - Department level: 1 row per department per day
--    - Salesperson level: 1 row per salesperson per day
--
-- 2. **Real-time vs Pre-calculated**:
--    - Pre-calculated (recommended): Calculate and store metrics daily via cron job
--    - Real-time: Update metrics table whenever source data changes (triggers)
--
-- 3. **Data Consistency**:
--    - Ensure salesperson totals sum to department totals
--    - Ensure department totals sum to company totals
--    - You may want to add validation triggers or application-level checks
--
-- 4. **Performance**:
--    - Use batch inserts for bulk data loading
--    - Consider partitioning by snapshot_date for very large datasets
--    - Use UPSERT (ON CONFLICT) to update existing snapshots
--
-- 5. **Example UPSERT for updating existing snapshot**:
--
-- INSERT INTO dashboard_metrics (
--     snapshot_date, organization_id, department_type, salesperson_id,
--     total_leads, total_revenue, ...
-- ) VALUES (
--     CURRENT_DATE, 1, NULL, NULL, 150, 1250000.00, ...
-- )
-- ON CONFLICT (organization_id, snapshot_date) 
-- WHERE department_type IS NULL AND salesperson_id IS NULL
-- DO UPDATE SET
--     total_leads = EXCLUDED.total_leads,
--     total_revenue = EXCLUDED.total_revenue,
--     updated_at = CURRENT_TIMESTAMP;

