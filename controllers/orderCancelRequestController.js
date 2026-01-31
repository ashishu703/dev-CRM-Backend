const OrderCancelRequest = require('../models/OrderCancelRequest');
const Quotation = require('../models/Quotation');
const { query } = require('../config/database');

const isDepartment = (user, keyword) => {
  const dept = (user?.departmentType || '').toLowerCase();
  return dept.includes(keyword);
};

class OrderCancelRequestController {
  // Salesperson: request order cancel
  async requestCancel(req, res) {
    try {
      const { quotationId, reason } = req.body;
      const userId = req.user?.id ?? req.user?._id;
      const userEmail = req.user?.email;

      if (!quotationId) {
        return res.status(400).json({ success: false, message: 'quotationId is required' });
      }

      // Get quotation to ensure it exists and get customer_id
      const qRes = await query(
        'SELECT id, customer_id, status FROM quotations WHERE id::text = $1 LIMIT 1',
        [quotationId]
      );
      const quotation = qRes.rows?.[0];
      if (!quotation) {
        return res.status(404).json({ success: false, message: 'Quotation not found' });
      }
      if (quotation.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'Order is already cancelled' });
      }

      const customerId = String(quotation.customer_id ?? '');

      // Check if there is already a pending request for this quotation
      const existing = await OrderCancelRequest.getByQuotationId(quotationId);
      if (existing && existing.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'A cancel request is already pending for this order. Wait for department head approval.'
        });
      }
      if (existing && existing.status === 'approved') {
        return res.status(400).json({ success: false, message: 'Order is already cancelled' });
      }

      const request = await OrderCancelRequest.createRequest({
        quotationId: quotationId,
        customerId,
        requestedBy: userEmail || userId,
        reason: reason || null
      });

      return res.status(201).json({
        success: true,
        message: 'Order cancel request submitted. Pending department head approval.',
        data: request
      });
    } catch (error) {
      console.error('Order cancel request error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to submit cancel request',
        error: error.message
      });
    }
  }

  // Get cancel request status for a quotation (salesperson / any authenticated)
  async getByQuotation(req, res) {
    try {
      const { quotationId } = req.params;
      if (!quotationId) {
        return res.status(400).json({ success: false, message: 'quotationId is required' });
      }
      const request = await OrderCancelRequest.getByQuotationId(quotationId);
      if (!request) {
        return res.json({ success: true, data: null });
      }
      return res.json({ success: true, data: request });
    } catch (error) {
      console.error('Get order cancel by quotation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch cancel request',
        error: error.message
      });
    }
  }

  // Get cancel requests for a customer/lead (for lead details)
  async getByCustomer(req, res) {
    try {
      const { customerId } = req.params;
      if (!customerId) {
        return res.status(400).json({ success: false, message: 'customerId is required' });
      }
      const requests = await OrderCancelRequest.getByCustomerId(customerId);
      return res.json({ success: true, data: requests || [] });
    } catch (error) {
      console.error('Get order cancel by customer error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch cancel requests',
        error: error.message
      });
    }
  }

  // Department head: list pending cancel requests
  async getPending(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user?.role !== 'department_head') {
        return res.status(403).json({
          success: false,
          message: 'Only sales department head can view pending cancel requests'
        });
      }
      const list = await OrderCancelRequest.getPending();
      return res.json({ success: true, data: list });
    } catch (error) {
      console.error('Get pending order cancels error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch pending cancel requests',
        error: error.message
      });
    }
  }

  // Department head: approve cancel request → mark quotation as cancelled
  async approve(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user?.role !== 'department_head') {
        return res.status(403).json({
          success: false,
          message: 'Only sales department head can approve cancel requests'
        });
      }
      const { id } = req.params;
      const approvedBy = req.user?.email ?? req.user?.id;

      const request = await OrderCancelRequest.getById(id);
      if (!request) {
        return res.status(404).json({ success: false, message: 'Cancel request not found' });
      }
      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Request is already ${request.status}`
        });
      }

      const updated = await OrderCancelRequest.approve(id, approvedBy);
      if (!updated) {
        return res.status(400).json({ success: false, message: 'Could not approve request' });
      }

      // Mark quotation as cancelled
      await query(
        `UPDATE quotations SET status = 'cancelled', updated_at = NOW() WHERE id::text = $1`,
        [request.quotation_id]
      );

      return res.json({
        success: true,
        message: 'Order cancel approved. Quotation has been marked as cancelled.',
        data: updated
      });
    } catch (error) {
      console.error('Approve order cancel error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to approve cancel request',
        error: error.message
      });
    }
  }

  // Department head: reject cancel request
  async reject(req, res) {
    try {
      if (!isDepartment(req.user, 'sales') || req.user?.role !== 'department_head') {
        return res.status(403).json({
          success: false,
          message: 'Only sales department head can reject cancel requests'
        });
      }
      const { id } = req.params;
      const { rejectionReason } = req.body;
      const rejectedBy = req.user?.email ?? req.user?.id;

      const request = await OrderCancelRequest.getById(id);
      if (!request) {
        return res.status(404).json({ success: false, message: 'Cancel request not found' });
      }
      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Request is already ${request.status}`
        });
      }

      const updated = await OrderCancelRequest.reject(id, rejectedBy, rejectionReason);
      if (!updated) {
        return res.status(400).json({ success: false, message: 'Could not reject request' });
      }

      return res.json({
        success: true,
        message: 'Order cancel request rejected.',
        data: updated
      });
    } catch (error) {
      console.error('Reject order cancel error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reject cancel request',
        error: error.message
      });
    }
  }
}

module.exports = new OrderCancelRequestController();
