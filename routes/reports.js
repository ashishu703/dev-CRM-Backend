const express = require('express');
const router = express.Router();
const SalespersonReportController = require('../controllers/salespersonReportController');
const OrdersReportController = require('../controllers/ordersReportController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

/**
 * Salesperson Reports Routes
 */

// Get Activity Report for a salesperson
router.get('/salesperson/activity/:salespersonUsername', 
  SalespersonReportController.getActivityReport.bind(SalespersonReportController)
);

// Get Performance Report for a salesperson
router.get('/salesperson/performance/:salespersonUsername', 
  SalespersonReportController.getPerformanceReport.bind(SalespersonReportController)
);

// Get Top Performer Comparison Report
router.get('/salesperson/top-performers', 
  SalespersonReportController.getTopPerformerComparison.bind(SalespersonReportController)
);

// Get Salespersons List
router.get('/salesperson/list', 
  SalespersonReportController.getSalespersonsList.bind(SalespersonReportController)
);

/**
 * Orders Reports Routes
 */

// Get Orders Report
router.get('/orders', OrdersReportController.getOrdersReport.bind(OrdersReportController));

// Get Salespersons with Orders
router.get('/orders/salespersons', OrdersReportController.getSalespersonsWithOrders.bind(OrdersReportController));

module.exports = router;

