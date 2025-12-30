-- Migration: 063_update_work_orders_full_details.sql
-- Purpose: Add all work order fields for complete form data

-- Add company details
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS from_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS from_website VARCHAR(255),
ADD COLUMN IF NOT EXISTS company_logo TEXT;

-- Add customer details
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS customer_business_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_buyer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_gst VARCHAR(50),
ADD COLUMN IF NOT EXISTS customer_contact VARCHAR(50),
ADD COLUMN IF NOT EXISTS customer_state VARCHAR(100);

-- Add additional details
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS transport_tc TEXT,
ADD COLUMN IF NOT EXISTS dispatch_through VARCHAR(255),
ADD COLUMN IF NOT EXISTS delivery_terms TEXT,
ADD COLUMN IF NOT EXISTS material_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS delivery_location TEXT;

-- Add production details
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS raw_materials TEXT,
ADD COLUMN IF NOT EXISTS quality_standards TEXT,
ADD COLUMN IF NOT EXISTS special_instructions TEXT,
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';

-- Add items as JSON
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS items JSONB;

-- Add remarks
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Add prepared by details
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS prepared_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS prepared_by_designation VARCHAR(255),
ADD COLUMN IF NOT EXISTS prepared_by_user_id INTEGER;

-- Add revision tracking
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_revised BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS revised_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS revised_by INTEGER,
ADD COLUMN IF NOT EXISTS original_work_order_id INTEGER REFERENCES work_orders(id);

-- Add soft delete
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_is_deleted ON work_orders(is_deleted);
CREATE INDEX IF NOT EXISTS idx_work_orders_is_revised ON work_orders(is_revised);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_prepared_by ON work_orders(prepared_by_user_id);

-- Comments
COMMENT ON COLUMN work_orders.items IS 'Product items as JSON array';
COMMENT ON COLUMN work_orders.revision_number IS 'Revision number for tracking edits';
COMMENT ON COLUMN work_orders.is_revised IS 'Flag to indicate if this is a revised version';
COMMENT ON COLUMN work_orders.original_work_order_id IS 'Reference to original work order if this is a revision';

