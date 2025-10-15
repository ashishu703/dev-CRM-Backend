const express = require('express');
const router = express.Router();
const LeadController = require('../controllers/leadController');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { mapLeadFields, mapLeadArray } = require('../middleware/mapLeadFields');
const {
  createLeadSchema,
  updateLeadSchema,
  querySchema,
  importCSVSchema,
  idParamSchema
} = require('../apis/leads/validators');
const SalespersonLeadController = require('../controllers/salespersonLeadController');
const upload = require('../middleware/upload');

router.use(protect);

router.post('/', mapLeadFields, validateRequest(createLeadSchema), LeadController.create);
router.get('/', validateRequest(querySchema, 'query'), LeadController.getAll);
router.get('/stats', LeadController.getStats);
router.get('/:id', validateRequest(idParamSchema, 'params'), LeadController.getById);
router.put('/:id', mapLeadFields, validateRequest([...idParamSchema, ...updateLeadSchema]), LeadController.update);
router.delete('/:id', validateRequest(idParamSchema, 'params'), LeadController.delete);

router.post('/:id/transfer', validateRequest(idParamSchema, 'params'), LeadController.transferLead);

router.post('/import', mapLeadArray, validateRequest(importCSVSchema), LeadController.importCSV);

// Salesperson assigned leads for logged-in department_user or by username
router.get('/assigned/salesperson', SalespersonLeadController.listForLoggedInUser);
router.get('/assigned/salesperson/:username', SalespersonLeadController.listForUsername);

// Salesperson lead details and updates (including file uploads)
router.get('/assigned/salesperson/lead/:id', validateRequest(idParamSchema, 'params'), SalespersonLeadController.getById);
router.put(
  '/assigned/salesperson/lead/:id',
  validateRequest(idParamSchema, 'params'),
  upload.fields([
    { name: 'quotation', maxCount: 1 },
    { name: 'proforma_invoice', maxCount: 1 },
    { name: 'payment_receipt', maxCount: 1 }
  ]),
  validateRequest(require('../apis/leads/validators').salespersonLeadUpdateSchema),
  SalespersonLeadController.updateById
);

module.exports = router;
