-- Cleanup legacy status columns from salesperson_leads
-- Safe and idempotent: drops only if columns exist

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'connected_status') THEN
        ALTER TABLE salesperson_leads DROP COLUMN connected_status;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'final_status') THEN
        ALTER TABLE salesperson_leads DROP COLUMN final_status;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'connected_status_remark') THEN
        ALTER TABLE salesperson_leads DROP COLUMN connected_status_remark;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'final_status_remark') THEN
        ALTER TABLE salesperson_leads DROP COLUMN final_status_remark;
    END IF;
END $$;


