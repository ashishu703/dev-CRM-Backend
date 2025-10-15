-- Cleanup legacy status columns from salesperson_leads
-- Safe and idempotent: drops only if columns exist

IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'connected_status')
BEGIN
    ALTER TABLE salesperson_leads DROP COLUMN connected_status;
END;

IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'final_status')
BEGIN
    ALTER TABLE salesperson_leads DROP COLUMN final_status;
END;

IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'connected_status_remark')
BEGIN
    ALTER TABLE salesperson_leads DROP COLUMN connected_status_remark;
END;

IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'final_status_remark')
BEGIN
    ALTER TABLE salesperson_leads DROP COLUMN final_status_remark;
END;


