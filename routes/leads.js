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
  idParamSchema,
  batchUpdateSchema,
  bulkDeleteSchema
} = require('../apis/leads/validators');
const SalespersonLeadController = require('../controllers/salespersonLeadController');
const EnquiryController = require('../controllers/enquiryController');
const upload = require('../middleware/upload');

router.use(protect);

router.post('/', mapLeadFields, validateRequest(createLeadSchema), LeadController.create.bind(LeadController));
router.get('/', validateRequest(querySchema, 'query'), LeadController.getAll.bind(LeadController));
router.get('/stats', LeadController.getStats.bind(LeadController));
// Batch operations MUST come before parametric :id routes
router.put('/batch', validateRequest(batchUpdateSchema), LeadController.batchUpdate.bind(LeadController));
router.delete('/batch', validateRequest(bulkDeleteSchema), LeadController.bulkDelete.bind(LeadController));
router.get('/:id', validateRequest(idParamSchema, 'params'), LeadController.getById.bind(LeadController));
// IMPORTANT: Do not map fields on update to avoid overwriting existing data with blanks
router.put('/:id', validateRequest([...idParamSchema, ...updateLeadSchema]), LeadController.update.bind(LeadController));
router.delete('/:id', validateRequest(idParamSchema, 'params'), LeadController.delete.bind(LeadController));

router.post('/:id/transfer', validateRequest(idParamSchema, 'params'), LeadController.transferLead.bind(LeadController));

router.post('/import', mapLeadArray, validateRequest(importCSVSchema), LeadController.importCSV.bind(LeadController));

// Salesperson assigned leads for logged-in department_user or by username
router.get('/assigned/salesperson', SalespersonLeadController.listForLoggedInUser);
router.get('/assigned/salesperson/:username', SalespersonLeadController.listForUsername);

// Salesperson lead create/import so DH also sees them
// Use multer to parse FormData (multipart/form-data)
router.post('/assigned/salesperson/lead', upload.none(), SalespersonLeadController.createLeadFromSalesperson);
router.post('/assigned/salesperson/import', validateRequest(importCSVSchema), SalespersonLeadController.importLeadsFromSalesperson);

// Salesperson lead details and updates (including file uploads)
router.get('/assigned/salesperson/lead/:id', validateRequest(idParamSchema, 'params'), SalespersonLeadController.getById);
router.get('/assigned/salesperson/lead/:id/history', validateRequest(idParamSchema, 'params'), SalespersonLeadController.getHistory);
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

// Enquiry routes for department head
router.get('/enquiries/department-head', EnquiryController.getForDepartmentHead);
router.get('/enquiries/superadmin', EnquiryController.getAllForSuperAdmin);
router.put('/enquiries/:id', validateRequest(idParamSchema, 'params'), EnquiryController.update);
router.delete('/enquiries/:id', validateRequest(idParamSchema, 'params'), EnquiryController.delete);

module.exports = router;
