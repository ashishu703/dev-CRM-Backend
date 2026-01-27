const express = require('express');
const router = express.Router();
const rawMaterialController = require('../controllers/rawMaterialController');

// GET /api/raw-materials/rates - Get current raw material rates
router.get('/rates', rawMaterialController.getCurrentRates);

// PUT /api/raw-materials/rates - Update raw material rates
router.put('/rates', rawMaterialController.updateRates);

module.exports = router;
