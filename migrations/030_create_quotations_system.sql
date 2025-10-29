-- Create quotations system with versioning and approval workflow
-- This migration creates the complete quotation-to-payment workflow

-- Skip this migration if tables already exist
-- The tables are already present in the database
-- This migration is kept for reference but will be skipped

-- Note: The following tables should already exist:
-- quotations, quotation_items, quotation_approval_logs
-- quotation_sent_logs, proforma_invoices, payments

-- Create tables if they don't exist (these will be created by the system)
-- CREATE TABLE quotations (...);
-- CREATE TABLE quotation_items (...);
-- CREATE TABLE quotation_approval_logs (...);
-- CREATE TABLE quotation_sent_logs (...);
-- CREATE TABLE proforma_invoices (...);
-- CREATE TABLE payments (...);

-- Add foreign key constraints if they don't exist (these will be created by the system)
-- ALTER TABLE quotations ADD CONSTRAINT fk_quotations_customer ...;
-- ALTER TABLE quotations ADD CONSTRAINT fk_quotations_salesperson ...;
-- etc.

-- Create indexes if they don't exist (these will be created by the system)
-- CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
-- CREATE INDEX idx_quotations_salesperson_id ON quotations(salesperson_id);
-- etc.