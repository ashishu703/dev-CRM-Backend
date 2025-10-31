-- Add dispatch/shipping fields to proforma_invoices table
-- These fields store the dispatch details for the PI

ALTER TABLE proforma_invoices
ADD COLUMN IF NOT EXISTS dispatch_mode VARCHAR(50),
ADD COLUMN IF NOT EXISTS transport_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS transport_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS lr_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS courier_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS consignment_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS by_hand VARCHAR(255),
ADD COLUMN IF NOT EXISTS post_service VARCHAR(255),
ADD COLUMN IF NOT EXISTS carrier_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS carrier_number VARCHAR(100);

-- Add comment to explain the fields
COMMENT ON COLUMN proforma_invoices.dispatch_mode IS 'Mode of dispatch: BY TRANSPORT, BY COURIER, BY HAND, BY POST, BY TRAIN, BY BUS';
COMMENT ON COLUMN proforma_invoices.transport_name IS 'Name of transport company (for BY TRANSPORT)';
COMMENT ON COLUMN proforma_invoices.vehicle_number IS 'Vehicle registration number (for BY TRANSPORT)';
COMMENT ON COLUMN proforma_invoices.transport_id IS 'Transport company ID (for BY TRANSPORT)';
COMMENT ON COLUMN proforma_invoices.lr_no IS 'Lorry Receipt Number (for BY TRANSPORT)';
COMMENT ON COLUMN proforma_invoices.courier_name IS 'Name of courier service (for BY COURIER)';
COMMENT ON COLUMN proforma_invoices.consignment_no IS 'Consignment tracking number (for BY COURIER)';
COMMENT ON COLUMN proforma_invoices.by_hand IS 'Person name who received by hand (for BY HAND)';
COMMENT ON COLUMN proforma_invoices.post_service IS 'Postal service details (for BY POST)';
COMMENT ON COLUMN proforma_invoices.carrier_name IS 'Train/Bus carrier name (for BY TRAIN/BY BUS)';
COMMENT ON COLUMN proforma_invoices.carrier_number IS 'Train/Bus number (for BY TRAIN/BY BUS)';

