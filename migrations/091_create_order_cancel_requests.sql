-- Order cancel requests: salesperson requests order cancel, department head approves/rejects
CREATE TABLE IF NOT EXISTS order_cancel_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_cancel_quotation ON order_cancel_requests(quotation_id);
CREATE INDEX IF NOT EXISTS idx_order_cancel_customer ON order_cancel_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_cancel_status ON order_cancel_requests(status);
CREATE INDEX IF NOT EXISTS idx_order_cancel_created ON order_cancel_requests(created_at DESC);

COMMENT ON TABLE order_cancel_requests IS 'Salesperson requests to cancel order; department head approves or rejects';
