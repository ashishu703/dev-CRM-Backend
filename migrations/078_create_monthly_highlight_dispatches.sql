-- Track monthly highlight notifications dispatch (idempotency)
CREATE TABLE IF NOT EXISTS monthly_highlight_dispatches (
  id SERIAL PRIMARY KEY,
  month DATE NOT NULL, -- YYYY-MM-01
  department_type VARCHAR(50) NOT NULL,
  kind VARCHAR(50) NOT NULL, -- e.g. 'monthly_highlights'
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month, department_type, kind)
);

CREATE INDEX IF NOT EXISTS idx_monthly_highlight_dispatches_month
  ON monthly_highlight_dispatches(month);



