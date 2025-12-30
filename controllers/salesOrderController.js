const SalesOrder = require('../models/SalesOrder');
const { validationResult } = require('express-validator');

/**
 * SalesOrderController class
 * Manages sales orders for Production Department Head
 */
class SalesOrderController {
  /**
   * Get all sales orders
   */
  async getAll(req, res) {
    try {
      const filters = {
        status: req.query.status,
        paymentStatus: req.query.paymentStatus || req.query.payment_status,
        priority: req.query.priority,
        search: req.query.search,
        limit: parseInt(req.query.limit) || undefined,
        offset: parseInt(req.query.offset) || undefined
      };

      const salesOrders = await SalesOrder.getAll(filters);

      res.json({
        success: true,
        data: salesOrders,
        count: salesOrders.length
      });
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sales orders',
        error: error.message
      });
    }
  }

  /**
   * Get sales order by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const salesOrder = await SalesOrder.getById(id);

      if (!salesOrder) {
        return res.status(404).json({
          success: false,
          message: 'Sales order not found'
        });
      }

      res.json({
        success: true,
        data: salesOrder
      });
    } catch (error) {
      console.error('Error fetching sales order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sales order',
        error: error.message
      });
    }
  }

  /**
   * Update sales order
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updated = await SalesOrder.update(id, updateData);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Sales order not found'
        });
      }

      res.json({
        success: true,
        message: 'Sales order updated successfully',
        data: updated
      });
    } catch (error) {
      console.error('Error updating sales order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update sales order',
        error: error.message
      });
    }
  }

  /**
   * Delete sales order (soft delete)
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await SalesOrder.softDelete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Sales order not found'
        });
      }

      res.json({
        success: true,
        message: 'Sales order deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting sales order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete sales order',
        error: error.message
      });
    }
  }

  /**
   * Get sales order statistics
   */
  async getStatistics(req, res) {
    try {
      const stats = await SalesOrder.getStatistics();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics',
        error: error.message
      });
    }
  }
}

module.exports = new SalesOrderController();

