-- Create Indiamart and TradeIndia API configuration tables
-- Migration: 044_create_indiamart_tradeindia_tables.sql

-- Indiamart API Configuration Table
CREATE TABLE IF NOT EXISTS indiamart_configuration (
  id SERIAL PRIMARY KEY,
  api_key VARCHAR(255) NOT NULL,
  api_secret VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  webhook_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TradeIndia API Configuration Table
CREATE TABLE IF NOT EXISTS tradeindia_configuration (
  id SERIAL PRIMARY KEY,
  api_key VARCHAR(255) NOT NULL,
  api_secret VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  webhook_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_indiamart_configuration_active ON indiamart_configuration(is_active);
CREATE INDEX IF NOT EXISTS idx_tradeindia_configuration_active ON tradeindia_configuration(is_active);

-- Create triggers for updated_at on both tables
DROP TRIGGER IF EXISTS update_indiamart_configuration_updated_at ON indiamart_configuration;
CREATE TRIGGER update_indiamart_configuration_updated_at
BEFORE UPDATE ON indiamart_configuration
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tradeindia_configuration_updated_at ON tradeindia_configuration;
CREATE TRIGGER update_tradeindia_configuration_updated_at
BEFORE UPDATE ON tradeindia_configuration
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

