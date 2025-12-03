const WorkOrder = require('../models/WorkOrder');
const { validationResult } = require('express-validator');

/**
 * WorkOrderController class
 * Follows OOP principles for work order operations
 */
class WorkOrderController {
  /**
   * Create a new work order
   */
  async create(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const workOrderData = {
        ...req.body,
        paymentId: req.body.paymentId || req.body.payment_id,
        quotationId: req.body.quotationId || req.body.quotation_id,
        leadId: req.body.leadId || req.body.lead_id
      };

      const result = await WorkOrder.create(workOrderData);

      res.status(201).json({
        success: true,
        message: 'Work order created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating work order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create work order',
        error: error.message
      });
    }
  }

  /**
   * Get work order by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const workOrder = await WorkOrder.getById(id);

      if (!workOrder) {
        return res.status(404).json({
          success: false,
          message: 'Work order not found'
        });
      }

      // Parse terms if it's a JSON string
      if (workOrder.terms && typeof workOrder.terms === 'string') {
        try {
          workOrder.terms = JSON.parse(workOrder.terms);
        } catch (e) {
          workOrder.terms = [];
        }
      }

      res.json({
        success: true,
        data: workOrder
      });
    } catch (error) {
      console.error('Error fetching work order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch work order',
        error: error.message
      });
    }
  }

  /**
   * Get all work orders
   */
  async getAll(req, res) {
    try {
      const filters = {
        paymentId: req.query.paymentId || req.query.payment_id,
        quotationId: req.query.quotationId || req.query.quotation_id
      };

      const workOrders = await WorkOrder.getAll(filters);

      // Parse terms for each work order
      workOrders.forEach(wo => {
        if (wo.terms && typeof wo.terms === 'string') {
          try {
            wo.terms = JSON.parse(wo.terms);
          } catch (e) {
            wo.terms = [];
          }
        }
      });

      res.json({
        success: true,
        data: workOrders
      });
    } catch (error) {
      console.error('Error fetching work orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch work orders',
        error: error.message
      });
    }
  }
}

module.exports = new WorkOrderController();

