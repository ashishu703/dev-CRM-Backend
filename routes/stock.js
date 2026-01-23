const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const StockController = require('../controllers/stockController');

// Debug endpoint - Public (no auth required for testing)
router.get('/tally/debug', StockController.debugTallyResponse.bind(StockController));

// Apply authentication to all other routes
router.use(protect);

// Tally integration routes (must be before parameterized routes)
router.get('/tally/status', StockController.checkTallyConnection.bind(StockController));
router.post('/tally/sync', StockController.syncFromTally.bind(StockController));
router.get('/tally/groups', StockController.getTopLevelGroups.bind(StockController));
router.get('/tally/groups/:groupName', StockController.getSubGroups.bind(StockController));
router.get('/tally/items/:groupName', StockController.getStockItemsByGroup.bind(StockController));
router.get('/tally/items', StockController.fetchTallyStockItems.bind(StockController));

// Get all stock records
router.get('/', StockController.getAllStock.bind(StockController));

// Batch update multiple stock records (must be before /:productName)
router.put('/batch', StockController.batchUpdateStock.bind(StockController));

// Get stock by product name
router.get('/:productName', StockController.getStockByProduct.bind(StockController));

// Update stock for a product
router.put('/:productName', StockController.updateStock.bind(StockController));

module.exports = router;



