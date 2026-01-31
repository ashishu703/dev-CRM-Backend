const express = require('express');
const router = express.Router();
const proformaInvoiceController = require('../controllers/proformaInvoiceController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Proforma Invoice routes
router.get('/all', proformaInvoiceController.getAll);
router.get('/pending', proformaInvoiceController.getPendingApproval);
router.get('/pending-revised', proformaInvoiceController.getPendingRevisedPIs);
router.get('/bulk-by-quotations', proformaInvoiceController.getBulkByQuotations);
router.post('/bulk-by-quotations', proformaInvoiceController.getBulkByQuotations); // POST for large arrays
router.post('/quotation/:quotationId', proformaInvoiceController.createFromQuotation);
router.get('/quotation/:quotationId/active', proformaInvoiceController.getActivePI);
router.get('/quotation/:quotationId', proformaInvoiceController.getByQuotation);
router.post('/:id/submit-revised', proformaInvoiceController.submitRevisedPI);
router.post('/:id/approve-revised', proformaInvoiceController.approveRevisedPI);
router.post('/:id/reject-revised', proformaInvoiceController.rejectRevisedPI);
router.post('/:parentPiId/revised', proformaInvoiceController.createRevisedPI);
// Lightweight split APIs for fast View PI (order matters: specific before /:id)
router.get('/:id/summary', proformaInvoiceController.getSummary);
router.get('/:id/products', proformaInvoiceController.getProducts);
router.get('/:id/payments-only', proformaInvoiceController.getPaymentsOnly);
router.get('/:id', proformaInvoiceController.getById);
router.get('/:id/payments', proformaInvoiceController.getWithPayments);
router.put('/:id', proformaInvoiceController.update);
router.delete('/:id', proformaInvoiceController.delete);
router.post('/:id/send', proformaInvoiceController.sendToCustomer);

module.exports = router;
