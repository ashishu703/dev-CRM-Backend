const Joi = require('joi');
const { validationResult } = require('express-validator');

const schemas = {
  createUserSchema: Joi.object({
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    target: Joi.number().min(0).required(),
    // Optional target period fields (used by department_head assignment flows)
    targetStartDate: Joi.date().iso().optional(),
    targetEndDate: Joi.date().iso().optional(),
    targetDurationDays: Joi.number().integer().min(0).optional(),
    // departmentType is dynamic; just ensure it's a reasonable string when provided
    departmentType: Joi.string().max(100).optional(),
    companyName: Joi.string().min(1).max(255).optional(),
    headUserId: Joi.string().uuid().optional(),
    headUserEmail: Joi.string().email().optional()
  }),

  updateUserSchema: Joi.object({
    username: Joi.string().min(3).max(255).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    departmentType: Joi.string().max(100).optional(),
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
  }),

  updateStatusSchema: Joi.object({
    isActive: Joi.boolean().required()
  }),

  createHeadSchema: Joi.object({
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    // Accept any non-empty department label; routing is resolved at login time
    departmentType: Joi.string().min(1).max(100).required(),
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
  }),

  updateHeadSchema: Joi.object({
    username: Joi.string().min(3).max(255).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    // Department type is dynamic; simple string validation
    departmentType: Joi.string().min(1).max(100).optional(),
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
  }),

  register: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.alphanum': 'Username must contain only alphanumeric characters',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 30 characters',
        'any.required': 'Username is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'any.required': 'Password is required'
      }),
    departmentType: Joi.string()
      .min(1)
      .max(100)
      .required()
      .messages({
        'any.required': 'Department type is required'
      }),
    companyName: Joi.string()
      .min(1)
      .max(255)
      .required()
      .messages({
        'any.required': 'Company name is required'
      }),
    role: Joi.string()
      .valid('department_user', 'department_head')
      .required()
      .messages({
        'any.only': 'Role must be one of: department_user, department_head, superadmin',
        'any.required': 'Role is required'
      }),
    headUser: Joi.string()
      .allow('')
      .when('role', { is: 'department_user', then: Joi.required().messages({ 'any.required': 'Head user is required for department users' }), otherwise: Joi.optional() }),
    monthlyTarget: Joi.number().min(0).optional()
  }),

  // User login
  login: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  }),

  submitReview: Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .required()
      .messages({
        'string.min': 'Title cannot be empty',
        'string.max': 'Title cannot exceed 200 characters',
        'any.required': 'Title is required'
      }),
    content: Joi.string()
      .min(10)
      .max(10000)
      .required()
      .messages({
        'string.min': 'Content must be at least 10 characters long',
        'string.max': 'Content cannot exceed 10,000 characters',
        'any.required': 'Content is required'
      }),
    category: Joi.string()
      .valid('academic', 'business', 'creative', 'technical', 'other')
      .required()
      .messages({
        'any.only': 'Category must be one of: academic, business, creative, technical, other',
        'any.required': 'Category is required'
      }),
    priority: Joi.string()
      .valid('low', 'medium', 'high', 'urgent')
      .default('medium')
      .messages({
        'any.only': 'Priority must be one of: low, medium, high, urgent'
      })
  }),

  updateReview: Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .messages({
        'string.min': 'Title cannot be empty',
        'string.max': 'Title cannot exceed 200 characters'
      }),
    content: Joi.string()
      .min(10)
      .max(10000)
      .messages({
        'string.min': 'Content must be at least 10 characters long',
        'string.max': 'Content cannot exceed 10,000 characters'
      }),
    category: Joi.string()
      .valid('academic', 'business', 'creative', 'technical', 'other')
      .messages({
        'any.only': 'Category must be one of: academic, business, creative, technical, other'
      }),
    priority: Joi.string()
      .valid('low', 'medium', 'high', 'urgent')
      .messages({
        'any.only': 'Priority must be one of: low, medium, high, urgent'
      })
  }),

  // User profile update
  updateProfile: Joi.object({
    username: Joi.string()
      .min(3)
      .max(255)
      .optional()
      .messages({
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 255 characters'
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': 'Please provide a valid email address'
      }),
    phone: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .optional()
      .allow('')
      .messages({
        'string.pattern.base': 'Phone number must be exactly 10 digits'
      }),
    profilePicture: Joi.string()
      .uri()
      .optional()
      .allow('')
      .messages({
        'string.uri': 'Profile picture must be a valid URL'
      }),
    bio: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Bio cannot exceed 500 characters'
      })
  }),

  // Pagination
  pagination: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      })
  }),

  // Organization management
  createOrganization: Joi.object({
    organizationName: Joi.string().min(1).max(255).required(),
    legalName: Joi.string().min(1).max(255).required(),
    logoUrl: Joi.string().uri().max(500).optional().allow(''),
    streetAddress: Joi.string().min(1).max(500).required(),
    city: Joi.string().min(1).max(100).required(),
    state: Joi.string().min(1).max(100).required(),
    zipCode: Joi.string().min(1).max(20).required(),
    country: Joi.string().min(1).max(100).default('India'),
    phone: Joi.string().max(20).optional().allow(''),
    email: Joi.string().email().optional().allow(''),
    website: Joi.string().uri().optional().allow(''),
    gstin: Joi.string().max(15).optional().allow(''),
    pan: Joi.string().max(10).optional().allow(''),
    tan: Joi.string().max(10).optional().allow(''),
    currency: Joi.string().max(10).default('INR'),
    fiscalYearStart: Joi.string().max(20).default('April'),
    fiscalYearEnd: Joi.string().max(20).default('March'),
    timezone: Joi.string().max(50).default('Asia/Kolkata')
  }),

  updateOrganization: Joi.object({
    organizationName: Joi.string().min(1).max(255).optional(),
    legalName: Joi.string().min(1).max(255).optional(),
    logoUrl: Joi.string().uri().max(500).optional().allow(''),
    streetAddress: Joi.string().min(1).max(500).optional(),
    city: Joi.string().min(1).max(100).optional(),
    state: Joi.string().min(1).max(100).optional(),
    zipCode: Joi.string().min(1).max(20).optional(),
    country: Joi.string().min(1).max(100).optional(),
    phone: Joi.string().max(20).optional().allow(''),
    email: Joi.string().email().optional().allow(''),
    website: Joi.string().uri().optional().allow(''),
    gstin: Joi.string().max(15).optional().allow(''),
    pan: Joi.string().max(10).optional().allow(''),
    tan: Joi.string().max(10).optional().allow(''),
    currency: Joi.string().max(10).optional(),
    fiscalYearStart: Joi.string().max(20).optional(),
    fiscalYearEnd: Joi.string().max(20).optional(),
    timezone: Joi.string().max(50).optional(),
    isActive: Joi.boolean().optional()
  }),

  organizationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    isActive: Joi.boolean().optional()
  })
};

// Validation middleware factory
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: 'Validation schema not found'
      });
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorMessages
      });
    }

    req.body = value;
    next();
  };
};

const validateQuery = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: 'Validation schema not found'
      });
    }

    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        error: 'Query validation failed',
        details: errorMessages
      });
    }

    req.query = value;
    next();
  };
};

module.exports = {
  validate,
  validateQuery,
  schemas,
  validateRequest: (validations, source = 'body') => {
    return async (req, res, next) => {
      try {
        const validationArray = Array.isArray(validations) ? validations : [validations];
        
        await Promise.all(validationArray.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
          });
        }

        next();
      } catch (error) {
        console.error('Validation middleware error:', error);
        return res.status(500).json({
          success: false,
          message: 'Validation middleware error',
          error: error.message
        });
      }
    };
  }
}; 