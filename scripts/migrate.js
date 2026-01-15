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

    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const alreadyApplied = await query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [file]
      );

      if (alreadyApplied.rows.length > 0) {
        logger.info(`Skipping already applied migration: ${file}`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);

      logger.info(`Running migration: ${file}`);

      await query('BEGIN');
      try {
        if (file === '035_payments_credits_and_fks.sql') {
          logger.info('Executing 035_payments_credits_and_fks via JS helper');
          await run035();
        } else {
          const sql = fs.readFileSync(filePath, 'utf8');
          await query(sql);
        }

        await query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
          [file]
        );

        await query('COMMIT');
        logger.info(`Completed migration: ${file}`);
      } catch (err) {
        await query('ROLLBACK');
        logger.error(`Migration failed for ${file}`, err);
        throw err;
      }
    }

    logger.info('All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
}

async function run035() {
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

  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='paid_amount'
      ) THEN
        ALTER TABLE quotations ADD COLUMN paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
      END IF;
    END $$;`);

  await query(`ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS customer_id INTEGER`);
  await query(`ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS applied_amount DECIMAL(15,2)`);
  await query(`ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'payment'`);

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



