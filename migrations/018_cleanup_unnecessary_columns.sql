-- Remove unnecessary columns from department_head_leads table
-- Remove product_type, assigned, telecaller columns as they are redundant
-- This migration safely checks if columns exist before operations

-- Drop the unnecessary columns (safe with IF EXISTS)
ALTER TABLE department_head_leads 
  DROP COLUMN IF EXISTS product_type,
  DROP COLUMN IF EXISTS assigned,
  DROP COLUMN IF EXISTS telecaller;

-- Update existing data to map assigned/telecaller to assigned_salesperson/assigned_telecaller
-- Only update if the target columns exist
DO $$ 
BEGIN
  -- Check if assigned_salesperson exists before updating
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'department_head_leads' 
    AND column_name = 'assigned_salesperson'
  ) THEN
    BEGIN
      UPDATE department_head_leads 
      SET assigned_salesperson = COALESCE(assigned_salesperson, 'Unassigned')
      WHERE assigned_salesperson IS NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not update assigned_salesperson: %', SQLERRM;
    END;
  END IF;

  -- Check if assigned_telecaller exists before updating
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'department_head_leads' 
    AND column_name = 'assigned_telecaller'
  ) THEN
    BEGIN
      UPDATE department_head_leads 
      SET assigned_telecaller = COALESCE(assigned_telecaller, 'Unassigned')
      WHERE assigned_telecaller IS NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not update assigned_telecaller: %', SQLERRM;
    END;
  END IF;
END $$;

-- Add comment to table
DO $$ BEGIN
  COMMENT ON TABLE department_head_leads IS 'Department Head Leads - Cleaned up redundant columns';
EXCEPTION WHEN others THEN 
  RAISE NOTICE 'Could not add table comment: %', SQLERRM;
END $$;
