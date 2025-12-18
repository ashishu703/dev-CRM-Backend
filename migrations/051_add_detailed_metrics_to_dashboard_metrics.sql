-- ============================================================================
-- Add Detailed Metrics Columns to dashboard_metrics Table
-- ============================================================================
-- This migration adds detailed lead status columns, PI metrics, and advance payment
-- to support comprehensive dashboard data in a single table
-- Migration: 051_add_detailed_metrics_to_dashboard_metrics.sql
-- ============================================================================

-- Add detailed lead status columns
ALTER TABLE dashboard_metrics
ADD COLUMN IF NOT EXISTS pending_leads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS running_leads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS interested_leads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS win_closed_leads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lost_leads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS meeting_scheduled INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quotation_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS closed_lost_followup INTEGER DEFAULT 0;

-- Add PI metrics columns
ALTER TABLE dashboard_metrics
ADD COLUMN IF NOT EXISTS total_pis INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS approved_pis INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_pis INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rejected_pis INTEGER DEFAULT 0;

-- Add payment detail columns
ALTER TABLE dashboard_metrics
ADD COLUMN IF NOT EXISTS advance_payments DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_quotations INTEGER DEFAULT 0;

-- Update constraints to include new columns
ALTER TABLE dashboard_metrics
DROP CONSTRAINT IF EXISTS chk_non_negative_leads;

ALTER TABLE dashboard_metrics
ADD CONSTRAINT chk_non_negative_leads CHECK (
    total_leads >= 0 AND
    open_leads >= 0 AND
    closed_leads >= 0 AND
    converted_leads >= 0 AND
    pending_leads >= 0 AND
    running_leads >= 0 AND
    interested_leads >= 0 AND
    win_closed_leads >= 0 AND
    lost_leads >= 0
);

ALTER TABLE dashboard_metrics
DROP CONSTRAINT IF EXISTS chk_non_negative_counts;

ALTER TABLE dashboard_metrics
ADD CONSTRAINT chk_non_negative_counts CHECK (
    total_quotations >= 0 AND
    approved_quotations >= 0 AND
    rejected_quotations >= 0 AND
    pending_quotations >= 0 AND
    total_followups >= 0 AND
    pending_followups >= 0 AND
    completed_followups >= 0 AND
    total_orders >= 0 AND
    total_pis >= 0 AND
    approved_pis >= 0 AND
    pending_pis >= 0 AND
    rejected_pis >= 0 AND
    meeting_scheduled >= 0 AND
    quotation_sent >= 0 AND
    closed_lost_followup >= 0
);

-- Add comments for documentation
COMMENT ON COLUMN dashboard_metrics.pending_leads IS 'Leads with status = pending';
COMMENT ON COLUMN dashboard_metrics.running_leads IS 'Leads with status = running';
COMMENT ON COLUMN dashboard_metrics.interested_leads IS 'Leads with status = interested';
COMMENT ON COLUMN dashboard_metrics.win_closed_leads IS 'Leads with status = win/closed';
COMMENT ON COLUMN dashboard_metrics.lost_leads IS 'Leads with status = lost';
COMMENT ON COLUMN dashboard_metrics.meeting_scheduled IS 'Leads with follow_up_status = appointment scheduled';
COMMENT ON COLUMN dashboard_metrics.quotation_sent IS 'Leads with follow_up_status = quotation sent';
COMMENT ON COLUMN dashboard_metrics.closed_lost_followup IS 'Leads with follow_up_status = closed/lost';
COMMENT ON COLUMN dashboard_metrics.total_pis IS 'Total number of Proforma Invoices';
COMMENT ON COLUMN dashboard_metrics.approved_pis IS 'Number of approved PIs';
COMMENT ON COLUMN dashboard_metrics.pending_pis IS 'Number of pending PIs';
COMMENT ON COLUMN dashboard_metrics.rejected_pis IS 'Number of rejected PIs';
COMMENT ON COLUMN dashboard_metrics.advance_payments IS 'Total advance payments received';
COMMENT ON COLUMN dashboard_metrics.pending_quotations IS 'Number of pending quotations';

