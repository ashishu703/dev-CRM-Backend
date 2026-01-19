const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const productPriceController = require('../controllers/productPriceController');

router.use(protect);

router.get('/:productSpec', productPriceController.getApprovedPrice);
router.post('/', productPriceController.createApprovedPrice);

module.exports = router;
