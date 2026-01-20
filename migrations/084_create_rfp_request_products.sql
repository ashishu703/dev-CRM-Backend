-- Create RFP Request Products table (child table for products in an RFP)
-- This allows one RFP to have multiple products

CREATE TABLE IF NOT EXISTS rfp_request_products (
  id SERIAL PRIMARY KEY,
  rfp_request_id INTEGER NOT NULL,
  product_spec TEXT NOT NULL,
  quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
  length VARCHAR(50),
  length_unit VARCHAR(20) DEFAULT 'Mtr',
  target_price DECIMAL(15,2),
  availability_status VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_rfp_request_product
    FOREIGN KEY (rfp_request_id) REFERENCES rfp_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rfp_request_products_rfp_request_id ON rfp_request_products(rfp_request_id);

-- Make product_spec and quantity nullable in rfp_requests (products now in child table)
-- Keep them for backward compatibility but they won't be used for new RFPs
ALTER TABLE rfp_requests
ALTER COLUMN product_spec DROP NOT NULL,
ALTER COLUMN quantity DROP NOT NULL;

-- Add comment to indicate products should be in rfp_request_products
COMMENT ON COLUMN rfp_requests.product_spec IS 'DEPRECATED: Use rfp_request_products table. Kept for backward compatibility.';
COMMENT ON COLUMN rfp_requests.quantity IS 'DEPRECATED: Use rfp_request_products table. Kept for backward compatibility.';
