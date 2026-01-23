-- Add master_rfp_id column to rfp_requests to link all RFPs to one master RFP ID per lead
ALTER TABLE rfp_requests
ADD COLUMN IF NOT EXISTS master_rfp_id VARCHAR(50);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rfp_requests_master_rfp_id ON rfp_requests(master_rfp_id);

-- Add master_rfp_id to quotations for tracking
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS master_rfp_id VARCHAR(50);

-- Add master_rfp_id to proforma_invoices for tracking
ALTER TABLE proforma_invoices
ADD COLUMN IF NOT EXISTS master_rfp_id VARCHAR(50);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotations_master_rfp_id ON quotations(master_rfp_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_master_rfp_id ON proforma_invoices(master_rfp_id);
