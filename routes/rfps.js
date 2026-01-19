const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const rfpController = require('../controllers/rfpController');

router.use(protect);

router.get('/', rfpController.list);
router.post('/', rfpController.create);
router.get('/:id', rfpController.getById);
router.post('/:id/approve', rfpController.approve);
router.post('/:id/reject', rfpController.reject);
router.get('/:id/prices', rfpController.listPrices);
router.post('/:id/prices', rfpController.addPrice);
router.post('/:id/quotation', rfpController.generateQuotation);
router.post('/:id/submit-accounts', rfpController.submitToAccounts);
router.post('/:id/accounts-approval', rfpController.updateAccountsApproval);
router.post('/:id/senior-approval', rfpController.updateSeniorApproval);

module.exports = router;
