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

      // Get quotation if provided
      let quotation = null;
      let quotationTotal = 0;
      let paidSoFar = 0;
      let remainingBefore = 0;
      let installmentNumber = 1;

      if (quotation_id) {
        const quotRes = await client.query(
          'SELECT * FROM quotations WHERE id = $1',
          [quotation_id]
        );
        quotation = quotRes.rows[0];
        
        if (!quotation) {
          throw new Error('Quotation not found');
        }

        if (quotation.status !== 'approved' && quotation.status !== 'completed') {
          throw new Error('Quotation must be approved before payment');
        }

        quotationTotal = Number(quotation.total_amount);

        // Calculate paid amount so far
        const paidRes = await client.query(
          `SELECT COALESCE(SUM(installment_amount), 0) as paid
           FROM payment_history
           WHERE quotation_id = $1 AND payment_status = 'completed' AND is_refund = false`,
          [quotation_id]
        );
        paidSoFar = Number(paidRes.rows[0].paid);
        remainingBefore = Math.max(0, quotationTotal - paidSoFar);

        // Get next installment number
        const instRes = await client.query(
          `SELECT COALESCE(MAX(installment_number), 0) + 1 as next_num
           FROM payment_history
           WHERE quotation_id = $1`,
          [quotation_id]
        );
        installmentNumber = instRes.rows[0].next_num;
      }

      // Calculate payment distribution
      let appliedToQuotation = 0;
      let overpaidAmount = 0;
      let remainingAfter = 0;

      if (quotation_id && remainingBefore > 0) {
        appliedToQuotation = Math.min(installmentAmt, remainingBefore);
        overpaidAmount = Math.max(0, installmentAmt - appliedToQuotation);
        remainingAfter = remainingBefore - appliedToQuotation;
      } else if (!quotation_id) {
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

      // Insert payment record
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'completed',
          $15, $16, $17, $18, $19, $20, $21, COALESCE($22, NOW()), NOW()
        ) RETURNING *
      `;

      const paymentResult = await client.query(insertQuery, [
        finalLeadId,
        lead.name,
        quotation?.items?.[0]?.description || lead.product_type,
        lead.business || lead.business_type,
        lead.address,
        quotation_id || null,
        pi_id || null,
        quotationTotal,
        totalPaidAfter,
        remainingAfter,
        installmentNumber,
        installmentAmt,
        payment_method,
        paymentReference,
        availableCredit,
        overpaidAmount,
        purchase_order_id || quotation?.work_order_id || null,
        delivery_date || null,
        delivery_status || 'pending',
        remarks,
        notes,
        payment_date
      ]);

      // Update quotation status if fully paid
      if (quotation_id && remainingAfter === 0 && quotation.status !== 'completed') {
        await client.query(
          `UPDATE quotations SET status = 'completed', updated_at = NOW() WHERE id = $1`,
          [quotation_id]
        );
      }

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
      const { page = 1, limit = 50, status, search, startDate, endDate } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const values = [];
      let paramCount = 0;

      // Add status filter
      if (status && status !== 'All Status') {
        paramCount++;
        whereClause += ` AND payment_status = $${paramCount}`;
        values.push(status.toLowerCase());
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
      const countQuery = `SELECT COUNT(*) FROM payment_history ${whereClause}`;
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
        LEFT JOIN leads l ON ph.lead_id = l.id
        LEFT JOIN quotations q ON ph.quotation_id = q.id
        LEFT JOIN proforma_invoices pi ON ph.pi_id = pi.id
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
      const approvedBy = req.user?.email || req.user?.username || 'system';

      const payment = await Payment.approvePayment(id, approvedBy);

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
}

module.exports = new PaymentController();
