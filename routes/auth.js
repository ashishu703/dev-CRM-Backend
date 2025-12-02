const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const authController = require('../controllers/authController');

const router = express.Router();

// Public routes
router.post('/login', validate('login'), authController.login);

// Protected routes
router.post(
  '/impersonate',
  protect,
  authorize('superadmin', 'department_head'),
  authController.impersonateLogin
);
router.post('/register', protect, authorize('superadmin'), validate('register'), authController.register);
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, validate('updateProfile'), authController.updateProfile);
router.post('/logout', protect, authController.logout);
router.put('/change-password', protect, authController.changePassword);

module.exports = router; 