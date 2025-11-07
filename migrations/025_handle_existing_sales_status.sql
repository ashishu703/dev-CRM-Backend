-- Migration to handle existing sales_status indexes idempotently
-- Ensures indexes exist without failing if they already do

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_leads_sales_status') THEN
        CREATE INDEX idx_leads_sales_status ON leads(sales_status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_dh_leads_sales_status') THEN
        CREATE INDEX idx_dh_leads_sales_status ON department_head_leads(sales_status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_sp_leads_sales_status') THEN
        CREATE INDEX idx_sp_leads_sales_status ON salesperson_leads(sales_status);
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating sales_status indexes: %', SQLERRM;
END $$;
