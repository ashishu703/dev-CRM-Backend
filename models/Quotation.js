const BaseModel = require('./BaseModel');
const { query } = require('../config/database');
const notificationService = require('../services/notificationService');

function normalizeBankDetailsForApi(bankDetailsRaw, branchCode) {
  if (!bankDetailsRaw) return null;
  const details = typeof bankDetailsRaw === 'string' ? JSON.parse(bankDetailsRaw) : bankDetailsRaw;
  const branchFallback = branchCode || 'ANODE';
  const companyNameMap = { ANODE: 'ANODE ELECTRIC PVT. LTD.' };
  let accountHolder =
    details.accountHolderName ||
    details.account_holder_name ||
    companyNameMap[branchFallback] ||
    branchFallback;
  const strVal = String(accountHolder || '').trim();
  if (!strVal || /^\d+$/.test(strVal) || strVal.length < 2) {
    accountHolder = companyNameMap[branchFallback] || 'ANODE ELECTRIC PVT. LTD.';
  }
  return {
    ...details,
    accountHolderName: String(accountHolder),
    account_holder_name: String(accountHolder),
    branch: String(details.branch || details.branchName || ''),
    branchName: String(details.branch || details.branchName || ''),
    bankName: String(details.bankName || ''),
    accountNumber: String(details.accountNumber || ''),
    ifscCode: String(details.ifscCode || '')
  };
}

class Quotation extends BaseModel {
  constructor() {
    super('quotations');
  }

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
          subtotal, tax_rate, tax_amount, discount_rate, discount_amount, total_amount,
          template, payment_mode, transport_tc, dispatch_through, delivery_terms, material_type,
          bank_details, terms_sections, bill_to, remark, rfp_request_id, rfp_id, master_rfp_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34
        ) RETURNING *
      `;
      
      const quotationValues = [
        quotationNumber,
        quotationData.customerId,
        quotationData.salespersonId,
        // Pricing is already decided upstream; quotation doesn't need DH approval
        quotationData.status || 'approved',
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
        quotationData.totalAmount,
        quotationData.template || null,
        quotationData.paymentMode || null,
        quotationData.transportTc || null,
        quotationData.dispatchThrough || null,
        quotationData.deliveryTerms || null,
        quotationData.materialType || null,
        quotationData.bankDetails ? JSON.stringify(quotationData.bankDetails) : null,
        quotationData.termsSections ? JSON.stringify(quotationData.termsSections) : null,
        quotationData.billTo ? JSON.stringify(quotationData.billTo) : null,
        quotationData.remark || null,
        quotationData.rfpRequestId || null,
        quotationData.rfpId || null,
        quotationData.masterRfpId || null
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
              quantity, unit, unit_price, gst_rate, taxable_amount, gst_amount, total_amount, remark
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
            item.totalAmount,
            item.remark || null
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

  async updateById(id, updateData) {
    try {
      await query('BEGIN');
      
      // Update quotation
      const quotationUpdateFields = [];
      const quotationValues = [];
      let paramCount = 1;
      
      const fieldsToUpdate = {
        quotation_date: updateData.quotationDate,
        valid_until: updateData.validUntil,
        branch: updateData.branch,
        customer_name: updateData.customerName,
        customer_business: updateData.customerBusiness,
        customer_phone: updateData.customerPhone,
        customer_email: updateData.customerEmail,
        customer_address: updateData.customerAddress,
        customer_gst_no: updateData.customerGstNo,
        customer_state: updateData.customerState,
        subtotal: updateData.subtotal,
        tax_rate: updateData.taxRate,
        tax_amount: updateData.taxAmount,
        discount_rate: updateData.discountRate,
        discount_amount: updateData.discountAmount,
        total_amount: updateData.totalAmount,
        template: updateData.template,
        payment_mode: updateData.paymentMode,
        transport_tc: updateData.transportTc,
        dispatch_through: updateData.dispatchThrough,
        delivery_terms: updateData.deliveryTerms,
        material_type: updateData.materialType,
        bank_details: updateData.bankDetails ? JSON.stringify(updateData.bankDetails) : null,
        terms_sections: updateData.termsSections ? JSON.stringify(updateData.termsSections) : null,
        bill_to: updateData.billTo ? JSON.stringify(updateData.billTo) : null,
        remark: updateData.remark,
        rfp_request_id: updateData.rfpRequestId,
        rfp_id: updateData.rfpId,
        // Do not force back to draft on edit; keep current unless explicitly changed
        status: updateData.status,
        updated_at: new Date().toISOString()
      };
      
      Object.entries(fieldsToUpdate).forEach(([key, value]) => {
        if (value !== undefined) {
          quotationUpdateFields.push(`${key} = $${paramCount++}`);
          quotationValues.push(value);
        }
      });
      
      if (quotationUpdateFields.length > 0) {
        quotationValues.push(id);
        const quotationUpdateQuery = `
          UPDATE quotations 
          SET ${quotationUpdateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;
        await query(quotationUpdateQuery, quotationValues);
      }
      
      // Delete existing items
      await query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);
      
      // Insert new items
      const items = updateData.items || [];
      if (items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const itemQuery = `
            INSERT INTO quotation_items (
              quotation_id, item_order, product_name, description, hsn_code,
              quantity, unit, unit_price, gst_rate, taxable_amount, gst_amount, total_amount, remark
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `;
          
          const itemValues = [
            id,
            i + 1,
            item.productName,
            item.description || item.productName,
            item.hsnCode || item.hsn || '',
            item.quantity,
            item.unit || 'Nos',
            item.unitPrice || item.buyerRate,
            item.gstRate || 18.00,
            item.taxableAmount || item.amount,
            item.gstAmount || (item.amount * (item.gstRate || 18.00) / 100),
            item.totalAmount || (item.amount * (1 + (item.gstRate || 18.00) / 100)),
            item.remark || null
          ];
          
          await query(itemQuery, itemValues);
        }
      }
      
      await query('COMMIT');
      return await this.getWithItems(id);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  async getWithItems(id) {
    const isUUID = (str) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    let quotationQuery, itemsQuery;
    if (isUUID(id)) {
      quotationQuery = 'SELECT * FROM quotations WHERE id = $1';
      itemsQuery = 'SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY item_order';
    } else {
      quotationQuery = 'SELECT * FROM quotations WHERE quotation_number = $1';
      const quotationResult = await query(quotationQuery, [id]);
      if (quotationResult.rows.length === 0) return null;
      const quotation = quotationResult.rows[0];
      itemsQuery = 'SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY item_order';
      const itemsResult = await query(itemsQuery, [quotation.id]);
      quotation.items = itemsResult.rows;
      if (quotation.bank_details != null) {
        try {
          quotation.bank_details = normalizeBankDetailsForApi(quotation.bank_details, quotation.branch);
        } catch (e) {}
      }
      return quotation;
    }
    
    const quotationResult = await query(quotationQuery, [id]);
    if (quotationResult.rows.length === 0) return null;

    const quotation = quotationResult.rows[0];
    const itemsResult = await query(itemsQuery, [quotation.id]);
    quotation.items = itemsResult.rows;

    if (quotation.bank_details != null) {
      try {
        quotation.bank_details = normalizeBankDetailsForApi(quotation.bank_details, quotation.branch);
      } catch (e) {
        // keep original if parse fails
      }
    }
    return quotation;
  }

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

  async getDepartmentHeadEmail(customerId) {
    if (!customerId) return null;
    
    try {
      const leadQuery = `
        SELECT COALESCE(dhl.created_by, dh_spl.created_by) as department_head_email
        FROM (
          SELECT $1::integer as lead_id
        ) q
        LEFT JOIN department_head_leads dhl ON dhl.id = q.lead_id
        LEFT JOIN salesperson_leads spl ON spl.id = q.lead_id
        LEFT JOIN department_head_leads dh_spl ON dh_spl.id = spl.dh_lead_id
        LIMIT 1
      `;
      const leadResult = await query(leadQuery, [customerId]);
      
      if (leadResult.rows && leadResult.rows.length > 0) {
        return leadResult.rows[0].department_head_email || null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async sendQuotationNotification(notificationType, quotation, notifyEmail, additionalData = {}) {
    if (!quotation || !notifyEmail) return;

    try {
      const quotationData = {
        id: quotation.id,
        quotation_number: quotation.quotation_number,
        customer_name: quotation.customer_name,
        total_amount: quotation.total_amount,
        created_by: quotation.created_by,
        ...additionalData
      };

      let notificationPromise;
      switch (notificationType) {
        case 'pending':
          notificationPromise = notificationService.notifyQuotationPending(quotationData, notifyEmail);
          break;
        case 'approved':
          notificationPromise = notificationService.notifyQuotationApproved(quotationData, additionalData.approvedBy || 'System', notifyEmail);
          break;
        case 'rejected':
          notificationPromise = notificationService.notifyQuotationRejected(quotationData, additionalData.rejectedBy || 'System', notifyEmail);
          break;
        default:
          console.warn(`⚠️ Unknown notification type: ${notificationType}`);
          return;
      }

      await notificationPromise;
    } catch (error) {
      console.error(`Error sending ${notificationType} notification:`, error);
    }
  }

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
    
    const placeholderUserId = '00000000-0000-0000-0000-000000000001';
    const result = await query(queryText, [id, placeholderUserId]);
    const quotation = result.rows?.[0];
    
    await this.logApprovalAction(id, 'submitted', submittedBy, 'salesperson', 'Quotation submitted for verification');
    
    if (quotation && quotation.customer_id) {
      const departmentHeadEmail = await this.getDepartmentHeadEmail(quotation.customer_id);
      if (departmentHeadEmail) {
        await this.sendQuotationNotification('pending', quotation, departmentHeadEmail);
      }
    }
    
    return quotation;
  }

  async approve(id, approvedBy, notes = '') {
    try {
      const queryText = `
        UPDATE quotations 
        SET status = 'approved', 
            verification_notes = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await query(queryText, [id, notes]);
      const quotation = result.rows?.[0];
      
      try {
        await this.logApprovalAction(id, 'approved', approvedBy, 'department_head', notes);
      } catch (logError) {
        console.error('Failed to log approval action:', logError);
      }
      
      if (quotation && quotation.created_by) {
        await this.sendQuotationNotification('approved', quotation, quotation.created_by, {
          approvedBy,
          rejection_reason: notes
        });
      }
      
      return quotation;
    } catch (error) {
      console.error('Error in approve function:', error);
      throw error;
    }
  }

  async reject(id, rejectedBy, notes = '') {
    try {
      const queryText = `
        UPDATE quotations 
        SET status = 'rejected', 
            verification_notes = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await query(queryText, [id, notes]);
      const quotation = result.rows?.[0];
      
      try {
        await this.logApprovalAction(id, 'rejected', rejectedBy, 'department_head', notes);
      } catch (logError) {
        console.error('Failed to log rejection action:', logError);
      }
      
      if (quotation && quotation.created_by) {
        await this.sendQuotationNotification('rejected', quotation, quotation.created_by, {
          rejectedBy,
          rejection_reason: notes
        });
      }
      
      return quotation;
    } catch (error) {
      console.error('Error in reject function:', error);
      throw error;
    }
  }

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
    
    const placeholderUserId = '00000000-0000-0000-0000-000000000001';
    const result = await query(queryText, [id, placeholderUserId]);
    await this.logSentAction(id, sentTo, sentVia, sentBy);
    
    return result.rows?.[0];
  }

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

  async logApprovalAction(quotationId, action, performedBy, performedByType, notes) {
    try {
      const placeholderId = performedBy || 'system@anocab.com';
      const formattedQuotationId = typeof quotationId === 'string' ? quotationId : quotationId.toString();
      const formattedAction = typeof action === 'string' ? action : action.toString();
      const formattedPerformedByType = typeof performedByType === 'string' ? performedByType : performedByType.toString();
      const formattedNotes = notes ? (typeof notes === 'string' ? notes : notes.toString()) : null;
      
      const queryText = `
        INSERT INTO quotation_approval_logs (quotation_id, action, performed_by, performed_by_type, notes)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      return await query(queryText, [formattedQuotationId, formattedAction, placeholderId, formattedPerformedByType, formattedNotes]);
    } catch (error) {
      if (error.message && error.message.includes('foreign key constraint')) {
        try {
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
          const formattedQuotationId = typeof quotationId === 'string' ? quotationId : quotationId.toString();
          const formattedAction = typeof action === 'string' ? action : action.toString();
          const formattedPerformedByType = typeof performedByType === 'string' ? performedByType : performedByType.toString();
          const formattedNotes = notes ? (typeof notes === 'string' ? notes : notes.toString()) : null;
          const placeholderId = performedBy || 'system@anocab.com';
          const queryText = `
            INSERT INTO quotation_approval_logs (quotation_id, action, performed_by, performed_by_type, notes)
            VALUES ($1, $2, $3, $4, $5)
          `;
          return await query(queryText, [formattedQuotationId, formattedAction, placeholderId, formattedPerformedByType, formattedNotes]);
        } catch (recreateError) {
          console.error('Failed to recreate table:', recreateError);
        }
      }
    }
  }

  async logSentAction(quotationId, sentTo, sentVia, sentBy) {
    const queryText = `
      INSERT INTO quotation_sent_logs (quotation_id, sent_to, sent_via, sent_by)
      VALUES ($1, $2, $3, $4)
    `;
    
    return await query(queryText, [quotationId, sentTo, sentVia, sentBy]);
  }

  async generateQuotationNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
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
      return `QT${year}${month}001`;
    } else {
      const lastNumber = result.rows[0].quotation_number;
      const lastSeq = parseInt(lastNumber.slice(-3));
      const newSeq = String(lastSeq + 1).padStart(3, '0');
      return `QT${year}${month}${newSeq}`;
    }
  }

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

  async getCompleteData(quotationId) {
    const quotation = await this.getWithItems(quotationId);
    if (!quotation) return null;
    
    const approvalLogsRes = await query(
      'SELECT * FROM quotation_approval_logs WHERE quotation_id = $1 ORDER BY created_at ASC',
      [quotationId]
    );
    const approvalLogs = approvalLogsRes.rows || [];
    const sentLogsRes = await query(
      'SELECT * FROM quotation_sent_logs WHERE quotation_id = $1 ORDER BY sent_at ASC',
      [quotationId]
    );
    const sentLogs = sentLogsRes.rows || [];
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
    
    let payments = [];
    try {
      const paymentsRes = await query(
        'SELECT * FROM payment_history WHERE quotation_id = $1 AND payment_status = $2 ORDER BY payment_date ASC',
        [quotationId, 'completed']
      );
      payments = paymentsRes.rows || [];
    } catch (err) {
      // payment_history table might not exist
    }
    
    return {
      quotation,
      approvalLogs,
      sentLogs,
      pis,
      payments
    };
  }

  async getPendingVerification(departmentType = null, companyName = null) {
    let queryText = `
      SELECT q.*, 
             COUNT(qi.id) as item_count,
             q.created_by as salesperson_email
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      LEFT JOIN department_head_leads dhl ON dhl.id = q.customer_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE (q.status = 'pending' OR q.status = 'pending_verification')
        AND q.submitted_for_verification_at IS NOT NULL
    `;
    
    const values = [];
    let paramCount = 1;

    if (departmentType) {
      queryText += ` AND dh.department_type = $${paramCount}`;
      values.push(departmentType);
      paramCount++;
    }

    // STRICT CHECK: Filter by company name if provided
    if (companyName) {
      queryText += ` AND dh.company_name = $${paramCount}`;
      values.push(companyName);
    }

    queryText += `
      GROUP BY q.id
      ORDER BY q.submitted_for_verification_at DESC
    `;
    
    const result = await query(queryText, values);
    return result.rows;
  }

  async getByStatus(status, departmentType = null, companyName = null) {
    let queryText = `
      SELECT q.*, 
             COUNT(qi.id) as item_count,
             q.created_by as salesperson_email
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      LEFT JOIN department_head_leads dhl ON dhl.id = q.customer_id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE q.status = $1
    `;
    
    const values = [status];
    let paramCount = 2;

    if (departmentType) {
      queryText += ` AND dh.department_type = $${paramCount}`;
      values.push(departmentType);
      paramCount++;
    }

    // STRICT CHECK: Filter by company name if provided
    if (companyName) {
      queryText += ` AND dh.company_name = $${paramCount}`;
      values.push(companyName);
    }

    queryText += `
      GROUP BY q.id
      ORDER BY q.updated_at DESC
    `;
    
    const result = await query(queryText, values);
    return result.rows;
  }

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

  async deleteById(id) {
    try {
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
