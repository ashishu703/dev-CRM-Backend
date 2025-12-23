const SalespersonReportService = require('../services/salespersonReportService');
const BaseController = require('./BaseController');
const logger = require('../utils/logger');

/**
 * Salesperson Report Controller
 * Handles HTTP requests for salesperson reports
 */
class SalespersonReportController extends BaseController {
  /**
   * Get Activity Report
   * GET /api/reports/salesperson/activity/:salespersonUsername
   */
  static async getActivityReport(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { salespersonUsername } = req.params;
      const { startDate, endDate } = req.query;

      if (!salespersonUsername) {
        throw new Error('Salesperson username is required');
      }

      const report = await SalespersonReportService.getActivityReport(
        salespersonUsername,
        startDate || null,
        endDate || null
      );

      return report;
    }, 'Activity report fetched successfully', 'Failed to fetch activity report');
  }

  /**
   * Get Performance Report
   * GET /api/reports/salesperson/performance/:salespersonUsername
   */
  static async getPerformanceReport(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { salespersonUsername } = req.params;
      const { startDate, endDate } = req.query;

      if (!salespersonUsername) {
        throw new Error('Salesperson username is required');
      }

      const report = await SalespersonReportService.getPerformanceReport(
        salespersonUsername,
        startDate || null,
        endDate || null
      );

      return report;
    }, 'Performance report fetched successfully', 'Failed to fetch performance report');
  }

  /**
   * Get Top Performer Comparison Report
   * GET /api/reports/salesperson/top-performers
   */
  static async getTopPerformerComparison(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { startDate, endDate, departmentType } = req.query;

      const report = await SalespersonReportService.getTopPerformerComparison(
        startDate || null,
        endDate || null,
        departmentType || null
      );

      return report;
    }, 'Top performer comparison report fetched successfully', 'Failed to fetch top performer comparison');
  }

  /**
   * Get all salespersons list
   * GET /api/reports/salesperson/list
   */
  static async getSalespersonsList(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { departmentType } = req.query;

      const result = await SalespersonReportService.getAllSalespersons(departmentType || null);
      
      return {
        salespersons: result.rows || []
      };
    }, 'Salespersons list fetched successfully', 'Failed to fetch salespersons list');
  }
}

module.exports = SalespersonReportController;

