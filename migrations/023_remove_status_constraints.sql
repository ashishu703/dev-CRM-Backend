-- Remove all CHECK constraints on status fields to allow any frontend data
-- This ensures no validation errors when frontend sends any status values

-- Remove final_status constraints from all tables
ALTER TABLE department_head_leads 
DROP CONSTRAINT IF EXISTS department_head_leads_final_status_check;

ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_final_status_check;

-- Remove connected_status constraints from all tables  
ALTER TABLE department_head_leads 
DROP CONSTRAINT IF EXISTS department_head_leads_connected_status_check;

ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_connected_status_check;

-- Remove any other status-related constraints that might exist
ALTER TABLE department_head_leads 
DROP CONSTRAINT IF EXISTS department_head_leads_telecaller_status_check;

ALTER TABLE department_head_leads 
DROP CONSTRAINT IF EXISTS department_head_leads_payment_status_check;

-- Make sure all status fields are just VARCHAR without constraints
-- This allows any value from frontend to be stored
