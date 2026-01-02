const BaseController = require('./BaseController');
const MonthlyHighlightsService = require('../services/monthlyHighlightsService');

class MonthlyHighlightsController extends BaseController {
  /**
   * GET /api/reports/monthly-highlights
   * Returns month-start highlight data for the logged-in user (winner / motivation)
   */
  static async getMonthlyHighlights(req, res) {
    await BaseController.handleAsyncOperation(
      res,
      async () => {
        if (req.user?.role === 'superadmin') {
          const departmentType = req.query.departmentType || 'office_sales';
          return await MonthlyHighlightsService.getSuperAdminMonthlyHighlights({
            user: req.user,
            departmentType
          });
        }
        return await MonthlyHighlightsService.getUserMonthlyHighlight({ user: req.user });
      },
      'Monthly highlights fetched successfully',
      'Failed to fetch monthly highlights'
    );
  }
}

module.exports = MonthlyHighlightsController;


