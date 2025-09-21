const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');

async function runMigration() {
  try {
    logger.info('Starting migration process...');

    // This script is legacy. No-op to avoid running outdated migrations.
    logger.info('No-op: legacy migration script disabled. Use scripts/migrate.js for current migrations.');

    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
