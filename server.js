const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');                 // 🔧 FIX
const { Server } = require('socket.io');      // 🔧 FIX
const compression = require('./middleware/compression');
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
const inventoryRoutes = require('./routes/inventory');
const workOrderRoutes = require('./routes/workOrders');
const rfpRoutes = require('./routes/rfps');
const pricingRfpDecisionRoutes = require('./routes/pricingRfpDecisions');
const salesOrderRoutes = require('./routes/salesOrders');
const organizationRoutes = require('./routes/organizations');
const tradeIndiaRoutes = require('./routes/tradeIndia');
const reportsRoutes = require('./routes/reports');
const notificationService = require('./services/notificationService');
const productPriceRoutes = require('./routes/productPrices');
const aaacCalculatorRoutes = require('./routes/aaacCalculator');
const rawMaterialRoutes = require('./routes/rawMaterials');

const app = express();
const PORT = process.env.PORT || 4500;

/* =====================================================
   CREATE HTTP SERVER EARLY 
===================================================== */
const server = http.createServer(app);

/* =====================================================
   TRUST PROXY (NGINX)
===================================================== */
app.set('trust proxy', 1);

/* =====================================================
   SECURITY
===================================================== */
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

/* =====================================================
                 CORS
===================================================== */
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV !== 'production') return true;

  return [
    'https://anocabapp.com',
    'https://www.anocabapp.com'
  ];
};

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true
}));

app.options('*', cors());

/* =====================================================
   RATE LIMIT
===================================================== */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.method === 'OPTIONS'
});
app.use('/api/', limiter);

/* =====================================================
   MIDDLEWARES
===================================================== */
app.use(compression);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =====================================================
   HEALTH
===================================================== */
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

/* =====================================================
   API ROUTES
===================================================== */
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
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
app.use('/api/inventory', inventoryRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/rfps', rfpRoutes);
app.use('/api/pricing-rfp-decisions', pricingRfpDecisionRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/tradeindia', tradeIndiaRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notification', require('./routes/pushNotifications'));
app.use('/api/prices', productPriceRoutes);
app.use('/api/aaac-calculator', aaacCalculatorRoutes);
app.use('/api/raw-materials', rawMaterialRoutes);
app.use('/api/admin', adminRoutes);

/* =====================================================
   404
===================================================== */
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.use(errorHandler);

/* =====================================================
   🔧 FIX 2: SOCKET.IO SIMPLE + STABLE CONFIG
===================================================== */
const io = new Server(server, {
  path: '/socket.io',
  transports: ['websocket'],
  cors: {
    origin: [
      'https://anocabapp.com',
      'https://www.anocabapp.com'
    ],
    credentials: true
  }
});

// Attach io to app for access in routes
app.set('io', io);

/* =====================================================
   SOCKET AUTH
===================================================== */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));

    const jwt = require('jsonwebtoken');
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

/* =====================================================
   SOCKET EVENTS
===================================================== */
io.on('connection', (socket) => {
  const email = socket.user?.email?.toLowerCase();
  if (email) {
    socket.join(`user:${email}`);
    logger.info(`✅ Socket connected: ${email}`);
  }

  socket.on('disconnect', () => {
    logger.info(`❌ Socket disconnected: ${email}`);
  });
});

notificationService.initialize(io);

/* =====================================================
   START SERVER
===================================================== */
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`Socket.IO enabled`);
});

/* =====================================================
   SHUTDOWN
===================================================== */
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = app;
