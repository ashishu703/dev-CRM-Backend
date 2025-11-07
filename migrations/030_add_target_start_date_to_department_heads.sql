-- Add target_start_date to department_heads table for monthly target tracking
ALTER TABLE department_heads 
ADD COLUMN IF NOT EXISTS target_start_date TIMESTAMP;

-- Update existing records to set target_start_date to updated_at if target exists
UPDATE department_heads 
SET target_start_date = updated_at 
WHERE target > 0 AND target_start_date IS NULL;

