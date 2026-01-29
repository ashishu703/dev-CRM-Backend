/**
 * RFP Backend Helper Utilities - Algorithm-based helper functions
 * Reusable functions for RFP data processing and transformation
 */

/**
 * Transforms products array from child table format to pricing decision format
 * @param {Array} products - Array of products from rfp_request_products table
 * @returns {Array} Transformed products array
 */
const transformProductsForPricingDecision = (products) => {
  if (!Array.isArray(products)) return []
  
  return products.map(product => ({
    productSpec: product.product_spec || '',
    quantity: product.quantity || '',
    length: product.length || '',
    lengthUnit: product.length_unit || 'Mtr',
    targetPrice: product.target_price ? String(product.target_price) : ''
  }))
}

/**
 * Builds filter object for RFP list query based on user role and permissions
 * @param {Object} user - User object
 * @param {Object} queryParams - Query parameters (status, search, etc.)
 * @returns {Object} Filter object
 */
const buildRfpListFilters = (user, queryParams = {}) => {
  const filters = {}
  
  // Add status filter if provided
  if (queryParams.status) {
    filters.status = queryParams.status
  }
  
  // Add search filter if provided
  if (queryParams.search) {
    filters.search = queryParams.search
  }
  
  // Algorithm-based permission filtering
  if (user?.role === 'superadmin') {
    // Superadmin sees all RFPs - no additional filters
    return filters
  }
  
  if (user?.departmentType?.toLowerCase().includes('sales')) {
    if (user.role === 'department_head') {
      // Department Head sees RFPs from their department and company
      filters.departmentType = user.departmentType
      if (user.companyName) {
        filters.companyName = user.companyName
      }
    } else if (user.role === 'department_user') {
      // Salesperson sees only their own RFPs
      filters.createdBy = user.email
    }
  } else if (user?.companyName) {
    // Other departments filtered by company
    filters.companyName = user.companyName
  }
  
  return filters
}

/**
 * Builds pagination object from query parameters
 * @param {Object} queryParams - Query parameters (page, limit)
 * @returns {Object} Pagination object
 */
const buildPagination = (queryParams = {}) => {
  const page = parseInt(queryParams.page, 10) || 1
  const limit = Math.min(parseInt(queryParams.limit, 10) || 50, 200) // Max 200 per page
  
  return {
    limit,
    offset: (page - 1) * limit
  }
}

/**
 * Validates RFP approval prerequisites
 * @param {Object} rfp - RFP object
 * @returns {Object} { isValid: boolean, error: string }
 */
const validateRfpApproval = (rfp) => {
  if (!rfp) {
    return {
      isValid: false,
      error: 'RFP request not found'
    }
  }

  if (!rfp.products || !Array.isArray(rfp.products) || rfp.products.length === 0) {
    return {
      isValid: false,
      error: 'RFP request has no products'
    }
  }

  return { isValid: true, error: '' }
}

module.exports = {
  transformProductsForPricingDecision,
  buildRfpListFilters,
  buildPagination,
  validateRfpApproval
}
