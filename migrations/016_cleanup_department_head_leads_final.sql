-- Final cleanup of department_head_leads table
-- Keep only essential columns and fix GST field

-- First, update all NULL gst_no values to 'N/A'
UPDATE department_head_leads 
SET gst_no = 'N/A' 
WHERE gst_no IS NULL OR gst_no = '';

-- Drop unnecessary columns
ALTER TABLE department_head_leads 
DROP COLUMN IF EXISTS product_names,
DROP COLUMN IF EXISTS created,
DROP COLUMN IF EXISTS assigned,
DROP COLUMN IF EXISTS telecaller,
DROP COLUMN IF EXISTS telecaller_status,
DROP COLUMN IF EXISTS payment_status,
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS product_type,
DROP COLUMN IF EXISTS state,
DROP COLUMN IF EXISTS customer_type,
DROP COLUMN IF EXISTS date,
DROP COLUMN IF EXISTS connected_status,
DROP COLUMN IF EXISTS final_status,
DROP COLUMN IF EXISTS whatsapp,
DROP COLUMN IF EXISTS assigned_salesperson,
DROP COLUMN IF EXISTS assigned_telecaller;

-- Set gst_no to NOT NULL with default value
ALTER TABLE department_head_leads 
ALTER COLUMN gst_no SET NOT NULL,
ALTER COLUMN gst_no SET DEFAULT 'N/A';

-- Update the table comment
COMMENT ON TABLE department_head_leads IS 'Department Head Leads - Essential columns only';
