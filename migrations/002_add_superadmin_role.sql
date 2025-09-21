-- Add superadmin role to the existing table
-- First drop existing constraints
ALTER TABLE admin_department_users 
DROP CONSTRAINT IF EXISTS admin_department_users_role_check;

ALTER TABLE admin_department_users 
DROP CONSTRAINT IF EXISTS admin_department_users_department_type_check;

ALTER TABLE admin_department_users 
DROP CONSTRAINT IF EXISTS admin_department_users_company_name_check;

-- Drop NOT NULL constraints (these might have different names)
ALTER TABLE admin_department_users 
DROP CONSTRAINT IF EXISTS admin_dept_users_department_type_nn;

ALTER TABLE admin_department_users 
DROP CONSTRAINT IF EXISTS admin_dept_users_company_name_nn;

-- Make department_type and company_name nullable for superadmin
ALTER TABLE admin_department_users 
ALTER COLUMN department_type DROP NOT NULL;

ALTER TABLE admin_department_users 
ALTER COLUMN company_name DROP NOT NULL;

-- Add new constraints that allow superadmin
ALTER TABLE admin_department_users 
ADD CONSTRAINT admin_department_users_role_check 
CHECK (role IN ('department_user', 'department_head', 'superadmin'));

ALTER TABLE admin_department_users 
ADD CONSTRAINT admin_department_users_department_type_check 
CHECK (department_type IS NULL OR department_type IN ('telesales', 'marketing_sales', 'office_sales'));

ALTER TABLE admin_department_users 
ADD CONSTRAINT admin_department_users_company_name_check 
CHECK (company_name IS NULL OR company_name IN ('Anode Electric Pvt. Ltd.', 'Anode Metals', 'Samrridhi Industries'));

-- Add a check constraint to ensure superadmin doesn't need department/company
ALTER TABLE admin_department_users 
DROP CONSTRAINT IF EXISTS check_superadmin_fields;

ALTER TABLE admin_department_users 
ADD CONSTRAINT check_superadmin_fields 
CHECK (
  (role = 'superadmin' AND department_type IS NULL AND company_name IS NULL) OR
  (role != 'superadmin' AND department_type IS NOT NULL AND company_name IS NOT NULL)
);

-- Insert a default superadmin user
INSERT INTO admin_department_users (username, email, password, role, is_active, email_verified)
VALUES (
  'superadmin',
  'admin@anocab.com',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: admin123
  'superadmin',
  true,
  true
) ON CONFLICT (email) DO NOTHING;

-- Ensure superadmin password is Admin123!
UPDATE admin_department_users
SET password = crypt('Admin123!', gen_salt('bf', 12))
WHERE email = 'admin@anocab.com';
