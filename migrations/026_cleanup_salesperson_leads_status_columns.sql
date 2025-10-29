-- Cleanup legacy status columns from salesperson_leads
-- Safe and idempotent: drops only if columns exist

-- Drop columns if they exist
ALTER TABLE salesperson_leads DROP COLUMN IF EXISTS connected_status;
ALTER TABLE salesperson_leads DROP COLUMN IF EXISTS final_status;
ALTER TABLE salesperson_leads DROP COLUMN IF EXISTS connected_status_remark;
ALTER TABLE salesperson_leads DROP COLUMN IF EXISTS final_status_remark;