-- Store per-product calculator detail (length, base rate, total, etc.) for RFP Approval display
ALTER TABLE rfp_request_products
ADD COLUMN IF NOT EXISTS calculator_log JSONB;

COMMENT ON COLUMN rfp_request_products.calculator_log IS 'Calculator detail for this product: family, length, rateType, basePerUnit, baseTotal, totalPrice, extraCharges, etc.';
