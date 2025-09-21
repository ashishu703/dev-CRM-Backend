const express = require('express');
const router = express.Router();
const DepartmentUserController = require('../controllers/departmentUserController');
const { protect } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validation');
const { createUserSchema, updateUserSchema, updateStatusSchema, querySchema } = require('../apis/departmentUsers/validators');

router.use(protect);

router.post('/', validate('createUserSchema'), DepartmentUserController.create);
router.get('/', validateQuery('pagination'), DepartmentUserController.getAll);
router.get('/stats', DepartmentUserController.getStats);
router.get('/by-head/:headUserId', DepartmentUserController.getByHeadUserId);
router.get('/:id', DepartmentUserController.getById);
router.put('/:id', validate('updateUserSchema'), DepartmentUserController.update);
router.put('/:id/status', validate('updateStatusSchema'), DepartmentUserController.updateStatus);
router.delete('/:id', DepartmentUserController.delete);

module.exports = router;
