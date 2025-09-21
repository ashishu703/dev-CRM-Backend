-- Department Head Leads: master records that DH manages and assigns
CREATE TABLE IF NOT EXISTS department_head_leads (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(32) UNIQUE,
  customer VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  business VARCHAR(255),
  lead_source VARCHAR(100),
  product_names TEXT,
  category VARCHAR(100),
  sales_status VARCHAR(20) DEFAULT 'PENDING' CHECK (sales_status IN ('PENDING','IN_PROGRESS','COMPLETED')),
  created DATE,
  assigned VARCHAR(255),
  telecaller VARCHAR(255),
  telecaller_status VARCHAR(20) DEFAULT 'INACTIVE' CHECK (telecaller_status IN ('ACTIVE','INACTIVE')),
  payment_status VARCHAR(20) DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING','IN_PROGRESS','COMPLETED')),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_dh_leads_customer ON department_head_leads(customer);
  CREATE INDEX IF NOT EXISTS idx_dh_leads_sales_status ON department_head_leads(sales_status);
EXCEPTION WHEN others THEN NULL; END $$;

-- trigger to maintain updated_at
CREATE OR REPLACE FUNCTION update_dh_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_dh_leads_updated_at ON department_head_leads;
  CREATE TRIGGER trg_dh_leads_updated_at
  BEFORE UPDATE ON department_head_leads
  FOR EACH ROW EXECUTE FUNCTION update_dh_leads_updated_at();
EXCEPTION WHEN others THEN NULL; END $$;


