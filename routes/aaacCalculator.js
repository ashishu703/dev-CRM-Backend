const express = require('express');
const router = express.Router();
const aaacCalculatorController = require('../controllers/aaacCalculatorController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Get current variable prices
router.get('/prices', aaacCalculatorController.getCurrentPrices);

// Get all daily price history
router.get('/prices/history', aaacCalculatorController.getPriceHistory);

// Download price history as CSV
router.get('/prices/download/csv', aaacCalculatorController.downloadPriceHistory);

// Update variable prices (Account department only)
// NOTE: All calculations are now done on frontend using constants
// Backend only handles price broadcasting via Socket.io
router.put('/prices', aaacCalculatorController.updatePrices);

module.exports = router;
