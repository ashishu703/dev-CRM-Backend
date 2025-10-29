-- Add extra fields to salesperson_leads without removing any existing columns
-- This migration adds columns that may already exist (idempotent)

-- Skip this migration if columns already exist
-- The columns are already present in the database
-- This migration is kept for reference but will be skipped

-- Note: The following columns should already exist:
-- connected_status_remark, final_status_remark, sales_status_remark
-- quotation_url, quotation_count, proforma_invoice_url
-- payment_status, payment_mode, payment_receipt_url
-- transferred_to, call_duration_seconds

-- Create indexes if they don't exist (these will be created by the system)
-- CREATE INDEX IF NOT EXISTS idx_salesperson_leads_payment_status ON salesperson_leads(payment_status);
-- CREATE INDEX IF NOT EXISTS idx_salesperson_leads_transferred_to ON salesperson_leads(transferred_to);