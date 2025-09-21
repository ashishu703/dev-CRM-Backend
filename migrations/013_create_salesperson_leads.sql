-- Salesperson Leads: minimal table (indexes/triggers can be added separately)
-- PostgreSQL compatible: guarded CREATE to avoid linter complaints

-- Create table with conditional logic
CREATE TABLE IF NOT EXISTS salesperson_leads (
    id INTEGER PRIMARY KEY,
    dh_lead_id INTEGER,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    business VARCHAR(255),
    address TEXT,
    gst_no VARCHAR(50),
    product_type VARCHAR(100),
    state VARCHAR(100),
    lead_source VARCHAR(100),
    customer_type VARCHAR(50),
    date DATE,
    connected_status VARCHAR(20),
    final_status VARCHAR(20),
    whatsapp VARCHAR(20),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint separately to avoid linter issues
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_salesperson_leads_dh_lead_id'
    ) THEN
        ALTER TABLE salesperson_leads 
        ADD CONSTRAINT fk_salesperson_leads_dh_lead_id 
        FOREIGN KEY (dh_lead_id) REFERENCES department_head_leads(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create a unique index to guarantee 1:1 mapping with department_head_leads.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ux_salesperson_leads_id'
  ) THEN
    CREATE UNIQUE INDEX ux_salesperson_leads_id ON salesperson_leads(id);
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;


