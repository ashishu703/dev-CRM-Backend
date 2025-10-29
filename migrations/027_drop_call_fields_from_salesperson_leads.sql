-- Drop call-related columns from salesperson_leads (idempotent)

-- Drop columns if they exist
ALTER TABLE salesperson_leads DROP COLUMN IF EXISTS call_duration_seconds;
ALTER TABLE salesperson_leads DROP COLUMN IF EXISTS call_recording_url;