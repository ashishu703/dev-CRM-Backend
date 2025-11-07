-- Create quotations system tables
-- This migration creates the complete quotation-to-payment workflow tables

-- Create quotations table
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Quotation identification
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    parent_quotation_id UUID,
    
    -- Customer and Salesperson references
    customer_id INTEGER,
    salesperson_id UUID,
    created_by VARCHAR(255) NOT NULL,
    
    -- Customer information (denormalized for historical accuracy)
    customer_name VARCHAR(255),
    customer_business VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    customer_address TEXT,
    customer_gst_no VARCHAR(50),
    customer_state VARCHAR(100),
    
    -- Quotation dates and validity
    quotation_date DATE NOT NULL,
    valid_until DATE,
    branch VARCHAR(100) DEFAULT 'ANODE',
    
    -- Financial information
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 18.00,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_rate DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Status and workflow
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    verification_notes TEXT,
    
    -- Timestamps for workflow tracking
    submitted_for_verification_at TIMESTAMP,
    sent_to_customer_at TIMESTAMP,
    customer_accepted_at TIMESTAMP,
    customer_accepted_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- Standard timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create quotation_items table
CREATE TABLE IF NOT EXISTS quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    
    -- Product information
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    hsn_code VARCHAR(50),
    
    -- Quantity and pricing
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'Nos',
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Tax information
    gst_rate DECIMAL(5,2) DEFAULT 18.00,
    taxable_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    gst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Foreign key constraint
    CONSTRAINT fk_quotation_items_quotation 
        FOREIGN KEY (quotation_id) 
        REFERENCES quotations(id) 
        ON DELETE CASCADE
);

-- Create quotation_approval_logs table
CREATE TABLE IF NOT EXISTS quotation_approval_logs (
    id SERIAL PRIMARY KEY,
    quotation_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    performed_by_type VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_quotation_approval_logs_quotation 
        FOREIGN KEY (quotation_id) 
        REFERENCES quotations(id) 
        ON DELETE CASCADE
);

-- Create quotation_sent_logs table
CREATE TABLE IF NOT EXISTS quotation_sent_logs (
    id SERIAL PRIMARY KEY,
    quotation_id UUID NOT NULL,
    sent_to VARCHAR(255) NOT NULL,
    sent_via VARCHAR(50) NOT NULL,
    sent_by VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_quotation_sent_logs_quotation 
        FOREIGN KEY (quotation_id) 
        REFERENCES quotations(id) 
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_salesperson_id ON quotations(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_quotation_number ON quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at);
CREATE INDEX IF NOT EXISTS idx_quotations_parent_quotation_id ON quotations(parent_quotation_id);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_item_order ON quotation_items(quotation_id, item_order);

CREATE INDEX IF NOT EXISTS idx_quotation_approval_logs_quotation_id ON quotation_approval_logs(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_approval_logs_created_at ON quotation_approval_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_quotation_sent_logs_quotation_id ON quotation_sent_logs(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_sent_logs_sent_at ON quotation_sent_logs(sent_at);

