const Joi = require('joi');
const { validationResult } = require('express-validator');

const schemas = {
  createUserSchema: Joi.object({
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    target: Joi.number().min(0).required(),
    departmentType: Joi.string().min(1).max(50).optional(),
    companyName: Joi.string().min(1).max(255).optional(),
    headUserId: Joi.string().uuid().optional(),
    headUserEmail: Joi.string().email().optional()
  }),

  updateUserSchema: Joi.object({
    username: Joi.string().min(3).max(255).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    departmentType: Joi.string().min(1).max(50).optional(),
    companyName: Joi.string().min(1).max(255).optional(),
    headUserId: Joi.string().uuid().optional(),
    target: Joi.number().min(0).optional(),
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
    departmentType: Joi.string().min(1).max(50).required(),
    companyName: Joi.string().min(1).max(255).required(),
    target: Joi.number().min(0).default(0)
  }),

  updateHeadSchema: Joi.object({
    username: Joi.string().min(3).max(255).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    departmentType: Joi.string().min(1).max(50).optional(),
    companyName: Joi.string().min(1).max(255).optional(),
    target: Joi.number().min(0).optional(),
    isActive: Joi.boolean().optional(),
    emailVerified: Joi.boolean().optional()
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
      .valid('marketing_sales', 'office_sales')
      .required()
      .messages({
        'any.only': 'Department type must be one of: marketing_sales, office_sales',
        'any.required': 'Department type is required'
      }),
    companyName: Joi.string()
      .valid('Anode Electric Pvt. Ltd.', 'Anode Metals', 'Samrridhi Industries')
      .required()
      .messages({
        'any.only': 'Company name must be one of: Anode Electric Pvt. Ltd., Anode Metals, Samrridhi Industries',
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
      .alphanum()
      .min(3)
      .max(30)
      .messages({
        'string.alphanum': 'Username must contain only alphanumeric characters',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 30 characters'
      }),
    email: Joi.string()
      .email()
      .messages({
        'string.email': 'Please provide a valid email address'
      }),
    bio: Joi.string()
      .max(500)
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