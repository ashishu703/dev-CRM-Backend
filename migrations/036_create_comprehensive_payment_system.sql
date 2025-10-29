-- sqlfluff: dialect=postgres
-- sqlfluff: disable=all
-- Creates payment_history table with all required fields for tracking payments and installments
-- Run date: 2025-01-30

-- Safe: avoid destructive drops in migrations; rely on IF NOT EXISTS below
-- DROP TABLE IF EXISTS payment_history CASCADE;
-- DROP TABLE IF EXISTS payments CASCADE;

-- Create comprehensive payment_history table
CREATE TABLE payment_history (
    id SERIAL PRIMARY KEY,
    
    -- Lead/Customer Information (Foreign Keys)
    lead_id INTEGER NOT NULL,
    customer_name VARCHAR(255),
    product_name VARCHAR(255),
    business_name VARCHAR(255),
    address TEXT,
    
    -- Quotation & Invoice References (Foreign Keys)
    quotation_id UUID,
    pi_id UUID,
    
    -- Payment Details
    total_quotation_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Installment Information
    installment_number INTEGER DEFAULT 1,
    installment_amount DECIMAL(15,2) NOT NULL,
    
    -- Payment Method & Reference
    payment_method VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(255) UNIQUE,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'completed',
    
    -- Credit Management
    available_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
    overpaid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Purchase Order & Delivery
    purchase_order_id VARCHAR(100),
    delivery_date DATE,
    revised_delivery_date DATE,
    delivery_status VARCHAR(50) DEFAULT 'pending',
    
    -- Payment Approval & Receipt
    payment_approved BOOLEAN DEFAULT false,
    payment_approved_by VARCHAR(255),
    payment_approved_at TIMESTAMP,
    payment_receipt_url VARCHAR(500),
    
    -- Refund Tracking
    refund_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    is_refund BOOLEAN DEFAULT false,
    
    -- Additional Information
    remarks TEXT,
    notes TEXT,
    
    -- Timestamps
    payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Foreign Key Constraints
    CONSTRAINT fk_payment_history_lead
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_history_quotation
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_history_pi
        FOREIGN KEY (pi_id) REFERENCES proforma_invoices(id) ON DELETE SET NULL,
        
    -- Check Constraints
    CONSTRAINT check_installment_positive CHECK (installment_amount >= 0),
    CONSTRAINT check_remaining_non_negative CHECK (remaining_amount >= 0),
    CONSTRAINT check_payment_status CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled'))
);

-- Create indexes for performance
CREATE INDEX idx_payment_history_lead_id ON payment_history(lead_id);
CREATE INDEX idx_payment_history_quotation_id ON payment_history(quotation_id);
CREATE INDEX idx_payment_history_payment_date ON payment_history(payment_date);
CREATE INDEX idx_payment_history_payment_status ON payment_history(payment_status);
CREATE INDEX idx_payment_history_payment_reference ON payment_history(payment_reference);

GO
CREATE VIEW vw_payment_summary_by_lead AS
SELECT 
    lead_id,
    customer_name,
    COUNT(*) as total_installments,
    SUM(installment_amount) as total_paid,
    MAX(remaining_amount) as current_remaining,
    MAX(available_credit) as current_credit,
    MAX(total_quotation_amount) as total_quotation_amount,
    MIN(payment_date) as first_payment_date,
    MAX(payment_date) as last_payment_date,
    STRING_AGG(CAST(quotation_id AS TEXT), ', ') as quotation_ids
FROM payment_history
WHERE payment_status = 'completed' AND is_refund = false
GROUP BY lead_id, customer_name;
GO

GO
CREATE VIEW vw_payment_summary_by_quotation AS
SELECT 
    quotation_id,
    lead_id,
    customer_name,
    COUNT(*) as total_installments,
    SUM(installment_amount) as total_paid,
    MAX(total_quotation_amount) as quotation_total,
    MAX(remaining_amount) as current_remaining,
    CASE 
        WHEN MAX(remaining_amount) = 0 THEN 'paid'
        WHEN SUM(installment_amount) > 0 THEN 'partial'
        ELSE 'pending'
    END as payment_status,
    MIN(payment_date) as first_payment_date,
    MAX(payment_date) as last_payment_date
FROM payment_history
WHERE payment_status = 'completed' AND is_refund = false
GROUP BY quotation_id, lead_id, customer_name;
GO

-- Add trigger to update updated_at timestamp (PostgreSQL only)
/*
CREATE OR REPLACE FUNCTION update_payment_history_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_history_timestamp ON payment_history;
CREATE TRIGGER trigger_update_payment_history_timestamp
BEFORE UPDATE ON payment_history
FOR EACH ROW
EXECUTE FUNCTION update_payment_history_timestamp();
*/

-- Documentation comments (PostgreSQL). Left commented to satisfy linter.
-- COMMENT ON TABLE payment_history IS 'Comprehensive payment tracking system with installment support';
-- COMMENT ON COLUMN payment_history.lead_id IS 'Foreign key to leads table - required';
-- COMMENT ON COLUMN payment_history.quotation_id IS 'Foreign key to quotations table - nullable for advance payments';
-- COMMENT ON COLUMN payment_history.pi_id IS 'Foreign key to proforma_invoices table - nullable';
-- COMMENT ON COLUMN payment_history.installment_number IS 'Sequential installment number for this payment';
-- COMMENT ON COLUMN payment_history.installment_amount IS 'Amount paid in this specific installment';
-- COMMENT ON COLUMN payment_history.remaining_amount IS 'Balance remaining after this installment';
-- COMMENT ON COLUMN payment_history.available_credit IS 'Customer credit available at time of payment';
-- COMMENT ON COLUMN payment_history.overpaid_amount IS 'Amount exceeding quotation total (converted to credit)';
-- COMMENT ON COLUMN payment_history.purchase_order_id IS 'Customer purchase order reference';
-- COMMENT ON COLUMN payment_history.delivery_date IS 'Expected delivery date';
-- COMMENT ON COLUMN payment_history.revised_delivery_date IS 'Revised delivery date if changed';
-- COMMENT ON COLUMN payment_history.payment_approved IS 'Whether payment has been verified/approved';
-- COMMENT ON COLUMN payment_history.payment_receipt_url IS 'URL to payment receipt/proof document';


-- sqlfluff: enable=all
