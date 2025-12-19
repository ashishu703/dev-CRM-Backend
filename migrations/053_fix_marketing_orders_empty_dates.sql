-- Fix empty date strings in marketing_orders table
-- Run date: 2025-01-XX
-- This migration converts empty strings in date fields to NULL
-- Note: DATE columns cannot contain empty strings by design in PostgreSQL
-- This migration is a safety check that safely handles the case

DO $$ 
DECLARE
  expected_delivery_date_type TEXT;
  delivered_date_type TEXT;
BEGIN
  -- Check if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_orders') THEN
    
    -- Get column data types safely
    SELECT data_type INTO expected_delivery_date_type
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_orders' 
      AND column_name = 'expected_delivery_date'
    LIMIT 1;
      
    SELECT data_type INTO delivered_date_type
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'marketing_orders' 
      AND column_name = 'delivered_date'
    LIMIT 1;

    -- If columns are DATE type (which they should be), no action needed
    -- DATE columns cannot contain empty strings, so this is a no-op
    IF expected_delivery_date_type = 'date' AND delivered_date_type = 'date' THEN
      RAISE NOTICE 'All date columns are already DATE type. No conversion needed.';
      RETURN;
    END IF;
    
    -- Only process if columns are text/varchar (shouldn't happen, but handle safely)
    -- This handles edge cases where columns might have been created as text
    IF expected_delivery_date_type IN ('character varying', 'text', 'varchar') THEN
      BEGIN
        UPDATE marketing_orders 
        SET expected_delivery_date = NULL 
        WHERE expected_delivery_date::text = '' OR TRIM(expected_delivery_date::text) = '';
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not update expected_delivery_date: %', SQLERRM;
      END;
    END IF;
    
    IF delivered_date_type IN ('character varying', 'text', 'varchar') THEN
      BEGIN
        UPDATE marketing_orders 
        SET delivered_date = NULL 
        WHERE delivered_date::text = '' OR TRIM(delivered_date::text) = '';
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not update delivered_date: %', SQLERRM;
      END;
    END IF;

  END IF;
EXCEPTION WHEN others THEN
  -- Silently skip if there's any error - migration should not fail
  RAISE NOTICE 'Migration completed with notice: %', SQLERRM;
END $$;

-- Add check constraints to prevent empty strings in date fields (optional but recommended)
-- Note: This will only work if there are no existing empty strings
-- ALTER TABLE marketing_orders 
--   ADD CONSTRAINT check_order_date_not_empty 
--   CHECK (order_date IS NULL OR order_date::text != '');

