const express = require('express');
const router = express.Router();
const aaacCalculatorController = require('../controllers/aaacCalculatorController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Get all products with calculations
router.get('/products', aaacCalculatorController.getAllProducts);

// Get current variable prices
router.get('/prices', aaacCalculatorController.getCurrentPrices);

// Update variable prices (Account department only - add role check if needed)
router.put('/prices', aaacCalculatorController.updatePrices);

// Calculate specific product
router.post('/calculate', aaacCalculatorController.calculateProduct);

module.exports = router;
