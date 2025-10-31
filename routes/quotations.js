const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Specific routes must come before parameterized ':id' routes
router.get('/approved', quotationController.getApprovedForCustomer);
router.get('/bulk-with-payments', quotationController.getBulkWithPayments);
router.get('/:id/summary', quotationController.getSummary);

// Quotation CRUD routes
router.post('/', quotationController.create);
router.get('/:id', quotationController.getById);
router.put('/:id', quotationController.update);
router.delete('/:id', quotationController.delete);

// Quotation workflow routes
router.post('/:id/submit', quotationController.submitForVerification);
router.post('/:id/approve', quotationController.approve);
router.post('/:id/reject', quotationController.reject);
router.post('/:id/send', quotationController.sendToCustomer);
router.post('/:id/accept', quotationController.acceptByCustomer);

// Data retrieval routes
router.get('/customer/:customerId', quotationController.getByCustomer);
router.get('/:id/complete', quotationController.getCompleteData);
router.get('/:id/pdf', quotationController.generatePDF);

// Department head routes
router.get('/pending-verification', quotationController.getPendingVerification);
router.get('/status/:status', quotationController.getByStatus);

// Salesperson routes
router.get('/my-quotations', quotationController.getBySalesperson);

module.exports = router;
