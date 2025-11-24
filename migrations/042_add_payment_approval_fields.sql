-- sqlfluff: dialect=postgres
-- Adds explicit approval workflow fields to payment_history
-- Run date: 2025-11-21

ALTER TABLE payment_history
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS approval_notes TEXT,
    ADD COLUMN IF NOT EXISTS approval_action_by VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'payment_history'
          AND constraint_name = 'payment_history_approval_status_check'
    ) THEN
        ALTER TABLE payment_history
        ADD CONSTRAINT payment_history_approval_status_check
        CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

-- Backfill approval metadata for existing rows
UPDATE payment_history
SET approval_status = CASE
        WHEN payment_approved IS TRUE THEN 'approved'
        WHEN approval_status IS NULL OR approval_status NOT IN ('pending','approved','rejected') THEN 'pending'
        ELSE approval_status
    END,
    approval_action_by = COALESCE(approval_action_by, payment_approved_by);

-- Ensure rejected payments reset legacy approval columns
UPDATE payment_history
SET payment_approved = FALSE,
    payment_approved_by = NULL,
    payment_approved_at = NULL
WHERE approval_status = 'rejected';

-- Index for quick tab filtering
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_payment_history_approval_status'
    ) THEN
        CREATE INDEX idx_payment_history_approval_status
        ON payment_history(approval_status);
    END IF;
END $$;

-- sqlfluff: enable=all

