const Joi = require('joi');

const SUPPORTED_DEPARTMENT_TYPES = ['marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it'];

const createUserSchema = Joi.object({
  username: Joi.string().min(3).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  departmentType: Joi.string().valid(...SUPPORTED_DEPARTMENT_TYPES).required(),
  companyName: Joi.string().valid('Anode Electric Pvt. Ltd.', 'Anode Metals', 'Samrridhi Industries').required(),
  role: Joi.string().valid('department_user', 'department_head').required(),
  headUser: Joi.string().when('role', { 
    is: 'department_user', 
    then: Joi.string().required().messages({ 'any.required': 'Head user is required for department users' }),
    otherwise: Joi.string().optional()
  })
});

const updateUserSchema = Joi.object({
  username: Joi.string().min(3).max(255).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).optional(),
  departmentType: Joi.string().valid(...SUPPORTED_DEPARTMENT_TYPES).optional(),
  companyName: Joi.string().valid('Anode Electric Pvt. Ltd.', 'Anode Metals', 'Samrridhi Industries').optional(),
  role: Joi.string().valid('department_user', 'department_head').optional(),
  headUser: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
  emailVerified: Joi.boolean().optional()
});

const updateStatusSchema = Joi.object({
  isActive: Joi.boolean().required()
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  companyName: Joi.string().valid('Anode Electric Pvt. Ltd.', 'Anode Metals', 'Samrridhi Industries').optional(),
  departmentType: Joi.string().valid(...SUPPORTED_DEPARTMENT_TYPES).optional(),
  role: Joi.string().valid('department_user', 'department_head').optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().max(255).optional()
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  querySchema
};



