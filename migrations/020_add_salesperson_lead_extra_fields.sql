-- Add extra fields to salesperson_leads without removing any existing columns
-- This migration is idempotent via IF NOT EXISTS guards

-- PostgreSQL specific syntax for adding columns
DO $$
BEGIN
    -- Add connected_status_remark column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'connected_status_remark') THEN
        ALTER TABLE salesperson_leads ADD COLUMN connected_status_remark TEXT;
    END IF;

    -- Add final_status_remark column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'final_status_remark') THEN
        ALTER TABLE salesperson_leads ADD COLUMN final_status_remark TEXT;
    END IF;

    -- Add sales_status_remark column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'sales_status_remark') THEN
        ALTER TABLE salesperson_leads ADD COLUMN sales_status_remark TEXT;
    END IF;

    -- Add quotation_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'quotation_url') THEN
        ALTER TABLE salesperson_leads ADD COLUMN quotation_url TEXT;
    END IF;

    -- Add quotation_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'quotation_count') THEN
        ALTER TABLE salesperson_leads ADD COLUMN quotation_count INTEGER DEFAULT 0;
    END IF;

    -- Add proforma_invoice_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'proforma_invoice_url') THEN
        ALTER TABLE salesperson_leads ADD COLUMN proforma_invoice_url TEXT;
    END IF;

    -- Add payment_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'payment_status') THEN
        ALTER TABLE salesperson_leads ADD COLUMN payment_status VARCHAR(50);
    END IF;

    -- Add payment_mode column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'payment_mode') THEN
        ALTER TABLE salesperson_leads ADD COLUMN payment_mode VARCHAR(50);
    END IF;

    -- Add payment_receipt_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'payment_receipt_url') THEN
        ALTER TABLE salesperson_leads ADD COLUMN payment_receipt_url TEXT;
    END IF;

    -- Add transferred_to column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'transferred_to') THEN
        ALTER TABLE salesperson_leads ADD COLUMN transferred_to VARCHAR(255);
    END IF;

    -- Add call_duration_seconds column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_duration_seconds') THEN
        ALTER TABLE salesperson_leads ADD COLUMN call_duration_seconds INTEGER;
    END IF;
END $$;

-- Helpful indexes where appropriate
DO $$
BEGIN
    -- Create payment_status index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_salesperson_leads_payment_status') THEN
        CREATE INDEX idx_salesperson_leads_payment_status ON salesperson_leads(payment_status);
    END IF;

    -- Create transferred_to index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_salesperson_leads_transferred_to') THEN
        CREATE INDEX idx_salesperson_leads_transferred_to ON salesperson_leads(transferred_to);
    END IF;
END $$;


