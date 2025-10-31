-- Add sales_status column to leads table if it doesn't exist
-- Add sales_status column to salesperson_leads table if it doesn't exist
-- Create indexes for performance

<<<<<<< HEAD
/* Add sales_status column to leads table if it doesn't exist */
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'sales_status') THEN
        ALTER TABLE leads ADD COLUMN sales_status VARCHAR(20) DEFAULT 'PENDING';
    END IF;
END $$;

/* Add sales_status column to salesperson_leads table if it doesn't exist */
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'sales_status') THEN
        ALTER TABLE salesperson_leads ADD COLUMN sales_status VARCHAR(20) DEFAULT 'PENDING';
    END IF;
END $$;

/* Create indexes for performance */
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leads_sales_status') THEN
        CREATE INDEX idx_leads_sales_status ON leads(sales_status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_dh_leads_sales_status') THEN
        CREATE INDEX idx_dh_leads_sales_status ON department_head_leads(sales_status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sp_leads_sales_status') THEN
        CREATE INDEX idx_sp_leads_sales_status ON salesperson_leads(sales_status);
    END IF;
END $$;
=======
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
>>>>>>> 69ac8921530cfdbc8e248f9c715611694f503d6c
