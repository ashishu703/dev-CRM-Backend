-- Add lead transfer tracking fields to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS transferred_from VARCHAR(255),
ADD COLUMN IF NOT EXISTS transferred_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS transfer_reason TEXT;

-- Add indexes for better performance
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_transferred_from ON leads(transferred_from);
  CREATE INDEX IF NOT EXISTS idx_leads_transferred_to ON leads(transferred_to);
  CREATE INDEX IF NOT EXISTS idx_leads_transferred_at ON leads(transferred_at);
EXCEPTION WHEN others THEN NULL; END $$;
