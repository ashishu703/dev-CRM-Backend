-- Drop call-related columns from salesperson_leads (idempotent)

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_duration_seconds') THEN
        ALTER TABLE salesperson_leads DROP COLUMN call_duration_seconds;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_recording_url') THEN
        ALTER TABLE salesperson_leads DROP COLUMN call_recording_url;
    END IF;
END $$;


