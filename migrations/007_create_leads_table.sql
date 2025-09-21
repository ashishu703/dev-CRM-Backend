-- Create leads table for storing customer/lead information (PostgreSQL)
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
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
    connected_status VARCHAR(20) DEFAULT 'pending' CHECK (connected_status IN ('connected', 'not_connected', 'pending')),
    final_status VARCHAR(20) DEFAULT 'open' CHECK (final_status IN ('open', 'closed', 'next_meeting')),
    whatsapp VARCHAR(20),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
  CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
  CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);
  CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);
  CREATE INDEX IF NOT EXISTS idx_leads_product_type ON leads(product_type);
  CREATE INDEX IF NOT EXISTS idx_leads_connected_status ON leads(connected_status);
  CREATE INDEX IF NOT EXISTS idx_leads_final_status ON leads(final_status);
  CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
EXCEPTION WHEN others THEN NULL; END $$;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
