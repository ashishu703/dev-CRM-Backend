const Joi = require('joi');

const SUPPORTED_DEPARTMENT_TYPES = ['marketing_sales', 'office_sales', 'hr', 'production', 'accounts', 'it', 'telesales'];

const createHeadSchema = Joi.object({
  username: Joi.string().min(3).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  departmentType: Joi.string().valid(...SUPPORTED_DEPARTMENT_TYPES).required(),
  companyName: Joi.string().min(1).max(255).required(),
  target: Joi.number().min(0).optional(),
  monthlyTarget: Joi.alternatives().try(
    Joi.number().min(0),
    Joi.string().pattern(/^\d+(\.\d+)?$/).custom((value) => parseFloat(value))
  ).optional()
}).custom((value, helpers) => {
  // If monthlyTarget is provided, map it to target (same as update schema)
  if (value.monthlyTarget !== undefined) {
    value.target = typeof value.monthlyTarget === 'string' 
      ? parseFloat(value.monthlyTarget) 
      : value.monthlyTarget;
    delete value.monthlyTarget;
  }
  // Default target to 0 if not provided
  if (value.target === undefined) {
    value.target = 0;
  }
  return value;
});

const updateHeadSchema = Joi.object({
  username: Joi.string().min(3).max(255).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).optional(),
  departmentType: Joi.string().valid(...SUPPORTED_DEPARTMENT_TYPES).optional(),
  companyName: Joi.string().min(1).max(255).optional(),
  target: Joi.number().min(0).optional(),
  monthlyTarget: Joi.alternatives().try(
    Joi.number().min(0),
    Joi.string().pattern(/^\d+(\.\d+)?$/).custom((value) => parseFloat(value))
  ).optional(),
  isActive: Joi.boolean().optional(),
  emailVerified: Joi.boolean().optional()
}).custom((value, helpers) => {
  // If monthlyTarget is provided, map it to target
  if (value.monthlyTarget !== undefined) {
    value.target = typeof value.monthlyTarget === 'string' 
      ? parseFloat(value.monthlyTarget) 
      : value.monthlyTarget;
    delete value.monthlyTarget;
  }
  return value;
});

const updateStatusSchema = Joi.object({
  isActive: Joi.boolean().required()
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  companyName: Joi.string().min(0).max(255).optional(),
  departmentType: Joi.string().min(0).max(50).optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().max(255).optional()
});

module.exports = {
  createHeadSchema,
  updateHeadSchema,
  updateStatusSchema,
  querySchema
};
