-- Add HR department type to existing constraints
-- This migration adds support for HR department in the system
-- First updates any invalid existing data, then adds constraints

DO $$
BEGIN
    -- First, update any invalid department_type values in department_heads
    -- Map any unexpected values to a valid default
    UPDATE department_heads 
    SET department_type = 'office_sales'
    WHERE department_type IS NULL 
       -- Keep this in sync with the latest allowed department types so that
       -- rerunning this migration does NOT overwrite newer values to office_sales
       OR department_type NOT IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales');
    
    -- Update any invalid department_type values in department_users
    UPDATE department_users 
    SET department_type = 'office_sales'
    WHERE department_type IS NULL 
       -- Keep this in sync with the latest allowed department types so that
       -- rerunning this migration does NOT overwrite newer values to office_sales
       OR department_type NOT IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales');
    
    -- Now update department_heads table to include HR department type
    BEGIN
        ALTER TABLE department_heads 
        DROP CONSTRAINT IF EXISTS department_heads_department_type_check;
        
        ALTER TABLE department_heads 
        ADD CONSTRAINT department_heads_department_type_check 
        CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales'));
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Error updating department_heads constraint: %', SQLERRM;
    END;

    -- Update department_users table to include HR department type
    BEGIN
        ALTER TABLE department_users 
        DROP CONSTRAINT IF EXISTS department_users_department_type_check;
        
        ALTER TABLE department_users 
        ADD CONSTRAINT department_users_department_type_check 
        CHECK (department_type IN ('marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales'));
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Error updating department_users constraint: %', SQLERRM;
    END;
END $$;
