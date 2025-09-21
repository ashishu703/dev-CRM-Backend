const express = require('express');
const router = express.Router();
const DepartmentHeadController = require('../controllers/departmentHeadController');
const { protect } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validation');
const { createHeadSchema, updateHeadSchema, updateStatusSchema, querySchema } = require('../apis/departmentHeads/validators');

router.use(protect);

router.post('/', validate('createHeadSchema'), DepartmentHeadController.create);
router.get('/', validateQuery('pagination'), DepartmentHeadController.getAll);
router.get('/stats', DepartmentHeadController.getStats);
router.get('/by-company-department/:companyName/:departmentType', DepartmentHeadController.getByCompanyAndDepartment);
router.get('/:id', DepartmentHeadController.getById);
router.put('/:id', validate('updateHeadSchema'), DepartmentHeadController.update);
router.put('/:id/status', validate('updateStatusSchema'), DepartmentHeadController.updateStatus);
router.delete('/:id', DepartmentHeadController.delete);

module.exports = router;
