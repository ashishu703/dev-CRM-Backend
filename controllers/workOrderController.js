const WorkOrder = require('../models/WorkOrder');
const RfpRequest = require('../models/RfpRequest');
const SalesOrder = require('../models/SalesOrder');
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
        workOrderNumber: req.body.workOrderNumber || req.body.work_order_number, // Handle both cases
        paymentId: req.body.paymentId || req.body.payment_id,
        quotationId: req.body.quotationId || req.body.quotation_id,
        leadId: req.body.leadId || req.body.lead_id,
        templateKey: req.body.templateKey || req.body.template_key || req.body.template,
        status: req.body.status || 'pending'
      };

      const result = await WorkOrder.create(workOrderData);
      const workOrder = result.rows[0];

      // Create sales order only if explicitly requested (DRY principle - no automatic creation)
      const shouldCreateSalesOrder = req.body.createSalesOrder === true; // Only create if explicitly requested
      
      if (shouldCreateSalesOrder) {
        try {
          const salesOrder = await SalesOrder.createFromWorkOrder(workOrder);
          console.log('✅ Sales order created:', salesOrder.sales_order_number);
        } catch (soError) {
          console.error('⚠️ Failed to create sales order:', soError.message);
          // Don't fail the work order creation if sales order fails
        }
      }

      res.status(201).json({
        success: true,
        message: 'Work order created successfully',
        data: workOrder
      });
    } catch (error) {
      console.error('Error creating work order:', error);
      
      // Check if it's a duplicate quotation error
      if (error.message.includes('already exists for quotation')) {
        return res.status(409).json({
          success: false,
          message: error.message,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create work order',
        error: error.message
      });
    }
  }

  /**
   * Check if work order exists for quotation
   */
  async checkQuotation(req, res) {
    try {
      const { quotationId } = req.params;
      
      if (!quotationId) {
        return res.status(400).json({
          success: false,
          message: 'Quotation ID is required'
        });
      }

      const existingWorkOrder = await WorkOrder.getByQuotationId(quotationId);
      
      res.json({
        success: true,
        exists: !!existingWorkOrder,
        data: existingWorkOrder
      });
    } catch (error) {
      console.error('Error checking quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check quotation',
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

      // Parse JSON fields (DRY principle)
      const parseJsonFields = (wo) => {
        const jsonFields = ['terms', 'items'];
        jsonFields.forEach(field => {
          if (wo[field] && typeof wo[field] === 'string') {
            try {
              wo[field] = JSON.parse(wo[field]);
            } catch (e) {
              wo[field] = field === 'items' ? [] : [];
            }
          }
        });
        return wo;
      };
      parseJsonFields(workOrder);

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
        quotationId: req.query.quotationId || req.query.quotation_id,
        status: req.query.status,
        operationsStatus: req.query.operationsStatus || req.query.operations_status,
        rfpRequestId: req.query.rfpRequestId || req.query.rfp_request_id
      };

      const workOrders = await WorkOrder.getAll(filters);

      // Parse JSON fields for each work order (DRY principle)
      const parseJsonFields = (workOrder) => {
        const jsonFields = ['terms', 'items'];
        jsonFields.forEach(field => {
          if (workOrder[field] && typeof workOrder[field] === 'string') {
            try {
              workOrder[field] = JSON.parse(workOrder[field]);
            } catch (e) {
              workOrder[field] = field === 'items' ? [] : [];
            }
          }
        });
        return workOrder;
      };

      workOrders.forEach(wo => parseJsonFields(wo));

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

  /**
   * Update work order status
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const updated = await WorkOrder.updateStatus(id, status);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Work order not found'
        });
      }

      res.json({
        success: true,
        message: 'Work order status updated successfully',
        data: updated
      });
    } catch (error) {
      console.error('Error updating work order status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update work order status',
        error: error.message
      });
    }
  }

  /**
   * Update work order (edit functionality)
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updated = await WorkOrder.update(id, updateData);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Work order not found or no changes made'
        });
      }

      // Update corresponding sales order
      try {
        await SalesOrder.updateFromWorkOrder(updated);
      } catch (soError) {
        console.error('⚠️ Failed to update sales order:', soError.message);
      }

      res.json({
        success: true,
        message: 'Work order updated successfully',
        data: updated
      });
    } catch (error) {
      console.error('Error updating work order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update work order',
        error: error.message
      });
    }
  }

  /**
   * Soft delete work order
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || req.body.userId;

      const deleted = await WorkOrder.softDelete(id, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Work order not found or already deleted'
        });
      }

      // Mark corresponding sales order as deleted
      try {
        await SalesOrder.markAsDeleted(id);
      } catch (soError) {
        console.error('⚠️ Failed to mark sales order as deleted:', soError.message);
      }

      res.json({
        success: true,
        message: 'Work order deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting work order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete work order',
        error: error.message
      });
    }
  }

  /**
   * Operations acknowledgement
   */
  async acknowledge(req, res) {
    try {
      const { id } = req.params;
      const { expectedOrderCreationDate } = req.body;
      const updated = await WorkOrder.update(id, {
        operations_status: 'acknowledged',
        operations_acknowledged_at: new Date().toISOString(),
        expected_order_creation_date: expectedOrderCreationDate || null
      });

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Work order not found' });
      }

      if (updated?.rfp_request_id) {
        await RfpRequest.logAction(
          updated.rfp_request_id,
          'work_order_acknowledged',
          req.user?.email || req.user?.username || 'system',
          req.user?.role,
          null,
          { expectedOrderCreationDate: expectedOrderCreationDate || null }
        );
      }

      res.json({ success: true, message: 'Work order acknowledged', data: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to acknowledge work order', error: error.message });
    }
  }

  /**
   * Operations cancellation
   */
  async cancel(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
      }

      const existing = await WorkOrder.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Work order not found' });
      }

      const currentOpsStatus = (existing.operations_status || '').toLowerCase();
      if (['in_production', 'completed'].includes(currentOpsStatus)) {
        return res.status(409).json({ success: false, message: 'Work order cannot be cancelled after production start' });
      }

      const updated = await WorkOrder.update(id, {
        status: 'cancelled',
        operations_status: 'cancelled',
        operations_cancelled_at: new Date().toISOString(),
        operations_cancelled_by: req.user?.email || req.user?.username || 'system',
        operations_cancel_reason: reason
      });

      if (updated?.rfp_request_id) {
        await RfpRequest.logAction(
          updated.rfp_request_id,
          'work_order_cancelled',
          req.user?.email || req.user?.username || 'system',
          req.user?.role,
          reason,
          { workOrderId: updated.id, workOrderNumber: updated.work_order_number }
        );
      }

      res.json({ success: true, message: 'Work order cancelled', data: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to cancel work order', error: error.message });
    }
  }

}

module.exports = new WorkOrderController();

