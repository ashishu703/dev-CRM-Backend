-- Add sales_status column to leads table if it doesn't exist
-- Add sales_status column to salesperson_leads table if it doesn't exist
-- Create indexes for performance

-- Skip this migration if columns already exist
-- The columns are already present in the database
-- This migration is kept for reference but will be skipped

-- Note: The following columns should already exist:
-- sales_status in leads table
-- sales_status in salesperson_leads table

-- Create indexes if they don't exist (these will be created by the system)
-- CREATE INDEX idx_leads_sales_status ON leads(sales_status);
-- CREATE INDEX idx_dh_leads_sales_status ON department_head_leads(sales_status);
-- CREATE INDEX idx_sp_leads_sales_status ON salesperson_leads(sales_status);