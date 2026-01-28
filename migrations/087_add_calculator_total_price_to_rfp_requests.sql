ALTER TABLE rfp_requests
ADD COLUMN IF NOT EXISTS calculator_total_price NUMERIC(18, 2);

ALTER TABLE rfp_requests
ADD COLUMN IF NOT EXISTS calculator_total_price NUMERIC(14,2);

