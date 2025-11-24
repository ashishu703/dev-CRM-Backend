-- sqlfluff: dialect=postgres
-- Adds Accounts and IT department types to all relevant tables
-- Run date: 2025-11-21

-- sqlfluff: dialect=postgres
-- Adds Accounts and IT department types to all relevant tables
-- Run date: 2025-11-21

-- Normalize unexpected department_type values
UPDATE department_heads
SET department_type = 'office_sales'
WHERE department_type IS NULL 
  OR department_type NOT IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it');

UPDATE department_users
SET department_type = 'office_sales'
WHERE department_type IS NULL 
  OR department_type NOT IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it');

-- Recreate constraints for department_heads
ALTER TABLE IF EXISTS department_heads
  DROP CONSTRAINT IF EXISTS department_heads_department_type_check;

ALTER TABLE IF EXISTS department_heads
  ADD CONSTRAINT department_heads_department_type_check
  CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it'));

-- Recreate constraints for department_users
ALTER TABLE IF EXISTS department_users
  DROP CONSTRAINT IF EXISTS department_users_department_type_check;

ALTER TABLE IF EXISTS department_users
  ADD CONSTRAINT department_users_department_type_check
  CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it'));

-- Update legacy admin table if it still exists
ALTER TABLE IF EXISTS admin_department_users
  DROP CONSTRAINT IF EXISTS admin_department_users_department_type_check;

ALTER TABLE IF EXISTS admin_department_users
  ADD CONSTRAINT admin_department_users_department_type_check
  CHECK (
    department_type IS NULL OR
    department_type IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it')
  );

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_department_heads_department ON department_heads(department_type);
CREATE INDEX IF NOT EXISTS idx_department_users_department ON department_users(department_type);

-- sqlfluff: enable=all

-- sqlfluff: enable=all

