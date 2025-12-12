-- Create document_templates table for storing dynamic document layouts
-- Migration: 049_create_document_templates_table.sql
-- This table is intended for quotation / PI / work-order templates etc.

CREATE TABLE IF NOT EXISTS document_templates (
  id SERIAL PRIMARY KEY,
  -- e.g. 'quotation', 'pi', 'work_order'
  template_type VARCHAR(50) NOT NULL,
  -- Human readable label shown to users (e.g. 'Classic', 'Modern')
  name VARCHAR(255) NOT NULL,
  -- Stable key used by frontend to map to a concrete renderer
  template_key VARCHAR(100) NOT NULL,
  description TEXT,
  html_content TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure template_key is unique per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_templates_type_key
ON document_templates(template_type, template_key);

CREATE INDEX IF NOT EXISTS idx_document_templates_type
ON document_templates(template_type);

CREATE INDEX IF NOT EXISTS idx_document_templates_active
ON document_templates(is_active);

-- Reuse the generic updated_at trigger function if it already exists.
-- If it doesn't, this will fail unless 043_create_configuration_tables.sql has run first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_document_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_document_templates_updated_at
    BEFORE UPDATE ON document_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

