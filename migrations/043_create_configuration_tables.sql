-- Create configuration tables for system settings
-- Migration: 043_create_configuration_tables.sql
-- Run date: 2025-01-XX

-- Global Settings Table
CREATE TABLE IF NOT EXISTS global_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Configuration Table
CREATE TABLE IF NOT EXISTS email_configuration (
  id SERIAL PRIMARY KEY,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  recipients TEXT,
  cc_recipients TEXT,
  bcc_recipients TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Configuration Table
CREATE TABLE IF NOT EXISTS whatsapp_configuration (
  id SERIAL PRIMARY KEY,
  flow_id VARCHAR(255),
  flow_name VARCHAR(255),
  api_key VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  description TEXT,
  html_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cloudinary Configuration Table (for file upload settings)
CREATE TABLE IF NOT EXISTS cloudinary_configuration (
  id SERIAL PRIMARY KEY,
  cloud_name VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  api_secret VARCHAR(255) NOT NULL,
  upload_preset VARCHAR(255),
  default_folder VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_global_settings_key ON global_settings(key);
CREATE INDEX IF NOT EXISTS idx_email_configuration_active ON email_configuration(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configuration_active ON whatsapp_configuration(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
CREATE INDEX IF NOT EXISTS idx_cloudinary_configuration_active ON cloudinary_configuration(is_active);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at on all configuration tables
DROP TRIGGER IF EXISTS update_global_settings_updated_at ON global_settings;
CREATE TRIGGER update_global_settings_updated_at
BEFORE UPDATE ON global_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_configuration_updated_at ON email_configuration;
CREATE TRIGGER update_email_configuration_updated_at
BEFORE UPDATE ON email_configuration
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_configuration_updated_at ON whatsapp_configuration;
CREATE TRIGGER update_whatsapp_configuration_updated_at
BEFORE UPDATE ON whatsapp_configuration
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cloudinary_configuration_updated_at ON cloudinary_configuration;
CREATE TRIGGER update_cloudinary_configuration_updated_at
BEFORE UPDATE ON cloudinary_configuration
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

