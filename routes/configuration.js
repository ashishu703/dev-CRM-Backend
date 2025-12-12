const express = require('express');
const router = express.Router();
const configurationController = require('../controllers/configurationController');
const { protect } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Get all configurations
router.get('/', configurationController.getAll);

// Email configuration
router.post('/email', configurationController.saveEmail);

// WhatsApp configuration
router.post('/whatsapp', configurationController.saveWhatsApp);

// Cloudinary configuration
router.post('/cloudinary', configurationController.saveCloudinary);

// Indiamart configuration
router.post('/indiamart', configurationController.saveIndiamart);

// TradeIndia configuration
router.post('/tradeindia', configurationController.saveTradeIndia);

// Global settings
router.get('/global', configurationController.getGlobalSettings);
router.post('/global', configurationController.setGlobalSetting);

// Email templates
router.get('/templates', configurationController.getEmailTemplates);
router.post('/templates', configurationController.createEmailTemplate);
router.put('/templates/:id', configurationController.updateEmailTemplate);
router.delete('/templates/:id', configurationController.deleteEmailTemplate);

// Document templates (quotation / PI / work orders)
router.get('/document-templates', configurationController.getDocumentTemplates);
router.post('/document-templates', configurationController.createDocumentTemplate);
router.put('/document-templates/:id', configurationController.updateDocumentTemplate);
router.delete('/document-templates/:id', configurationController.deleteDocumentTemplate);

module.exports = router;

