-- Create proforma_invoices table if missing (required by payments and PI flows)
-- Ensures schema matches application expectations

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS proforma_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pi_number VARCHAR(50) UNIQUE NOT NULL,
    quotation_id TEXT,
    customer_id TEXT,
    salesperson_id TEXT,
    pi_date DATE,
    valid_until DATE,
    status VARCHAR(50) DEFAULT 'draft',
    subtotal NUMERIC(12,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(12,2) DEFAULT 0,
    total_paid NUMERIC(12,2) DEFAULT 0,
    remaining_balance NUMERIC(12,2) DEFAULT 0,
    template VARCHAR(50) DEFAULT 'template1',
    dispatch_mode VARCHAR(50),
    transport_name VARCHAR(255),
    vehicle_number VARCHAR(100),
    transport_id INTEGER,
    lr_no VARCHAR(100),
    courier_name VARCHAR(255),
    consignment_no VARCHAR(100),
    by_hand VARCHAR(255),
    post_service VARCHAR(255),
    carrier_name VARCHAR(255),
    carrier_number VARCHAR(100),
    created_by VARCHAR(255),
    sent_to_customer_at TIMESTAMP NULL,
    customer_accepted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pi_number ON proforma_invoices(pi_number);
CREATE INDEX IF NOT EXISTS idx_pi_quotation ON proforma_invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_pi_customer ON proforma_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_template ON proforma_invoices(template);

COMMENT ON COLUMN proforma_invoices.template IS 'Template identifier: template1 (Classic), template2 (Modern), or template3 (Minimal)';

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION update_pi_updated_at()
RETURNS TRIGGER AS $pi$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$pi$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pi_updated_at ON proforma_invoices;
CREATE TRIGGER trg_pi_updated_at
    BEFORE UPDATE ON proforma_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_pi_updated_at();

-- If an older table exists with integer id, migrate it to UUID
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'proforma_invoices'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'proforma_invoices'
              AND column_name = 'id'
              AND data_type IN ('integer', 'bigint')
        ) THEN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'proforma_invoices'
                  AND column_name = 'id_uuid'
            ) THEN
                ALTER TABLE proforma_invoices ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
            END IF;

            UPDATE proforma_invoices
            SET id_uuid = COALESCE(id_uuid, gen_random_uuid());

            -- Drop old PK if present, then swap columns
            BEGIN
                ALTER TABLE proforma_invoices DROP CONSTRAINT IF EXISTS proforma_invoices_pkey;
            EXCEPTION WHEN OTHERS THEN NULL;
            END;

            ALTER TABLE proforma_invoices DROP COLUMN id;
            ALTER TABLE proforma_invoices RENAME COLUMN id_uuid TO id;
            ALTER TABLE proforma_invoices ADD PRIMARY KEY (id);
        END IF;
    END IF;
END $$;

-- Add FK from payment_history.pi_id if possible
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payment_history'
    ) THEN
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
END $$;
