-- Restore all fields to department_head_leads table
-- Add back all the fields that were removed

-- Add back all the missing fields
ALTER TABLE department_head_leads 
ADD COLUMN IF NOT EXISTS product_names TEXT,
ADD COLUMN IF NOT EXISTS created DATE,
ADD COLUMN IF NOT EXISTS assigned VARCHAR(255),
ADD COLUMN IF NOT EXISTS telecaller VARCHAR(255),
ADD COLUMN IF NOT EXISTS telecaller_status VARCHAR(20) DEFAULT 'INACTIVE' CHECK (telecaller_status IN ('ACTIVE', 'INACTIVE')),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS product_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS date DATE,
ADD COLUMN IF NOT EXISTS connected_status VARCHAR(20) DEFAULT 'pending' CHECK (connected_status IN ('connected', 'not_connected', 'pending')),
ADD COLUMN IF NOT EXISTS final_status VARCHAR(20) DEFAULT 'open' CHECK (final_status IN ('open', 'closed', 'next_meeting')),
ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
ADD COLUMN IF NOT EXISTS assigned_salesperson VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_telecaller VARCHAR(255);

-- Also add phone column if it doesn't exist
ALTER TABLE department_head_leads 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Update existing rows with default values for new fields
UPDATE department_head_leads 
SET 
  product_names = 'N/A',
  created = CURRENT_DATE,
  assigned = 'Unassigned',
  telecaller = 'N/A',
  telecaller_status = 'INACTIVE',
  payment_status = 'PENDING',
  address = 'N/A',
  product_type = 'N/A',
  state = 'N/A',
  customer_type = 'business',
  date = CURRENT_DATE,
  connected_status = 'pending',
  final_status = 'open',
  whatsapp = phone,
  assigned_salesperson = 'Unassigned',
  assigned_telecaller = 'Unassigned'
WHERE 
  product_names IS NULL OR 
  assigned IS NULL OR 
  telecaller IS NULL OR 
  telecaller_status IS NULL OR 
  payment_status IS NULL OR 
  address IS NULL OR 
  product_type IS NULL OR 
  state IS NULL OR 
  customer_type IS NULL OR 
  date IS NULL OR 
  connected_status IS NULL OR 
  final_status IS NULL OR 
  whatsapp IS NULL OR 
  assigned_salesperson IS NULL OR 
  assigned_telecaller IS NULL;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_dh_leads_product_names ON department_head_leads(product_names);
CREATE INDEX IF NOT EXISTS idx_dh_leads_created ON department_head_leads(created);
CREATE INDEX IF NOT EXISTS idx_dh_leads_assigned ON department_head_leads(assigned);
CREATE INDEX IF NOT EXISTS idx_dh_leads_telecaller ON department_head_leads(telecaller);
CREATE INDEX IF NOT EXISTS idx_dh_leads_telecaller_status ON department_head_leads(telecaller_status);
CREATE INDEX IF NOT EXISTS idx_dh_leads_payment_status ON department_head_leads(payment_status);
CREATE INDEX IF NOT EXISTS idx_dh_leads_address ON department_head_leads(address);
CREATE INDEX IF NOT EXISTS idx_dh_leads_product_type ON department_head_leads(product_type);
CREATE INDEX IF NOT EXISTS idx_dh_leads_state ON department_head_leads(state);
CREATE INDEX IF NOT EXISTS idx_dh_leads_customer_type ON department_head_leads(customer_type);
CREATE INDEX IF NOT EXISTS idx_dh_leads_date ON department_head_leads(date);
CREATE INDEX IF NOT EXISTS idx_dh_leads_connected_status ON department_head_leads(connected_status);
CREATE INDEX IF NOT EXISTS idx_dh_leads_final_status ON department_head_leads(final_status);
CREATE INDEX IF NOT EXISTS idx_dh_leads_whatsapp ON department_head_leads(whatsapp);
CREATE INDEX IF NOT EXISTS idx_dh_leads_assigned_salesperson ON department_head_leads(assigned_salesperson);
CREATE INDEX IF NOT EXISTS idx_dh_leads_assigned_telecaller ON department_head_leads(assigned_telecaller);
