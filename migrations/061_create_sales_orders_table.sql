-- Migration: 061_create_sales_orders_table.sql
-- Purpose: Create sales_orders table for Production Department Head
-- Sales orders are created from work orders and represent production commitments

CREATE TABLE IF NOT EXISTS sales_orders (
    id SERIAL PRIMARY KEY,
    
    -- Sales Order Identification
    sales_order_number VARCHAR(50) UNIQUE NOT NULL,
    work_order_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
    
    -- Customer and Order Information
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    customer_address TEXT,
    customer_gst_no VARCHAR(50),
    
    -- Product Details
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    quantity NUMERIC(15,2) NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    
    -- Dates
    order_date DATE NOT NULL,
    delivery_date DATE,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'confirmed',
    -- Status options: confirmed, in_production, quality_check, completed, shipped, cancelled
    
    payment_status VARCHAR(50) DEFAULT 'pending',
    -- Payment status: pending, partial, paid, overdue
    
    -- Production tracking
    production_start_date DATE,
    production_end_date DATE,
    assigned_to VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'medium',
    -- Priority: low, medium, high, urgent
    
    -- Financial
    total_amount NUMERIC(15,2) NOT NULL,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    
    -- Notes and remarks
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Soft delete
    deleted_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_sales_order_number ON sales_orders(sales_order_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_work_order_id ON sales_orders(work_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_payment_status ON sales_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_delivery_date ON sales_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_priority ON sales_orders(priority);
CREATE INDEX IF NOT EXISTS idx_sales_orders_deleted_at ON sales_orders(deleted_at);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sales_orders_updated_at
    BEFORE UPDATE ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_orders_updated_at();

-- Add comments for documentation
COMMENT ON TABLE sales_orders IS 'Sales orders for production department - created from work orders';
COMMENT ON COLUMN sales_orders.status IS 'Production status: confirmed, in_production, quality_check, completed, shipped, cancelled';
COMMENT ON COLUMN sales_orders.payment_status IS 'Payment tracking: pending, partial, paid, overdue';
COMMENT ON COLUMN sales_orders.priority IS 'Production priority: low, medium, high, urgent';

