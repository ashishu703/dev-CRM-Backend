-- Add template column to proforma_invoices table
-- This migration adds a template field to store which PI template was used

ALTER TABLE proforma_invoices 
ADD COLUMN IF NOT EXISTS template VARCHAR(50) DEFAULT 'template1';

-- Add comment to document the template values
COMMENT ON COLUMN proforma_invoices.template IS 'Template identifier: template1 (Classic), template2 (Modern), or template3 (Minimal)';

-- Create index for faster queries by template
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_template ON proforma_invoices(template);


