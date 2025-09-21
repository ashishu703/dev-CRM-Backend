const Joi = require('joi');

const createHeadSchema = Joi.object({
  username: Joi.string().min(3).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  departmentType: Joi.string().min(1).max(50).required(),
  companyName: Joi.string().min(1).max(255).required(),
  target: Joi.number().min(0).default(0)
});

const updateHeadSchema = Joi.object({
  username: Joi.string().min(3).max(255).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).optional(),
  departmentType: Joi.string().min(1).max(50).optional(),
  companyName: Joi.string().min(1).max(255).optional(),
  target: Joi.number().min(0).optional(),
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
  isActive: Joi.boolean().optional(),
  search: Joi.string().max(255).optional()
});

module.exports = {
  createHeadSchema,
  updateHeadSchema,
  updateStatusSchema,
  querySchema
};
