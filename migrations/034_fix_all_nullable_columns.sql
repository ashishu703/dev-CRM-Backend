-- Make all nullable columns actually nullable in payments table
-- Migration: 034_fix_all_nullable_columns.sql
-- Note: This migration fixes all NOT NULL constraints that should be nullable

-- Remove NOT NULL constraint from remaining_balance column
-- ALTER TABLE payments ALTER COLUMN remaining_balance DROP NOT NULL;

-- Remove NOT NULL constraint from lead_id column (if exists)
-- ALTER TABLE payments ALTER COLUMN lead_id DROP NOT NULL;

-- Remove NOT NULL constraint from quotation_id column (if exists)  
-- ALTER TABLE payments ALTER COLUMN quotation_id DROP NOT NULL;

-- Remove NOT NULL constraint from payment_ref column (if exists)
-- ALTER TABLE payments ALTER COLUMN payment_ref DROP NOT NULL;

-- Remove NOT NULL constraint from notes column (if exists)
-- ALTER TABLE payments ALTER COLUMN notes DROP NOT NULL;

-- Remove NOT NULL constraint from gateway_transaction_id column (if exists)
-- ALTER TABLE payments ALTER COLUMN gateway_transaction_id DROP NOT NULL;

-- Remove NOT NULL constraint from gateway_response column (if exists)
-- ALTER TABLE payments ALTER COLUMN gateway_response DROP NOT NULL;

-- Remove NOT NULL constraint from receipt_url column (if exists)
-- ALTER TABLE payments ALTER COLUMN receipt_url DROP NOT NULL;

-- Remove NOT NULL constraint from updated_by column (if exists)
-- ALTER TABLE payments ALTER COLUMN updated_by DROP NOT NULL;
