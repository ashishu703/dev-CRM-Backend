-- Create stock table for managing product stock/availability
CREATE TABLE IF NOT EXISTS stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name VARCHAR(255) NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(50) NOT NULL DEFAULT 'meters',
    status VARCHAR(50) NOT NULL DEFAULT 'out_of_stock', -- 'available', 'limited', 'out_of_stock'
    updated_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_status CHECK (status IN ('available', 'limited', 'out_of_stock')),
    CONSTRAINT check_quantity_non_negative CHECK (quantity >= 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_product_name ON stock(product_name);
CREATE INDEX IF NOT EXISTS idx_stock_status ON stock(status);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stock_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stock_updated_at_trigger ON stock;
CREATE TRIGGER update_stock_updated_at_trigger
BEFORE UPDATE ON stock
FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();

-- Insert initial stock data for all 26 products
INSERT INTO stock (product_name, quantity, unit, status) VALUES
    ('Aerial Bunch Cable', 0, 'meters', 'out_of_stock'),
    ('Aluminium Conductor Galvanized Steel Reinforced', 0, 'meters', 'out_of_stock'),
    ('All Aluminium Alloy Conductor', 0, 'meters', 'out_of_stock'),
    ('PVC Insulated Submersible Cable', 0, 'meters', 'out_of_stock'),
    ('Multi Core XLPE Insulated Aluminium Unarmoured Cable', 0, 'meters', 'out_of_stock'),
    ('Paper Cover Aluminium Conductor', 0, 'meters', 'out_of_stock'),
    ('Single Core PVC Insulated Aluminium/Copper Armoured/Unarmoured Cable', 0, 'meters', 'out_of_stock'),
    ('Single Core XLPE Insulated Aluminium/Copper Armoured/Unarmoured Cable', 0, 'meters', 'out_of_stock'),
    ('Multi Core PVC Insulated Aluminium Armoured Cable', 0, 'meters', 'out_of_stock'),
    ('Multi Core XLPE Insulated Aluminium Armoured Cable', 0, 'meters', 'out_of_stock'),
    ('Multi Core PVC Insulated Aluminium Unarmoured Cable', 0, 'meters', 'out_of_stock'),
    ('Multistrand Single Core Copper Cable', 0, 'meters', 'out_of_stock'),
    ('Multi Core Copper Cable', 0, 'meters', 'out_of_stock'),
    ('PVC Insulated Single Core Aluminium Cable', 0, 'meters', 'out_of_stock'),
    ('PVC Insulated Multicore Aluminium Cable', 0, 'meters', 'out_of_stock'),
    ('Submersible Winding Wire', 0, 'meters', 'out_of_stock'),
    ('Twin Twisted Copper Wire', 0, 'meters', 'out_of_stock'),
    ('Speaker Cable', 0, 'meters', 'out_of_stock'),
    ('CCTV Cable', 0, 'meters', 'out_of_stock'),
    ('LAN Cable', 0, 'meters', 'out_of_stock'),
    ('Automobile Cable', 0, 'meters', 'out_of_stock'),
    ('PV Solar Cable', 0, 'meters', 'out_of_stock'),
    ('Co Axial Cable', 0, 'meters', 'out_of_stock'),
    ('Uni-tube Unarmoured Optical Fibre Cable', 0, 'meters', 'out_of_stock'),
    ('Armoured Unarmoured PVC Insulated Copper Control Cable', 0, 'meters', 'out_of_stock'),
    ('Telecom Switch Board Cables', 0, 'meters', 'out_of_stock')
ON CONFLICT (product_name) DO NOTHING;


