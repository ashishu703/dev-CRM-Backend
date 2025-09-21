-- Remove unnecessary columns from department_head_leads table
-- Remove product_type, assigned, telecaller columns as they are redundant

-- Drop the unnecessary columns
ALTER TABLE department_head_leads 
  DROP COLUMN IF EXISTS product_type,
  DROP COLUMN IF EXISTS assigned,
  DROP COLUMN IF EXISTS telecaller;

-- Update existing data to map assigned/telecaller to assigned_salesperson/assigned_telecaller
UPDATE department_head_leads 
SET 
  assigned_salesperson = COALESCE(assigned_salesperson, 'Unassigned'),
  assigned_telecaller = COALESCE(assigned_telecaller, 'Unassigned')
WHERE 
  assigned_salesperson IS NULL OR assigned_telecaller IS NULL;

-- Add comment to table
DO $$ BEGIN
  COMMENT ON TABLE department_head_leads IS 'Department Head Leads - Cleaned up redundant columns';
EXCEPTION WHEN others THEN NULL; END $$;
