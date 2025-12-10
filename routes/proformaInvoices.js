const express = require('express');
const router = express.Router();
const proformaInvoiceController = require('../controllers/proformaInvoiceController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Proforma Invoice routes
router.get('/all', proformaInvoiceController.getAll);
router.get('/pending', proformaInvoiceController.getPendingApproval);
router.get('/bulk-by-quotations', proformaInvoiceController.getBulkByQuotations);
router.post('/bulk-by-quotations', proformaInvoiceController.getBulkByQuotations); // POST for large arrays
router.post('/quotation/:quotationId', proformaInvoiceController.createFromQuotation);
router.get('/:id', proformaInvoiceController.getById);
router.get('/:id/payments', proformaInvoiceController.getWithPayments);
router.get('/quotation/:quotationId', proformaInvoiceController.getByQuotation);
router.put('/:id', proformaInvoiceController.update);
router.delete('/:id', proformaInvoiceController.delete);
router.post('/:id/send', proformaInvoiceController.sendToCustomer);

module.exports = router;
