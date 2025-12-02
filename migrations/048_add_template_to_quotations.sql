-- Add template column to quotations table
-- This migration adds a template field to store which quotation template was used

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS template VARCHAR(50) DEFAULT 'template1';

-- Add comment to document the template values
COMMENT ON COLUMN quotations.template IS 'Template identifier: template1 (Classic), template2 (Modern), or template3 (Minimal)';

-- Create index for faster queries by template
CREATE INDEX IF NOT EXISTS idx_quotations_template ON quotations(template);

