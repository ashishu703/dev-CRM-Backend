-- Revised PI workflow: revision_no for audit trail; approved PI remains read-only
-- revision_no: 1 = original or first revised; 2+ = subsequent revisions from same parent
ALTER TABLE proforma_invoices
  ADD COLUMN IF NOT EXISTS revision_no INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_proforma_invoices_revision_no ON proforma_invoices(parent_pi_id, revision_no);

COMMENT ON COLUMN proforma_invoices.revision_no IS 'Revision number: 1 for original or first revised PI; incremented for same parent_pi_id';
