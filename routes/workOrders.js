const express = require('express');
const router = express.Router();
const workOrderController = require('../controllers/workOrderController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Work Order CRUD routes
router.post('/', workOrderController.create);
router.get('/', workOrderController.getAll);
router.get('/:id', workOrderController.getById);

module.exports = router;

