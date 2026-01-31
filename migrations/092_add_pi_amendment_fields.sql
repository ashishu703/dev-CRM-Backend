-- Revised PI (amendment) workflow: product cancellation after PI approval
-- parent_pi_id = original approved PI; amendment_detail = which lines removed/reduced
ALTER TABLE proforma_invoices
  ADD COLUMN IF NOT EXISTS parent_pi_id UUID,
  ADD COLUMN IF NOT EXISTS amendment_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS amendment_detail JSONB;

CREATE INDEX IF NOT EXISTS idx_proforma_invoices_parent_pi ON proforma_invoices(parent_pi_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_amendment_type ON proforma_invoices(amendment_type);

COMMENT ON COLUMN proforma_invoices.parent_pi_id IS 'Original PI when this is a revised/amended PI';
COMMENT ON COLUMN proforma_invoices.amendment_type IS 'e.g. product_cancellation';
COMMENT ON COLUMN proforma_invoices.amendment_detail IS 'JSON: removed_item_ids[], reduced_items[{quotation_item_id, quantity}]';
