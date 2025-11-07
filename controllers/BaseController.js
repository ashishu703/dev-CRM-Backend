const logger = require('../utils/logger');

class BaseController {
  static handleResponse(res, data, message = 'Success', statusCode = 200) {
    res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  static handleError(res, error, message = 'Operation failed', statusCode = 500) {
    logger.error(`${this.constructor.name} error:`, error);
    res.status(statusCode).json({
      success: false,
      error: message,
      message: message // Also include as 'message' for frontend compatibility
    });
  }

  static validateRequiredFields(fields, data) {
    const missing = fields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  static async handleAsyncOperation(res, operation, successMessage, errorMessage) {
    try {
      const result = await operation();
      this.handleResponse(res, result, successMessage);
    } catch (error) {
      // Use the actual error message if available, otherwise use the default error message
      const message = error?.message || errorMessage;
      const statusCode = error?.statusCode || 400; // Use 400 for validation errors, 500 for server errors
      this.handleError(res, error, message, statusCode);
    }
  }
}

module.exports = BaseController;
