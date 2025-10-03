const { Pool } = require('pg');
const logger = require('../utils/logger');

require('dotenv').config();

const sslRequired = process.env.DB_SSL === 'require' || process.env.DB_SSL === 'true';
const useConnectionString = !!process.env.DATABASE_URL;

const baseConfig = useConnectionString
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: sslRequired ? { rejectUnauthorized: false } : false
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'automatic_review_system',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || undefined,
    ssl: sslRequired ? { rejectUnauthorized: false } : false
  };

const pool = new Pool({
  ...baseConfig,
  max: 20,
  idleTimeoutMillis: 60000, // keep clients around a bit longer
  connectionTimeoutMillis: 20000, // allow more time to establish remote TLS connections
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 60000,
  query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS) || 60000
});

// Test the connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  // Do NOT crash the process on idle client errors. These can happen due to
  // transient network issues (e.g., EADDRNOTAVAIL during read). Log them and
  // allow the pool to recover.
  logger.error('Unexpected error on idle client', err);
  if (err && err.code === 'EADDRNOTAVAIL') {
    // Network address not available: often transient. Let pg reconnect.
    return;
  }
  // For other errors, still avoid exiting; rely on pg-pool to manage clients.
});

// Helper function to run queries
const isTransientDbError = (err) => {
  if (!err) return false;
  const code = err.code || '';
  const msg = String(err.message || '').toLowerCase();
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'EADDRNOTAVAIL' ||
    msg.includes('connection terminated due to connection timeout') ||
    msg.includes('terminating connection due to administrator command')
  );
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const query = async (text, params) => {
  const maxRetries = 3;
  const start = Date.now();
  let attempt = 0;
  while (true) {
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      attempt += 1;
      const transient = isTransientDbError(error);
      logger.error('Database query error', { text, error: error.message, attempt, transient });
      if (!transient || attempt >= maxRetries) {
        throw error;
      }
      const backoff = 300 * attempt;
      await delay(backoff);
      // retry
    }
  }
};

// Helper function to get a client for transactions
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    logger.error('A client has been checked out for more than 5 seconds!');
    logger.error(`The last executed query on this client was: ${client.lastQuery}`);
  }, 5000);
  
  client.query = (...args) => {
    client.lastQuery = args;
    return query(...args);
  };
  
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release();
  };
  
  return client;
};

module.exports = {
  query,
  getClient,
  pool
};
