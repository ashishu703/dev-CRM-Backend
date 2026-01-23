-- Store "same-to-same" snapshot when RFP is raised from Pricing & RFP Decision
-- This keeps a full copy of what salesperson raised (all products + form/lead context)

ALTER TABLE rfp_requests
ADD COLUMN IF NOT EXISTS source VARCHAR(50),
ADD COLUMN IF NOT EXISTS source_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_rfp_requests_salesperson_id ON rfp_requests(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_rfp_requests_source ON rfp_requests(source);
