-- Add Master Batch (XLPE) and Master Batch (PVC) to raw material rates
ALTER TABLE raw_material_rates
ADD COLUMN IF NOT EXISTS master_batch_xlpe DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS master_batch_pvc DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN raw_material_rates.master_batch_xlpe IS 'Master Batch (XLPE) price';
COMMENT ON COLUMN raw_material_rates.master_batch_pvc IS 'Master Batch (PVC) price';
