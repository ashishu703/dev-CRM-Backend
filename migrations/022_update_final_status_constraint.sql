-- Update final_status constraint to allow new values
-- This fixes the constraint violation error when syncing salesperson leads
-- This migration safely checks if columns exist before updating constraints

DO $$
BEGIN
    -- Update final_status constraint only if the column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'department_head_leads' 
        AND column_name = 'final_status'
    ) THEN
        -- Drop the existing constraint if it exists
        BEGIN
            ALTER TABLE department_head_leads 
            DROP CONSTRAINT IF EXISTS department_head_leads_final_status_check;
            
            -- Also try dropping other possible constraint names
            ALTER TABLE department_head_leads 
            DROP CONSTRAINT IF EXISTS chk_dh_leads_final_status;
            
            ALTER TABLE department_head_leads 
            DROP CONSTRAINT IF EXISTS chk_dh_leads_final_status_restore;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not drop final_status constraints: %', SQLERRM;
        END;
        
        -- Add the new constraint with all allowed values
        BEGIN
            ALTER TABLE department_head_leads 
            ADD CONSTRAINT department_head_leads_final_status_check 
            CHECK (final_status IN ('open', 'closed', 'next_meeting', 'order_confirmed', 'not_interested', 'other'));
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add final_status constraint: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'final_status column does not exist, skipping constraint update';
    END IF;

    -- Update connected_status constraint only if the column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'department_head_leads' 
        AND column_name = 'connected_status'
    ) THEN
        -- Drop the existing constraint if it exists
        BEGIN
            ALTER TABLE department_head_leads 
            DROP CONSTRAINT IF EXISTS department_head_leads_connected_status_check;
            
            -- Also try dropping other possible constraint names
            ALTER TABLE department_head_leads 
            DROP CONSTRAINT IF EXISTS chk_dh_leads_connected_status;
            
            ALTER TABLE department_head_leads 
            DROP CONSTRAINT IF EXISTS chk_dh_leads_connected_status_restore;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not drop connected_status constraints: %', SQLERRM;
        END;
        
        -- Add the new constraint with all allowed values
        BEGIN
            ALTER TABLE department_head_leads 
            ADD CONSTRAINT department_head_leads_connected_status_check 
            CHECK (connected_status IN ('connected', 'not_connected', 'pending', 'next_meeting', 'other'));
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add connected_status constraint: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'connected_status column does not exist, skipping constraint update';
    END IF;
END $$;
