-- sqlfluff: dialect=postgres
-- sqlfluff: disable=all
-- Creates payment_history table with all required fields for tracking payments and installments
-- Run date: 2025-01-30

-- Create comprehensive payment_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_history (
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
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add foreign key constraints if they don't exist (safely)
DO $$
BEGIN
    -- Add foreign key to leads table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'payment_history' 
            AND constraint_name = 'fk_payment_history_lead'
        ) THEN
            ALTER TABLE payment_history 
            ADD CONSTRAINT fk_payment_history_lead
            FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Add foreign key to quotations table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quotations') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'payment_history' 
            AND constraint_name = 'fk_payment_history_quotation'
        ) THEN
            ALTER TABLE payment_history 
            ADD CONSTRAINT fk_payment_history_quotation
            FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- Add foreign key to proforma_invoices table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proforma_invoices') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'payment_history' 
            AND constraint_name = 'fk_payment_history_pi'
        ) THEN
            ALTER TABLE payment_history 
            ADD CONSTRAINT fk_payment_history_pi
            FOREIGN KEY (pi_id) REFERENCES proforma_invoices(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- Add check constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_history' 
        AND constraint_name = 'check_installment_positive'
    ) THEN
        ALTER TABLE payment_history 
        ADD CONSTRAINT check_installment_positive 
        CHECK (installment_amount >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_history' 
        AND constraint_name = 'check_remaining_non_negative'
    ) THEN
        ALTER TABLE payment_history 
        ADD CONSTRAINT check_remaining_non_negative 
        CHECK (remaining_amount >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_history' 
        AND constraint_name = 'check_payment_status'
    ) THEN
        ALTER TABLE payment_history 
        ADD CONSTRAINT check_payment_status 
        CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled'));
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error adding constraints to payment_history: %', SQLERRM;
END $$;

-- Create indexes for performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_payment_history_lead_id') THEN
        CREATE INDEX idx_payment_history_lead_id ON payment_history(lead_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_payment_history_quotation_id') THEN
        CREATE INDEX idx_payment_history_quotation_id ON payment_history(quotation_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_payment_history_payment_date') THEN
        CREATE INDEX idx_payment_history_payment_date ON payment_history(payment_date);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_payment_history_payment_status') THEN
        CREATE INDEX idx_payment_history_payment_status ON payment_history(payment_status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_payment_history_payment_reference') THEN
        CREATE INDEX idx_payment_history_payment_reference ON payment_history(payment_reference);
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating indexes for payment_history: %', SQLERRM;
END $$;

-- Create views if they don't exist
DO $$
BEGIN
    -- Create view for payment summary by lead
    IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'vw_payment_summary_by_lead') THEN
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
    END IF;

    -- Create view for payment summary by quotation
    IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'vw_payment_summary_by_quotation') THEN
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
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating views: %', SQLERRM;
END $$;

-- Add trigger to update updated_at timestamp
DO $$
BEGIN
    CREATE OR REPLACE FUNCTION update_payment_history_timestamp()
    RETURNS TRIGGER AS $trigger$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_update_payment_history_timestamp ON payment_history;
    CREATE TRIGGER trigger_update_payment_history_timestamp
    BEFORE UPDATE ON payment_history
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_history_timestamp();
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating trigger for payment_history: %', SQLERRM;
END $$;

-- sqlfluff: enable=all
