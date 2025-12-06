-- sqlfluff: dialect=postgres
-- Adds Accounts and IT department types to all relevant tables
-- Run date: 2025-11-21

-- sqlfluff: dialect=postgres
-- Adds Accounts and IT department types to all relevant tables
-- Run date: 2025-11-21

-- Normalize and map legacy/labelled department_type values safely
-- 1) Map known text labels to new enum values for ALL departments
--    We do this BEFORE any generic fallback so that:
--      - "Production Department" → "production"
--      - "IT Department"        → "it"
--      - "HR Department"        → "hr"
--      - "Marketing Department" → "marketing_sales"
--      - "Sales Department"     → "office_sales"
--      - "Accounts Department"  → "accounts"

-- SALES / OFFICE SALES
UPDATE department_heads
SET department_type = 'office_sales'
WHERE department_type IN ('Sales Department', 'sales_department', 'Sales', 'office_sales');

UPDATE department_users
SET department_type = 'office_sales'
WHERE department_type IN ('Sales Department', 'sales_department', 'Sales', 'office_sales');

-- MARKETING
UPDATE department_heads
SET department_type = 'marketing_sales'
WHERE department_type IN ('Marketing Department', 'marketing_department', 'Marketing', 'marketing_sales');

UPDATE department_users
SET department_type = 'marketing_sales'
WHERE department_type IN ('Marketing Department', 'marketing_department', 'Marketing', 'marketing_sales');

-- HR
UPDATE department_heads
SET department_type = 'hr'
WHERE department_type IN ('HR Department', 'hr_department', 'Human Resources', 'HR', 'hr');

UPDATE department_users
SET department_type = 'hr'
WHERE department_type IN ('HR Department', 'hr_department', 'Human Resources', 'HR', 'hr');

-- PRODUCTION
UPDATE department_heads
SET department_type = 'production'
WHERE department_type IN ('Production Department', 'production_department', 'Production', 'production');

UPDATE department_users
SET department_type = 'production'
WHERE department_type IN ('Production Department', 'production_department', 'Production', 'production');

-- ACCOUNTS
UPDATE department_heads
SET department_type = 'accounts'
WHERE department_type IN ('Accounts Department', 'accounts_department', 'Accounts', 'accounts');

UPDATE department_users
SET department_type = 'accounts'
WHERE department_type IN ('Accounts Department', 'accounts_department', 'Accounts', 'accounts');

-- IT
UPDATE department_heads
SET department_type = 'it'
WHERE department_type IN ('IT Department', 'it_department', 'Information Technology', 'it');

UPDATE department_users
SET department_type = 'it'
WHERE department_type IN ('IT Department', 'it_department', 'Information Technology', 'it');

-- 2) Fallback: normalize any remaining unexpected values to office_sales
UPDATE department_heads
SET department_type = 'office_sales'
WHERE department_type IS NULL 
  -- Include all known department types so rerunning this migration does not
  -- incorrectly coerce valid values like 'accounts', 'it', or 'telesales'
  OR department_type NOT IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales');

UPDATE department_users
SET department_type = 'office_sales'
WHERE department_type IS NULL 
  OR department_type NOT IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales');

-- Recreate constraints for department_heads
ALTER TABLE IF EXISTS department_heads
  DROP CONSTRAINT IF EXISTS department_heads_department_type_check;

ALTER TABLE IF EXISTS department_heads
  ADD CONSTRAINT department_heads_department_type_check
  CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales'));

-- Recreate constraints for department_users
ALTER TABLE IF EXISTS department_users
  DROP CONSTRAINT IF EXISTS department_users_department_type_check;

ALTER TABLE IF EXISTS department_users
  ADD CONSTRAINT department_users_department_type_check
  CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales'));

-- Update legacy admin table if it still exists
ALTER TABLE IF EXISTS admin_department_users
  DROP CONSTRAINT IF EXISTS admin_department_users_department_type_check;

ALTER TABLE IF EXISTS admin_department_users
  ADD CONSTRAINT admin_department_users_department_type_check
  CHECK (
    department_type IS NULL OR
    department_type IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales')
  );

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_department_heads_department ON department_heads(department_type);
CREATE INDEX IF NOT EXISTS idx_department_users_department ON department_users(department_type);

-- sqlfluff: enable=all

-- sqlfluff: enable=all

