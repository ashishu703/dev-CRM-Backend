/* Migration to handle existing sales_status indexes idempotently */
/* Ensures indexes exist without failing if they already do */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_leads_sales_status')
BEGIN
    CREATE INDEX idx_leads_sales_status ON leads(sales_status);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_dh_leads_sales_status')
BEGIN
    CREATE INDEX idx_dh_leads_sales_status ON department_head_leads(sales_status);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_sp_leads_sales_status')
BEGIN
    CREATE INDEX idx_sp_leads_sales_status ON salesperson_leads(sales_status);
END;
