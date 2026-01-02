-- Monthly targets history table (SuperAdmin -> DepartmentHead, DepartmentHead -> DepartmentUser)
CREATE TABLE IF NOT EXISTS monthly_targets (
  id SERIAL PRIMARY KEY,
  month DATE NOT NULL, -- normalized to first day of month (YYYY-MM-01)

  assignee_role VARCHAR(50) NOT NULL CHECK (assignee_role IN ('department_head', 'department_user')),
  assignee_id UUID NOT NULL,
  assignee_email VARCHAR(255),

  assigner_role VARCHAR(50) NOT NULL CHECK (assigner_role IN ('superadmin', 'department_head')),
  assigner_id UUID,
  assigner_email VARCHAR(255),

  company_name VARCHAR(255),
  department_type VARCHAR(100),

  target_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One target per assignee per month
CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_targets_assignee_month
  ON monthly_targets(assignee_role, assignee_id, month);

CREATE INDEX IF NOT EXISTS idx_monthly_targets_month ON monthly_targets(month);
CREATE INDEX IF NOT EXISTS idx_monthly_targets_company_dept ON monthly_targets(company_name, department_type);

COMMENT ON TABLE monthly_targets IS 'Stores month-wise targets with history across months';


