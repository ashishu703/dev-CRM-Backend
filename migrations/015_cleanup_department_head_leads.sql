-- Clean up department_head_leads table
-- Remove duplicate rows and keep only essential columns

-- First, remove duplicates based on customer_id (keep the latest one)
DELETE FROM department_head_leads 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM department_head_leads 
    GROUP BY customer_id
);

-- Remove any rows without customer_id
DELETE FROM department_head_leads WHERE customer_id IS NULL OR customer_id = '';

-- Update existing rows with default values
UPDATE department_head_leads 
SET created_by = 'system', 
    created_at = CURRENT_TIMESTAMP, 
    updated_at = CURRENT_TIMESTAMP 
WHERE created_by IS NULL OR created_at IS NULL;
