-- Add transfer tracking fields to department_head_leads table
-- Run date: 2025-12-03

DO $$
BEGIN
    -- Add transferred_from column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'transferred_from') THEN
        ALTER TABLE department_head_leads ADD COLUMN transferred_from VARCHAR(255);
    END IF;

    -- Add transferred_to column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'transferred_to') THEN
        ALTER TABLE department_head_leads ADD COLUMN transferred_to VARCHAR(255);
    END IF;

    -- Add transferred_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'transferred_at') THEN
        ALTER TABLE department_head_leads ADD COLUMN transferred_at TIMESTAMP;
    END IF;

    -- Add transfer_reason column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'transfer_reason') THEN
        ALTER TABLE department_head_leads ADD COLUMN transfer_reason TEXT;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error adding transfer columns to department_head_leads: %', SQLERRM;
END $$;

-- Add indexes for better performance
DO $$
BEGIN
    -- Create transferred_from index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_department_head_leads_transferred_from') THEN
        CREATE INDEX idx_department_head_leads_transferred_from ON department_head_leads(transferred_from);
    END IF;

    -- Create transferred_to index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_department_head_leads_transferred_to') THEN
        CREATE INDEX idx_department_head_leads_transferred_to ON department_head_leads(transferred_to);
    END IF;

    -- Create transferred_at index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_department_head_leads_transferred_at') THEN
        CREATE INDEX idx_department_head_leads_transferred_at ON department_head_leads(transferred_at);
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating transfer indexes for department_head_leads: %', SQLERRM;
END $$;

