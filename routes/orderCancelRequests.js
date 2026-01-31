const express = require('express');
const router = express.Router();
const orderCancelRequestController = require('../controllers/orderCancelRequestController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Salesperson: submit cancel request
router.post('/', orderCancelRequestController.requestCancel);

// Get cancel request for a quotation (salesperson / anyone)
router.get('/quotation/:quotationId', orderCancelRequestController.getByQuotation);

// Get cancel requests for a customer/lead (lead details)
router.get('/customer/:customerId', orderCancelRequestController.getByCustomer);

// Department head: pending list, approve, reject
router.get('/pending', orderCancelRequestController.getPending);
router.post('/:id/approve', orderCancelRequestController.approve);
router.post('/:id/reject', orderCancelRequestController.reject);

module.exports = router;
