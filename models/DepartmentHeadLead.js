const BaseModel = require('./BaseModel');

const CONSTANTS = {
  CUSTOMER_NAME_MAX_LENGTH: 100,
  PHONE_MAX_LENGTH: 50,
  BATCH_SIZE: 1000,
  DUPLICATE_CHECK_BATCH_SIZE: 1500,
  MAX_CUSTOMER_ID_ATTEMPTS: 100,
  PARAMS_PER_ROW: 22
};

const FIELD_MAP = {
  leadSource: 'lead_source',
  productNames: 'product_names',
  salesStatus: 'sales_status',
  telecallerStatus: 'telecaller_status',
  paymentStatus: 'payment_status',
  gstNo: 'gst_no',
  customerType: 'customer_type',
  assignedSalesperson: 'assigned_salesperson',
  assignedTelecaller: 'assigned_telecaller'
};

// Allowed fields for updates
const ALLOWED_UPDATE_FIELDS = [
  'customer', 'email', 'business', 'leadSource', 'productNames', 'category',
  'salesStatus', 'created', 'telecallerStatus', 'paymentStatus',
  'phone', 'address', 'gstNo', 'state', 'customerType', 'date',
  'whatsapp', 'assignedSalesperson', 'assignedTelecaller', 'division'
];

// Data Validator Utility Class
class DataValidator {
  static truncateString(value, maxLength) {
    const trimmed = (value || '').toString().trim();
    return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed;
  }

  static cleanPhone(phone) {
    if (!phone) return null;
    const cleaned = phone.toString().trim().replace(/\D/g, '');
    return cleaned.length > 0 ? this.truncateString(cleaned, CONSTANTS.PHONE_MAX_LENGTH) : null;
  }

  static normalizeWhatsapp(whatsapp, phone) {
    const cleaned = this.cleanPhone(whatsapp);
    return cleaned || this.cleanPhone(phone);
  }

  static normalizeCustomerName(customer) {
    return this.truncateString(customer, CONSTANTS.CUSTOMER_NAME_MAX_LENGTH) || null;
  }

  static normalizeGstNo(gstNo) {
    // Handle all null/empty cases
    if (gstNo === undefined || gstNo === null) {
      return 'N/A';
    }
    
    const trimmed = String(gstNo).trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'n/a' || trimmed === 'null') {
      return 'N/A';
    }
    return trimmed.length > 50 ? trimmed.substring(0, 50) : trimmed;
  }


  static normalizeCustomerType(customerType) {
    if (!customerType) return null;
    const trimmed = String(customerType).trim();
    return trimmed.length > 50 ? trimmed.substring(0, 50) : trimmed;
  }

  static normalizeDate(dateValue) {
    if (!dateValue) return null;
    
    const dateStr = String(dateValue).trim();
    if (!dateStr || dateStr === 'null' || dateStr === 'N/A') return null;
    
    if (dateStr.includes('-') || dateStr.includes('/')) {
      const separator = dateStr.includes('-') ? '-' : '/';
      const parts = dateStr.split(separator);
      if (parts.length === 3) {
        const [part1, part2, part3] = parts.map(p => p.trim());
        if (part1.length === 2 && part3.length === 4) {
          return `${part3}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
        }
        if (part1.length === 4) {
          return `${part1}-${part2.padStart(2, '0')}-${part3.padStart(2, '0')}`;
        }
      }
    }
    
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
    }
    
    return null;
  }

  static validateRow(row) {
    const name = this.normalizeCustomerName(row.customer);
    const phone = this.cleanPhone(row.phone);
    return name.length > 0 || (phone && phone.length > 0);
  }
}

class QueryBuilder {
  constructor() {
    this.conditions = [];
    this.values = [];
    this.paramCount = 1;
  }

  addCondition(condition, value) {
    if (value !== undefined && value !== null && value !== '') {
      this.conditions.push(`${condition} = $${this.paramCount}`);
      this.values.push(value);
      this.paramCount++;
    }
    return this;
  }

  addSearchCondition(fields, searchTerm) {
    if (!searchTerm) return this;
    const searchFields = fields.map(field => `${field} ILIKE $${this.paramCount}`).join(' OR ');
    this.conditions.push(`(${searchFields})`);
    this.values.push(`%${searchTerm}%`);
    this.paramCount++;
    return this;
  }

  addInCondition(field, values, batchSize = CONSTANTS.DUPLICATE_CHECK_BATCH_SIZE) {
    if (!values || values.length === 0) return [];
    
    const batches = [];
    for (let i = 0; i < values.length; i += batchSize) {
      batches.push(values.slice(i, i + batchSize));
    }
    return batches;
  }

  buildWhereClause() {
    return this.conditions.length > 0 ? ` WHERE ${this.conditions.join(' AND ')}` : '';
  }

  getValues() {
    return this.values;
  }

  getParamCount() {
    return this.paramCount;
  }
}

// Batch Processor Utility Class
class BatchProcessor {
  static splitIntoBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  static async processBatches(batches, processor) {
    const results = [];
    for (const batch of batches) {
      const result = await processor(batch);
      results.push(result);
    }
    return results;
  }
}

// Main Model Class
class DepartmentHeadLead extends BaseModel {
  constructor() {
    super('department_head_leads');
  }

  /**
   * Check if is_deleted column exists in department_head_leads table
   * @returns {Promise<boolean>}
   */
  async hasIsDeletedColumn() {
    try {
      const columnCheckQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'department_head_leads' 
        AND column_name = 'is_deleted'
      `;
      const columnCheck = await DepartmentHeadLead.query(columnCheckQuery);
      return columnCheck.rows.length > 0;
    } catch (e) {
      return false;
    }
  }

  generateCustomerId() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CUST-${timestamp}${random}`;
  }

  generateUniqueCustomerId(existingIds, usedIds, index = 0) {
    let attempts = 0;
    let newId;
    
    while (attempts < CONSTANTS.MAX_CUSTOMER_ID_ATTEMPTS) {
      newId = attempts === 0 ? this.generateCustomerId() : 
              `CUST-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`;
      
      if (!existingIds.has(newId) && !usedIds.has(newId)) {
        return newId;
      }
      attempts++;
    }
    
    return `CUST-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`;
  }

  static normalizeForDB(value) {
    if (value === null || value === undefined) return 'N/A';
    const trimmed = String(value).trim();
    return trimmed === '' || trimmed.toLowerCase() === 'n/a' ? 'N/A' : trimmed;
  }

  static normalizePaymentStatus(value) {
    if (value === null || value === undefined) return 'PENDING';
    const trimmed = String(value).trim().toUpperCase();
    return ['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(trimmed) ? trimmed : 'PENDING';
  }

  static normalizeTelecallerStatus(value) {
    if (value === null || value === undefined) return 'INACTIVE';
    const trimmed = String(value).trim().toUpperCase();
    return ['ACTIVE', 'INACTIVE'].includes(trimmed) ? trimmed : 'INACTIVE';
  }

  /**
   * Prepares lead values for database insertion
   * Logic: If field has data → save actual data, If field is empty → save 'N/A' to DB
   * @param {Object} lead - Lead data object
   * @param {string} createdBy - Creator email/identifier
   * @returns {Array} - Array of values for SQL INSERT
   */
  prepareLeadValues(lead, createdBy) {
    const customer = (lead.customer && DataValidator.normalizeCustomerName(lead.customer)) || 'N/A';
    const phone = DataValidator.cleanPhone(lead.phone) || 'N/A';
    const whatsapp = DataValidator.normalizeWhatsapp(lead.whatsapp, lead.phone) || 'N/A';
    const customerType = (lead.customerType && DataValidator.normalizeCustomerType(lead.customerType)) || 'N/A';
    const gstNo = DataValidator.normalizeGstNo(lead.gstNo);
    const normalizedDate = DataValidator.normalizeDate(lead.date);

    return [
      lead.customerId || null,
      customer,
      DepartmentHeadLead.normalizeForDB(lead.email),
      DepartmentHeadLead.normalizeForDB(lead.business),
      DepartmentHeadLead.normalizeForDB(lead.leadSource),
      DepartmentHeadLead.normalizeForDB(lead.productNames || lead.productNamesText),
      DepartmentHeadLead.normalizeForDB(lead.category),
      DepartmentHeadLead.normalizeForDB(lead.salesStatus),
      lead.createdAt || null,
      DepartmentHeadLead.normalizeTelecallerStatus(lead.telecallerStatus),
      DepartmentHeadLead.normalizePaymentStatus(lead.paymentStatus),
      phone,
      DepartmentHeadLead.normalizeForDB(lead.address),
      gstNo,
      DepartmentHeadLead.normalizeForDB(lead.state),
      customerType,
      normalizedDate,
      whatsapp,
      DepartmentHeadLead.normalizeForDB(lead.assignedSalesperson),
      DepartmentHeadLead.normalizeForDB(lead.assignedTelecaller),
      DepartmentHeadLead.normalizeForDB(lead.division),
      createdBy || 'system'
    ];
  }

  async checkDuplicatePhone(phone, createdBy) {
    const result = await DepartmentHeadLead.query(
      'SELECT id FROM department_head_leads WHERE created_by = $1 AND phone = $2 LIMIT 1',
      [createdBy, phone]
    );
    return result.rows?.[0] || null;
  }

  async getExistingPhones(phones, createdBy) {
    if (!phones || phones.length === 0) return new Set();
    
    const batches = BatchProcessor.splitIntoBatches(phones, CONSTANTS.DUPLICATE_CHECK_BATCH_SIZE);
    const existingPhones = new Set();

    for (const batch of batches) {
      const placeholders = batch.map((_, idx) => `$${idx + 2}`).join(',');
      const query = `SELECT phone FROM department_head_leads WHERE created_by = $1 AND phone IN (${placeholders})`;
      const result = await DepartmentHeadLead.query(query, [createdBy, ...batch]);
      
      (result.rows || []).forEach(row => {
        const phone = (row.phone || '').toString().trim();
        if (phone) existingPhones.add(phone);
      });
    }

    return existingPhones;
  }

  async getExistingCustomerIds(customerIds) {
    if (!customerIds || customerIds.length === 0) return new Set();
    
    const batches = BatchProcessor.splitIntoBatches(customerIds, CONSTANTS.DUPLICATE_CHECK_BATCH_SIZE);
    const existingIds = new Set();

    for (const batch of batches) {
      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(',');
      const query = `SELECT customer_id FROM department_head_leads WHERE customer_id IN (${placeholders})`;
      const result = await DepartmentHeadLead.query(query, batch);
      
      (result.rows || []).forEach(row => {
        if (row.customer_id) existingIds.add(row.customer_id);
      });
    }

    return existingIds;
  }

  assignUniqueCustomerIds(rows, existingCustomerIdSet) {
    const usedCustomerIdsInBatch = new Set();
    
    return rows.map((row, index) => {
      let customerId = row.customerId || null;
      
      const isDuplicate = customerId && 
                         (existingCustomerIdSet.has(customerId) || usedCustomerIdsInBatch.has(customerId));
      
      if (isDuplicate) {
        customerId = null;
      }

      if (!customerId) {
        customerId = this.generateUniqueCustomerId(existingCustomerIdSet, usedCustomerIdsInBatch, index);
      }

      usedCustomerIdsInBatch.add(customerId);
      return { ...row, customerId };
    });
  }

  filterValidRows(rows, existingPhoneSet) {
    const validRows = [];
    const skippedRows = [];
    
    rows.forEach((row, index) => {
      try {
        const name = row.customer ? DataValidator.normalizeCustomerName(row.customer) : null;
        const phone = row.phone ? DataValidator.cleanPhone(row.phone) : null;
        
        const nameIsEmpty = !name || (typeof name === 'string' && name.length === 0);
        const phoneIsEmpty = !phone || (typeof phone === 'string' && phone.length === 0);
        
        if (nameIsEmpty && phoneIsEmpty) {
          skippedRows.push({
            rowIndex: index + 1,
            row,
            reason: 'Both customer name and phone number are missing'
          });
          return;
        }
        
        if (phone && existingPhoneSet.has(phone)) {
          skippedRows.push({
            rowIndex: index + 1,
            row,
            reason: `Duplicate phone number: ${phone}`
          });
          return;
        }
        
        // Validate date format - skip row if date is invalid
        if (row.date) {
          const normalizedDate = DataValidator.normalizeDate(row.date);
          if (!normalizedDate) {
            skippedRows.push({
              rowIndex: index + 1,
              row,
              reason: `Invalid date format: ${row.date} (expected DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD)`
            });
            return;
          }
        }
        
        validRows.push(row);
      } catch (error) {
        skippedRows.push({
          rowIndex: index + 1,
          row,
          reason: `Error processing row: ${error.message}`
        });
      }
    });
    
    return { validRows, skippedRows };
  }

  buildInsertQuery(placeholders) {
    return `
      INSERT INTO department_head_leads (
        customer_id, customer, email, business, lead_source, product_names, category,
        sales_status, created, telecaller_status, payment_status,
        phone, address, gst_no, state, customer_type, date,
        whatsapp, assigned_salesperson, assigned_telecaller, division,
        created_by, created_at, updated_at
      ) VALUES ${placeholders}
      ON CONFLICT (customer_id) DO NOTHING
      RETURNING id
    `;
  }

  generatePlaceholders(rowCount) {
    let paramIndex = 1;
    const placeholders = [];
    
    for (let i = 0; i < rowCount; i++) {
      const rowParams = [];
      for (let j = 0; j < CONSTANTS.PARAMS_PER_ROW; j++) {
        rowParams.push(`$${paramIndex++}`);
      }
      placeholders.push(`(${rowParams.join(',')},NOW(),NOW())`);
    }
    
    return placeholders.join(',');
  }

  async insertBatch(batch, createdBy) {
    const placeholders = this.generatePlaceholders(batch.length);
    const query = this.buildInsertQuery(placeholders);
    const values = batch.flatMap(row => this.prepareLeadValues(row, createdBy));
    
    const result = await DepartmentHeadLead.query(query, values);
    return {
      rowCount: result.rowCount || 0,
      rows: result.rows || []
    };
  }

  async createFromUi(uiLead, createdBy) {
    const phone = DataValidator.cleanPhone(uiLead.phone);
    
    if (phone) {
      const existing = await this.checkDuplicatePhone(phone, createdBy);
      if (existing) return existing;
    }

    const customerId = uiLead.customerId || this.generateCustomerId();
    const values = this.prepareLeadValues({ ...uiLead, customerId }, createdBy);
    
    const query = `
      INSERT INTO department_head_leads (
        customer_id, customer, email, business, lead_source, product_names, category,
        sales_status, created, telecaller_status, payment_status,
        phone, address, gst_no, state, customer_type, date,
        whatsapp, assigned_salesperson, assigned_telecaller, division,
        created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())
      RETURNING id
    `;

    const result = await DepartmentHeadLead.query(query, values);
    return result.rows?.[0] || null;
  }

  async bulkCreateFromUi(rows, createdBy) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { rowCount: 0, rows: [], duplicatesCount: 0 };
    }

    const phones = Array.from(new Set(
      rows.map(r => DataValidator.cleanPhone(r.phone)).filter(Boolean)
    ));
    
    const existingPhoneSet = await this.getExistingPhones(phones, createdBy);
    const customerIds = rows.map(r => r.customerId).filter(Boolean);
    const existingCustomerIdSet = await this.getExistingCustomerIds(customerIds);
    
    const rowsWithUniqueIds = this.assignUniqueCustomerIds(rows, existingCustomerIdSet);
    const { validRows: filteredRows, skippedRows } = this.filterValidRows(rowsWithUniqueIds, existingPhoneSet);
    const skippedRowsInfo = skippedRows.map(s => ({
      row: s.rowIndex,
      reason: s.reason
    }));
    
    if (filteredRows.length === 0) {
      const duplicatesCount = rows.length;
      return { 
        rowCount: 0, 
        rows: [], 
        duplicatesCount,
        skippedRows: skippedRowsInfo
      };
    }

    const batches = BatchProcessor.splitIntoBatches(filteredRows, CONSTANTS.BATCH_SIZE);
    let totalRowCount = 0;
    const allInsertedRows = [];
    const batchSkippedRows = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      try {
        const result = await this.insertBatch(batch, createdBy);
        totalRowCount += result.rowCount;
        allInsertedRows.push(...result.rows);
      } catch (error) {
        const startRow = batchIndex * CONSTANTS.BATCH_SIZE;
        batch.forEach((row, idx) => {
          batchSkippedRows.push({
            row: startRow + idx + 1,
            reason: `Database error: ${error.message}`
          });
        });
      }
    }
    
    const allSkippedRows = [...skippedRowsInfo, ...batchSkippedRows];
    
    const duplicateSkippedCount = skippedRowsInfo.filter(s => s.reason && s.reason.includes('Duplicate')).length;
    return { 
      rowCount: totalRowCount, 
      rows: allInsertedRows, 
      duplicatesCount: duplicateSkippedCount,
      skippedRows: allSkippedRows
    };
  }

  buildGetAllQuery(filters, pagination) {
    const baseQuery = `
      SELECT 
        dhl.id, dhl.customer_id, dhl.customer, dhl.email, dhl.business, dhl.lead_source, 
        COALESCE(dhl.product_names, sl.product_type) AS product_names, dhl.category,
        dhl.sales_status, dhl.created, dhl.telecaller_status, dhl.payment_status,
        dhl.phone, COALESCE(dhl.address, sl.address) AS address, dhl.gst_no, 
        COALESCE(dhl.state, sl.state) AS state, dhl.customer_type, dhl.date,
        dhl.whatsapp, dhl.assigned_salesperson, dhl.assigned_telecaller,
        dhl.created_by, dhl.created_at, dhl.updated_at,
        sl.follow_up_status AS follow_up_status,
        sl.follow_up_remark AS follow_up_remark,
        sl.sales_status_remark AS sales_status_remark
      FROM department_head_leads dhl
      LEFT JOIN salesperson_leads sl ON sl.id = dhl.id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
    `;

    const builder = new QueryBuilder();
    if (filters.createdBy) {
      builder.addCondition('dhl.created_by', filters.createdBy);
    }
    if (filters.departmentType) {
      builder.addCondition('dh.department_type', filters.departmentType);
    }
    if (filters.companyName) {
      builder.addCondition('dh.company_name', filters.companyName);
    }
    builder.addSearchCondition(['dhl.customer', 'dhl.email', 'dhl.business'], filters.search);
    builder.addCondition('dhl.state', filters.state);
    builder.addCondition('dhl.product_names', filters.productType);
    builder.addCondition('dhl.sales_status', filters.salesStatus);
    
    // Exclude deleted leads by default (unless explicitly requested)
    if (filters.includeDeleted !== true) {
      // Add condition to exclude deleted leads
      const paramCount = builder.getParamCount() + 1;
      builder.conditions.push(`COALESCE(dhl.is_deleted, FALSE) = FALSE`);
    }

    let query = baseQuery + builder.buildWhereClause();
    query += ' ORDER BY dhl.created_at ASC';

    const values = builder.getValues();
    let paramCount = builder.getParamCount();

    if (pagination.limit) {
      query += ` LIMIT $${paramCount}`;
      values.push(pagination.limit);
      paramCount++;
    }

    if (pagination.offset) {
      query += ` OFFSET $${paramCount}`;
      values.push(pagination.offset);
    }

    return { query, values };
  }

  async getAll(filters = {}, pagination = {}) {
    // Check if is_deleted column exists before building query
    const hasIsDeletedColumn = await this.hasIsDeletedColumn();
    
    // If column doesn't exist and we're trying to filter by it, skip the filter
    const modifiedFilters = { ...filters };
    if (!hasIsDeletedColumn && modifiedFilters.includeDeleted !== true) {
      // Column doesn't exist, so we can't filter by it - include all leads
      modifiedFilters.includeDeleted = true;
    }
    
    const { query, values } = this.buildGetAllQuery(modifiedFilters, pagination);
    
    try {
      const result = await DepartmentHeadLead.query(query, values);
      return result.rows || [];
    } catch (error) {
      // If query fails due to missing is_deleted column, retry without the filter
      if (error.message && error.message.includes('is_deleted')) {
        console.warn('is_deleted column not found, retrying query without deleted filter');
        const fallbackFilters = { ...filters, includeDeleted: true };
        const { query: fallbackQuery, values: fallbackValues } = this.buildGetAllQuery(fallbackFilters, pagination);
        const result = await DepartmentHeadLead.query(fallbackQuery, fallbackValues);
        return result.rows || [];
      }
      throw error;
    }
  }

  buildGetByIdQuery(id, userEmail, departmentType, companyName) {
    const baseQuery = `
      SELECT 
        dhl.id, dhl.customer_id, dhl.customer, dhl.email, dhl.business, dhl.lead_source, dhl.product_names, dhl.category,
        dhl.sales_status, dhl.created, dhl.telecaller_status, dhl.payment_status,
        dhl.phone, dhl.address, dhl.gst_no, dhl.state, dhl.customer_type, dhl.date,
        dhl.whatsapp, dhl.assigned_salesperson, dhl.assigned_telecaller,
        dhl.created_by, dhl.created_at, dhl.updated_at,
        dhl.transferred_from, dhl.transferred_to, dhl.transferred_at, dhl.transfer_reason,
        sl.follow_up_status AS follow_up_status,
        sl.follow_up_remark AS follow_up_remark,
        sl.sales_status_remark AS sales_status_remark,
        dh.department_type AS creator_department_type,
        dh.company_name AS creator_company_name
      FROM department_head_leads dhl
      LEFT JOIN salesperson_leads sl ON sl.id = dhl.id
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE dhl.id = $1
    `;

    const builder = new QueryBuilder();
    builder.paramCount = 2;
    builder.addCondition('dhl.created_by', userEmail);
    builder.addCondition('dh.department_type', departmentType);
    builder.addCondition('dh.company_name', companyName);

    const additionalConditions = builder.buildWhereClause();
    const query = additionalConditions ? baseQuery + additionalConditions.replace('WHERE', 'AND') : baseQuery;
    const values = [id, ...builder.getValues()];

    return { query, values };
  }

  async getById(id, userEmail = null, departmentType = null, companyName = null) {
    const { query, values } = this.buildGetByIdQuery(id, userEmail, departmentType, companyName);
    const result = await DepartmentHeadLead.query(query, values);
    return result.rows?.[0] || null;
  }

  buildUpdateFields(updateData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (ALLOWED_UPDATE_FIELDS.includes(key) && updateData[key] !== undefined) {
        const column = FIELD_MAP[key] || key;
        updates.push(`${column} = $${paramCount++}`);
        values.push(updateData[key]);
      }
    });

    return { updates, values, paramCount };
  }

  buildUpdateQuery(id, updateData, userEmail, departmentType, companyName) {
    const { updates, values, paramCount } = this.buildUpdateFields(updateData);
    
    if (updates.length === 0) {
      return null;
    }

    let query = `
      UPDATE department_head_leads dhl
      SET ${updates.join(', ')}, updated_at = NOW()
      FROM department_heads dh
      WHERE dhl.id = $${paramCount} AND dh.email = dhl.created_by
    `;
    
    values.push(id);
    let nextParam = paramCount + 1;

    const builder = new QueryBuilder();
    builder.paramCount = nextParam;
    builder.addCondition('dhl.created_by', userEmail);
    builder.addCondition('dh.department_type', departmentType);
    builder.addCondition('dh.company_name', companyName);

    const additionalConditions = builder.buildWhereClause();
    if (additionalConditions) {
      query += additionalConditions.replace('WHERE', 'AND');
      values.push(...builder.getValues());
    }

    return { query, values };
  }

  async updateById(id, updateData, userEmail = null, departmentType = null, companyName = null) {
    const queryData = this.buildUpdateQuery(id, updateData, userEmail, departmentType, companyName);
    if (!queryData) return { rowCount: 0 };
    
    return await DepartmentHeadLead.query(queryData.query, queryData.values);
  }

  async transferLead(id, transferredTo, transferredFrom, reason = '') {
    const query = `
      UPDATE department_head_leads 
      SET 
        assigned_salesperson = $1,
        transferred_to = $2,
        transferred_from = $3,
        transferred_at = NOW(),
        transfer_reason = $4,
        updated_at = NOW()
      WHERE id = $5
    `;
    const values = [transferredTo, transferredTo, transferredFrom, reason || '', id];
    return await DepartmentHeadLead.query(query, values);
  }

  buildUpdateManyQuery(ids, updateData, createdBy, departmentType, companyName) {
    const { updates, values, paramCount } = this.buildUpdateFields(updateData);
    
    if (updates.length === 0) return null;

    const idStartIdx = paramCount;
    const idPlaceholders = ids.map((_, idx) => `$${idStartIdx + idx}`).join(',');
    const createdByIdx = idStartIdx + ids.length;

    let query = `
      UPDATE department_head_leads dhl
      SET ${updates.join(', ')}, updated_at = NOW()
      FROM department_heads dh
      WHERE dhl.id IN (${idPlaceholders}) 
        AND dhl.created_by = $${createdByIdx}
        AND dh.email = dhl.created_by
    `;
    
    values.push(...ids, createdBy);
    let nextParam = createdByIdx + 1;

    const builder = new QueryBuilder();
    builder.paramCount = nextParam;
    builder.addCondition('dh.department_type', departmentType);
    builder.addCondition('dh.company_name', companyName);

    const additionalConditions = builder.buildWhereClause();
    if (additionalConditions) {
      query += additionalConditions.replace('WHERE', 'AND');
      values.push(...builder.getValues());
    }

    return { query, values };
  }

  async updateManyForCreator(ids, updateData, createdBy, departmentType = null, companyName = null) {
    if (!Array.isArray(ids) || ids.length === 0) return { rowCount: 0 };
    
    const queryData = this.buildUpdateManyQuery(ids, updateData, createdBy, departmentType, companyName);
    if (!queryData) return { rowCount: 0 };
    
    return await DepartmentHeadLead.query(queryData.query, queryData.values);
  }

  /**
   * Bulk delete leads by IDs (scoped to creator for security)
   * Also deletes associated salesperson leads
   * @param {Array<number>} ids - Array of lead IDs to delete
   * @param {string} createdBy - Creator email for security check
   * @param {string} departmentType - Optional department type filter
   * @param {string} companyName - Optional company name filter
   * @returns {Promise<Object>} - Result with rowCount
   */
  async deleteManyForCreator(ids, createdBy, departmentType = null, companyName = null) {
    if (!Array.isArray(ids) || ids.length === 0) return { rowCount: 0 };

    const idPlaceholders = ids.map((_, idx) => `$${idx + 1}`).join(',');
    const createdByIdx = ids.length + 1;
    let paramCount = createdByIdx + 1;

    const values = [...ids, createdBy];
    let whereConditions = `dhl.id IN (${idPlaceholders}) AND dhl.created_by = $${createdByIdx} AND dh.email = dhl.created_by`;

    if (departmentType) {
      whereConditions += ` AND dh.department_type = $${paramCount}`;
      values.push(departmentType);
      paramCount++;
    }

    if (companyName) {
      whereConditions += ` AND dh.company_name = $${paramCount}`;
      values.push(companyName);
      paramCount++;
    }

    // First delete associated salesperson leads
    const deleteSalespersonQuery = `
      DELETE FROM salesperson_leads
      WHERE dh_lead_id IN (
        SELECT dhl.id 
        FROM department_head_leads dhl
        JOIN department_heads dh ON dh.email = dhl.created_by
        WHERE ${whereConditions}
      )
    `;
    await DepartmentHeadLead.query(deleteSalespersonQuery, values);

    // Then delete department_head_leads
    const deleteDHQuery = `
      DELETE FROM department_head_leads dhl
      USING department_heads dh
      WHERE ${whereConditions}
      RETURNING dhl.id
    `;
    const result = await DepartmentHeadLead.query(deleteDHQuery, values);
    
    return { rowCount: result.rowCount || 0 };
  }

  buildStatsQuery(createdBy, departmentType, companyName) {
    const baseQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN dhl.sales_status = 'PENDING' THEN 1 END) as pending,
        COUNT(CASE WHEN dhl.sales_status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN dhl.sales_status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN dhl.telecaller_status = 'ACTIVE' THEN 1 END) as active_telecallers,
        COUNT(CASE WHEN dhl.telecaller_status = 'INACTIVE' THEN 1 END) as inactive_telecallers,
        COUNT(CASE WHEN dhl.payment_status = 'PENDING' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN dhl.payment_status = 'IN_PROGRESS' THEN 1 END) as in_progress_payments,
        COUNT(CASE WHEN dhl.payment_status = 'COMPLETED' THEN 1 END) as completed_payments
      FROM department_head_leads dhl
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
    `;

    const builder = new QueryBuilder();
    builder.paramCount = 1;
    
    if (createdBy) {
      builder.addCondition('dhl.created_by', createdBy);
    }
    builder.addCondition('dh.department_type', departmentType);
    builder.addCondition('dh.company_name', companyName);

    const whereClause = builder.buildWhereClause();
    const query = baseQuery + whereClause;
    const values = builder.getValues();

    return { query, values };
  }

  async getStats(createdBy, departmentType = null, companyName = null) {
    const { query, values } = this.buildStatsQuery(createdBy, departmentType, companyName);
    const result = await DepartmentHeadLead.query(query, values);
    
    return result.rows?.[0] || {
      total: 0,
      pending: 0,
      in_progress: 0,
      completed: 0,
      active_telecallers: 0,
      inactive_telecallers: 0,
      pending_payments: 0,
      in_progress_payments: 0,
      completed_payments: 0
    };
  }
}

const instance = new DepartmentHeadLead();
instance.DataValidator = DataValidator;
module.exports = instance;
