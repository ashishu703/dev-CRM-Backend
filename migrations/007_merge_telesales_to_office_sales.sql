-- Migration to merge telesales department into office_sales
-- This migration updates all telesales users to office_sales department

-- Update all telesales users to office_sales
UPDATE admin_department_users 
SET department_type = 'office_sales' 
WHERE department_type = 'telesales';
