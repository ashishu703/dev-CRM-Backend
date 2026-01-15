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
  max: 50, 
  min: 5, 
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000, 
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 60000,
  query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS) || 60000,
  allowExitOnIdle: false 
});

let errorCount = 0;
let lastErrorTime = 0;
const ERROR_LOG_THROTTLE_MS = 60000;

pool.on('connect', () => {
});

pool.on('error', (err) => {
  const errorMsg = err?.message || '';
  const isConnectionError = errorMsg.includes('Connection terminated') || 
                           errorMsg.includes('connection terminated unexpectedly') ||
                           err?.code === 'EADDRNOTAVAIL' ||
                           err?.code === 'ECONNRESET';
    
  if (isConnectionError) {
    const now = Date.now();
    if (now - lastErrorTime > ERROR_LOG_THROTTLE_MS) {
      errorCount = 0;
      lastErrorTime = now;
    }
    errorCount++;
    
    if (errorCount > 5) {
      logger.debug('Connection error on idle client (pool will auto-reconnect)', { 
        code: err?.code, 
        message: errorMsg,
        errorCount 
      });
    }
    return;
  }
  
  logger.error('Unexpected error on idle client', err);
});

const isTransientDbError = (err) => {
  if (!err) return false;
  const code = err.code || '';
  const msg = String(err.message || '').toLowerCase();
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'EADDRNOTAVAIL' ||
    msg.includes('connection terminated') ||
    msg.includes('connection terminated due to connection timeout') ||
    msg.includes('terminating connection due to administrator command') ||
    msg.includes('connection terminated unexpectedly') ||
    code === '57P01' || 
    code === '57P02' || 
    code === '57P03'    
  );
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const checkPoolHealth = async () => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.debug('Pool health check failed', { error: error.message });
    return false;
  }
};

if (typeof setInterval !== 'undefined') {
  setInterval(async () => {
    const isHealthy = await checkPoolHealth();
    if (!isHealthy) {
      logger.debug('Pool health check indicates connection issues, pool will auto-recover');
    }
  }, 5 * 60 * 1000);
}

const query = async (text, params) => {
  const maxRetries = 5; 
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
      
      if (!transient || attempt >= maxRetries) {
        logger.error('Database query error', { 
          text: text.substring(0, 100),
          error: error.message, 
          attempt, 
          transient 
        });
        throw error;
      }
      
      if (attempt === 1) {
        logger.debug('Transient database error, retrying', { 
          error: error.message, 
          attempt 
        });
      }
      
      const backoff = Math.min(100 * Math.pow(2, attempt - 1) + Math.random() * 100, 2000);
      await delay(backoff);
    }
  }
};

const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
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

const gracefulShutdown = async () => {
  try {
    logger.info('Closing database pool...');
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool', error);
  }
};

if (typeof process !== 'undefined') {
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    gracefulShutdown().then(() => process.exit(1));
  });
}

module.exports = {
  query,
  getClient,
  pool,
  gracefulShutdown
};
