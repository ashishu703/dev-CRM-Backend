const MarketingOrder = require('../models/MarketingOrder');
const logger = require('../utils/logger');

class MarketingOrderController {
  /**
   * Create a new order
   * POST /api/marketing/orders
   */
  async create(req, res) {
    try {
      const {
        lead_number,
        customer_name,
        customer_phone,
        customer_address,
        customer_gst,
        product_name,
        product_type,
        quantity,
        unit_price,
        total_amount,
        order_date,
        expected_delivery_date,
        delivered_date,
        order_status,
        dispatch_from,
        work_order,
        payment_status,
        paid_amount,
        notes,
        order_history
      } = req.body;

      // Validation
      if (!lead_number || !customer_name || !product_name || !product_type || !order_date) {
        return res.status(400).json({
          success: false,
          message: 'lead_number, customer_name, product_name, product_type, and order_date are required'
        });
      }

      if (!['Cable', 'Conductor'].includes(product_type)) {
        return res.status(400).json({
          success: false,
          message: 'product_type must be either "Cable" or "Conductor"'
        });
      }

      const created_by = req.user?.email || req.user?.username || 'unknown';

      // Default order_history if not provided
      const defaultOrderHistory = order_history || [{
        date: order_date,
        status: 'Order Placed',
        description: 'Order created by marketing team'
      }];

      const order = await MarketingOrder.create({
        lead_number,
        customer_name,
        customer_phone: customer_phone || null,
        customer_address: customer_address || null,
        customer_gst: customer_gst || null,
        product_name,
        product_type,
        quantity: quantity || 1,
        unit_price: unit_price || 0,
        total_amount: total_amount || 0,
        order_date,
        expected_delivery_date: expected_delivery_date || null,
        delivered_date: delivered_date || null,
        order_status: order_status || 'Pending',
        dispatch_from: dispatch_from || 'Plant',
        work_order: work_order || null,
        payment_status: payment_status || 'Not Started',
        paid_amount: paid_amount || 0,
        notes: notes || null,
        order_history: defaultOrderHistory,
        created_by
      });

      logger.info('Marketing order created:', { lead_number, created_by });

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: order
      });
    } catch (error) {
      logger.error('Error creating marketing order:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create order',
        error: error.message
      });
    }
  }

  /**
   * Get all orders (for logged-in salesperson)
   * GET /api/marketing/orders
   */
  async getAll(req, res) {
    try {
      const filters = {};

      // Filter by created_by (salesperson) - only show orders created by logged-in user
      const userEmail = req.user?.email || req.user?.username;
      if (userEmail) {
        filters.created_by = userEmail;
      }

      // Optional query filters
      if (req.query.order_status) {
        filters.order_status = req.query.order_status;
      }

      if (req.query.payment_status) {
        filters.payment_status = req.query.payment_status;
      }

      if (req.query.order_date) {
        filters.order_date = req.query.order_date;
      }

      if (req.query.customer_name) {
        filters.customer_name = req.query.customer_name;
      }

      const orders = await MarketingOrder.getAll(filters);

      res.json({
        success: true,
        data: orders,
        count: orders.length
      });
    } catch (error) {
      logger.error('Error fetching marketing orders:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch orders',
        error: error.message
      });
    }
  }

  /**
   * Get order by ID
   * GET /api/marketing/orders/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const order = await MarketingOrder.getById(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check if order belongs to logged-in user
      const userEmail = req.user?.email || req.user?.username;
      if (order.created_by !== userEmail) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this order'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      logger.error('Error fetching marketing order:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch order',
        error: error.message
      });
    }
  }

  /**
   * Update order
   * PUT /api/marketing/orders/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // First check if order exists and belongs to user
      const existingOrder = await MarketingOrder.getById(id);
      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      const userEmail = req.user?.email || req.user?.username;
      if (existingOrder.created_by !== userEmail) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this order'
        });
      }

      // If order_history is being updated, merge with existing history
      if (updateData.order_history && Array.isArray(updateData.order_history)) {
        const existingHistory = existingOrder.order_history || [];
        updateData.order_history = [...existingHistory, ...updateData.order_history];
      }

      const updatedOrder = await MarketingOrder.update(id, updateData);

      logger.info('Marketing order updated:', { order_id: id });

      res.json({
        success: true,
        message: 'Order updated successfully',
        data: updatedOrder
      });
    } catch (error) {
      logger.error('Error updating marketing order:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update order',
        error: error.message
      });
    }
  }

  /**
   * Delete order
   * DELETE /api/marketing/orders/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      // First check if order exists and belongs to user
      const existingOrder = await MarketingOrder.getById(id);
      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      const userEmail = req.user?.email || req.user?.username;
      if (existingOrder.created_by !== userEmail) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this order'
        });
      }

      const deleted = await MarketingOrder.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      logger.info('Marketing order deleted:', { order_id: id });

      res.json({
        success: true,
        message: 'Order deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting marketing order:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete order',
        error: error.message
      });
    }
  }
}

module.exports = new MarketingOrderController();

