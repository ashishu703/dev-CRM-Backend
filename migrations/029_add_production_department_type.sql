-- Add PRODUCTION department type to all relevant tables

-- department_heads
ALTER TABLE department_heads 
DROP CONSTRAINT IF EXISTS department_heads_department_type_check;

ALTER TABLE department_heads 
ADD CONSTRAINT department_heads_department_type_check 
CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr', 'production'));

-- department_users
ALTER TABLE department_users 
DROP CONSTRAINT IF EXISTS department_users_department_type_check;

ALTER TABLE department_users 
ADD CONSTRAINT department_users_department_type_check 
CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr', 'production'));

COMMENT ON CONSTRAINT department_heads_department_type_check ON department_heads IS 'Allows marketing_sales, office_sales, hr and production department types';
COMMENT ON CONSTRAINT department_users_department_type_check ON department_users IS 'Allows marketing_sales, office_sales, hr and production department types';


