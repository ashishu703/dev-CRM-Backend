const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('./middleware/compression');
const { cacheMiddleware } = require('./middleware/cache');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const departmentHeadRoutes = require('./routes/departmentHeads');
const departmentUserRoutes = require('./routes/departmentUsers');
const leadRoutes = require('./routes/leads');
const quotationRoutes = require('./routes/quotations');
const paymentRoutes = require('./routes/payments');
const proformaInvoiceRoutes = require('./routes/proformaInvoices');
const notificationRoutes = require('./routes/notifications');
const configurationRoutes = require('./routes/configuration');
const uploadRoutes = require('./routes/upload');
const ticketRoutes = require('./routes/tickets');
const securityLogRoutes = require('./routes/securityLogs');
const stockRoutes = require('./routes/stock');
const workOrderRoutes = require('./routes/workOrders');
const marketingRoutes = require('./routes/marketing');
const organizationRoutes = require('./routes/organizations');
const tradeIndiaRoutes = require('./routes/tradeIndia');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 4500;

// Security middleware - configure helmet to work with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - allow localhost for development and include production origins
const getAllowedOrigins = () => {
  const origins = [];
  
  // Always allow localhost origins for development
  origins.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173');
  
  // Add production origins if specified
  if (process.env.ALLOWED_ORIGINS) {
    const productionOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    origins.push(...productionOrigins);
  }
  
  // In development mode, allow all origins
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  
  // In production, use the specific origins list
  return origins.length > 0 ? origins : true;
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

// Apply CORS middleware - this handles both regular requests and preflight OPTIONS requests
app.use(cors(corsOptions));

// Explicitly handle OPTIONS preflight requests for all routes
app.options('*', cors(corsOptions));

// Rate limiting - increased limit for development to prevent IP blocking during testing
const isDevelopment = (process.env.NODE_ENV || 'development') !== 'production';
// Get trusted IPs from environment variable (comma-separated)
const trustedIps = process.env.TRUSTED_IPS ? process.env.TRUSTED_IPS.split(',').map(ip => ip.trim()) : [];
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  // Much higher limit for development (1000), normal limit for production (100)
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isDevelopment ? 1000 : 100),
  standardHeaders: true,
  legacyHeaders: false,
  // Skip limiting for OPTIONS requests (CORS preflight), local development, localhost IPs, and trusted IPs
  skip: (req) => {
    // Always skip OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      return true;
    }
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || '';
    const isLocalIp = 
      ip === '::1' || 
      ip === '127.0.0.1' || 
      ip === 'localhost' ||
      ip.startsWith('::ffff:127.0.0.1') ||
      ip.startsWith('127.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.');
    const isTrustedIp = trustedIps.some(trustedIp => ip === trustedIp || ip.includes(trustedIp));
    return isDevelopment || isLocalIp || isTrustedIp;
  },
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// OPTIMIZED: Response compression (reduces payload size by 70-90%)
app.use(compression);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// OPTIMIZED: Cache middleware for GET requests (reduces DB load)
app.use('/api/leads', cacheMiddleware(300)); // 5 minute cache
app.use('/api/quotations', cacheMiddleware(180)); // 3 minute cache
app.use('/api/proforma-invoices', cacheMiddleware(180)); // 3 minute cache

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Welcome page route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Database health check
app.get('/health/db', async (req, res) => {
  try {
    const start = Date.now();
    await db.query('SELECT 1');
    const ms = Date.now() - start;
    res.status(200).json({ status: 'OK', latencyMs: ms });
  } catch (err) {
    res.status(503).json({ status: 'DOWN', error: err?.message || 'Unknown error' });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
// Mount new department routes BEFORE general admin routes to avoid unintended authorization blocks
app.use('/api/admin/department-heads', departmentHeadRoutes);
app.use('/api/admin/department-users', departmentUserRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/proforma-invoices', proformaInvoiceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/configuration', configurationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/security-logs', securityLogRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/tradeindia', tradeIndiaRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize TradeIndia cron service (if enabled)
if (process.env.TRADEINDIA_CRON_ENABLED === 'true') {
  const tradeIndiaCronService = require('./services/tradeIndiaCronService');
  logger.info('TradeIndia cron service initialized');
}

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app; 