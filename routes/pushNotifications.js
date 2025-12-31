const express = require('express');
const router = express.Router();
const pushNotificationController = require('../controllers/pushNotificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/save-token', pushNotificationController.saveToken);
router.post('/send', pushNotificationController.sendTestNotification);

module.exports = router;

