const OrdersReportService = require('../services/ordersReportService');
const BaseController = require('./BaseController');

class OrdersReportController extends BaseController {
  /**
   * Get Orders Report
   * GET /api/reports/orders?salesperson=username&startDate=2024-01-01&endDate=2024-12-31
   */
  static async getOrdersReport(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { salesperson, startDate, endDate } = req.query;
      
      const report = await OrdersReportService.getOrdersReport(
        salesperson || null,
        startDate || null,
        endDate || null
      );
      
      return report;
    }, 'Orders report fetched successfully', 'Failed to fetch orders report');
  }

  /**
   * Get all salespersons who have orders
   * GET /api/reports/orders/salespersons
   */
  static async getSalespersonsWithOrders(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const result = await OrdersReportService.getSalespersonsWithOrders();
      
      return {
        salespersons: result.rows || []
      };
    }, 'Salespersons with orders fetched successfully', 'Failed to fetch salespersons with orders');
  }
}

module.exports = OrdersReportController;

