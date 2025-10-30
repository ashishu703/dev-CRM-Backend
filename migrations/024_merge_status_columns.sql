
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
