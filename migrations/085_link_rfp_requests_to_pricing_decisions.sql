-- Add pricing_decision_rfp_id column to rfp_requests to link RFP requests to pricing decisions
-- This allows tracking which pricing decision an RFP request was raised from
ALTER TABLE rfp_requests
ADD COLUMN IF NOT EXISTS pricing_decision_rfp_id VARCHAR(50);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rfp_requests_pricing_decision_rfp_id ON rfp_requests(pricing_decision_rfp_id);

-- Add comment to explain the field
COMMENT ON COLUMN rfp_requests.pricing_decision_rfp_id IS 'Links to pricing_rfp_decisions.rfp_id when RFP is raised from pricing decision section';
