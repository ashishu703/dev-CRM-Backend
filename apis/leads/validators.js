const { body, query, param } = require('express-validator');
const salespersonAllowedPaymentStatuses = ['pending', 'advanced', 'remaining', 'completed'];
const salespersonAllowedPaymentModes = ['cash', 'upi', 'neft', 'rtgs', 'card', 'cheque', 'other'];
const connectedStatuses = ['connected', 'not_connected', 'next_meeting', 'pending', 'other'];
const finalStatuses = ['open', 'closed', 'next_meeting', 'order_confirmed', 'not_interested', 'other'];

// Validation rules for creating a lead
const createLeadSchema = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  
  body('phone')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[6-9]\d{9}$/.test(value);
    })
    .withMessage('Please provide a valid Indian phone number'),
  
  body('email')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  
  body('phone')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[6-9]\d{9}$/.test(value);
    })
    .withMessage('Please provide a valid Indian phone number'),
  
  body('email')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
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
    .withMessage('Leads data must be a non-empty array'),
  
  body('leads.*.name')
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  
  body('leads.*.phone')
    .optional()
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid Indian phone number for all leads'),
  
  body('leads.*.email')
    .optional()
    .isEmail()
    .withMessage('Please provide valid email addresses'),
  
  body('leads.*.business')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Business name must not exceed 255 characters'),
  
  body('leads.*.address')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Address must not exceed 1000 characters'),
  
  body('leads.*.gstNo')
    .optional()
    .custom((_value) => true),
  
  body('leads.*.productType')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Product type must not exceed 100 characters'),
  
  body('leads.*.state')
    .optional()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters'),
  
  body('leads.*.leadSource')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Lead source must not exceed 100 characters'),
  
  body('leads.*.customerType')
    .optional()
    .isIn(['individual', 'business', 'corporate'])
    .withMessage('Customer type must be one of: individual, business, corporate'),
  
  body('leads.*.date')
    .optional()
    .isISO8601()
    .withMessage('Please provide valid dates'),
  
  body('leads.*.connectedStatus')
    .optional()
    .isIn(['connected', 'not_connected', 'pending'])
    .withMessage('Connected status must be one of: connected, not_connected, pending'),
  
  body('leads.*.finalStatus')
    .optional()
    .isIn(['open', 'closed', 'next_meeting'])
    .withMessage('Final status must be one of: open, closed, next_meeting'),
  
  body('leads.*.whatsapp')
    .optional()
    .isMobilePhone('en-IN')
    .withMessage('Please provide valid WhatsApp numbers'),
  
  body('leads.*.category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  
  body('leads.*.assignedSalesperson')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Assigned salesperson must not exceed 255 characters'),
  
  body('leads.*.assignedTelecaller')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Assigned telecaller must not exceed 255 characters')
];

// Validation rules for ID parameter
const idParamSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lead ID must be a positive integer')
];

module.exports = {
  createLeadSchema,
  updateLeadSchema,
  querySchema,
  importCSVSchema,
  idParamSchema,
  // Salesperson lead update validators
  salespersonLeadUpdateSchema: [
    body('name').optional().isLength({ min: 2, max: 255 }),
    body('phone').optional().custom((value) => { if (value === null || value === undefined || value === '') return true; return /^[6-9]\d{9}$/.test(value); }),
    body('email').optional().custom((value) => { if (value === null || value === undefined || value === '') return true; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }),
    body('business').optional().isLength({ max: 255 }),
    body('address').optional().isLength({ max: 1000 }),
    body('gst_no').optional().custom((_v) => true),
    body('product_type').optional().isLength({ max: 255 }),
    body('state').optional().isLength({ max: 100 }),
    body('lead_source').optional().isLength({ max: 100 }),
    body('customer_type').optional().isLength({ max: 50 }),
    body('date').optional().custom((value) => { if (value === null || value === undefined || value === '') return true; return !isNaN(Date.parse(value)); }),
    body('whatsapp').optional().custom((value) => { if (value === null || value === undefined || value === '') return true; return /^[6-9]\d{9}$/.test(value); }),
    body('connected_status')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        return connectedStatuses.includes(value);
      })
      .withMessage(`connected_status must be one of: ${connectedStatuses.join(', ')}`),

    body('connected_status_remark')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('connected_status_remark must not exceed 2000 characters'),

    body('final_status')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        return finalStatuses.includes(value);
      })
      .withMessage(`final_status must be one of: ${finalStatuses.join(', ')}`),
    body('call_recording_url')
      .optional()
      .isString(),

    body('final_status_remark')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('final_status_remark must not exceed 2000 characters'),

    body('quotation_url')
      .optional()
      .isString(),

    body('quotation_count')
      .optional()
      .isInt({ min: 0 })
      .withMessage('quotation_count must be a non-negative integer'),

    body('proforma_invoice_url')
      .optional()
      .isString(),

    body('payment_status')
      .optional()
      .isIn(salespersonAllowedPaymentStatuses)
      .withMessage(`payment_status must be one of: ${salespersonAllowedPaymentStatuses.join(', ')}`),

    body('payment_mode')
      .optional()
      .isIn(salespersonAllowedPaymentModes)
      .withMessage(`payment_mode must be one of: ${salespersonAllowedPaymentModes.join(', ')}`),

    body('payment_receipt_url')
      .optional()
      .isString(),

    body('transferred_to')
      .optional()
      .isLength({ max: 255 })
      .withMessage('transferred_to must not exceed 255 characters'),

    body('call_duration_seconds')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        return Number.isInteger(Number(value)) && Number(value) >= 0;
      })
      .withMessage('call_duration_seconds must be a non-negative integer')
  ]
};
