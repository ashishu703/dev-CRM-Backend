-- Drop call-related columns from salesperson_leads (idempotent)

IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_duration_seconds')
BEGIN
    ALTER TABLE salesperson_leads DROP COLUMN call_duration_seconds;
END;

IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_recording_url')
BEGIN
    ALTER TABLE salesperson_leads DROP COLUMN call_recording_url;
END;


