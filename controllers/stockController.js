const Stock = require('../models/Stock');
const logger = require('../utils/logger');

class StockController {
  /**
   * Get all stock records
   * GET /api/stock
   */
  async getAllStock(req, res) {
    try {
      const stock = await Stock.getAll();
      
      res.json({
        success: true,
        data: stock
      });
    } catch (error) {
      logger.error('Error fetching stock:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch stock',
        error: error.message
      });
    }
  }

  /**
   * Get stock by product name
   * GET /api/stock/:productName
   */
  async getStockByProduct(req, res) {
    try {
      const { productName } = req.params;
      const stock = await Stock.getByProductName(productName);
      
      if (!stock) {
        return res.status(404).json({
          success: false,
          message: 'Stock record not found'
        });
      }
      
      res.json({
        success: true,
        data: stock
      });
    } catch (error) {
      logger.error('Error fetching stock by product:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch stock',
        error: error.message
      });
    }
  }

  /**
   * Update stock for a product
   * PUT /api/stock/:productName
   */
  async updateStock(req, res) {
    try {
      const { productName } = req.params;
      const { quantity, unit, status } = req.body;
      const updatedBy = req.user?.username || req.user?.name || 'unknown';
      
      if (quantity === undefined && status === undefined) {
        return res.status(400).json({
          success: false,
          message: 'quantity or status is required'
        });
      }
      
      const stock = await Stock.updateStock(productName, {
        quantity,
        unit,
        status,
        updated_by: updatedBy
      });
      
      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: stock
      });
    } catch (error) {
      logger.error('Error updating stock:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update stock',
        error: error.message
      });
    }
  }

  /**
   * Batch update multiple stock records
   * PUT /api/stock/batch
   */
  async batchUpdateStock(req, res) {
    try {
      const { updates } = req.body;
      const updatedBy = req.user?.username || req.user?.name || 'unknown';
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'updates array is required and must not be empty'
        });
      }
      
      // Add updated_by to each update
      const stockUpdates = updates.map(update => ({
        ...update,
        updated_by: updatedBy
      }));
      
      const results = await Stock.batchUpdate(stockUpdates);
      
      res.json({
        success: true,
        message: `Successfully updated ${results.length} stock records`,
        data: results
      });
    } catch (error) {
      logger.error('Error batch updating stock:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to batch update stock',
        error: error.message
      });
    }
  }
}

module.exports = new StockController();

