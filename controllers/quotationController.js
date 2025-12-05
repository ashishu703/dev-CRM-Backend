const Quotation = require('../models/Quotation');
const ProformaInvoice = require('../models/ProformaInvoice');
const Payment = require('../models/Payment');
const { query } = require('../config/database');

class QuotationController {
  // Create quotation
  async create(req, res) {
    try {
      console.log('Received quotation data:', req.body);
      const quotationData = {
        customerId: req.body.customerId,
        salespersonId: req.user.id,
        createdBy: req.user.email,
        customerName: req.body.customerName,
        customerBusiness: req.body.customerBusiness,
        customerPhone: req.body.customerPhone,
        customerEmail: req.body.customerEmail,
        customerAddress: req.body.customerAddress,
        customerGstNo: req.body.customerGstNo,
        customerState: req.body.customerState,
        quotationDate: req.body.quotationDate,
        validUntil: req.body.validUntil || (() => {
          const quotationDate = req.body.quotationDate || new Date().toISOString().split('T')[0];
          const date = new Date(quotationDate);
          date.setDate(date.getDate() + 30); // 30 days validity
          return date.toISOString().split('T')[0];
        })(),
        branch: req.body.branch || 'ANODE',
        subtotal: req.body.subtotal,
        taxRate: req.body.taxRate || 18.00,
        taxAmount: req.body.taxAmount,
        discountRate: req.body.discountRate || 0,
        discountAmount: req.body.discountAmount || 0,
        totalAmount: req.body.totalAmount,
        status: req.body.status || 'draft',
        template: req.body.template || 'template1'
      };

      const items = req.body.items || [];
      
      const quotation = await Quotation.createWithItems(quotationData, items);
      
      res.json({
        success: true,
        message: 'Quotation created successfully',
        data: quotation
      });
    } catch (error) {
      console.error('Error creating quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create quotation',
        error: error.message
      });
    }
  }

  // Get quotation by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const quotation = await Quotation.getWithItems(id);
      
      if (!quotation) {
        return res.status(404).json({
          success: false,
          message: 'Quotation not found'
        });
      }
      
      res.json({
        success: true,
        data: quotation
      });
    } catch (error) {
      console.error('Error fetching quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quotation',
        error: error.message
      });
    }
  }

  // Get quotations by customer
  async getByCustomer(req, res) {
    try {
      const { customerId } = req.params;
      const quotations = await Quotation.getByCustomer(customerId);
      
      res.json({
        success: true,
        data: quotations
      });
    } catch (error) {
      console.error('Error fetching customer quotations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch customer quotations',
        error: error.message
      });
    }
  }

  // Submit for verification
  async submitForVerification(req, res) {
    try {
      const { id } = req.params;
      const quotation = await Quotation.submitForVerification(id, req.user.email);
      
      res.json({
        success: true,
        message: 'Quotation submitted for verification',
        data: quotation
      });
    } catch (error) {
      console.error('Error submitting quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit quotation',
        error: error.message
      });
    }
  }

  // Approve quotation
  async approve(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const quotation = await Quotation.approve(id, req.user.email, notes);
      
      res.json({
        success: true,
        message: 'Quotation approved',
        data: quotation
      });
    } catch (error) {
      console.error('Error approving quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve quotation',
        error: error.message
      });
    }
  }

  // Reject quotation
  async reject(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const quotation = await Quotation.reject(id, req.user.email, notes);
      
      res.json({
        success: true,
        message: 'Quotation rejected',
        data: quotation
      });
    } catch (error) {
      console.error('Error rejecting quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject quotation',
        error: error.message
      });
    }
  }

  // Send to customer
  async sendToCustomer(req, res) {
    try {
      const { id } = req.params;
      const { sentTo, sentVia } = req.body;
      const quotation = await Quotation.sendToCustomer(id, req.user.email, sentTo, sentVia);
      
      res.json({
        success: true,
        message: 'Quotation sent to customer',
        data: quotation
      });
    } catch (error) {
      console.error('Error sending quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send quotation',
        error: error.message
      });
    }
  }

  // Customer accepts quotation
  async acceptByCustomer(req, res) {
    try {
      const { id } = req.params;
      const { acceptedBy } = req.body;
      const quotation = await Quotation.acceptByCustomer(id, acceptedBy);
      
      res.json({
        success: true,
        message: 'Quotation accepted by customer',
        data: quotation
      });
    } catch (error) {
      console.error('Error accepting quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to accept quotation',
        error: error.message
      });
    }
  }

  // Get complete quotation data
  async getCompleteData(req, res) {
    try {
      const { id } = req.params;
      const data = await Quotation.getCompleteData(id);
      
      if (!data) {
        return res.status(404).json({
          success: false,
          message: 'Quotation not found'
        });
      }
      
      res.json({
        success: true,
        data: data
      });
    } catch (error) {
      console.error('Error fetching complete quotation data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch complete quotation data',
        error: error.message
      });
    }
  }

  // Get quotations pending verification (for department head)
  async getPendingVerification(req, res) {
    try {
      // STRICT CHECK: Filter by logged-in user's department and company
      const quotations = await Quotation.getPendingVerification(
        req.user.departmentType,
        req.user.companyName
      );
      
      res.json({
        success: true,
        data: quotations
      });
    } catch (error) {
      console.error('Error fetching pending quotations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending quotations',
        error: error.message
      });
    }
  }

  // Get quotations by status (for department head)
  async getByStatus(req, res) {
    try {
      const { status } = req.params;
      
      // STRICT CHECK: Filter by logged-in user's department and company
      const quotations = await Quotation.getByStatus(
        status,
        req.user.departmentType,
        req.user.companyName
      );
      
      res.json({
        success: true,
        data: quotations
      });
    } catch (error) {
      console.error('Error fetching quotations by status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quotations by status',
        error: error.message
      });
    }
  }

  // Get quotations by salesperson (for salesperson view)
  async getBySalesperson(req, res) {
    try {
      const quotations = await Quotation.getBySalesperson(req.user.email);
      
      res.json({
        success: true,
        data: quotations
      });
    } catch (error) {
      console.error('Error fetching salesperson quotations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch salesperson quotations',
        error: error.message
      });
    }
  }

  // Update quotation
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const quotation = await Quotation.updateById(id, updateData);
      
      if (!quotation) {
        return res.status(404).json({
          success: false,
          message: 'Quotation not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Quotation updated successfully',
        data: quotation
      });
    } catch (error) {
      console.error('Error updating quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quotation',
        error: error.message
      });
    }
  }

  // Delete quotation
  async delete(req, res) {
    try {
      const { id } = req.params;
      console.log('Delete request received for quotation ID:', id);
      const result = await Quotation.deleteById(id);
      console.log('Delete result:', result);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Quotation not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Quotation deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete quotation',
        error: error.message
      });
    }
  }

  // Generate PDF for quotation
  async generatePDF(req, res) {
    try {
      const { id } = req.params;
      const quotation = await Quotation.getWithItems(id);
      
      if (!quotation) {
        return res.status(404).json({
          success: false,
          message: 'Quotation not found'
        });
      }

      // Return quotation data for frontend to display
      res.json({
        success: true,
        data: quotation
      });
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate PDF',
        error: error.message
      });
    }
  }

  // Approved quotations for a customer (for dropdown)
  async getApprovedForCustomer(req, res) {
    try {
      const { customerId } = req.query;
      if (!customerId) return res.status(400).json({ success: false, message: 'customerId required' });
      const result = await Quotation.constructor.query(
        `SELECT id, quotation_number, total_amount, paid_amount
         FROM quotations
         WHERE status = 'approved' AND customer_id = $1
         ORDER BY created_at DESC`,
        [customerId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch approved quotations', error: error.message });
    }
  }

  // Quotation summary
  async getSummary(req, res) {
    try {
      const { id } = req.params;
      const qRes = await Quotation.constructor.query('SELECT id, total_amount FROM quotations WHERE id = $1', [id]);
      if (qRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Quotation not found' });

      const total = Number(qRes.rows[0].total_amount || 0);
      const paidRes = await Quotation.constructor.query(
        `SELECT COALESCE(SUM(installment_amount),0) AS paid
           FROM payment_history
          WHERE quotation_id = $1 AND approval_status = 'approved' AND is_refund = false`,
        [id]
      );
      const paid = Number(paidRes.rows[0]?.paid || 0);
      const remaining = Math.max(0, total - paid);
      res.json({ success: true, data: { total, paid, remaining } });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to get summary', error: error.message });
    }
  }

  async getBulkWithPayments(req, res) {
    try {
      const salespersonId = req.user.id;
      
      const quotationsQuery = `
        SELECT 
          q.*
        FROM quotations q
        WHERE q.salesperson_id = $1 
          AND q.status IN ('approved','pending_approval','rejected')
        ORDER BY q.created_at DESC
      `;
      
      const quotationsResult = await query(quotationsQuery, [salespersonId]);
      const quotations = quotationsResult.rows || [];
      
      if (quotations.length === 0) {
        return res.json({
          success: true,
          data: { quotations: [], payments: [] }
        });
      }
      
      // Get all quotation IDs
      const quotationIds = quotations.map(q => q.id);
      
      // Fetch all payments for these quotations in one query
      const paymentsQuery = `
        SELECT 
          ph.*
        FROM payment_history ph
        WHERE ph.quotation_id = ANY($1::uuid[])
        ORDER BY ph.payment_date DESC, ph.created_at DESC
      `;
      
      const paymentsResult = await query(paymentsQuery, [quotationIds]);
      const payments = paymentsResult.rows || [];
      
      // Calculate payment summaries for each quotation
      const quotationsWithSummary = quotations.map(q => {
        const quotationPayments = payments.filter(p => p.quotation_id === q.id);
        const totalAmount = Number(q.total_amount || 0);
        const paidAmount = quotationPayments
          .filter(p => p.payment_status === 'completed' && !p.is_refund)
          .reduce((sum, p) => sum + Number(p.installment_amount || 0), 0);
        const remainingAmount = Math.max(0, totalAmount - paidAmount);
        
        return {
          ...q,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          remaining_amount: remainingAmount,
          payment_count: quotationPayments.length
        };
      });
      
      res.json({
        success: true,
        data: {
          quotations: quotationsWithSummary,
          payments: payments
        }
      });
    } catch (error) {
      console.error('Error fetching bulk quotations with payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quotations with payments',
        error: error.message
      });
    }
  }

  // Get quotations for multiple customers (bulk)
  async getBulkByCustomers(req, res) {
    try {
      const { customerIds } = req.query;
      
      if (!customerIds) {
        return res.status(400).json({
          success: false,
          message: 'customerIds query parameter is required'
        });
      }

      // Parse customerIds (comma-separated or JSON array)
      let idsArray = [];
      try {
        if (typeof customerIds === 'string') {
          // Try parsing as JSON array first
          if (customerIds.startsWith('[')) {
            idsArray = JSON.parse(customerIds);
          } else {
            // Comma-separated string
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
      const quotationsQuery = `
        SELECT 
          q.*
        FROM quotations q
        WHERE q.customer_id IN (${placeholders})
        ORDER BY q.created_at DESC
      `;
      
      const quotationsResult = await query(quotationsQuery, idsArray);
      const quotations = quotationsResult.rows || [];
      
      res.json({
        success: true,
        data: quotations
      });
    } catch (error) {
      console.error('Error fetching bulk quotations by customers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bulk quotations',
        error: error.message
      });
    }
  }

  // Get summaries for multiple quotations (bulk)
  async getBulkSummaries(req, res) {
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

      // Fetch summaries for all quotations
      const summaries = [];
      
      for (const quotationId of idsArray) {
        try {
          // Get quotation with items
          const quotation = await Quotation.getWithItems(quotationId);
          
          if (!quotation) {
            summaries.push({
              quotation_id: quotationId,
              error: 'Quotation not found'
            });
            continue;
          }

          // Get PIs for this quotation
          const piQuery = `
            SELECT * FROM proforma_invoices 
            WHERE quotation_id = $1
            ORDER BY created_at DESC
          `;
          const piResult = await query(piQuery, [quotationId]);
          const pis = piResult.rows || [];

          // Get payments for this quotation
          const paymentQuery = `
            SELECT * FROM payment_history 
            WHERE quotation_id = $1
            ORDER BY payment_date DESC, created_at DESC
          `;
          const paymentResult = await query(paymentQuery, [quotationId]);
          const payments = paymentResult.rows || [];

          // Calculate payment totals
          const completedPayments = payments.filter(p => 
            p.payment_status === 'completed' && !p.is_refund
          );
          const totalPaid = completedPayments.reduce((sum, p) => 
            sum + Number(p.installment_amount || 0), 0
          );
          const advancePayment = completedPayments.find(p => 
            p.installment_number === 1 || p.payment_type === 'advance'
          );
          const advanceAmount = advancePayment ? Number(advancePayment.installment_amount || 0) : 0;
          const dueAmount = Math.max(0, Number(quotation.total_amount) - totalPaid);

          summaries.push({
            quotation_id: quotationId,
            quotation,
            pis,
            payments,
            summary: {
              total_amount: Number(quotation.total_amount),
              total_paid: totalPaid,
              advance_amount: advanceAmount,
              due_amount: dueAmount,
              pi_count: pis.length,
              payment_count: payments.length
            }
          });
        } catch (err) {
          console.warn(`Error fetching summary for quotation ${quotationId}:`, err);
          summaries.push({
            quotation_id: quotationId,
            error: err.message
          });
        }
      }
      
      res.json({
        success: true,
        data: summaries
      });
    } catch (error) {
      console.error('Error fetching bulk summaries:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bulk summaries',
        error: error.message
      });
    }
  }
}

module.exports = new QuotationController();
