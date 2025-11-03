-- Migration to handle existing sales_status indexes idempotently
-- Ensures indexes exist without failing if they already do

<<<<<<< HEAD
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
-- Skip this migration if indexes already exist
-- The indexes are already present in the database
-- This migration is kept for reference but will be skipped

-- Note: The following indexes should already exist:
-- idx_leads_sales_status, idx_dh_leads_sales_status, idx_sp_leads_sales_status

-- Create indexes if they don't exist (these will be created by the system)
-- CREATE INDEX idx_leads_sales_status ON leads(sales_status);
-- CREATE INDEX idx_dh_leads_sales_status ON department_head_leads(sales_status);
-- CREATE INDEX idx_sp_leads_sales_status ON salesperson_leads(sales_status);
>>>>>>> 69ac8921530cfdbc8e248f9c715611694f503d6c
