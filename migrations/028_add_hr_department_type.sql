-- Add HR department type to existing constraints
-- This migration adds support for HR department in the system

-- Update department_heads table to include HR department type
ALTER TABLE department_heads 
DROP CONSTRAINT IF EXISTS department_heads_department_type_check;

ALTER TABLE department_heads 
ADD CONSTRAINT department_heads_department_type_check 
CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr'));

-- Update department_users table to include HR department type  
ALTER TABLE department_users 
DROP CONSTRAINT IF EXISTS department_users_department_type_check;

ALTER TABLE department_users 
ADD CONSTRAINT department_users_department_type_check 
CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr'));

-- Add comment for clarity
COMMENT ON CONSTRAINT department_heads_department_type_check ON department_heads IS 'Allows marketing_sales, office_sales, and hr department types';
COMMENT ON CONSTRAINT department_users_department_type_check ON department_users IS 'Allows marketing_sales, office_sales, and hr department types';
