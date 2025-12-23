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
          ph.customer_name ILIKE $${paramCount} OR 
          ph.product_name ILIKE $${paramCount} OR 
          ph.lead_id::text ILIKE $${paramCount} OR
          ph.payment_reference ILIKE $${paramCount} OR
          q.quotation_number ILIKE $${paramCount} OR
          q.customer_name ILIKE $${paramCount}
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

      // Get total count - need to join quotations if search includes quotation fields
      let countQuery = `SELECT COUNT(DISTINCT ph.id) FROM payment_history ph`;
      if (search && (whereClause.includes('q.quotation_number') || whereClause.includes('q.customer_name'))) {
        countQuery += ` LEFT JOIN quotations q ON ph.quotation_id::text = q.id::text`;
      }
      countQuery += ` ${whereClause}`;
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
          q.total_amount as quotation_total_amount,
          pi.pi_number,
          pi.id as pi_full_id,
          COALESCE(
            du_assign.username,
            du_spl.username,
            du_q.username,
            dhl.assigned_salesperson,
            spl.created_by,
            q.created_by
          ) as salesperson_name,
          COALESCE(
            qi_agg.product_names,
            ph.product_name,
            dhl.product_names,
            'N/A'
          ) as product_name_from_quotation,
          -- Company and Department information from department_head_leads creator
          COALESCE(
            dh_creator.company_name,
            du_creator.company_name,
            'N/A'
          ) as lead_company_name,
          COALESCE(
            dh_creator.department_type,
            du_creator.department_type,
            'N/A'
          ) as lead_department_type,
          -- Department Head name for this company and department (from department_heads or department_users table)
          COALESCE(
            dh_creator.username,
            dh_creator.email,
            du_creator.username,
            du_creator.email,
            dhl.created_by,
            'N/A'
          ) as department_head_name,
          -- Calculate cumulative approved payments for this quotation
          COALESCE(approved_payments.total_approved_paid, 0) as quotation_total_paid,
          -- Calculate remaining due for quotation
          GREATEST(0, COALESCE(q.total_amount, 0) - COALESCE(approved_payments.total_approved_paid, 0)) as quotation_remaining_due
        FROM payment_history ph
        LEFT JOIN leads l ON ph.lead_id::text = l.id::text
        LEFT JOIN quotations q ON ph.quotation_id::text = q.id::text
        LEFT JOIN proforma_invoices pi ON ph.pi_id::text = pi.id::text
        -- Join department_head_leads via quotations.customer_id (not ph.lead_id!)
        -- quotations.customer_id references department_head_leads.id
        LEFT JOIN department_head_leads dhl ON q.customer_id = dhl.id
        LEFT JOIN salesperson_leads spl ON q.customer_id = spl.id
        -- Join with department_heads to get company_name, department_type, and department head name from creator
        -- Use case-insensitive comparison for email matching, handle NULL values
        LEFT JOIN department_heads dh_creator ON (
          dhl.created_by IS NOT NULL
          AND LOWER(TRIM(COALESCE(dh_creator.email, ''))) = LOWER(TRIM(COALESCE(dhl.created_by, '')))
          AND dh_creator.is_active = true
        )
        -- Fallback: also join with department_users in case creator is a department user
        LEFT JOIN department_users du_creator ON (
          dhl.created_by IS NOT NULL
          AND LOWER(TRIM(COALESCE(du_creator.email, ''))) = LOWER(TRIM(COALESCE(dhl.created_by, '')))
          AND du_creator.is_active = true
          AND dh_creator.id IS NULL  -- Only use du_creator if dh_creator didn't match
        )
        LEFT JOIN department_users du_assign ON (
          dhl.assigned_salesperson IS NOT NULL 
          AND (du_assign.email = dhl.assigned_salesperson OR du_assign.username = dhl.assigned_salesperson)
        )
        LEFT JOIN department_users du_spl ON (
          spl.created_by IS NOT NULL 
          AND (du_spl.email = spl.created_by OR du_spl.username = spl.created_by)
        )
        LEFT JOIN department_users du_q ON (
          q.created_by IS NOT NULL 
          AND (du_q.email = q.created_by OR du_q.username = q.created_by)
        )
        LEFT JOIN LATERAL (
          SELECT STRING_AGG(DISTINCT qi.product_name, ', ' ORDER BY qi.product_name) as product_names
          FROM quotation_items qi
          WHERE qi.quotation_id = q.id
        ) qi_agg ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(ph2.installment_amount), 0) as total_approved_paid
          FROM payment_history ph2
          WHERE ph2.quotation_id = q.id
            AND ph2.installment_amount > 0
            AND (ph2.payment_status = 'completed' OR ph2.payment_status = 'advance')
            AND ph2.is_refund = false
            AND (ph2.approval_status = 'approved' OR (ph2.approval_status IS NULL AND ph2.payment_approved = true))
        ) approved_payments ON true
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

  /**
   * Get detailed installment breakdown for a quotation
   * Returns all installments with ledger balance, paid amount, remaining balance for each
   */
  async getInstallmentBreakdown(req, res) {
    const client = await getClient();
    try {
      const { quotationId } = req.params;

      // Get quotation details
      const quotRes = await client.query(
        'SELECT id, quotation_number, total_amount, customer_id FROM quotations WHERE id = $1',
        [quotationId]
      );

      if (quotRes.rows.length === 0) {
        client.release();
        return res.status(404).json({
          success: false,
          message: 'Quotation not found'
        });
      }

      const quotation = quotRes.rows[0];
      const quotationTotal = Number(quotation.total_amount || 0);

      // Get all payments for this quotation (including pending, approved, rejected)
      const paymentsRes = await client.query(
        `SELECT 
          ph.id,
          ph.installment_number,
          ph.installment_amount,
          ph.paid_amount,
          ph.remaining_amount,
          ph.payment_date,
          ph.payment_method,
          ph.payment_reference,
          ph.approval_status,
          ph.payment_status,
          ph.overpaid_amount,
          ph.available_credit,
          ph.remarks,
          ph.approval_notes,
          ph.payment_receipt_url,
          ph.created_at,
          ph.updated_at
        FROM payment_history ph
        WHERE ph.quotation_id::text = $1::text AND ph.is_refund = false
        ORDER BY ph.installment_number ASC, ph.payment_date ASC, ph.created_at ASC`,
        [quotationId]
      );

      const allPayments = paymentsRes.rows;
      
      // Calculate cumulative totals and ledger balance for each installment
      let cumulativePaid = 0;
      let cumulativeApproved = 0;
      
      const installments = allPayments.map((payment, index) => {
        const installmentAmount = Number(payment.installment_amount || 0);
        const isApproved = (payment.approval_status || '').toLowerCase() === 'approved';
        
        // Ledger balance before this installment (based on approved payments only)
        const ledgerBalanceBefore = Math.max(0, quotationTotal - cumulativeApproved);
        
        // If approved, add to cumulative approved
        if (isApproved) {
          cumulativeApproved += installmentAmount;
        }
        
        // Cumulative paid (all payments regardless of approval)
        cumulativePaid += installmentAmount;
        
        // Ledger balance after this installment (based on approved payments only)
        const ledgerBalanceAfter = Math.max(0, quotationTotal - cumulativeApproved);
        
        // Remaining balance after this installment
        const remainingAfterThis = ledgerBalanceAfter;
        
        return {
          installment_number: payment.installment_number || index + 1,
          payment_id: payment.id,
          installment_amount: installmentAmount,
          payment_date: payment.payment_date,
          payment_method: payment.payment_method,
          payment_reference: payment.payment_reference,
          approval_status: payment.approval_status || 'pending',
          payment_status: payment.payment_status || 'pending',
          ledger_balance_before: ledgerBalanceBefore,
          ledger_balance_after: ledgerBalanceAfter,
          cumulative_paid: cumulativePaid,
          cumulative_approved: cumulativeApproved,
          remaining_balance: remainingAfterThis,
          overpaid_amount: Number(payment.overpaid_amount || 0),
          available_credit: Number(payment.available_credit || 0),
          remarks: payment.remarks,
          approval_notes: payment.approval_notes,
          payment_receipt_url: payment.payment_receipt_url,
          created_at: payment.created_at,
          updated_at: payment.updated_at
        };
      });

      // Calculate summary
      const totalInstallments = installments.length;
      const approvedInstallments = installments.filter(i => i.approval_status === 'approved').length;
      const pendingInstallments = installments.filter(i => i.approval_status === 'pending').length;
      const rejectedInstallments = installments.filter(i => i.approval_status === 'rejected').length;
      
      const totalPaid = cumulativePaid;
      const totalApproved = cumulativeApproved;
      const finalRemaining = Math.max(0, quotationTotal - totalApproved);
      const totalOverpaid = installments.reduce((sum, i) => sum + i.overpaid_amount, 0);

      client.release();

      res.json({
        success: true,
        data: {
          quotation: {
            id: quotation.id,
            quotation_number: quotation.quotation_number,
            total_amount: quotationTotal,
            customer_id: quotation.customer_id
          },
          summary: {
            total_quotation_amount: quotationTotal,
            total_installments: totalInstallments,
            approved_installments: approvedInstallments,
            pending_installments: pendingInstallments,
            rejected_installments: rejectedInstallments,
            total_paid_all: totalPaid,
            total_approved: totalApproved,
            remaining_balance: finalRemaining,
            total_overpaid: totalOverpaid,
            payment_status: finalRemaining <= 0 ? 'fully_paid' : (totalApproved > 0 ? 'partially_paid' : 'unpaid')
          },
          installments: installments
        }
      });
    } catch (error) {
      client.release();
      console.error('Error fetching installment breakdown:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch installment breakdown',
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
