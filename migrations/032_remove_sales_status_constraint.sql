-- Remove remaining sales_status constraint from department_head_leads
-- Migration: 032_remove_sales_status_constraint.sql

-- Remove the sales_status constraint that's causing the violation
ALTER TABLE department_head_leads 
DROP CONSTRAINT IF EXISTS department_head_leads_sales_status_check;

-- Also remove any other remaining status constraints
ALTER TABLE department_head_leads 
DROP CONSTRAINT IF EXISTS department_head_leads_telecaller_status_check;

ALTER TABLE department_head_leads 
DROP CONSTRAINT IF EXISTS department_head_leads_payment_status_check;
