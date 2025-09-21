-- Add extra fields to salesperson_leads without removing any existing columns
-- This migration is idempotent via IF NOT EXISTS guards

ALTER TABLE salesperson_leads 
  ADD COLUMN IF NOT EXISTS connected_status_remark TEXT,
  ADD COLUMN IF NOT EXISTS final_status_remark TEXT,
  ADD COLUMN IF NOT EXISTS quotation_url TEXT,
  ADD COLUMN IF NOT EXISTS quotation_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proforma_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS transferred_to VARCHAR(255),
  ADD COLUMN IF NOT EXISTS call_duration_seconds INTEGER;

-- Helpful indexes where appropriate
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_salesperson_leads_payment_status ON salesperson_leads(payment_status);
  CREATE INDEX IF NOT EXISTS idx_salesperson_leads_transferred_to ON salesperson_leads(transferred_to);
EXCEPTION WHEN others THEN NULL; END $$;


