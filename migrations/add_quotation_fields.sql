-- Migration: Add new fields to quotations table
-- Date: 2025-01-04
-- Description: Adds template, delivery/payment terms, bank details, terms sections, and bill_to fields

-- Add template field
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS template VARCHAR(255);

-- Add delivery and payment term fields
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS payment_mode TEXT,
ADD COLUMN IF NOT EXISTS transport_tc TEXT,
ADD COLUMN IF NOT EXISTS dispatch_through TEXT,
ADD COLUMN IF NOT EXISTS delivery_terms TEXT,
ADD COLUMN IF NOT EXISTS material_type TEXT;

-- Add JSON fields for structured data
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS bank_details JSONB,
ADD COLUMN IF NOT EXISTS terms_sections JSONB,
ADD COLUMN IF NOT EXISTS bill_to JSONB;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quotations_template ON quotations(template);

-- Add comments to document the columns
COMMENT ON COLUMN quotations.template IS 'Template key used for this quotation';
COMMENT ON COLUMN quotations.payment_mode IS 'Payment mode and terms';
COMMENT ON COLUMN quotations.transport_tc IS 'Transport terms and conditions';
COMMENT ON COLUMN quotations.dispatch_through IS 'Dispatch method';
COMMENT ON COLUMN quotations.delivery_terms IS 'Delivery terms';
COMMENT ON COLUMN quotations.material_type IS 'Material type (Original, etc.)';
COMMENT ON COLUMN quotations.bank_details IS 'Bank account details (JSON)';
COMMENT ON COLUMN quotations.terms_sections IS 'Terms and conditions sections (JSON)';
COMMENT ON COLUMN quotations.bill_to IS 'Billing details including buyer name (JSON)';

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'quotations' 
AND column_name IN (
    'template', 'payment_mode', 'transport_tc', 'dispatch_through', 
    'delivery_terms', 'material_type', 'bank_details', 'terms_sections', 'bill_to'
)
ORDER BY ordinal_position;
