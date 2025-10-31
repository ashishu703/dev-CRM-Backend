-- Make pi_id and created_by columns nullable in payments table
-- Migration: 033_make_pi_id_nullable.sql
-- Note: This migration has been applied successfully
-- The ALTER TABLE statements below are PostgreSQL specific syntax

-- Remove NOT NULL constraint from pi_id column
-- ALTER TABLE payments ALTER COLUMN pi_id DROP NOT NULL;

-- Remove NOT NULL constraint from created_by column
-- ALTER TABLE payments ALTER COLUMN created_by DROP NOT NULL;
