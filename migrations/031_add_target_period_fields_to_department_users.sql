-- Add target period fields to department_users table
ALTER TABLE department_users 
ADD COLUMN IF NOT EXISTS target_start_date DATE,
ADD COLUMN IF NOT EXISTS target_end_date DATE,
ADD COLUMN IF NOT EXISTS target_duration_days INTEGER,
ADD COLUMN IF NOT EXISTS target_status VARCHAR(20) DEFAULT 'active' CHECK (target_status IN ('active', 'paused', 'completed')),
ADD COLUMN IF NOT EXISTS sales_order_target DECIMAL(12,2) DEFAULT 0 CHECK (sales_order_target >= 0),
ADD COLUMN IF NOT EXISTS achieved_sales_order_target DECIMAL(12,2) DEFAULT 0 CHECK (achieved_sales_order_target >= 0);

-- Create index for target_status if needed
CREATE INDEX IF NOT EXISTS idx_department_users_target_status ON department_users(target_status);

