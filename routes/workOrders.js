const express = require('express');
const router = express.Router();
const workOrderController = require('../controllers/workOrderController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Work Order CRUD routes
router.post('/', workOrderController.create);
router.get('/', workOrderController.getAll);
router.get('/check/quotation/:quotationId', workOrderController.checkQuotation); // Must be before /:id
router.get('/:id', workOrderController.getById);
router.put('/:id', workOrderController.update);
router.delete('/:id', workOrderController.delete);
router.patch('/:id/status', workOrderController.updateStatus);
router.post('/:id/acknowledge', workOrderController.acknowledge);
router.post('/:id/cancel', workOrderController.cancel);

module.exports = router;

