-- Add group and subgroup columns to stock table for hierarchical structure
ALTER TABLE stock 
ADD COLUMN IF NOT EXISTS "group" VARCHAR(255) DEFAULT '',
ADD COLUMN IF NOT EXISTS subgroup VARCHAR(255) DEFAULT '';

-- Add comments
COMMENT ON COLUMN stock."group" IS 'Top-level stock group (e.g., Finished Goods, Raw Material)';
COMMENT ON COLUMN stock.subgroup IS 'Subgroup within the main group (e.g., AERIAL BUNCHED CABLE, CONDUCTORS)';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_group ON stock("group");
CREATE INDEX IF NOT EXISTS idx_stock_subgroup ON stock(subgroup);
