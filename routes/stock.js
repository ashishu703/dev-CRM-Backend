const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const StockController = require('../controllers/stockController');

// Apply authentication to all routes
router.use(protect);

// Get all stock records
router.get('/', StockController.getAllStock.bind(StockController));

// Get stock by product name
router.get('/:productName', StockController.getStockByProduct.bind(StockController));

// Update stock for a product
router.put('/:productName', StockController.updateStock.bind(StockController));

// Batch update multiple stock records
router.put('/batch', StockController.batchUpdateStock.bind(StockController));

module.exports = router;


