const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      if (file === '035_payments_credits_and_fks.sql') {
        // Run via JS to be portable
        logger.info('Running migration: 035_payments_credits_and_fks (JS)');
        await run035();
        logger.info('Completed migration: 035_payments_credits_and_fks (JS)');
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      logger.info(`Running migration: ${file}`);
      await query(sql);
      logger.info(`Completed migration: ${file}`);
    }

    logger.info('All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
}

async function run035() {
  // Create customer_credits
  await query(`
    CREATE TABLE IF NOT EXISTS customer_credits (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      balance DECIMAL(15,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_credits_customer ON customer_credits(customer_id)`);
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_customer_credits_customer'
      ) THEN
        ALTER TABLE customer_credits
          ADD CONSTRAINT fk_customer_credits_customer
          FOREIGN KEY (customer_id) REFERENCES leads(id) ON DELETE CASCADE;
      END IF;
    END $$;`);

  // Quotations: paid_amount
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='paid_amount'
      ) THEN
        ALTER TABLE quotations ADD COLUMN paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
      END IF;
    END $$;`);

  // Payments: extra columns
  await query(`ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS customer_id INTEGER`);
  await query(`ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS applied_amount DECIMAL(15,2)`);
  await query(`ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'payment'`);

  // Payments FKs
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_payments_lead') THEN
        ALTER TABLE payments ADD CONSTRAINT fk_payments_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
      END IF;
    END $$;`);
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_payments_quotation') THEN
        ALTER TABLE payments ADD CONSTRAINT fk_payments_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;
      END IF;
    END $$;`);
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_payments_customer') THEN
        ALTER TABLE payments ADD CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES leads(id) ON DELETE SET NULL;
      END IF;
    END $$;`);
}

runMigrations();



