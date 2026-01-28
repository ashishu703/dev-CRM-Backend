ALTER TABLE rfp_requests
ADD COLUMN IF NOT EXISTS calculator_pricing_log JSONB;

