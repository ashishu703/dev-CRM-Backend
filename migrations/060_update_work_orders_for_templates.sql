-- Migration: 060_update_work_orders_for_templates.sql
-- Purpose: Update work_orders table to support dynamic templates and ensure unique quotation constraint

-- Add template_key column for dynamic template rendering
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS template_key VARCHAR(100);

-- Add status column for work order tracking
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Add unique constraint on quotation_id to ensure one work order per quotation
-- First, remove any duplicate entries (keep the most recent one)
DELETE FROM work_orders a USING work_orders b
WHERE a.id < b.id 
  AND a.quotation_id = b.quotation_id 
  AND a.quotation_id IS NOT NULL;

-- Now add the unique constraint
ALTER TABLE work_orders 
ADD CONSTRAINT unique_quotation_work_order 
UNIQUE (quotation_id);

-- Create index on template_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_template_key ON work_orders(template_key);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);

-- Add comment for documentation
COMMENT ON COLUMN work_orders.template_key IS 'Key to identify which template to use for rendering the work order';
COMMENT ON COLUMN work_orders.status IS 'Status of work order: pending, approved, in_production, completed, cancelled';
COMMENT ON CONSTRAINT unique_quotation_work_order ON work_orders IS 'Ensures only one work order can be created per quotation';

