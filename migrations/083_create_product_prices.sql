-- Create approved product price list table

CREATE TABLE IF NOT EXISTS product_prices (
  id SERIAL PRIMARY KEY,
  product_spec VARCHAR(255) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'approved',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_prices_product_spec ON product_prices(product_spec);
CREATE INDEX IF NOT EXISTS idx_product_prices_status ON product_prices(status);

CREATE OR REPLACE FUNCTION update_product_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_prices_updated_at ON product_prices;
CREATE TRIGGER trg_product_prices_updated_at
BEFORE UPDATE ON product_prices
FOR EACH ROW EXECUTE FUNCTION update_product_prices_updated_at();
