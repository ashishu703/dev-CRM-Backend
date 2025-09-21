-- Add call recording URL field to salesperson_leads
ALTER TABLE salesperson_leads 
  ADD COLUMN IF NOT EXISTS call_recording_url TEXT;

-- Add quotation verification fields
ALTER TABLE salesperson_leads 
  ADD COLUMN IF NOT EXISTS quotation_verified_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS quotation_verified_by VARCHAR(255);

-- Add PI verification fields  
ALTER TABLE salesperson_leads 
  ADD COLUMN IF NOT EXISTS pi_verification_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pi_verified_by VARCHAR(255);

-- Add indexes for better performance
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_salesperson_leads_quotation_verified ON salesperson_leads(quotation_verified_status);
  CREATE INDEX IF NOT EXISTS idx_salesperson_leads_pi_verification ON salesperson_leads(pi_verification_status);
EXCEPTION WHEN others THEN NULL; END $$;


