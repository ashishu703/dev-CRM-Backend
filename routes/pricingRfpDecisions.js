const express = require('express');
const router = express.Router();
const pricingRfpDecisionController = require('../controllers/pricingRfpDecisionController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Create a new pricing & RFP decision
router.post('/', pricingRfpDecisionController.create);

// Get pricing decision by lead ID
router.get('/by-lead/:leadId', pricingRfpDecisionController.getByLeadId);

// IMPORTANT: These routes must come BEFORE /:rfpId to avoid route conflicts
// Get all RFP records with optional date range (exact match)
router.get('/records/all', (req, res, next) => {
  console.log('Route /records/all matched!');
  return pricingRfpDecisionController.getAllRecords(req, res, next);
});

// Get RFP records by date (exact match)
router.get('/records/by-date', pricingRfpDecisionController.getRecordsByDate);

// Get pricing decision by RFP ID (must be last to avoid catching /records/* routes)
// This will match any string that doesn't match the above routes
router.get('/:rfpId', pricingRfpDecisionController.getByRfpId);

// Update pricing decision
router.put('/:rfpId', pricingRfpDecisionController.update);

// Mark RFP as created
router.patch('/:rfpId/mark-rfp-created', pricingRfpDecisionController.markRfpCreated);

module.exports = router;
