-- Add call recording URL field to salesperson_leads
<<<<<<< HEAD
DO $$
BEGIN
    -- Add call_recording_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_recording_url') THEN
        ALTER TABLE salesperson_leads ADD COLUMN call_recording_url TEXT;
    END IF;

    -- Add quotation_verified_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'quotation_verified_status') THEN
        ALTER TABLE salesperson_leads ADD COLUMN quotation_verified_status VARCHAR(50);
    END IF;

    -- Add quotation_verified_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'quotation_verified_by') THEN
        ALTER TABLE salesperson_leads ADD COLUMN quotation_verified_by VARCHAR(255);
    END IF;

    -- Add pi_verification_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'pi_verification_status') THEN
        ALTER TABLE salesperson_leads ADD COLUMN pi_verification_status VARCHAR(50);
    END IF;

    -- Add pi_verified_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'pi_verified_by') THEN
        ALTER TABLE salesperson_leads ADD COLUMN pi_verified_by VARCHAR(255);
    END IF;
END $$;

-- Add indexes for better performance
DO $$
BEGIN
    -- Create quotation_verified index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_salesperson_leads_quotation_verified') THEN
        CREATE INDEX idx_salesperson_leads_quotation_verified ON salesperson_leads(quotation_verified_status);
    END IF;

    -- Create pi_verification index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_salesperson_leads_pi_verification') THEN
        CREATE INDEX idx_salesperson_leads_pi_verification ON salesperson_leads(pi_verification_status);
    END IF;
END $$;
=======
-- Add quotation verification fields
-- Add PI verification fields
-- Add indexes for better performance

-- Skip this migration if columns already exist
-- The columns are already present in the database
-- This migration is kept for reference but will be skipped
>>>>>>> 69ac8921530cfdbc8e248f9c715611694f503d6c

-- Note: The following columns should already exist:
-- call_recording_url, quotation_verified_status, quotation_verified_by
-- pi_verification_status, pi_verified_by

-- Create indexes if they don't exist (these will be created by the system)
-- CREATE INDEX idx_salesperson_leads_quotation_verified ON salesperson_leads(quotation_verified_status);
-- CREATE INDEX idx_salesperson_leads_pi_verification ON salesperson_leads(pi_verification_status);