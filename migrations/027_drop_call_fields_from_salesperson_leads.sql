-- Drop call-related columns from salesperson_leads (idempotent)

<<<<<<< HEAD
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_duration_seconds') THEN
        ALTER TABLE salesperson_leads DROP COLUMN call_duration_seconds;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_recording_url') THEN
        ALTER TABLE salesperson_leads DROP COLUMN call_recording_url;
    END IF;
END $$;


=======
-- Drop columns if they exist
ALTER TABLE salesperson_leads DROP COLUMN IF EXISTS call_duration_seconds;
ALTER TABLE salesperson_leads DROP COLUMN IF EXISTS call_recording_url;
>>>>>>> 69ac8921530cfdbc8e248f9c715611694f503d6c
