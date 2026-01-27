const express = require('express');
const RawMaterialController = require('../controllers/rawMaterialController');
const auth = require('../middleware/auth');

const router = express.Router();
const rawMaterialController = new RawMaterialController();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * @route   GET /api/raw-materials/rates
 * @desc    Get current raw material rates
 * @access  Private (Accounts Department)
 */
router.get('/rates', (req, res) => {
  rawMaterialController.getCurrentRates(req, res);
});

/**
 * @route   PUT /api/raw-materials/rates  
 * @desc    Update raw material rates (partial update supported)
 * @access  Private (Accounts Department)
 */
router.put('/rates', (req, res) => {
  rawMaterialController.updateRawMaterialRates(req, res);
});

module.exports = router;