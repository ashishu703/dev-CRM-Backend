const Payment = require('../models/Payment');
const CustomerCredit = require('../models/CustomerCredit');
const { getClient, query } = require('../config/database');

class PaymentController {
  /**
   * Create payment installment with automatic calculations
   * Handles: installments, remaining balance, credit management
   */
  async create(req, res) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const {
        lead_id,
        quotation_id,
        pi_id,
        installment_amount,
        payment_method,
        payment_date,
        payment_reference: customReference,
        payment_receipt_url,
        remarks,
        notes,
        purchase_order_id,
        delivery_date,
        delivery_status
      } = req.body;

      // Validate at least one identifier
      if (!lead_id && !quotation_id) {
        throw new Error('Either lead_id or quotation_id is required');
      }

      const installmentAmt = Number(installment_amount);
      if (!installmentAmt || installmentAmt <= 0) {
        throw new Error('installment_amount must be greater than 0');
      }

      // Get lead information
      let lead = null;
      if (lead_id) {
        const leadRes = await client.query('SELECT * FROM leads WHERE id = $1', [lead_id]);
        lead = leadRes.rows[0] || null;
      }

      // Helper to validate UUIDs
      const isUuid = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);

      // Normalize identifiers expected to be UUIDs
      const safeQuotationId = isUuid(quotation_id) ? quotation_id : null;
      const safePiId = isUuid(pi_id) ? pi_id : null;

      // Get quotation if provided and is a valid UUID
      let quotation = null;
      let quotationTotal = 0;
      let paidSoFar = 0;
      let remainingBefore = 0;
      let installmentNumber = 1;

      if (safeQuotationId) {
        const quotRes = await client.query(
          'SELECT * FROM quotations WHERE id = $1',
          [safeQuotationId]
        );
        quotation = quotRes.rows[0];
        
        if (!quotation) {
          throw new Error('Quotation not found');
        }

        if (quotation.status !== 'approved' && quotation.status !== 'completed') {
          throw new Error('Quotation must be approved before payment');
        }

        quotationTotal = Number(quotation.total_amount);

        // Calculate paid amount so far (only approved payments)
        const paidRes = await client.query(
          `SELECT COALESCE(SUM(installment_amount), 0) as paid
           FROM payment_history
           WHERE quotation_id = $1 AND approval_status = 'approved' AND is_refund = false`,
          [safeQuotationId]
        );
        paidSoFar = Number(paidRes.rows[0].paid);
        remainingBefore = Math.max(0, quotationTotal - paidSoFar);

        // Get next installment number
        const instRes = await client.query(
          `SELECT COALESCE(MAX(installment_number), 0) + 1 as next_num
           FROM payment_history
           WHERE quotation_id = $1`,
          [safeQuotationId]
        );
        installmentNumber = instRes.rows[0].next_num;
      }

      // Calculate payment distribution
      let appliedToQuotation = 0;
      let overpaidAmount = 0;
      let remainingAfter = 0;

      if (safeQuotationId && remainingBefore > 0) {
        appliedToQuotation = Math.min(installmentAmt, remainingBefore);
        overpaidAmount = Math.max(0, installmentAmt - appliedToQuotation);
        remainingAfter = remainingBefore - appliedToQuotation;
      } else if (!safeQuotationId) {
        // No quotation: entire amount goes to credit
        overpaidAmount = installmentAmt;
        remainingAfter = 0;
      } else {
        // Quotation fully paid: entire amount is overpayment
        overpaidAmount = installmentAmt;
        remainingAfter = 0;
      }

      // If still no lead resolved, derive from quotation or create minimal
      if (!lead) {
        if (quotation) {
          const lRes = await client.query('SELECT * FROM leads WHERE id = $1', [quotation.customer_id]);
          lead = lRes.rows[0] || null;
          if (!lead) {
            const c = await client.query(
              `INSERT INTO leads (name, phone, email, business, address, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
              [
                quotation.customer_name || 'N/A',
                quotation.customer_phone || 'NA',
                quotation.customer_email || null,
                quotation.customer_business || null,
                quotation.customer_address || null,
                req.user?.email || 'system'
              ]
            );
            lead = c.rows[0];
          }
        } else {
          throw new Error('Lead not found');
        }
      }

      // Update customer credit if overpaid
      // Resolve final lead id for downstream usage
      const finalLeadId = lead?.id;

      if (overpaidAmount > 0) {
        await CustomerCredit.incrementBalance(finalLeadId, overpaidAmount, client);
      }

      // Get current credit balance
      const creditRes = await client.query(
        'SELECT COALESCE(balance, 0) as balance FROM customer_credits WHERE customer_id = $1',
        [finalLeadId]
      );
      const availableCredit = Number(creditRes.rows[0]?.balance || 0);

      // Generate payment reference
      const paymentReference = customReference || await Payment.generatePaymentReference();

      // Calculate total paid after this installment
      const totalPaidAfter = paidSoFar + appliedToQuotation;

      // Insert payment record with pending approval status
      const insertQuery = `
        INSERT INTO payment_history (
          lead_id,
          customer_name,
          product_name,
          business_name,
          address,
          quotation_id,
          pi_id,
          total_quotation_amount,
          paid_amount,
          remaining_amount,
          installment_number,
          installment_amount,
          payment_method,
          payment_reference,
          payment_status,
          approval_status,
          payment_receipt_url,
          available_credit,
          overpaid_amount,
          purchase_order_id,
          delivery_date,
          delivery_status,
          remarks,
          notes,
          payment_date,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW()
        ) RETURNING *
      `;

      const paymentResult = await client.query(insertQuery, [
        finalLeadId,
        lead.name,
        quotation?.items?.[0]?.description || lead.product_type,
        lead.business || lead.business_type,
        lead.address,
        safeQuotationId,
        safePiId,
        quotationTotal,
        totalPaidAfter,
        remainingAfter,
        installmentNumber,
        installmentAmt,
        payment_method,
        paymentReference,
        'pending', // payment_status
        'pending', // approval_status
        payment_receipt_url || null,
        availableCredit,
        overpaidAmount,
        purchase_order_id || quotation?.work_order_id || null,
        delivery_date || null,
        delivery_status || 'pending',
        remarks,
        notes,
        payment_date
      ]);

      // Note: Quotation status will be updated to 'completed' only after payment is approved
      // This is handled in the approval flow

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Payment installment recorded successfully',
        data: {
          payment: paymentResult.rows[0],
          summary: {
            total_quotation_amount: quotationTotal,
            total_paid: totalPaidAfter,
            remaining: remainingAfter,
            available_credit: availableCredit + overpaidAmount,
            installment_number: installmentNumber
          }
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment',
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  /**
   * Update payment - not implemented in new history-based flow
   */
  async update(req, res) {
    return res.status(501).json({ success: false, message: 'Update not supported for payment history entries' });
  }

  /**
   * Delete payment - not implemented in new history-based flow
   */
  async delete(req, res) {
    return res.status(501).json({ success: false, message: 'Delete not supported for payment history entries' });
  }

  /**
   * Update legacy payment status endpoint - kept for compatibility
   */
  async updateStatus(req, res) {
    return res.json({ success: true, message: 'Status update is a no-op in payment history model' });
  }

  /**
   * Get payments by PI (legacy) - return empty list for now
   */
  async getByPI(req, res) {
    return res.json({ success: true, data: [] });
  }

  /**
   * Legacy refund endpoint - not implemented in this controller revision
   */
  async refund(req, res) {
    return res.status(501).json({ success: false, message: 'Refund endpoint not implemented in this build' });
  }

  /**
   * Legacy credit transfer endpoint - not implemented in this controller revision
   */
  async transferCredit(req, res) {
    return res.status(501).json({ success: false, message: 'Credit transfer endpoint not implemented in this build' });
  }
  /**
   * Get payments by quotation ID
   */
  async getByQuotation(req, res) {
    try {
      const { quotationId } = req.params;
      const payments = await Payment.getByQuotation(quotationId);

      res.json({
        success: true,
        data: payments
      });
    } catch (error) {
      console.error('Error fetching quotation payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payments',
        error: error.message
      });
    }
  }

  /**
   * Get payments by lead/customer ID
   */
  async getByCustomer(req, res) {
    try {
      const { customerId } = req.params;
      const payments = await Payment.getByLead(customerId);

      res.json({
        success: true,
        data: payments
      });
    } catch (error) {
      console.error('Error fetching customer payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payments',
        error: error.message
      });
    }
  }

  /**
   * Get payment summary for a quotation
   */
  async getPaymentSummaryByQuotation(req, res) {
    try {
      const { quotationId } = req.params;
      const summary = await Payment.getPaymentSummaryByQuotation(quotationId);

      res.json({
        success: true,
        data: summary || {
          quotation_id: quotationId,
          total_installments: 0,
          total_paid: 0,
          current_remaining: 0,
          payment_status: 'pending'
        }
      });
    } catch (error) {
      console.error('Error fetching payment summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment summary',
        error: error.message
      });
    }
  }

  /**
   * Get payment summary for a customer/lead
   */
  async getPaymentSummary(req, res) {
    try {
      const { customerId } = req.params;
      const summary = await Payment.getPaymentSummaryByLead(customerId);

      res.json({
        success: true,
        data: summary || {
          lead_id: Number(customerId),
          total_installments: 0,
          total_paid: 0,
          current_remaining: 0,
          current_credit: 0,
          total_quotation_amount: 0
        }
      });
    } catch (error) {
      console.error('Error fetching payment summary by lead:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment summary',
        error: error.message
      });
    }
  }

  /**
   * Get all payments with pagination and filtering
   */
  async getAllPayments(req, res) {
    try {
      const { page = 1, limit = 50, status, approvalStatus, search, startDate, endDate } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const values = [];
      let paramCount = 0;

      // Add status filter
      if (status && status !== 'All Status') {
        paramCount++;
        whereClause += ` AND ph.payment_status = $${paramCount}`;
        values.push(status.toLowerCase());
      }

      if (approvalStatus && approvalStatus.toLowerCase() !== 'all') {
        paramCount++;
        whereClause += ` AND ph.approval_status = $${paramCount}`;
        values.push(approvalStatus.toLowerCase());
      }

      // Add search filter
      if (search) {
        paramCount++;
        whereClause += ` AND (
          customer_name ILIKE $${paramCount} OR 
          product_name ILIKE $${paramCount} OR 
          lead_id::text ILIKE $${paramCount} OR
          payment_reference ILIKE $${paramCount}
        )`;
        values.push(`%${search}%`);
      }

      // Date range filter
      if (startDate) {
        paramCount++;
        whereClause += ` AND ph.payment_date >= $${paramCount}`;
        values.push(new Date(startDate));
      }
      if (endDate) {
        paramCount++;
        whereClause += ` AND ph.payment_date <= $${paramCount}`;
        values.push(new Date(endDate));
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM payment_history ph ${whereClause}`;
      const countResult = await query(countQuery, values);
      const totalCount = parseInt(countResult.rows[0].count);

      // Get payments with pagination
      paramCount++;
      const limitParam = `$${paramCount}`;
      paramCount++;
      const offsetParam = `$${paramCount}`;
      
      const paymentsQuery = `
        SELECT 
          ph.*,
          l.name as lead_customer_name,
          l.email as lead_email,
          l.phone as lead_phone,
          q.quotation_number,
          pi.pi_number,
          pi.id as pi_full_id
        FROM payment_history ph
        LEFT JOIN leads l ON ph.lead_id::text = l.id::text
        LEFT JOIN quotations q ON ph.quotation_id::text = q.id::text
        LEFT JOIN proforma_invoices pi ON ph.pi_id::text = pi.id::text
        ${whereClause}
        ORDER BY ph.payment_date DESC, ph.created_at DESC
        LIMIT ${limitParam} OFFSET ${offsetParam}
      `;
      
      values.push(parseInt(limit), offset);
      const result = await query(paymentsQuery, values);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching all payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payments',
        error: error.message
      });
    }
  }

  /**
   * Get all quotations with payment info for a lead
   */
  async getQuotationsWithPayments(req, res) {
    try {
      const { customerId } = req.params;
      const quotations = await Payment.getQuotationsWithPayments(customerId);

      res.json({
        success: true,
        data: quotations
      });
    } catch (error) {
      console.error('Error fetching quotations with payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quotations',
        error: error.message
      });
    }
  }

  /**
   * Get customer credit balance
   */
  async getCustomerCredit(req, res) {
    try {
      const { customerId } = req.params;
      const balance = await Payment.getCreditBalance(customerId);

      res.json({
        success: true,
        data: { balance }
      });
    } catch (error) {
      console.error('Error fetching credit balance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch credit balance',
        error: error.message
      });
    }
  }

  /**
   * Approve a payment
   */
  async approvePayment(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body || {};
      const approvedBy = req.user?.email || req.user?.username || 'system';

      const payment = await Payment.updateApprovalStatus(id, 'approved', approvedBy, notes || null);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      res.json({
        success: true,
        message: 'Payment approved successfully',
        data: payment
      });
    } catch (error) {
      console.error('Error approving payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve payment',
        error: error.message
      });
    }
  }

  /**
   * Update payment approval status (approved/pending/rejected)
   */
  async updateApprovalStatus(req, res) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { status, notes } = req.body || {};

      if (!status) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const actionBy = req.user?.email || req.user?.username || 'system';
      const payment = await Payment.updateApprovalStatus(id, status, actionBy, notes || null);

      if (!payment) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // If approved, update payment_status to 'completed' and check if quotation is fully paid
      if (status === 'approved') {
        await client.query(
          `UPDATE payment_history 
           SET payment_status = 'completed', updated_at = NOW() 
           WHERE id = $1`,
          [id]
        );

        // Check if quotation is fully paid and update status
        if (payment.quotation_id) {
          const totalRes = await client.query(
            'SELECT total_amount FROM quotations WHERE id = $1',
            [payment.quotation_id]
          );
          if (totalRes.rows.length > 0) {
            const total = Number(totalRes.rows[0].total_amount || 0);
            const paidRes = await client.query(
              `SELECT COALESCE(SUM(installment_amount), 0) as paid
               FROM payment_history
               WHERE quotation_id = $1 AND approval_status = 'approved' AND is_refund = false`,
              [payment.quotation_id]
            );
            const paid = Number(paidRes.rows[0]?.paid || 0);
            
            if (paid >= total) {
              await client.query(
                `UPDATE quotations SET status = 'completed', updated_at = NOW() WHERE id = $1`,
                [payment.quotation_id]
              );
            }
          }
        }
      } else if (status === 'rejected') {
        // Keep payment_status as 'pending' for rejected payments
        await client.query(
          `UPDATE payment_history 
           SET payment_status = 'pending', updated_at = NOW() 
           WHERE id = $1`,
          [id]
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Payment marked as ${status}`,
        data: payment
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating payment approval status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update payment approval status',
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  /**
   * Update payment receipt
   */
  async updateReceipt(req, res) {
    try {
      const { id } = req.params;
      const { receipt_url } = req.body;

      if (!receipt_url) {
        return res.status(400).json({
          success: false,
          message: 'receipt_url is required'
        });
      }

      const payment = await Payment.updateReceipt(id, receipt_url);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      res.json({
        success: true,
        message: 'Receipt updated successfully',
        data: payment
      });
    } catch (error) {
      console.error('Error updating receipt:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update receipt',
        error: error.message
      });
    }
  }

  /**
   * Update delivery information
   */
  async updateDeliveryInfo(req, res) {
    try {
      const { id } = req.params;
      const deliveryInfo = req.body;

      const payment = await Payment.updateDeliveryInfo(id, deliveryInfo);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      res.json({
        success: true,
        message: 'Delivery info updated successfully',
        data: payment
      });
    } catch (error) {
      console.error('Error updating delivery info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update delivery info',
        error: error.message
      });
    }
  }

  /**
   * Get payment by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const payment = await Payment.getById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      res.json({
        success: true,
        data: payment
      });
    } catch (error) {
      console.error('Error fetching payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment',
        error: error.message
      });
    }
  }

  // Get payments for multiple customers (bulk)
  // OPTIMIZED: Supports both GET (query) and POST (body) to handle large arrays
  async getBulkByCustomers(req, res) {
    try {
      // Support both GET (query) and POST (body) for backward compatibility and large arrays
      const customerIds = req.body?.customerIds || req.query?.customerIds;
      
      if (!customerIds) {
        return res.status(400).json({
          success: false,
          message: 'customerIds is required (query parameter for GET or body for POST)'
        });
      }

      // Parse customerIds
      let idsArray = [];
      try {
        if (typeof customerIds === 'string') {
          if (customerIds.startsWith('[')) {
            idsArray = JSON.parse(customerIds);
          } else {
            idsArray = customerIds.split(',').map(id => id.trim()).filter(id => id);
          }
        } else if (Array.isArray(customerIds)) {
          idsArray = customerIds;
        }
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customerIds format'
        });
      }

      if (idsArray.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }

      // Build query with IN clause
      const placeholders = idsArray.map((_, index) => `$${index + 1}`).join(',');
      const paymentsQuery = `
        SELECT 
          ph.*
        FROM payment_history ph
        WHERE ph.lead_id IN (${placeholders})
        ORDER BY ph.payment_date DESC, ph.created_at DESC
      `;
      
      const paymentsResult = await query(paymentsQuery, idsArray);
      const payments = paymentsResult.rows || [];
      
      res.json({
        success: true,
        data: payments
      });
    } catch (error) {
      console.error('Error fetching bulk payments by customers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bulk payments',
        error: error.message
      });
    }
  }

  // Get payments for multiple quotations (bulk)
  async getBulkByQuotations(req, res) {
    try {
      const { quotationIds } = req.query;
      
      if (!quotationIds) {
        return res.status(400).json({
          success: false,
          message: 'quotationIds query parameter is required'
        });
      }

      // Parse quotationIds
      let idsArray = [];
      try {
        if (typeof quotationIds === 'string') {
          if (quotationIds.startsWith('[')) {
            idsArray = JSON.parse(quotationIds);
          } else {
            idsArray = quotationIds.split(',').map(id => id.trim()).filter(id => id);
          }
        } else if (Array.isArray(quotationIds)) {
          idsArray = quotationIds;
        }
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid quotationIds format'
        });
      }

      if (idsArray.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }

      // Build query with IN clause
      const placeholders = idsArray.map((_, index) => `$${index + 1}`).join(',');
      const paymentsQuery = `
        SELECT 
          ph.*
        FROM payment_history ph
        WHERE ph.quotation_id IN (${placeholders})
        ORDER BY ph.payment_date DESC, ph.created_at DESC
      `;
      
      const paymentsResult = await query(paymentsQuery, idsArray);
      const payments = paymentsResult.rows || [];
      
      res.json({
        success: true,
        data: payments
      });
    } catch (error) {
      console.error('Error fetching bulk payments by quotations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bulk payments',
        error: error.message
      });
    }
  }
}

module.exports = new PaymentController();
