-- Create RFP workflow tables and supporting columns

CREATE TABLE IF NOT EXISTS rfp_requests (
  id SERIAL PRIMARY KEY,
  rfp_id VARCHAR(50) UNIQUE,
  lead_id INTEGER NOT NULL,
  salesperson_id UUID,
  created_by VARCHAR(255) NOT NULL,
  department_type VARCHAR(100),
  company_name VARCHAR(255),
  product_spec TEXT NOT NULL,
  quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
  delivery_timeline VARCHAR(255),
  special_requirements TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_dh',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  rejected_by VARCHAR(255),
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  raw_material_price DECIMAL(15,2),
  processing_cost DECIMAL(15,2),
  margin DECIMAL(15,2),
  calculated_price DECIMAL(15,2),
  price_valid_until DATE,
  pricing_updated_by VARCHAR(255),
  pricing_updated_at TIMESTAMP,
  quotation_id UUID,
  quotation_number VARCHAR(50),
  pi_id UUID,
  payment_id INTEGER,
  accounts_approval_status VARCHAR(50) DEFAULT 'not_submitted',
  accounts_approved_by VARCHAR(255),
  accounts_approved_at TIMESTAMP,
  accounts_notes TEXT,
  senior_approval_status VARCHAR(50) DEFAULT 'not_required',
  senior_approved_by VARCHAR(255),
  senior_approved_at TIMESTAMP,
  senior_notes TEXT,
  work_order_id INTEGER,
  work_order_number VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfp_price_revisions (
  id SERIAL PRIMARY KEY,
  rfp_request_id INTEGER NOT NULL,
  raw_material_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  processing_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  margin DECIMAL(15,2) NOT NULL DEFAULT 0,
  calculated_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  validity_date DATE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_rfp_price_revision_request
    FOREIGN KEY (rfp_request_id) REFERENCES rfp_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rfp_audit_logs (
  id SERIAL PRIMARY KEY,
  rfp_request_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  performed_by_role VARCHAR(50),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_rfp_audit_request
    FOREIGN KEY (rfp_request_id) REFERENCES rfp_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rfp_requests_status ON rfp_requests(status);
CREATE INDEX IF NOT EXISTS idx_rfp_requests_lead_id ON rfp_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_rfp_requests_created_by ON rfp_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_rfp_requests_company ON rfp_requests(company_name);
CREATE INDEX IF NOT EXISTS idx_rfp_requests_department ON rfp_requests(department_type);
CREATE INDEX IF NOT EXISTS idx_rfp_price_request ON rfp_price_revisions(rfp_request_id);
CREATE INDEX IF NOT EXISTS idx_rfp_audit_request ON rfp_audit_logs(rfp_request_id);

-- Add RFP references to quotations
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS rfp_request_id INTEGER,
ADD COLUMN IF NOT EXISTS rfp_id VARCHAR(50);

-- Add RFP references and operations fields to work orders
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS rfp_request_id INTEGER,
ADD COLUMN IF NOT EXISTS rfp_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS sent_to_operations_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS operations_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS operations_acknowledged_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS expected_order_creation_date DATE,
ADD COLUMN IF NOT EXISTS operations_cancelled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS operations_cancelled_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS operations_cancel_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_work_orders_operations_status ON work_orders(operations_status);
CREATE INDEX IF NOT EXISTS idx_work_orders_rfp_request_id ON work_orders(rfp_request_id);
CREATE INDEX IF NOT EXISTS idx_quotations_rfp_request_id ON quotations(rfp_request_id);

-- Trigger to keep updated_at in sync for rfp_requests
CREATE OR REPLACE FUNCTION update_rfp_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rfp_requests_updated_at ON rfp_requests;
CREATE TRIGGER trg_rfp_requests_updated_at
BEFORE UPDATE ON rfp_requests
FOR EACH ROW EXECUTE FUNCTION update_rfp_requests_updated_at();
