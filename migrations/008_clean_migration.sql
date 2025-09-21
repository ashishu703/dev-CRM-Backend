-- Clean migration: Drop old table and create new structure
-- This migration replaces the problematic admin_department_users table

-- Drop the old table completely
DROP TABLE IF EXISTS admin_department_users CASCADE;

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
    head_user_id UUID REFERENCES department_heads(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Create superadmins table (separate from department users)
CREATE TABLE IF NOT EXISTS superadmins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Create indexes for superadmins
CREATE INDEX IF NOT EXISTS idx_superadmins_email ON superadmins(email);
CREATE INDEX IF NOT EXISTS idx_superadmins_username ON superadmins(username);
CREATE INDEX IF NOT EXISTS idx_superadmins_active ON superadmins(is_active);

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

CREATE OR REPLACE FUNCTION update_superadmins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers to make this migration idempotent
DROP TRIGGER IF EXISTS trigger_update_department_heads_updated_at ON department_heads;
DROP TRIGGER IF EXISTS trigger_update_department_users_updated_at ON department_users;
DROP TRIGGER IF EXISTS trigger_update_superadmins_updated_at ON superadmins;

CREATE TRIGGER trigger_update_department_heads_updated_at
    BEFORE UPDATE ON department_heads
    FOR EACH ROW
    EXECUTE FUNCTION update_department_heads_updated_at();

CREATE TRIGGER trigger_update_department_users_updated_at
    BEFORE UPDATE ON department_users
    FOR EACH ROW
    EXECUTE FUNCTION update_department_users_updated_at();

CREATE TRIGGER trigger_update_superadmins_updated_at
    BEFORE UPDATE ON superadmins
    FOR EACH ROW
    EXECUTE FUNCTION update_superadmins_updated_at();

-- Insert default superadmin
INSERT INTO superadmins (username, email, password, is_active, email_verified)
VALUES (
  'superadmin',
  'admin@anocab.com',
  crypt('Admin123!', gen_salt('bf', 12)),
  true,
  true
) ON CONFLICT (email) DO NOTHING;
