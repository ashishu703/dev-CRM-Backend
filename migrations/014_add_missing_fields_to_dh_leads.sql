-- Add missing fields to department_head_leads table
ALTER TABLE department_head_leads 
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS gst_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS connected_status VARCHAR(20) DEFAULT 'pending' CHECK (connected_status IN ('connected', 'not_connected', 'pending')),
  ADD COLUMN IF NOT EXISTS final_status VARCHAR(20) DEFAULT 'open' CHECK (final_status IN ('open', 'closed', 'next_meeting')),
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
  ADD COLUMN IF NOT EXISTS assigned_salesperson VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assigned_telecaller VARCHAR(255);

-- Remove NOT NULL constraints to make all fields optional
ALTER TABLE department_head_leads 
  ALTER COLUMN customer_id DROP NOT NULL,
  ALTER COLUMN customer DROP NOT NULL;

-- Create indexes for new fields
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_dh_leads_phone ON department_head_leads(phone);
  CREATE INDEX IF NOT EXISTS idx_dh_leads_state ON department_head_leads(state);
  CREATE INDEX IF NOT EXISTS idx_dh_leads_customer_type ON department_head_leads(customer_type);
  CREATE INDEX IF NOT EXISTS idx_dh_leads_connected_status ON department_head_leads(connected_status);
  CREATE INDEX IF NOT EXISTS idx_dh_leads_final_status ON department_head_leads(final_status);
  CREATE INDEX IF NOT EXISTS idx_dh_leads_assigned_salesperson ON department_head_leads(assigned_salesperson);
  CREATE INDEX IF NOT EXISTS idx_dh_leads_assigned_telecaller ON department_head_leads(assigned_telecaller);
EXCEPTION WHEN others THEN NULL; END $$;
