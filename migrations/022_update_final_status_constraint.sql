-- Update final_status constraint to allow new values
-- This fixes the constraint violation error when syncing salesperson leads

-- Drop the existing constraint
ALTER TABLE department_head_leads 
DROP CONSTRAINT IF EXISTS department_head_leads_final_status_check;

-- Add the new constraint with all allowed values
ALTER TABLE department_head_leads 
ADD CONSTRAINT department_head_leads_final_status_check 
CHECK (final_status IN ('open', 'closed', 'next_meeting', 'order_confirmed', 'not_interested', 'other'));

-- Also update connected_status constraint to allow new values
ALTER TABLE department_head_leads 
DROP CONSTRAINT IF EXISTS department_head_leads_connected_status_check;

ALTER TABLE department_head_leads 
ADD CONSTRAINT department_head_leads_connected_status_check 
CHECK (connected_status IN ('connected', 'not_connected', 'pending', 'next_meeting', 'other'));
