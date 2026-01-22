-- ============================================================================
-- Update AAAC Prices to Excel Sheet Values
-- ============================================================================
-- Migration: 061_update_aaac_prices_to_excel_values.sql
-- Purpose: Update variable prices to match Excel sheet values
-- ============================================================================

-- Deactivate all existing prices
UPDATE aaac_variable_prices SET is_active = FALSE;

-- Insert/Update prices to match Excel sheet values
-- Alu Price: 296.00, Alloy Price: 340.00
INSERT INTO aaac_variable_prices (alu_price_per_kg, alloy_price_per_kg, effective_date, is_active) 
VALUES (296.00, 340.00, CURRENT_DATE, TRUE)
ON CONFLICT (effective_date) 
DO UPDATE SET
    alu_price_per_kg = EXCLUDED.alu_price_per_kg,
    alloy_price_per_kg = EXCLUDED.alloy_price_per_kg,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;
