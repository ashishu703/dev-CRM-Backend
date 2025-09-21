-- Migration to split admin_department_users into separate tables
-- Department Heads and Department Users

-- Create department_heads table
CREATE TABLE IF NOT EXISTS department_heads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    department_type VARCHAR(50) NOT NULL CHECK (department_type IN ('marketing_sales', 'office_sales')),
    company_name VARCHAR(255) NOT NULL CHECK (company_name IN ('Anode Electric Pvt. Ltd.', 'Anode Metals', 'Samrridhi Industries')),
    target DECIMAL(10,2) DEFAULT 0 CHECK (target >= 0),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Create department_users table
CREATE TABLE IF NOT EXISTS department_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    department_type VARCHAR(50) NOT NULL CHECK (department_type IN ('marketing_sales', 'office_sales')),
    company_name VARCHAR(255) NOT NULL CHECK (company_name IN ('Anode Electric Pvt. Ltd.', 'Anode Metals', 'Samrridhi Industries')),
    head_user_id UUID REFERENCES department_heads(id) ON DELETE CASCADE,
    head_user_email VARCHAR(255),
    target DECIMAL(12,2) DEFAULT 0 CHECK (target >= 0),
    achieved_target DECIMAL(12,2) DEFAULT 0 CHECK (achieved_target >= 0),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Create indexes for department_heads
CREATE INDEX IF NOT EXISTS idx_department_heads_email ON department_heads(email);
CREATE INDEX IF NOT EXISTS idx_department_heads_username ON department_heads(username);
CREATE INDEX IF NOT EXISTS idx_department_heads_company ON department_heads(company_name);
CREATE INDEX IF NOT EXISTS idx_department_heads_department ON department_heads(department_type);
CREATE INDEX IF NOT EXISTS idx_department_heads_active ON department_heads(is_active);

-- Create indexes for department_users
CREATE INDEX IF NOT EXISTS idx_department_users_email ON department_users(email);
CREATE INDEX IF NOT EXISTS idx_department_users_username ON department_users(username);
CREATE INDEX IF NOT EXISTS idx_department_users_company ON department_users(company_name);
CREATE INDEX IF NOT EXISTS idx_department_users_department ON department_users(department_type);
CREATE INDEX IF NOT EXISTS idx_department_users_head_user ON department_users(head_user_id);
CREATE INDEX IF NOT EXISTS idx_department_users_active ON department_users(is_active);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_department_heads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_department_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers to make this migration idempotent
DROP TRIGGER IF EXISTS trigger_update_department_heads_updated_at ON department_heads;
DROP TRIGGER IF EXISTS trigger_update_department_users_updated_at ON department_users;

CREATE TRIGGER trigger_update_department_heads_updated_at
    BEFORE UPDATE ON department_heads
    FOR EACH ROW
    EXECUTE FUNCTION update_department_heads_updated_at();

CREATE TRIGGER trigger_update_department_users_updated_at
    BEFORE UPDATE ON department_users
    FOR EACH ROW
    EXECUTE FUNCTION update_department_users_updated_at();

-- Migrate existing data from admin_department_users
-- First, migrate department heads
INSERT INTO department_heads (
    id, username, email, password, department_type, company_name, 
    target, is_active, email_verified, last_login, created_at, updated_at, created_by, updated_by
)
SELECT 
    id, username, email, password, department_type, company_name,
    0 as target, is_active, email_verified, last_login, created_at, updated_at, created_by, updated_by
FROM admin_department_users 
WHERE role = 'department_head';

-- Then, migrate department users and link them to their heads
INSERT INTO department_users (
    id, username, email, password, department_type, company_name,
    head_user_id, is_active, email_verified, last_login, created_at, updated_at, created_by, updated_by
)
SELECT 
    adu.id, adu.username, adu.email, adu.password, adu.department_type, adu.company_name,
    dh.id as head_user_id, adu.is_active, adu.email_verified, adu.last_login, 
    adu.created_at, adu.updated_at, adu.created_by, adu.updated_by
FROM admin_department_users adu
LEFT JOIN department_heads dh ON (
    dh.company_name = adu.company_name 
    AND dh.department_type = adu.department_type 
    AND dh.email = adu.head_user
)
WHERE adu.role = 'department_user';

-- Drop the old table after successful migration
-- DROP TABLE IF EXISTS admin_department_users;
