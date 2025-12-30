-- Migration: 062_fix_work_orders_quotation_constraint.sql
-- Purpose: Fix unique constraint to use bna_number instead of quotation_id
-- Reason: quotation_id is UUID but quotation numbers are strings stored in bna_number

-- Drop the old constraint on quotation_id
ALTER TABLE work_orders 
DROP CONSTRAINT IF EXISTS unique_quotation_work_order;

-- Add unique constraint on bna_number to prevent duplicate work orders per quotation
-- Allow NULL values (for work orders created without quotations)
CREATE UNIQUE INDEX IF NOT EXISTS unique_bna_number_work_order 
ON work_orders (bna_number) 
WHERE bna_number IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX unique_bna_number_work_order IS 
'Ensures only one work order can be created per quotation number. NULL values are allowed for work orders without quotations.';

-- Note: bna_number stores quotation number strings (e.g., "QT202512051")
-- quotation_id (UUID) is reserved for future UUID-based quotation references

