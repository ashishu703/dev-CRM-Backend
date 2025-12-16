-- Migration to add soft delete functionality to department_head_leads
-- Run date: 2025-01-01

-- Add is_deleted and deleted_at columns to department_head_leads table
ALTER TABLE department_head_leads
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index for better performance when filtering non-deleted leads
CREATE INDEX IF NOT EXISTS idx_dh_leads_is_deleted ON department_head_leads(is_deleted);

-- Update existing NULL values to FALSE
UPDATE department_head_leads
SET is_deleted = FALSE
WHERE is_deleted IS NULL;

