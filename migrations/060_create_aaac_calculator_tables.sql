-- ============================================================================
-- AAAC Calculator Tables
-- ============================================================================
-- Migration: 060_create_aaac_calculator_tables.sql
-- Purpose: Store predefined AAAC products and variable prices for calculator
-- ============================================================================

-- Table for predefined AAAC products (Yellow cells - Fixed data)
CREATE TABLE IF NOT EXISTS aaac_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    nominal_area NUMERIC(10, 2) NOT NULL,
    no_of_strands INTEGER NOT NULL,
    diameter NUMERIC(10, 4) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for variable prices (Orange cells - Updated daily by account department)
CREATE TABLE IF NOT EXISTS aaac_variable_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alu_price_per_kg NUMERIC(10, 2) NOT NULL,
    alloy_price_per_kg NUMERIC(10, 2) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, -- User ID who updated the prices
    UNIQUE(effective_date)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_aaac_products_name ON aaac_products(name);
CREATE INDEX IF NOT EXISTS idx_aaac_products_active ON aaac_products(is_active);
CREATE INDEX IF NOT EXISTS idx_aaac_variable_prices_date ON aaac_variable_prices(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_aaac_variable_prices_active ON aaac_variable_prices(is_active);

-- Insert predefined AAAC products based on Excel sheet (exact data from spreadsheet)
INSERT INTO aaac_products (name, nominal_area, no_of_strands, diameter) VALUES
    ('Mole', 15, 3, 2.50),
    ('Squirrel', 20, 7, 2.00),
    ('Weasel', 34, 7, 2.50),
    ('Rabbit', 55, 7, 3.15),
    ('Raccoon', 80, 7, 3.81),
    ('Dog', 100, 7, 4.26),
    ('Dog(up)', 125, 19, 2.89),
    ('Coyote', 150, 19, 3.15),
    ('Wolf', 175, 19, 3.40),
    ('Wolf(up)', 200, 19, 3.66),
    ('Panther', 232, 19, 3.94),
    ('Panther (up) 290', 290, 37, 3.15),
    ('Panther (up) 345', 345, 37, 3.45),
    ('Kundah', 400, 37, 3.71),
    ('Zebra', 465, 37, 4.00),
    ('Zebra (up)', 525, 61, 3.31),
    ('Moose', 570, 61, 3.45)
ON CONFLICT (name) DO NOTHING;

-- Insert default variable prices (can be updated by account department)
INSERT INTO aaac_variable_prices (alu_price_per_kg, alloy_price_per_kg, effective_date, is_active) VALUES
    (296.00, 340.00, CURRENT_DATE, TRUE)
ON CONFLICT (effective_date) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE aaac_products IS 'Predefined AAAC product specifications (Fixed data - Yellow cells)';
COMMENT ON TABLE aaac_variable_prices IS 'Variable prices updated daily by account department (Orange cells)';
COMMENT ON COLUMN aaac_products.nominal_area IS 'Nominal area in sqmm';
COMMENT ON COLUMN aaac_products.diameter IS 'Diameter in mm';
COMMENT ON COLUMN aaac_variable_prices.alu_price_per_kg IS 'Aluminium price per kilogram';
COMMENT ON COLUMN aaac_variable_prices.alloy_price_per_kg IS 'Alloy price per kilogram';
