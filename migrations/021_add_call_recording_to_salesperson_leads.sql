-- Add call recording URL field to salesperson_leads
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'call_recording_url')
BEGIN
    ALTER TABLE salesperson_leads ADD call_recording_url TEXT;
END;

-- Add quotation verification fields
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'quotation_verified_status')
BEGIN
    ALTER TABLE salesperson_leads ADD quotation_verified_status VARCHAR(50);
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'quotation_verified_by')
BEGIN
    ALTER TABLE salesperson_leads ADD quotation_verified_by VARCHAR(255);
END;

-- Add PI verification fields  
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'pi_verification_status')
BEGIN
    ALTER TABLE salesperson_leads ADD pi_verification_status VARCHAR(50);
END;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'pi_verified_by')
BEGIN
    ALTER TABLE salesperson_leads ADD pi_verified_by VARCHAR(255);
END;

-- Add indexes for better performance
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_salesperson_leads_quotation_verified')
BEGIN
    CREATE INDEX idx_salesperson_leads_quotation_verified ON salesperson_leads(quotation_verified_status);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_salesperson_leads_pi_verification')
BEGIN
    CREATE INDEX idx_salesperson_leads_pi_verification ON salesperson_leads(pi_verification_status);
END;


