const express = require('express');
const router = express.Router();
const tradeIndiaController = require('../controllers/tradeIndiaController');
const { protect } = require('../middleware/auth');

// Webhook endpoint - NO authentication required (TradeIndia will call this)
router.post('/webhook/tradeindia', tradeIndiaController.handleWebhook);

// Manual fetch endpoint - requires authentication
router.get('/fetch-leads', protect, tradeIndiaController.fetchLeads);

// Status endpoint - requires authentication
router.get('/status', protect, tradeIndiaController.getStatus);

module.exports = router;

