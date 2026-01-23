-- Add rate and value columns to stock table for Tally data
ALTER TABLE stock 
ADD COLUMN IF NOT EXISTS rate DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS value DECIMAL(15, 2) DEFAULT 0;

-- Add comments
COMMENT ON COLUMN stock.rate IS 'Rate per unit from Tally';
COMMENT ON COLUMN stock.value IS 'Total value (quantity * rate) from Tally';
