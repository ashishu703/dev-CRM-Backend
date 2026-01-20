-- Create Pricing & RFP Decision table
CREATE TABLE IF NOT EXISTS pricing_rfp_decisions (
  id SERIAL PRIMARY KEY,
  rfp_id VARCHAR(50) UNIQUE NOT NULL,
  lead_id INTEGER NOT NULL,
  salesperson_id UUID,
  created_by VARCHAR(255) NOT NULL,
  department_type VARCHAR(100),
  company_name VARCHAR(255),
  products JSONB NOT NULL,
  delivery_timeline DATE,
  special_requirements TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  rfp_created BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on rfp_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_pricing_rfp_decisions_rfp_id ON pricing_rfp_decisions(rfp_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rfp_decisions_lead_id ON pricing_rfp_decisions(lead_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rfp_decisions_status ON pricing_rfp_decisions(status);
