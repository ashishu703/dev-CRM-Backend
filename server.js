const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
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
const organizationRoutes = require('./routes/organizations');
const tradeIndiaRoutes = require('./routes/tradeIndia');

const app = express();
const PORT = process.env.PORT || 4500;

// Security middleware
app.use(helmet());

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? (process.env.ALLOWED_ORIGINS?.split(',') || []) : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Handle CORS preflight requests explicitly
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
  // Skip limiting for local development, localhost IPs, and trusted IPs
  skip: (req) => {
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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/organizations', organizationRoutes);
app.use('/api/tradeindia', tradeIndiaRoutes);
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