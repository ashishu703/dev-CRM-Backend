
/* Add sales_status column to leads table if it doesn't exist */
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'sales_status')
BEGIN
    ALTER TABLE leads ADD sales_status VARCHAR(20) DEFAULT 'PENDING';
END;

/* Add sales_status column to salesperson_leads table if it doesn't exist */
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salesperson_leads' AND column_name = 'sales_status')
BEGIN
    ALTER TABLE salesperson_leads ADD sales_status VARCHAR(20) DEFAULT 'PENDING';
END;

/* Create indexes for performance */
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
