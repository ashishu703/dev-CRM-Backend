/**
 * RFP Backend Validation Utilities - Algorithm-based validation
 * Centralized validation logic for RFP backend operations
 */

/**
 * Validation rules constants
 */
const VALIDATION_RULES = {
  LEAD_ID: {
    required: true,
    type: 'number',
    min: 1
  },
  PRODUCTS: {
    required: true,
    type: 'array',
    minLength: 1
  },
  PRODUCT_SPEC: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 500
  },
  AVAILABILITY_STATUS: {
    required: true,
    type: 'string',
    allowedValues: [
      'custom_product_pricing_needed',
      'in_stock_price_unavailable',
      'not_in_stock_price_unavailable'
    ]
  }
}

/**
 * Validates a value against rules
 * @param {any} value - Value to validate
 * @param {Object} rules - Validation rules
 * @param {string} fieldName - Name of the field (for error messages)
 * @returns {Object} { isValid: boolean, error: string }
 */
const validateField = (value, rules, fieldName) => {
  // Required check
  if (rules.required) {
    if (value === undefined || value === null || value === '') {
      return {
        isValid: false,
        error: `${fieldName} is required`
      }
    }
  }

  // Type check
  if (rules.type) {
    if (rules.type === 'array' && !Array.isArray(value)) {
      return {
        isValid: false,
        error: `${fieldName} must be an array`
      }
    }
    if (rules.type === 'number' && typeof value !== 'number' && isNaN(parseFloat(value))) {
      return {
        isValid: false,
        error: `${fieldName} must be a number`
      }
    }
    if (rules.type === 'string' && typeof value !== 'string') {
      return {
        isValid: false,
        error: `${fieldName} must be a string`
      }
    }
  }

  // Array-specific validations
  if (Array.isArray(value)) {
    if (rules.minLength && value.length < rules.minLength) {
      return {
        isValid: false,
        error: `${fieldName} must have at least ${rules.minLength} item(s)`
      }
    }
  }

  // String-specific validations
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (rules.minLength && trimmed.length < rules.minLength) {
      return {
        isValid: false,
        error: `${fieldName} must be at least ${rules.minLength} characters`
      }
    }
    if (rules.maxLength && trimmed.length > rules.maxLength) {
      return {
        isValid: false,
        error: `${fieldName} must not exceed ${rules.maxLength} characters`
      }
    }
  }

  // Number-specific validations
  if (typeof value === 'number' || !isNaN(parseFloat(value))) {
    const numValue = parseFloat(value)
    if (rules.min !== undefined && numValue < rules.min) {
      return {
        isValid: false,
        error: `${fieldName} must be at least ${rules.min}`
      }
    }
  }

  // Allowed values check
  if (rules.allowedValues && !rules.allowedValues.includes(value)) {
    return {
      isValid: false,
      error: `${fieldName} must be one of: ${rules.allowedValues.join(', ')}`
    }
  }

  return { isValid: true, error: '' }
}

/**
 * Validates RFP creation request body
 * @param {Object} body - Request body
 * @returns {Object} { isValid: boolean, error: string, field: string }
 */
const validateRfpCreateRequest = (body) => {
  const { leadId, products, productSpec } = body

  // Validate leadId
  const leadIdValidation = validateField(leadId, VALIDATION_RULES.LEAD_ID, 'leadId')
  if (!leadIdValidation.isValid) {
    return {
      isValid: false,
      error: leadIdValidation.error,
      field: 'leadId'
    }
  }

  // Check if products array is provided (new format)
  if (products !== undefined && products !== null) {
    const productsValidation = validateField(products, VALIDATION_RULES.PRODUCTS, 'products')
    if (!productsValidation.isValid) {
      return {
        isValid: false,
        error: productsValidation.error,
        field: 'products'
      }
    }

    // Validate each product in the array
    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      
      if (!product || typeof product !== 'object') {
        return {
          isValid: false,
          error: `Product at index ${i} is invalid`,
          field: `products[${i}]`
        }
      }

      const productSpecValidation = validateField(
        product.productSpec,
        VALIDATION_RULES.PRODUCT_SPEC,
        `products[${i}].productSpec`
      )
      if (!productSpecValidation.isValid) {
        return {
          isValid: false,
          error: productSpecValidation.error,
          field: `products[${i}].productSpec`
        }
      }

      const availabilityStatusValidation = validateField(
        product.availabilityStatus,
        VALIDATION_RULES.AVAILABILITY_STATUS,
        `products[${i}].availabilityStatus`
      )
      if (!availabilityStatusValidation.isValid) {
        return {
          isValid: false,
          error: availabilityStatusValidation.error,
          field: `products[${i}].availabilityStatus`
        }
      }
    }

    return { isValid: true, error: '', field: '' }
  }

  // Check if productSpec is provided (old format - backward compatibility)
  if (productSpec) {
    const productSpecValidation = validateField(
      productSpec,
      VALIDATION_RULES.PRODUCT_SPEC,
      'productSpec'
    )
    if (!productSpecValidation.isValid) {
      return {
        isValid: false,
        error: productSpecValidation.error,
        field: 'productSpec'
      }
    }

    return { isValid: true, error: '', field: '' }
  }

  // Neither format provided
  return {
    isValid: false,
    error: 'Either products array or productSpec is required',
    field: 'products'
  }
}

/**
 * Validates user permissions for RFP operations
 * @param {Object} user - User object
 * @param {string} operation - Operation type ('create', 'approve', 'list')
 * @returns {Object} { allowed: boolean, error: string }
 */
const validateRfpPermission = (user, operation) => {
  if (!user) {
    return {
      allowed: false,
      error: 'User not authenticated'
    }
  }

  switch (operation) {
    case 'create':
      if (user.role !== 'department_user' || !user.departmentType?.toLowerCase().includes('sales')) {
        return {
          allowed: false,
          error: 'Only salespersons can raise RFP'
        }
      }
      break

    case 'approve':
      if (user.role !== 'department_head') {
        return {
          allowed: false,
          error: 'Only department heads can approve RFP'
        }
      }
      break

    case 'list':
      // All authenticated users can list (with filters)
      break

    default:
      return {
        allowed: false,
        error: 'Invalid operation'
      }
  }

  return { allowed: true, error: '' }
}

module.exports = {
  validateRfpCreateRequest,
  validateRfpPermission,
  VALIDATION_RULES
}
