-- Allow multiple RFP IDs per lead by removing UNIQUE constraint
-- This allows one lead to have multiple RFP IDs (one for each save/raise/approve)

-- Drop the UNIQUE constraint on rfp_id
ALTER TABLE pricing_rfp_decisions 
DROP CONSTRAINT IF EXISTS pricing_rfp_decisions_rfp_id_key;

-- Add index for faster lookups (non-unique)
CREATE INDEX IF NOT EXISTS idx_pricing_rfp_decisions_rfp_id_non_unique 
ON pricing_rfp_decisions(rfp_id);

-- Add index on created_at for date-based queries
CREATE INDEX IF NOT EXISTS idx_pricing_rfp_decisions_created_at 
ON pricing_rfp_decisions(created_at);

-- Add index on lead_id and created_at for lead-based queries with date sorting
CREATE INDEX IF NOT EXISTS idx_pricing_rfp_decisions_lead_created 
ON pricing_rfp_decisions(lead_id, created_at DESC);
