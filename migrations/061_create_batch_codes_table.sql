-- Create batch_codes table for tracking barcodes and batch codes
CREATE TABLE IF NOT EXISTS batch_codes (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    barcode VARCHAR(255) NOT NULL UNIQUE,
    batch_number VARCHAR(100),
    item_in_quantity DECIMAL(15, 3) DEFAULT 0,
    item_out_quantity DECIMAL(15, 3) DEFAULT 0,
    consumed_quantity DECIMAL(15, 3) DEFAULT 0,
    balance_quantity DECIMAL(15, 3) DEFAULT 0,
    store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
    no_of_packing INTEGER DEFAULT 1,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_codes_item_id ON batch_codes(item_id);
CREATE INDEX IF NOT EXISTS idx_batch_codes_barcode ON batch_codes(barcode);
CREATE INDEX IF NOT EXISTS idx_batch_codes_store_id ON batch_codes(store_id);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_batch_codes_updated_at ON batch_codes;
CREATE TRIGGER update_batch_codes_updated_at
BEFORE UPDATE ON batch_codes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

