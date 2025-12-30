const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/salesOrderController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Sales Order routes
router.get('/', salesOrderController.getAll);
router.get('/statistics', salesOrderController.getStatistics);
router.get('/:id', salesOrderController.getById);
router.put('/:id', salesOrderController.update);
router.delete('/:id', salesOrderController.delete);

module.exports = router;

