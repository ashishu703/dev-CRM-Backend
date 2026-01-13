const express = require('express');
const router = express.Router();
const tradeIndiaController = require('../controllers/tradeIndiaController');
const { protect } = require('../middleware/auth');

router.post('/webhook/tradeindia', tradeIndiaController.handleWebhook);

router.get('/fetch-leads', protect, tradeIndiaController.fetchLeads);

router.get('/status', protect, tradeIndiaController.getStatus);

module.exports = router;

