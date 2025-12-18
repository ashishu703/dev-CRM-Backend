-- ============================================================================
-- Dashboard Metrics Table - Single Table Design for Multi-Level Aggregation
-- ============================================================================
-- This table stores pre-calculated dashboard metrics at three levels:
-- 1. Company-level: department_id IS NULL AND salesperson_id IS NULL
-- 2. Department-level: department_id IS NOT NULL AND salesperson_id IS NULL
-- 3. Salesperson-level: salesperson_id IS NOT NULL
--
-- Migration: 050_create_dashboard_metrics_table.sql
-- ============================================================================

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS dashboard_metrics CASCADE;

-- Create the dashboard_metrics table
CREATE TABLE dashboard_metrics (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Snapshot/Time Dimension
    snapshot_date DATE NOT NULL,
    snapshot_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Hierarchical Dimensions
    -- Note: organization_id maps to organizations.id (INTEGER)
    -- For backward compatibility, we also store company_name
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    company_name VARCHAR(255), -- For backward compatibility with existing schema
    
    -- Department identification
    -- Since there's no departments table, we use department_type
    -- If you create a departments table later, you can add department_id INTEGER
    department_type VARCHAR(50), -- e.g., 'marketing_sales', 'office_sales'
    
    -- Salesperson identification
    salesperson_id UUID REFERENCES department_users(id) ON DELETE CASCADE,
    
    -- Metric Columns
    total_leads INTEGER DEFAULT 0,
    open_leads INTEGER DEFAULT 0,
    closed_leads INTEGER DEFAULT 0,
    converted_leads INTEGER DEFAULT 0,
    
    total_revenue DECIMAL(15, 2) DEFAULT 0,
    total_quotations INTEGER DEFAULT 0,
    approved_quotations INTEGER DEFAULT 0,
    rejected_quotations INTEGER DEFAULT 0,
    
    total_followups INTEGER DEFAULT 0,
    pending_followups INTEGER DEFAULT 0,
    completed_followups INTEGER DEFAULT 0,
    
    total_orders INTEGER DEFAULT 0,
    total_payments DECIMAL(15, 2) DEFAULT 0,
    pending_payments DECIMAL(15, 2) DEFAULT 0,
    
    -- Additional metrics (customize as needed)
    average_response_time_minutes INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5, 2) DEFAULT 0, -- Percentage
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    -- Ensure data integrity: salesperson_id implies department_type and company_name
    CONSTRAINT chk_aggregation_level CHECK (
        -- Company level: no department, no salesperson
        (department_type IS NULL AND salesperson_id IS NULL) OR
        -- Department level: has department, no salesperson
        (department_type IS NOT NULL AND salesperson_id IS NULL) OR
        -- Salesperson level: has salesperson (department_type should also be set)
        (salesperson_id IS NOT NULL)
    ),
    
    -- Ensure non-negative metrics
    CONSTRAINT chk_non_negative_leads CHECK (
        total_leads >= 0 AND
        open_leads >= 0 AND
        closed_leads >= 0 AND
        converted_leads >= 0
    ),
    CONSTRAINT chk_non_negative_revenue CHECK (
        total_revenue >= 0 AND
        total_payments >= 0 AND
        pending_payments >= 0
    ),
    CONSTRAINT chk_non_negative_counts CHECK (
        total_quotations >= 0 AND
        approved_quotations >= 0 AND
        rejected_quotations >= 0 AND
        total_followups >= 0 AND
        pending_followups >= 0 AND
        completed_followups >= 0 AND
        total_orders >= 0
    )
);

-- ============================================================================
-- INDEXES for Performance Optimization
-- ============================================================================

-- Indexes for Super Admin queries (all companies, all departments, all salespersons)
CREATE INDEX idx_dashboard_metrics_snapshot_date ON dashboard_metrics(snapshot_date);
CREATE INDEX idx_dashboard_metrics_organization_id ON dashboard_metrics(organization_id);
CREATE INDEX idx_dashboard_metrics_company_name ON dashboard_metrics(company_name) WHERE company_name IS NOT NULL;

-- Indexes for Department Head queries (filter by company and department)
CREATE INDEX idx_dashboard_metrics_dept_company ON dashboard_metrics(organization_id, department_type, snapshot_date) 
    WHERE department_type IS NOT NULL;
CREATE INDEX idx_dashboard_metrics_dept_company_name ON dashboard_metrics(company_name, department_type, snapshot_date) 
    WHERE company_name IS NOT NULL AND department_type IS NOT NULL;

-- Indexes for Salesperson queries (filter by salesperson_id)
CREATE INDEX idx_dashboard_metrics_salesperson ON dashboard_metrics(salesperson_id, snapshot_date) 
    WHERE salesperson_id IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX idx_dashboard_metrics_org_date_range ON dashboard_metrics(organization_id, snapshot_date DESC);
CREATE INDEX idx_dashboard_metrics_dept_date_range ON dashboard_metrics(department_type, snapshot_date DESC) 
    WHERE department_type IS NOT NULL;
CREATE INDEX idx_dashboard_metrics_salesperson_date_range ON dashboard_metrics(salesperson_id, snapshot_date DESC) 
    WHERE salesperson_id IS NOT NULL;

-- Index for aggregation level filtering
CREATE INDEX idx_dashboard_metrics_aggregation_level ON dashboard_metrics(
    (CASE 
        WHEN salesperson_id IS NOT NULL THEN 'salesperson'
        WHEN department_type IS NOT NULL THEN 'department'
        ELSE 'company'
    END),
    snapshot_date
);

-- ============================================================================
-- UNIQUE CONSTRAINTS (Partial Indexes) to Prevent Duplicate Snapshots
-- ============================================================================

-- Prevent duplicate company-level snapshots
CREATE UNIQUE INDEX uq_company_snapshot ON dashboard_metrics(organization_id, snapshot_date) 
    WHERE department_type IS NULL AND salesperson_id IS NULL;

-- Prevent duplicate department-level snapshots
CREATE UNIQUE INDEX uq_department_snapshot ON dashboard_metrics(organization_id, department_type, snapshot_date) 
    WHERE department_type IS NOT NULL AND salesperson_id IS NULL;

-- Prevent duplicate salesperson-level snapshots
CREATE UNIQUE INDEX uq_salesperson_snapshot ON dashboard_metrics(salesperson_id, snapshot_date) 
    WHERE salesperson_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_dashboard_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dashboard_metrics_updated_at
    BEFORE UPDATE ON dashboard_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_metrics_updated_at();

-- ============================================================================
-- COMMENTS for Documentation
-- ============================================================================

COMMENT ON TABLE dashboard_metrics IS 
    'Stores pre-calculated dashboard metrics at company, department, and salesperson levels. 
     Use NULL values to represent different aggregation levels:
     - Company: department_type IS NULL AND salesperson_id IS NULL
     - Department: department_type IS NOT NULL AND salesperson_id IS NULL  
     - Salesperson: salesperson_id IS NOT NULL';

COMMENT ON COLUMN dashboard_metrics.organization_id IS 
    'Foreign key to organizations table. Required for company-level and department-level metrics.';

COMMENT ON COLUMN dashboard_metrics.company_name IS 
    'Company name for backward compatibility with existing schema using company_name strings.';

COMMENT ON COLUMN dashboard_metrics.department_type IS 
    'Department type identifier (e.g., marketing_sales, office_sales). 
     NULL for company-level metrics, required for department and salesperson level.';

COMMENT ON COLUMN dashboard_metrics.salesperson_id IS 
    'Foreign key to department_users table. NULL for company and department level metrics.';

COMMENT ON COLUMN dashboard_metrics.snapshot_date IS 
    'Date for which metrics are calculated. Typically daily snapshots.';

COMMENT ON COLUMN dashboard_metrics.snapshot_timestamp IS 
    'Timestamp when the snapshot was created/updated. Useful for tracking when metrics were last refreshed.';

