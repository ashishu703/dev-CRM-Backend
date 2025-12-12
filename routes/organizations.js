const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validation');
const OrganizationController = require('../controllers/organizationController');

router.use(protect);

router.post(
  '/',
  authorize('superadmin'),
  validate('createOrganization'),
  OrganizationController.create
);

router.get(
  '/',
  validateQuery('organizationQuery'),
  OrganizationController.getAll
);

router.get('/active', OrganizationController.getActiveList);

router.put(
  '/:id',
  authorize('superadmin'),
  validate('updateOrganization'),
  OrganizationController.update
);

router.delete(
  '/:id',
  authorize('superadmin'),
  OrganizationController.softDelete
);

module.exports = router;


