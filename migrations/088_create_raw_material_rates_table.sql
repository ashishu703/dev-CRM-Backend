-- Add is_active column and audit fields to raw_material_rates table
-- Supports partial updates and prevents accidental zero overwrites

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add is_active column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='raw_material_rates' AND column_name='is_active') THEN
        ALTER TABLE raw_material_rates ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    -- Add created_by column (nullable, no FK constraint due to missing table)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='raw_material_rates' AND column_name='created_by') THEN
        ALTER TABLE raw_material_rates ADD COLUMN created_by UUID;
    END IF;
    
    -- Add updated_by column (nullable, no FK constraint due to missing table)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='raw_material_rates' AND column_name='updated_by') THEN
        ALTER TABLE raw_material_rates ADD COLUMN updated_by UUID;
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_material_rates_active ON raw_material_rates(is_active, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE raw_material_rates IS 'Raw material pricing data for ERP calculations - supports partial updates';
COMMENT ON COLUMN raw_material_rates.is_active IS 'Only one record should be active at a time';
COMMENT ON COLUMN raw_material_rates.aluminium_ec_grade IS 'Aluminium EC Grade price per kg';
COMMENT ON COLUMN raw_material_rates.steel_rate IS 'Steel rate per kg';

-- Insert default rates if table is empty
INSERT INTO raw_material_rates (
    aluminium_ec_grade,
    aluminium_cg_grade, 
    steel_rate,
    is_active
) 
SELECT 320.00, 296.00, 65.00, true
WHERE NOT EXISTS (SELECT 1 FROM raw_material_rates);

