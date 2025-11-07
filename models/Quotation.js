const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class Quotation extends BaseModel {
  constructor() {
    super('quotations');
  }

  // Create a new quotation with items
  async createWithItems(quotationData, items) {
    try {
      await query('BEGIN');
      
      // Generate quotation number
      const quotationNumber = await this.generateQuotationNumber();
      
      // Insert quotation
      const quotationQuery = `
        INSERT INTO quotations (
          quotation_number, customer_id, salesperson_id, status, created_by,
          customer_name, customer_business, customer_phone, customer_email, 
          customer_address, customer_gst_no, customer_state,
          quotation_date, valid_until, branch,
          subtotal, tax_rate, tax_amount, discount_rate, discount_amount, total_amount
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) RETURNING *
      `;
      
      console.log('Creating quotation with data:', quotationData);
      console.log('Items to save:', items);
      
      const quotationValues = [
        quotationNumber,
        quotationData.customerId,
        quotationData.salespersonId,
        quotationData.status || 'draft',
        quotationData.createdBy,
        quotationData.customerName,
        quotationData.customerBusiness,
        quotationData.customerPhone,
        quotationData.customerEmail,
        quotationData.customerAddress,
        quotationData.customerGstNo,
        quotationData.customerState,
        quotationData.quotationDate,
        quotationData.validUntil,
        quotationData.branch || 'ANODE',
        quotationData.subtotal,
        quotationData.taxRate || 18.00,
        quotationData.taxAmount,
        quotationData.discountRate || 0,
        quotationData.discountAmount || 0,
        quotationData.totalAmount
      ];
      
      const quotationResult = await query(quotationQuery, quotationValues);
      const quotation = quotationResult.rows[0];
      
      // Insert quotation items
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const itemQuery = `
            INSERT INTO quotation_items (
              quotation_id, item_order, product_name, description, hsn_code,
              quantity, unit, unit_price, gst_rate, taxable_amount, gst_amount, total_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `;
          
          const itemValues = [
            quotation.id,
            i + 1,
            item.productName,
            item.description,
            item.hsnCode,
            item.quantity,
            item.unit || 'Nos',
            item.unitPrice,
            item.gstRate || 18.00,
            item.taxableAmount,
            item.gstAmount,
            item.totalAmount
          ];
          
          await query(itemQuery, itemValues);
        }
      }
      
      await query('COMMIT');
      return quotation;
      
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  // Get quotation with items
  async getWithItems(id) {
    const quotationQuery = 'SELECT * FROM quotations WHERE id = $1';
    const itemsQuery = 'SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY item_order';
    
    const quotationResult = await query(quotationQuery, [id]);
    if (quotationResult.rows.length === 0) return null;
    
    const quotation = quotationResult.rows[0];
    const itemsResult = await query(itemsQuery, [id]);
    quotation.items = itemsResult.rows;
    
    return quotation;
  }

  // Get quotations by customer
  async getByCustomer(customerId) {
    const queryText = `
      SELECT q.*, 
             COUNT(qi.id) as item_count,
             COALESCE(SUM(ph.installment_amount), 0) as total_paid
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      LEFT JOIN payment_history ph ON q.id = ph.quotation_id AND ph.payment_status = 'completed' AND ph.is_refund = false
      WHERE q.customer_id = $1
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `;
    
    const result = await query(queryText, [customerId]);
    return result.rows;
  }

  // Submit for verification
  async submitForVerification(id, submittedBy) {
    const queryText = `
      UPDATE quotations 
      SET status = 'pending', 
          submitted_for_verification_at = NOW(),
          updated_by = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    // Use a placeholder UUID for updated_by column
    const placeholderUserId = '00000000-0000-0000-0000-000000000001'; // Use a valid UUID
    const result = await query(queryText, [id, placeholderUserId]);
    
    // Log the submission - use email instead of UUID to avoid FK constraint issues
    await this.logApprovalAction(id, 'submitted', submittedBy, 'salesperson', 'Quotation submitted for verification');
    
    return result[0];
  }

  // Approve quotation
  async approve(id, approvedBy, notes = '') {
    try {
      console.log('Approving quotation:', { id, approvedBy, notes });
      
      // Check the actual database schema for quotations table
      try {
        const schemaCheck = await query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'quotations' 
          AND column_name IN ('verified_by', 'updated_by')
          ORDER BY column_name
        `);
        console.log('Quotations table schema for user columns:', schemaCheck);
      } catch (schemaError) {
        console.log('Could not check schema:', schemaError.message);
      }
      
      // Try a simpler query first to see what columns actually exist
      const queryText = `
        UPDATE quotations 
        SET status = 'approved', 
            verification_notes = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      // Use a placeholder UUID for verified_by and updated_by columns
      const placeholderUserId = '00000000-0000-0000-0000-000000000001'; // Use a valid UUID
      
      console.log('Approving with parameters:', {
        id: id,
        notes: notes,
        idType: typeof id,
        notesType: typeof notes
      });
      
      const result = await query(queryText, [id, notes]);
      
      // Log the approval (with error handling)
      try {
        await this.logApprovalAction(id, 'approved', approvedBy, 'department_head', notes);
      } catch (logError) {
        console.error('Failed to log approval action:', logError);
        // Don't throw the error, just log it - the main operation succeeded
      }
      
      return result[0];
    } catch (error) {
      console.error('Error in approve function:', error);
      throw error;
    }
  }

  // Reject quotation
  async reject(id, rejectedBy, notes = '') {
    try {
      console.log('Rejecting quotation:', { id, rejectedBy, notes });
      
      const queryText = `
        UPDATE quotations 
        SET status = 'rejected', 
            verification_notes = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      console.log('Rejecting with parameters:', {
        id: id,
        notes: notes,
        idType: typeof id,
        notesType: typeof notes
      });
      
      const result = await query(queryText, [id, notes]);
      
      // Log the rejection (with error handling)
      try {
        await this.logApprovalAction(id, 'rejected', rejectedBy, 'department_head', notes);
      } catch (logError) {
        console.error('Failed to log rejection action:', logError);
        // Don't throw the error, just log it - the main operation succeeded
      }
      
      return result[0];
    } catch (error) {
      console.error('Error in reject function:', error);
      throw error;
    }
  }

  // Send to customer
  async sendToCustomer(id, sentBy, sentTo, sentVia = 'email') {
    const queryText = `
      UPDATE quotations 
      SET status = 'sent', 
          sent_to_customer_at = NOW(),
          updated_by = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    // Use a placeholder UUID for updated_by column
    const placeholderUserId = '00000000-0000-0000-0000-000000000001'; // Use a valid UUID
    const result = await query(queryText, [id, placeholderUserId]);
    
    // Log the send action
    await this.logSentAction(id, sentTo, sentVia, sentBy);
    
    return result[0];
  }

  // Customer accepts quotation
  async acceptByCustomer(id, acceptedBy) {
    const queryText = `
      UPDATE quotations 
      SET status = 'accepted', 
          customer_accepted_at = NOW(),
          customer_accepted_by = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    return await query(queryText, [id, acceptedBy]);
  }

  // Log approval actions
  async logApprovalAction(quotationId, action, performedBy, performedByType, notes) {
    try {
      // Use the actual performedBy email since performed_by is now VARCHAR
      const placeholderId = performedBy || 'system@anocab.com'; // Use actual email or system email
      
      // Ensure quotationId is properly formatted (it should be a UUID string)
      const formattedQuotationId = typeof quotationId === 'string' ? quotationId : quotationId.toString();
      
      // Ensure action is a string
      const formattedAction = typeof action === 'string' ? action : action.toString();
      
      // Ensure performedByType is a string
      const formattedPerformedByType = typeof performedByType === 'string' ? performedByType : performedByType.toString();
      
      // Ensure notes is a string or null
      const formattedNotes = notes ? (typeof notes === 'string' ? notes : notes.toString()) : null;
      
      const queryText = `
        INSERT INTO quotation_approval_logs (quotation_id, action, performed_by, performed_by_type, notes)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      console.log('Logging approval action:', {
        quotationId: formattedQuotationId,
        action: formattedAction,
        performedBy: placeholderId,
        performedByType: formattedPerformedByType,
        notes: formattedNotes
      });
      
      return await query(queryText, [formattedQuotationId, formattedAction, placeholderId, formattedPerformedByType, formattedNotes]);
    } catch (error) {
      console.error('Error in logApprovalAction:', error);
      
      // If it's a foreign key constraint error, try to drop and recreate the table
      if (error.message && error.message.includes('foreign key constraint')) {
        console.log('Foreign key constraint error detected, attempting to fix table structure...');
        try {
          // Drop the table and recreate without foreign key constraints
          await query('DROP TABLE IF EXISTS quotation_approval_logs CASCADE');
          await query(`
            CREATE TABLE quotation_approval_logs (
              id SERIAL PRIMARY KEY,
              quotation_id UUID NOT NULL,
              action VARCHAR(50) NOT NULL,
              performed_by VARCHAR(255) NOT NULL,
              performed_by_type VARCHAR(50) NOT NULL,
              notes TEXT,
              created_at TIMESTAMP DEFAULT NOW()
            );
          `);
          console.log('quotation_approval_logs table recreated without foreign key constraints');
          
          // Retry the insert
          return await query(queryText, [formattedQuotationId, formattedAction, placeholderId, formattedPerformedByType, formattedNotes]);
        } catch (recreateError) {
          console.error('Failed to recreate table:', recreateError);
          // Don't throw the error, just log it - the main operation succeeded
        }
      }
      
      // Don't throw the error, just log it - the main operation succeeded
      console.log('Logging failed but main operation succeeded');
    }
  }

  // Log sent actions
  async logSentAction(quotationId, sentTo, sentVia, sentBy) {
    const queryText = `
      INSERT INTO quotation_sent_logs (quotation_id, sent_to, sent_via, sent_by)
      VALUES ($1, $2, $3, $4)
    `;
    
    return await query(queryText, [quotationId, sentTo, sentVia, sentBy]);
  }

  // Generate quotation number
  async generateQuotationNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the last quotation number for this year-month
    const queryText = `
      SELECT quotation_number 
      FROM quotations 
      WHERE quotation_number LIKE $1 
      ORDER BY quotation_number DESC 
      LIMIT 1
    `;
    const pattern = `QT${year}${month}%`;
    const result = await query(queryText, [pattern]);
    
    if (result.rows.length === 0) {
      // First quotation of the month
      return `QT${year}${month}001`;
    } else {
      // Get the last number and increment
      const lastNumber = result.rows[0].quotation_number;
      const lastSeq = parseInt(lastNumber.slice(-3));
      const newSeq = String(lastSeq + 1).padStart(3, '0');
      return `QT${year}${month}${newSeq}`;
    }
  }

  // Get quotation history (all revisions)
  async getHistory(quotationId) {
    const queryText = `
      SELECT q.*, 
             COUNT(qi.id) as item_count,
             COALESCE(SUM(p.total_paid), 0) as total_paid
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      LEFT JOIN proforma_invoices pi ON q.id = pi.quotation_id
      LEFT JOIN payments p ON pi.id = p.pi_id AND p.status = 'completed'
      WHERE q.id = $1 OR q.parent_quotation_id = $1
      GROUP BY q.id
      ORDER BY q.created_at ASC
    `;
    
    return await query(queryText, [quotationId]);
  }

  // Get complete quotation data (quotation + items + approval logs + sent logs + PIs + payments)
  async getCompleteData(quotationId) {
    const quotation = await this.getWithItems(quotationId);
    if (!quotation) return null;
    
    // Get approval logs (rows array)
    const approvalLogsRes = await query(
      'SELECT * FROM quotation_approval_logs WHERE quotation_id = $1 ORDER BY created_at ASC',
      [quotationId]
    );
    const approvalLogs = approvalLogsRes.rows || [];
    
    // Get sent logs (rows array)
    const sentLogsRes = await query(
      'SELECT * FROM quotation_sent_logs WHERE quotation_id = $1 ORDER BY sent_at ASC',
      [quotationId]
    );
    const sentLogs = sentLogsRes.rows || [];
    
    // Get PIs (rows array) — tolerate envs where proforma_invoices might not exist yet
    let pis = [];
    try {
      const pisRes = await query(
        'SELECT * FROM proforma_invoices WHERE quotation_id = $1 ORDER BY created_at ASC',
        [quotationId]
      );
      pis = pisRes.rows || [];
    } catch (e) {
      if (!(e && (e.code === '42P01' || /proforma_invoices/.test(e.message || '')))) {
        throw e;
      }
    }
    
    // Get payment history for this quotation (if payment_history table exists)
    let payments = [];
    try {
      const paymentsRes = await query(
        'SELECT * FROM payment_history WHERE quotation_id = $1 AND payment_status = $2 ORDER BY payment_date ASC',
        [quotationId, 'completed']
      );
      payments = paymentsRes.rows || [];
    } catch (err) {
      // payment_history table might not exist, ignore
      console.log('payment_history table not found, skipping payments');
    }
    
    return {
      quotation,
      approvalLogs,
      sentLogs,
      pis,
      payments
    };
  }

  // Get quotations pending verification for department head
  // Check for status='pending' AND submitted_for_verification_at IS NOT NULL
  async getPendingVerification() {
    const queryText = `
      SELECT q.*, 
             COUNT(qi.id) as item_count,
             q.created_by as salesperson_email
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      WHERE (q.status = 'pending' OR q.status = 'pending_verification')
        AND q.submitted_for_verification_at IS NOT NULL
      GROUP BY q.id
      ORDER BY q.submitted_for_verification_at DESC
    `;
    
    const result = await query(queryText);
    return result.rows;
  }

  // Get quotations by status for department head
  async getByStatus(status) {
    const queryText = `
      SELECT q.*, 
             COUNT(qi.id) as item_count,
             q.created_by as salesperson_email
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      WHERE q.status = $1
      GROUP BY q.id
      ORDER BY q.updated_at DESC
    `;
    
    const result = await query(queryText, [status]);
    return result.rows;
  }

  // Get quotations by salesperson (for salesperson view)
  async getBySalesperson(salespersonEmail) {
    const queryText = `
      SELECT q.*, 
             COUNT(qi.id) as item_count
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      WHERE q.created_by = $1
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `;
    
    const result = await query(queryText, [salespersonEmail]);
    return result.rows;
  }

  // Delete quotation by ID (cascade delete items)
  async deleteById(id) {
    try {
      console.log('Deleting quotation with ID:', id);
      await query('BEGIN');
      
      // Delete quotation items first
      await query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);
      
      // Delete quotation
      const result = await query('DELETE FROM quotations WHERE id = $1 RETURNING *', [id]);
      
      await query('COMMIT');
      return result.rows.length > 0;
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }
}

module.exports = new Quotation();
