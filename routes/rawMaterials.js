const express = require('express');
const router = express.Router();
const { getCurrentRates, updateRawMaterialRates } = require('../controllers/rawMaterialController');

// GET /api/raw-materials/rates - Get current raw material rates
router.get('/rates', getCurrentRates);

// PUT /api/raw-materials/rates - Update raw material rates
router.put('/rates', updateRawMaterialRates);

module.exports = router;
