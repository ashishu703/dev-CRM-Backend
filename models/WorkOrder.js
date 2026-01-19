const BaseModel = require('./BaseModel');

/**
 * WorkOrder model class
 * Follows OOP principles for work order data management
 */
class WorkOrder extends BaseModel {
  constructor() {
    super('work_orders');
  }

  /**
   * Check if work order exists for quotation number
   * @param {string} quotationNumber - Quotation number (e.g., "QT202512051")
   * @returns {Promise<Object|null>} Existing work order or null
   */
  async getByQuotationId(quotationNumber) {
    if (!quotationNumber) return null;
    // Use bna_number field which stores quotation number as VARCHAR
    const query = 'SELECT * FROM work_orders WHERE bna_number = $1';
    const result = await WorkOrder.query(query, [quotationNumber]);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  /**
   * Generate unique work order number
   * Format: WO-YYYY-NNN
   * @returns {Promise<string>} Generated work order number
   */
  async generateWorkOrderNumber() {
    const year = new Date().getFullYear();
    const prefix = `WO-${year}-`;
    
    const result = await WorkOrder.query(
      `SELECT work_order_number FROM work_orders 
       WHERE work_order_number LIKE $1 
       ORDER BY work_order_number DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNumber = 1;
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].work_order_number;
      const lastSeq = parseInt(lastNumber.split('-').pop());
      nextNumber = lastSeq + 1;
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Create a new work order with full details
   * @param {Object} workOrderData - Complete work order data
   * @returns {Promise<Object>} Created work order
   */
  async create(workOrderData) {
    const {
      workOrderNumber: providedWorkOrderNumber,
      work_order_number, // Handle snake_case from frontend
      quotationId: quotationIdValue,
      date,
      deliveryDate,
      contact,
      from,
      to,
      customer,
      additionalDetails,
      orderDetails,
      items,
      production,
      unitRate,
      terms,
      preparedBy,
      receivedBy,
      paymentId,
      quotationId,
      leadId,
      templateKey,
      status = 'pending',
      remarks,
      companyLogo,
      preparedByUserId,
      rfpRequestId,
      rfpId,
      sentToOperationsAt,
      operationsStatus,
      operationsAcknowledgedAt,
      expectedOrderCreationDate,
      operationsCancelledAt,
      operationsCancelledBy,
      operationsCancelReason,
      quotationUuid
    } = workOrderData;

    // Generate work order number if not provided
    const workOrderNumber = providedWorkOrderNumber || work_order_number || await this.generateWorkOrderNumber();

    // Check if work order already exists for this quotation
    const finalQuotationId = quotationId || quotationIdValue;
    if (finalQuotationId) {
      const existing = await this.getByQuotationId(finalQuotationId);
      if (existing) {
        throw new Error(`Work order already exists for quotation ${finalQuotationId}. Work Order Number: ${existing.work_order_number}`);
      }
    }

    const query = `
      INSERT INTO work_orders (
        work_order_number, bna_number, date, delivery_date, contact,
        from_company_name, from_address, from_email, from_gstin, from_state, from_website, company_logo,
        to_company_name, to_address, to_email,
        customer_business_name, customer_buyer_name, customer_gst, customer_contact, customer_state,
        payment_terms, transport_tc, dispatch_through, delivery_terms, material_type, delivery_location,
        order_title, order_description, order_quantity, order_type,
        order_length, order_colour, order_print, order_total,
        items, unit_rate, terms,
        raw_materials, quality_standards, special_instructions, priority,
        remarks, prepared_by, received_by, prepared_by_name, prepared_by_designation, prepared_by_user_id,
        payment_id, quotation_id, lead_id, template_key, status,
        rfp_request_id, rfp_id, sent_to_operations_at, operations_status,
        operations_acknowledged_at, expected_order_creation_date, operations_cancelled_at,
        operations_cancelled_by, operations_cancel_reason
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, 
        $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, 
        $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52,
        $53, $54, $55, $56, $57, $58, $59, $60, $61
      ) RETURNING *
    `;

    // Helper function to sanitize date values (DRY principle)
    const sanitizeDate = (dateValue) => {
      if (!dateValue) return null;
      if (typeof dateValue === 'string') {
        const trimmed = dateValue.trim().toUpperCase();
        if (['N/A', '', 'NULL', 'NONE'].includes(trimmed)) return null;
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
      }
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? null : dateValue.toISOString().split('T')[0];
      }
      return null;
    };

    const isUuid = (value) => typeof value === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    const finalQuotationUuid = isUuid(quotationUuid) ? quotationUuid : (isUuid(quotationId) ? quotationId : null);

    const values = [
      workOrderNumber,
      quotationIdValue || quotationId || null,
      sanitizeDate(date) || new Date().toISOString().split('T')[0],
      sanitizeDate(deliveryDate),
      contact,
      from?.companyName || from?.name || '',
      from?.address || '',
      from?.email || '',
      from?.gstin || from?.gst || '',
      from?.state || '',
      from?.website || '',
      companyLogo || null,
      to?.companyName || to?.name || customer?.businessName || '',
      to?.address || customer?.address || '',
      to?.email || customer?.email || '',
      customer?.businessName || to?.companyName || '',
      customer?.buyerName || '',
      customer?.gst || customer?.gstin || '',
      customer?.contact || customer?.phone || '',
      customer?.state || '',
      additionalDetails?.paymentMode || additionalDetails?.paymentTerms || '',
      additionalDetails?.transportTc || '',
      additionalDetails?.dispatchThrough || '',
      additionalDetails?.deliveryTerms || '',
      additionalDetails?.materialType || '',
      additionalDetails?.deliveryLocation || '',
      orderDetails?.title || '',
      orderDetails?.description || '',
      orderDetails?.quantity || '',
      orderDetails?.type || '',
      orderDetails?.length || '',
      orderDetails?.colour || '',
      orderDetails?.print || '',
      orderDetails?.total || 0,
      items ? JSON.stringify(items) : null,
      unitRate || '0',
      terms ? JSON.stringify(terms) : null,
      production?.rawMaterials || '',
      production?.qualityStandards || '',
      production?.specialInstructions || '',
      production?.priority || 'medium',
      remarks || '',
      preparedBy || '',
      receivedBy || '',
      preparedBy?.name || preparedBy || '',
      preparedBy?.designation || '',
      preparedByUserId || null,
      paymentId || null,
      finalQuotationUuid,
      leadId || null,
      templateKey || null,
      status,
      rfpRequestId || null,
      rfpId || null,
      sentToOperationsAt || null,
      operationsStatus || 'pending',
      operationsAcknowledgedAt || null,
      sanitizeDate(expectedOrderCreationDate),
      operationsCancelledAt || null,
      operationsCancelledBy || null,
      operationsCancelReason || null
    ];

    return await WorkOrder.query(query, values);
  }

  /**
   * Get work order by ID
   * @param {number} id - Work order ID
   * @returns {Promise<Object>} Work order data
   */
  async getById(id) {
    const query = `
      SELECT * FROM work_orders WHERE id = $1
    `;
    const result = await WorkOrder.query(query, [id]);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  /**
   * Get all work orders
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of work orders
   */
  async getAll(filters = {}) {
    let query = 'SELECT * FROM work_orders WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.paymentId) {
      query += ` AND payment_id = $${paramCount}`;
      values.push(filters.paymentId);
      paramCount++;
    }

    if (filters.quotationId) {
      // Use bna_number field for quotation number string
      query += ` AND bna_number = $${paramCount}`;
      values.push(filters.quotationId);
      paramCount++;
    }

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await WorkOrder.query(query, values);
    return result.rows || [];
  }

  /**
   * Update work order status
   * @param {number} id - Work order ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated work order
   */
  async updateStatus(id, status) {
    const query = `
      UPDATE work_orders 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2 AND is_deleted = FALSE
      RETURNING *
    `;
    const result = await WorkOrder.query(query, [status, id]);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  /**
   * Create a revision of work order
   * @param {number} originalId - Original work order ID
   * @param {Object} updatedData - Updated work order data
   * @param {number} userId - User making the revision
   * @returns {Promise<Object>} New revised work order
   */
  async createRevision(originalId, updatedData, userId) {
    const original = await this.getById(originalId);
    if (!original) throw new Error('Original work order not found');

    // Create new work order with revision info
    const revisedData = {
      ...updatedData,
      workOrderNumber: `${original.work_order_number}-R${(original.revision_number || 1) + 1}`,
      isRevised: true,
      revisionNumber: (original.revision_number || 1) + 1,
      originalWorkOrderId: originalId,
      revisedBy: userId
    };

    return await this.create(revisedData);
  }

  /**
   * Soft delete work order
   * @param {number} id - Work order ID
   * @param {number} userId - User deleting the work order
   * @returns {Promise<boolean>} Success status
   */
  async softDelete(id, userId) {
    const query = `
      UPDATE work_orders 
      SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1, updated_at = NOW()
      WHERE id = $2 AND is_deleted = FALSE
      RETURNING id
    `;
    const result = await WorkOrder.query(query, [userId, id]);
    return result.rows.length > 0;
  }

  /**
   * Get work orders with filters (excluding deleted by default)
   * @param {Object} filters - Filter options
   * @param {boolean} includeDeleted - Include soft-deleted records
   * @returns {Promise<Array>} Array of work orders
   */
  async getAll(filters = {}, includeDeleted = false) {
    let query = 'SELECT * FROM work_orders WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (!includeDeleted) {
      query += ' AND is_deleted = FALSE';
    }

    if (filters.paymentId) {
      query += ` AND payment_id = $${paramCount}`;
      values.push(filters.paymentId);
      paramCount++;
    }

    if (filters.quotationId) {
      query += ` AND bna_number = $${paramCount}`;
      values.push(filters.quotationId);
      paramCount++;
    }

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.operationsStatus) {
      query += ` AND operations_status = $${paramCount}`;
      values.push(filters.operationsStatus);
      paramCount++;
    }

    if (filters.rfpRequestId) {
      query += ` AND rfp_request_id = $${paramCount}`;
      values.push(filters.rfpRequestId);
      paramCount++;
    }

    if (filters.isRevised !== undefined) {
      query += ` AND is_revised = $${paramCount}`;
      values.push(filters.isRevised);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await WorkOrder.query(query, values);
    return result.rows || [];
  }

  /**
   * Update work order (for editing)
   * @param {number} id - Work order ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated work order
   */
  async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Dynamically build update query (DRY principle)
    const allowedFields = [
      'customer_business_name', 'customer_buyer_name', 'customer_gst', 'customer_contact', 'customer_state',
      'payment_terms', 'transport_tc', 'dispatch_through', 'delivery_terms', 'material_type', 'delivery_location',
      'raw_materials', 'quality_standards', 'special_instructions', 'priority', 'remarks', 'items', 'status',
      'rfp_request_id', 'rfp_id', 'sent_to_operations_at', 'operations_status', 'operations_acknowledged_at',
      'expected_order_creation_date', 'operations_cancelled_at', 'operations_cancelled_by', 'operations_cancel_reason'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        fields.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    });

    if (fields.length === 0) return null;

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `
      UPDATE work_orders 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND is_deleted = FALSE
      RETURNING *
    `;

    const result = await WorkOrder.query(query, values);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }
}

module.exports = new WorkOrder();

