const Joi = require('joi');

const createUserSchema = Joi.object({
  username: Joi.string().min(3).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  target: Joi.number().min(0).required(),
  // Optional for superadmin flows; inferred when head creates
  departmentType: Joi.string().valid('marketing_sales', 'office_sales', 'hr', 'production').optional(),
  companyName: Joi.string().min(1).max(255).optional(),
  headUserId: Joi.string().uuid().optional(),
  headUserEmail: Joi.string().email().optional()
});

const updateUserSchema = Joi.object({
  username: Joi.string().min(3).max(255).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).optional(),
  departmentType: Joi.string().valid('marketing_sales', 'office_sales', 'hr', 'production').optional(),
  companyName: Joi.string().min(1).max(255).optional(),
  headUserId: Joi.string().uuid().optional(),
  target: Joi.number().min(0).optional(),
  achievedTarget: Joi.number().min(0).optional(),
  salesOrderTarget: Joi.number().min(0).optional(),
  achievedSalesOrderTarget: Joi.number().min(0).optional(),
  targetStatus: Joi.string().valid('active', 'paused', 'completed').optional(),
  targetStartDate: Joi.date().iso().optional(),
  targetEndDate: Joi.date().iso().optional(),
  targetDurationDays: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
  emailVerified: Joi.boolean().optional()
});

const updateStatusSchema = Joi.object({
  isActive: Joi.boolean().required()
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  companyName: Joi.string().min(0).max(255).optional(),
  departmentType: Joi.string().min(0).max(50).optional(),
  headUserId: Joi.string().uuid().optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().max(255).optional()
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  querySchema
};
