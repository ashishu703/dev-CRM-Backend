-- Create organizations table for storing organization information
-- Run date: 2025-12-03

CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    
    -- Organization Information
    organization_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    
    -- Address Information
    street_address VARCHAR(500) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'India',
    
    -- Contact Information
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    
    -- Tax Information
    gstin VARCHAR(15),
    pan VARCHAR(10),
    tan VARCHAR(10),
    
    -- Financial Settings
    currency VARCHAR(10) DEFAULT 'INR',
    fiscal_year_start VARCHAR(20) DEFAULT 'April',
    fiscal_year_end VARCHAR(20) DEFAULT 'March',
    
    -- Timezone
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    
    -- Status and Metadata
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_organization_name ON organizations(organization_name);
CREATE INDEX IF NOT EXISTS idx_organizations_legal_name ON organizations(legal_name);
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(email);
CREATE INDEX IF NOT EXISTS idx_organizations_gstin ON organizations(gstin);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at);

-- Create unique constraint on organization_name to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_name_unique ON organizations(organization_name) WHERE is_active = true;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();

-- Add comments for documentation
COMMENT ON TABLE organizations IS 'Stores organization profile and configuration information';
COMMENT ON COLUMN organizations.organization_name IS 'Display name of the organization';
COMMENT ON COLUMN organizations.legal_name IS 'Legal/registered name of the organization';
COMMENT ON COLUMN organizations.logo_url IS 'URL to the organization logo image';
COMMENT ON COLUMN organizations.street_address IS 'Street address of the organization';
COMMENT ON COLUMN organizations.city IS 'City where organization is located';
COMMENT ON COLUMN organizations.state IS 'State/Province where organization is located';
COMMENT ON COLUMN organizations.zip_code IS 'ZIP/Postal code';
COMMENT ON COLUMN organizations.country IS 'Country where organization is located';
COMMENT ON COLUMN organizations.phone IS 'Primary contact phone number';
COMMENT ON COLUMN organizations.email IS 'Primary contact email address';
COMMENT ON COLUMN organizations.website IS 'Organization website URL';
COMMENT ON COLUMN organizations.gstin IS 'GST Identification Number (15 characters)';
COMMENT ON COLUMN organizations.pan IS 'Permanent Account Number (10 characters)';
COMMENT ON COLUMN organizations.tan IS 'Tax Deduction and Collection Account Number (10 characters)';
COMMENT ON COLUMN organizations.currency IS 'Default currency code (e.g., INR, USD)';
COMMENT ON COLUMN organizations.fiscal_year_start IS 'Start month of fiscal year';
COMMENT ON COLUMN organizations.fiscal_year_end IS 'End month of fiscal year';
COMMENT ON COLUMN organizations.timezone IS 'Organization timezone (e.g., Asia/Kolkata)';
COMMENT ON COLUMN organizations.is_active IS 'Whether the organization is currently active';

