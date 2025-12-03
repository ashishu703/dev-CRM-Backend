const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const securityLogController = require('../controllers/securityLogController');

router.get('/', protect, authorize('department_head', 'superadmin'), securityLogController.getAll);
router.post('/:id/assign', protect, authorize('department_head', 'superadmin'), securityLogController.assign);
router.put('/:id/status', protect, securityLogController.updateStatus);
router.post('/:id/send-back', protect, authorize('department_head', 'superadmin'), securityLogController.sendBack);

module.exports = router;

