-- Create raw_material_rates table
CREATE TABLE IF NOT EXISTS raw_material_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluminium_ec_grade DECIMAL(10,2) DEFAULT 0,
    aluminium_cg_grade DECIMAL(10,2) DEFAULT 0,
    pvc_rp_inner DECIMAL(10,2) DEFAULT 0,
    pvc_rp_outer DECIMAL(10,2) DEFAULT 0,
    aluminium_alloy DECIMAL(10,2) DEFAULT 0,
    copper_lme_grade DECIMAL(10,2) DEFAULT 0,
    xlpe DECIMAL(10,2) DEFAULT 0,
    pvc_st1_type_a DECIMAL(10,2) DEFAULT 0,
    pvc_st2 DECIMAL(10,2) DEFAULT 0,
    fr_pvc DECIMAL(10,2) DEFAULT 0,
    frlsh_pvc DECIMAL(10,2) DEFAULT 0,
    gi_wire_0_6mm DECIMAL(10,2) DEFAULT 0,
    gi_wire_1_4mm DECIMAL(10,2) DEFAULT 0,
    gi_armouring_strip DECIMAL(10,2) DEFAULT 0,
    ld DECIMAL(10,2) DEFAULT 0,
    steel_rate DECIMAL(10,2) DEFAULT 0,
    pvc_st1_st2 DECIMAL(10,2) DEFAULT 0,
    aluminium_alloy_grade_t4 DECIMAL(10,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_raw_material_rates_updated_at ON raw_material_rates(updated_at DESC);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_raw_material_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_raw_material_rates_updated_at
    BEFORE UPDATE ON raw_material_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_raw_material_rates_updated_at();
