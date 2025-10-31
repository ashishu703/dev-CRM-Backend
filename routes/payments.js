const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Payment CRUD routes
router.post('/', paymentController.create);
router.get('/', paymentController.getAllPayments);
router.get('/:id', paymentController.getById);
router.put('/:id', paymentController.update);
router.delete('/:id', paymentController.delete);

// Payment status routes
router.put('/:id/status', paymentController.updateStatus);

// Data retrieval routes
router.get('/pi/:piId', paymentController.getByPI);
router.get('/quotation/:quotationId', paymentController.getByQuotation);
router.get('/customer/:customerId', paymentController.getByCustomer);

// Summary routes
router.get('/summary/customer/:customerId', paymentController.getPaymentSummary);
router.get('/summary/quotation/:quotationId', paymentController.getPaymentSummaryByQuotation);
router.get('/credit/:customerId', paymentController.getCustomerCredit);
router.post('/refund', paymentController.refund);
router.post('/transfer', paymentController.transferCredit);

module.exports = router;
