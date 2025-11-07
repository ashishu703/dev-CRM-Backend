const Joi = require('joi');

const createHeadSchema = Joi.object({
  username: Joi.string().min(3).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  departmentType: Joi.string().valid('marketing_sales', 'office_sales', 'hr').required(),
  companyName: Joi.string().min(1).max(255).required(),
  target: Joi.number().min(0).default(0)
});

const updateHeadSchema = Joi.object({
  username: Joi.string().min(3).max(255).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).optional(),
  departmentType: Joi.string().valid('marketing_sales', 'office_sales', 'hr').optional(),
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
