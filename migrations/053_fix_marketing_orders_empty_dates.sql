-- Fix empty date strings in marketing_orders table
-- Run date: 2025-01-XX
-- This migration converts empty strings in date fields to NULL

-- Update order_date: convert empty strings to NULL
UPDATE marketing_orders 
SET order_date = NULL 
WHERE order_date = '' OR order_date::text = '';

-- Update expected_delivery_date: convert empty strings to NULL
UPDATE marketing_orders 
SET expected_delivery_date = NULL 
WHERE expected_delivery_date = '' OR expected_delivery_date::text = '';

-- Update delivered_date: convert empty strings to NULL
UPDATE marketing_orders 
SET delivered_date = NULL 
WHERE delivered_date = '' OR delivered_date::text = '';

-- Add check constraints to prevent empty strings in date fields (optional but recommended)
-- Note: This will only work if there are no existing empty strings
-- ALTER TABLE marketing_orders 
--   ADD CONSTRAINT check_order_date_not_empty 
--   CHECK (order_date IS NULL OR order_date::text != '');

