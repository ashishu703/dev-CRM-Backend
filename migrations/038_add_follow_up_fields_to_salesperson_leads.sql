-- Add follow-up fields to salesperson_leads table
-- These fields are expected by the application but were missing from the database

DO $$
BEGIN
    -- Add follow_up_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'salesperson_leads' AND column_name = 'follow_up_status') THEN
        ALTER TABLE salesperson_leads ADD COLUMN follow_up_status VARCHAR(50);
    END IF;

    -- Add follow_up_remark column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'salesperson_leads' AND column_name = 'follow_up_remark') THEN
        ALTER TABLE salesperson_leads ADD COLUMN follow_up_remark TEXT;
    END IF;

    -- Add follow_up_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'salesperson_leads' AND column_name = 'follow_up_date') THEN
        ALTER TABLE salesperson_leads ADD COLUMN follow_up_date DATE;
    END IF;

    -- Add follow_up_time column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'salesperson_leads' AND column_name = 'follow_up_time') THEN
        ALTER TABLE salesperson_leads ADD COLUMN follow_up_time TIME;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error adding follow-up columns to salesperson_leads: %', SQLERRM;
END $$;

-- Create index for follow_up_status for better query performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_salesperson_leads_follow_up_status') THEN
        CREATE INDEX idx_salesperson_leads_follow_up_status ON salesperson_leads(follow_up_status);
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating index for follow_up_status: %', SQLERRM;
END $$;

