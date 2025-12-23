const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Payment CRUD routes
router.post('/', paymentController.create);
router.get('/', paymentController.getAllPayments);

// Data retrieval routes should be defined before generic :id handlers
router.get('/bulk-by-customers', paymentController.getBulkByCustomers);
router.post('/bulk-by-customers', paymentController.getBulkByCustomers); // POST for large arrays
router.get('/bulk-by-quotations', paymentController.getBulkByQuotations);
router.post('/bulk-by-quotations', paymentController.getBulkByQuotations); // POST for large arrays
router.get('/pi/:piId', paymentController.getByPI);
router.get('/quotation/:quotationId', paymentController.getByQuotation);
router.get('/customer/:customerId', paymentController.getByCustomer);

// Summary routes
router.get('/summary/customer/:customerId', paymentController.getPaymentSummary);
router.get('/summary/quotation/:quotationId', paymentController.getPaymentSummaryByQuotation);
router.get('/credit/:customerId', paymentController.getCustomerCredit);
router.get('/installment-breakdown/quotation/:quotationId', paymentController.getInstallmentBreakdown);

// Payment workflow routes
router.put('/:id/approval', paymentController.updateApprovalStatus);
router.put('/:id/approve', paymentController.approvePayment);
router.put('/:id/status', paymentController.updateStatus);

// Legacy refund/transfer
router.post('/refund', paymentController.refund);
router.post('/transfer', paymentController.transferCredit);

// CRUD routes that rely on payment ID
router.get('/:id', paymentController.getById);
router.put('/:id', paymentController.update);
router.delete('/:id', paymentController.delete);

module.exports = router;
