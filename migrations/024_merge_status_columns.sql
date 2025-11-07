-- Add sales_status column to leads table if it doesn't exist
-- Add sales_status column to salesperson_leads table if it doesn't exist
-- Create indexes for performance

-- Add sales_status column to leads table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'sales_status') THEN
        ALTER TABLE leads ADD COLUMN sales_status VARCHAR(20) DEFAULT 'PENDING';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error adding sales_status to leads: %', SQLERRM;
END $$;

-- Add sales_status column to salesperson_leads table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'salesperson_leads' AND column_name = 'sales_status') THEN
        ALTER TABLE salesperson_leads ADD COLUMN sales_status VARCHAR(20) DEFAULT 'PENDING';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error adding sales_status to salesperson_leads: %', SQLERRM;
END $$;

-- Create indexes for performance
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
