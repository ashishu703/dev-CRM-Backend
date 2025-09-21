CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_department_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    department_type VARCHAR(50) NOT NULL CHECK (department_type IN ('marketing_sales', 'office_sales')),
    company_name VARCHAR(255) NOT NULL CHECK (company_name IN ('Anode Electric Pvt. Ltd.', 'Anode Metals', 'Samrridhi Industries')),
    role VARCHAR(50) NOT NULL CHECK (role IN ('department_user', 'department_head')),
    head_user VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_admin_department_users_email ON admin_department_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_department_users_username ON admin_department_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_department_users_company ON admin_department_users(company_name);
CREATE INDEX IF NOT EXISTS idx_admin_department_users_department ON admin_department_users(department_type);
CREATE INDEX IF NOT EXISTS idx_admin_department_users_role ON admin_department_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_department_users_head_user ON admin_department_users(head_user);
CREATE INDEX IF NOT EXISTS idx_admin_department_users_active ON admin_department_users(is_active);

CREATE OR REPLACE FUNCTION update_admin_department_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger to make this migration idempotent
DROP TRIGGER IF EXISTS trigger_update_admin_department_users_updated_at ON admin_department_users;

CREATE TRIGGER trigger_update_admin_department_users_updated_at
    BEFORE UPDATE ON admin_department_users
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_department_users_updated_at();
