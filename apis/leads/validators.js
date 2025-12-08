const { body, query, param } = require('express-validator');
const salespersonAllowedPaymentStatuses = ['pending', 'advanced', 'remaining', 'completed'];
const salespersonAllowedPaymentModes = ['cash', 'upi', 'neft', 'rtgs', 'card', 'cheque', 'other'];
const connectedStatuses = ['connected', 'not_connected', 'next_meeting', 'pending', 'other'];
const finalStatuses = ['open', 'closed', 'next_meeting', 'order_confirmed', 'not_interested', 'other'];

// Validation rules for creating a lead
const createLeadSchema = [
  body('name')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return value.length >= 2 && value.length <= 255;
    })
    .withMessage('Name must be between 2 and 255 characters'),
  
  body('phone')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[6-9]\d{9}$/.test(value);
    })
    .withMessage('Please provide a valid Indian phone number'),
  
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '' || value === 'N/A' || String(value).trim().toLowerCase() === 'n/a') {
        return true;
      }
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    })
    .withMessage('Please provide a valid email address'),
  
  body('business')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Business name must not exceed 255 characters'),
  
  body('address')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Address must not exceed 1000 characters'),
  
  body('gstNo')
    .optional()
    .custom((_value) => true),
  
  body('productType')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Product type must not exceed 100 characters'),
  
  body('state')
    .optional()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters'),
  
  body('leadSource')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Lead source must not exceed 100 characters'),
  
  body('customerType')
    .optional()
    .isIn(['individual', 'business', 'corporate'])
    .withMessage('Customer type must be one of: individual, business, corporate'),
  
  body('date')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return !isNaN(Date.parse(value));
    })
    .withMessage('Please provide a valid date'),
  
  body('connectedStatus')
    .optional()
    .isIn(['connected', 'not_connected', 'pending'])
    .withMessage('Connected status must be one of: connected, not_connected, pending'),
  
  body('finalStatus')
    .optional()
    .isIn(['open', 'closed', 'next_meeting'])
    .withMessage('Final status must be one of: open, closed, next_meeting'),
  
  body('whatsapp')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[6-9]\d{9}$/.test(value);
    })
    .withMessage('Please provide a valid WhatsApp number'),
  
  body('category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  
  body('assignedSalesperson')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Assigned salesperson must not exceed 255 characters'),
  
  body('assignedTelecaller')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Assigned telecaller must not exceed 255 characters')
];

// Validation rules for updating a lead
const updateLeadSchema = [
  body('name')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return value.length >= 2 && value.length <= 255;
    })
    .withMessage('Name must be between 2 and 255 characters'),
  
  body('phone')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[6-9]\d{9}$/.test(value);
    })
    .withMessage('Please provide a valid Indian phone number'),
  
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '' || value === 'N/A' || (typeof value === 'string' && value.trim().toLowerCase() === 'n/a')) {
        return true;
      }
      const emailStr = String(value).trim();
      if (emailStr === '' || emailStr.toLowerCase() === 'n/a') {
        return true; // Treat as no email
      }
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
    })
    .withMessage('Please provide a valid email address'),
  
  body('business')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Business name must not exceed 255 characters'),
  
  body('address')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Address must not exceed 1000 characters'),
  
  body('gstNo')
    .optional()
    .custom((_value) => true),
  
  body('productType')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Product type must not exceed 100 characters'),
  
  body('state')
    .optional()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters'),
  
  body('leadSource')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Lead source must not exceed 100 characters'),
  
  body('customerType')
    .optional()
    .isIn(['individual', 'business', 'corporate'])
    .withMessage('Customer type must be one of: individual, business, corporate'),
  
  body('date')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return !isNaN(Date.parse(value));
    })
    .withMessage('Please provide a valid date'),
  
  body('connectedStatus')
    .optional()
    .isIn(['connected', 'not_connected', 'pending'])
    .withMessage('Connected status must be one of: connected, not_connected, pending'),
  
  body('finalStatus')
    .optional()
    .isIn(['open', 'closed', 'next_meeting'])
    .withMessage('Final status must be one of: open, closed, next_meeting'),
  
  body('whatsapp')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[6-9]\d{9}$/.test(value);
    })
    .withMessage('Please provide a valid WhatsApp number'),
  
  body('category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  
  body('assignedSalesperson')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Assigned salesperson must not exceed 255 characters'),
  
  body('assignedTelecaller')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Assigned telecaller must not exceed 255 characters')
];

// Validation rules for query parameters
const querySchema = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  
  query('search')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Search term must not exceed 255 characters'),
  
  query('state')
    .optional()
    .isLength({ max: 100 })
    .withMessage('State filter must not exceed 100 characters'),
  
  query('productType')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Product type filter must not exceed 100 characters'),
  
  query('connectedStatus')
    .optional()
    .isIn(['connected', 'not_connected', 'pending'])
    .withMessage('Connected status filter must be one of: connected, not_connected, pending'),
  
  query('createdBy')
    .optional()
    .isEmail()
    .withMessage('Created by filter must be a valid email address')
];

// Validation rules for CSV import
const importCSVSchema = [
  body('leads')
    .isArray({ min: 1 })
    .withMessage('Leads data must be a non-empty array')
];

// Validation rules for ID parameter
const idParamSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lead ID must be a positive integer')
];

// Validation rules for batch update
// Validation schema for bulk delete
const bulkDeleteSchema = [
  body('ids')
    .isArray({ min: 1 })
    .withMessage('ids must be a non-empty array')
    .custom((ids) => {
      return ids.every(id => Number.isInteger(id) && id > 0);
    })
    .withMessage('All IDs must be positive integers')
];

const batchUpdateSchema = [
  body('ids')
    .isArray({ min: 1 })
    .withMessage('ids must be a non-empty array'),
  body('ids.*')
    .isInt({ min: 1 })
    .withMessage('Each id must be a positive integer'),
  body('updateData')
    .isObject()
    .withMessage('updateData must be an object')
];

module.exports = {
  createLeadSchema,
  updateLeadSchema,
  querySchema,
  importCSVSchema,
  idParamSchema,
  batchUpdateSchema,
  bulkDeleteSchema,
  salespersonLeadUpdateSchema: []
};
