

const { query } = require('../config/database');

async function createIndexes() {
  try {
    console.log('Creating database indexes...');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_salesperson_leads_assigned_salesperson 
      ON salesperson_leads(assigned_salesperson);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_salesperson_leads_dh_lead_id 
      ON salesperson_leads(dh_lead_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_salesperson_leads_sales_status 
      ON salesperson_leads(sales_status);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_salesperson_leads_follow_up_status 
      ON salesperson_leads(follow_up_status);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_salesperson_leads_created_at 
      ON salesperson_leads(created_at DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_dh_leads_created_by 
      ON department_head_leads(created_by);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_dh_leads_assigned_salesperson 
      ON department_head_leads(assigned_salesperson);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_dh_leads_sales_status 
      ON department_head_leads(sales_status);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_dh_leads_created_at 
      ON department_head_leads(created_at DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_quotations_customer_id 
      ON quotations(customer_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_quotations_status 
      ON quotations(status);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_quotations_created_at 
      ON quotations(created_at DESC);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_quotations_customer_status 
      ON quotations(customer_id, status);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_pi_quotation_id 
      ON proforma_invoices(quotation_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_pi_status 
      ON proforma_invoices(status);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_pi_created_at 
      ON proforma_invoices(created_at DESC);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_pi_quotation_status 
      ON proforma_invoices(quotation_id, status);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_payments_lead_id 
      ON payment_history(lead_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_payments_quotation_id 
      ON payment_history(quotation_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_payments_approval_status 
      ON payment_history(approval_status);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_payments_payment_date 
      ON payment_history(payment_date DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_sl_assigned_status 
      ON salesperson_leads(assigned_salesperson, sales_status);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_dhl_created_assigned 
      ON department_head_leads(created_by, assigned_salesperson);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_quotations_customer_created 
      ON quotations(customer_id, created_at DESC);
    `);

    console.log('✅ All indexes created successfully!');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

if (require.main === module) {
  createIndexes()
    .then(() => {
      console.log('Index creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Index creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createIndexes };

