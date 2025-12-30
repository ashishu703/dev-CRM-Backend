-- Migration: 064_fix_work_orders_user_id_types.sql
-- Purpose: Change user ID columns from INTEGER to UUID to match user table structure

-- Change deleted_by from INTEGER to UUID
ALTER TABLE work_orders 
ALTER COLUMN deleted_by TYPE UUID USING NULL;

-- Change revised_by from INTEGER to UUID
ALTER TABLE work_orders 
ALTER COLUMN revised_by TYPE UUID USING NULL;

-- Change prepared_by_user_id from INTEGER to UUID
ALTER TABLE work_orders 
ALTER COLUMN prepared_by_user_id TYPE UUID USING NULL;

-- Add comments
COMMENT ON COLUMN work_orders.deleted_by IS 'UUID of user who deleted the work order';
COMMENT ON COLUMN work_orders.revised_by IS 'UUID of user who revised the work order';
COMMENT ON COLUMN work_orders.prepared_by_user_id IS 'UUID of user who prepared the work order';

