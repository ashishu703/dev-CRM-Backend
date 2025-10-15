-- Add extra fields to salesperson_leads without removing any existing columns
-- This migration is idempotent via IF NOT EXISTS guards

-- PostgreSQL specific syntax for adding columns
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'connected_status_remark')
BEGIN
    ALTER TABLE salesperson_leads ADD connected_status_remark TEXT;
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'final_status_remark')
BEGIN
    ALTER TABLE salesperson_leads ADD final_status_remark TEXT;
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'sales_status_remark')
BEGIN
    ALTER TABLE salesperson_leads ADD sales_status_remark TEXT;
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'quotation_url')
BEGIN
    ALTER TABLE salesperson_leads ADD quotation_url TEXT;
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'quotation_count')
BEGIN
    ALTER TABLE salesperson_leads ADD quotation_count INTEGER DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'proforma_invoice_url')
BEGIN
    ALTER TABLE salesperson_leads ADD proforma_invoice_url TEXT;
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'payment_status')
BEGIN
    ALTER TABLE salesperson_leads ADD payment_status VARCHAR(50);
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'payment_mode')
BEGIN
    ALTER TABLE salesperson_leads ADD payment_mode VARCHAR(50);
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'payment_receipt_url')
BEGIN
    ALTER TABLE salesperson_leads ADD payment_receipt_url TEXT;
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'transferred_to')
BEGIN
    ALTER TABLE salesperson_leads ADD transferred_to VARCHAR(255);
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_duration_seconds')
BEGIN
    ALTER TABLE salesperson_leads ADD call_duration_seconds INTEGER;
END;

-- Helpful indexes where appropriate
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_salesperson_leads_payment_status')
BEGIN
    CREATE INDEX idx_salesperson_leads_payment_status ON salesperson_leads(payment_status);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_salesperson_leads_transferred_to')
BEGIN
    CREATE INDEX idx_salesperson_leads_transferred_to ON salesperson_leads(transferred_to);
END;


