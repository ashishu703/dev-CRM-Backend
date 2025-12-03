-- Create work_orders table for storing work order information
-- Run date: 2025-12-03

CREATE TABLE IF NOT EXISTS work_orders (
    id SERIAL PRIMARY KEY,
    
    -- Work Order Identification
    work_order_number VARCHAR(50) UNIQUE NOT NULL,
    bna_number VARCHAR(50),
    
    -- Dates
    date DATE NOT NULL,
    delivery_date DATE,
    contact VARCHAR(50),
    
    -- From (Company) Information
    from_company_name VARCHAR(255),
    from_address TEXT,
    from_email VARCHAR(255),
    from_gstin VARCHAR(50),
    
    -- To (Customer) Information
    to_company_name VARCHAR(255),
    to_address TEXT,
    to_email VARCHAR(255),
    
    -- Order Details
    order_title VARCHAR(255),
    order_description TEXT,
    order_quantity VARCHAR(50),
    order_type VARCHAR(100),
    order_length VARCHAR(100),
    order_colour VARCHAR(100),
    order_print VARCHAR(100),
    order_total DECIMAL(15,2) DEFAULT 0,
    unit_rate VARCHAR(50),
    
    -- Terms & Conditions (stored as JSON)
    terms TEXT,
    
    -- Signatures
    prepared_by VARCHAR(255),
    received_by VARCHAR(255),
    
    -- References
    payment_id INTEGER,
    quotation_id UUID,
    lead_id INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_work_orders_work_order_number ON work_orders(work_order_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_payment_id ON work_orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_quotation_id ON work_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_lead_id ON work_orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_date ON work_orders(date);
CREATE INDEX IF NOT EXISTS idx_work_orders_delivery_date ON work_orders(delivery_date);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_work_orders_updated_at ON work_orders;
CREATE TRIGGER update_work_orders_updated_at
BEFORE UPDATE ON work_orders
FOR EACH ROW EXECUTE FUNCTION update_work_orders_updated_at();

