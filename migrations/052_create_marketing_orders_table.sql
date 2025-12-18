-- Create marketing_orders table for storing orders created by marketing salespersons
-- Run date: 2025-01-XX

CREATE TABLE IF NOT EXISTS marketing_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Order identification
    lead_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Customer information
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_address TEXT,
    customer_gst VARCHAR(50),
    
    -- Product information
    product_name VARCHAR(255) NOT NULL,
    product_type VARCHAR(50) NOT NULL CHECK (product_type IN ('Cable', 'Conductor')),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Order dates
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    delivered_date DATE,
    
    -- Order status
    order_status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (order_status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
    
    -- Dispatch information
    dispatch_from VARCHAR(100) DEFAULT 'Plant',
    work_order VARCHAR(100),
    
    -- Payment information
    payment_status VARCHAR(50) NOT NULL DEFAULT 'Not Started' CHECK (payment_status IN ('Not Started', 'Partial', 'Completed')),
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    pending_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Additional information
    notes TEXT,
    order_history JSONB DEFAULT '[]'::jsonb,
    
    -- Salesperson information
    created_by VARCHAR(255) NOT NULL, -- salesperson email/ID
    
    -- Standard timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_marketing_orders_lead_number ON marketing_orders(lead_number);
CREATE INDEX IF NOT EXISTS idx_marketing_orders_created_by ON marketing_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_orders_order_date ON marketing_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_marketing_orders_order_status ON marketing_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_marketing_orders_payment_status ON marketing_orders(payment_status);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_marketing_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_marketing_orders_updated_at
    BEFORE UPDATE ON marketing_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_marketing_orders_updated_at();

