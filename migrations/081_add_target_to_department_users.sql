-- Add missing target tracking columns to department_users

ALTER TABLE department_users
ADD COLUMN IF NOT EXISTS target DECIMAL(10,2) DEFAULT 0 CHECK (target >= 0),
ADD COLUMN IF NOT EXISTS achieved_target DECIMAL(10,2) DEFAULT 0 CHECK (achieved_target >= 0);

CREATE INDEX IF NOT EXISTS idx_department_users_target ON department_users(target);
