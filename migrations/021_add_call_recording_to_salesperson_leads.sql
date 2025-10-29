-- Add call recording URL field to salesperson_leads
-- Add quotation verification fields
-- Add PI verification fields
-- Add indexes for better performance

-- Skip this migration if columns already exist
-- The columns are already present in the database
-- This migration is kept for reference but will be skipped

-- Note: The following columns should already exist:
-- call_recording_url, quotation_verified_status, quotation_verified_by
-- pi_verification_status, pi_verified_by

-- Create indexes if they don't exist (these will be created by the system)
-- CREATE INDEX idx_salesperson_leads_quotation_verified ON salesperson_leads(quotation_verified_status);
-- CREATE INDEX idx_salesperson_leads_pi_verification ON salesperson_leads(pi_verification_status);