const DepartmentHeadLead = require('../models/DepartmentHeadLead');
const SalespersonLead = require('../models/SalespersonLead');
const DataValidator = DepartmentHeadLead.DataValidator;
const logger = require('../utils/logger');


class LeadAssignmentService {
  /**
   * Normalizes phone/whatsapp value - returns 'N/A' if empty/null
   * Applies DRY principle for phone normalization
   * @param {*} value - Phone or whatsapp value to normalize
   * @returns {string} - Normalized phone value or 'N/A'
   */
  normalizePhoneValue(value) {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    const trimmed = String(value).trim();
    if (trimmed.length === 0 || trimmed.toLowerCase() === 'null') {
      return 'N/A';
    }
    return trimmed;
  }

  /**
   * Extracts a valid phone number from various sources
   * Tries phone field, then whatsapp, then existing lead, finally generates placeholder
   * @param {Object} dhLead - Department head lead object
   * @param {Object} existingLead - Existing salesperson lead (optional)
   * @returns {string} - Valid phone number or 'N/A'
   */
  extractPhoneNumber(dhLead, existingLead = null) {
    // Try phone field first
    let phone = this.normalizePhoneValue(dhLead.phone);
    if (phone !== 'N/A') {
      return phone;
    }

    // Try whatsapp field as fallback
    phone = this.normalizePhoneValue(dhLead.whatsapp);
    if (phone !== 'N/A') {
      return phone;
    }

    // Check existing salesperson lead to preserve data
    if (existingLead && existingLead.phone) {
      phone = this.normalizePhoneValue(existingLead.phone);
      if (phone !== 'N/A') {
        return phone;
      }
    }

    // Return 'N/A' as valid phone value (database accepts this string)
    return 'N/A';
  }

  /**
   * Extracts safe name from various fields
   * @param {Object} dhLead - Department head lead object
   * @returns {string} - Safe name for the lead
   */
  extractSafeName(dhLead) {
    return (dhLead.customer && dhLead.customer.trim()) ||
           (dhLead.business && dhLead.business.trim()) ||
           (dhLead.customer_id && String(dhLead.customer_id).trim()) ||
           `Lead-${dhLead.id || 'Unknown'}`;
  }

  /**
   * Sync a DH lead into salesperson_leads if assigned to any department user
   * Always upserts by using the DH lead id as the PK in salesperson_leads
   * No fields are mandatory - all can be 'N/A' if not provided
   */
  async syncSalespersonLead(dhLeadId) {
    if (!dhLeadId) {
      logger.warn('syncSalespersonLead: No dhLeadId provided');
      return;
    }

    const dhLead = await DepartmentHeadLead.getById(dhLeadId);
    if (!dhLead) {
      logger.warn(`syncSalespersonLead: Lead ${dhLeadId} not found in department_head_leads`);
      return;
    }

    // Only create/maintain a salesperson lead if it is assigned to a salesperson or telecaller
    if (!dhLead.assigned_salesperson && !dhLead.assigned_telecaller) {
      // Nothing to sync if no assignment exists
      return;
    }

    // Get existing lead to preserve data if it exists
    const existingLead = await SalespersonLead.getById(dhLead.id);

    // Extract normalized values using helper methods
    const safeName = this.extractSafeName(dhLead);
    const phone = this.extractPhoneNumber(dhLead, existingLead);
    const whatsapp = this.normalizePhoneValue(dhLead.whatsapp) || phone;

    // Log for debugging
    logger.info(`syncSalespersonLead: Lead ${dhLead.id} - phone from dhLead: ${dhLead.phone}, whatsapp: ${dhLead.whatsapp}, final phone: ${phone}`);

    /**
     * Helper to preserve actual data from department_head_leads
     * Returns actual value if present, null only if truly null/undefined
     * @param {*} value - Value from department_head_leads
     * @returns {string|null} - Actual value or null
     */
    const preserveData = (value) => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      // Preserve actual data even if it's 'N/A' (don't convert to null)
      return trimmed === '' ? null : trimmed;
    };

    // Build upsert payload - preserve actual data from department_head_leads
    const upsertPayload = {
      id: dhLead.id,
      dh_lead_id: dhLead.id,
      name: safeName,
      phone: phone, // Always has a value (either actual phone or 'N/A')
      email: preserveData(dhLead.email),
      business: preserveData(dhLead.business),
      address: preserveData(dhLead.address),
      gst_no: preserveData(dhLead.gst_no) || 'N/A', // Required field
      product_type: preserveData(dhLead.product_names),
      state: preserveData(dhLead.state),
      lead_source: preserveData(dhLead.lead_source),
      customer_type: preserveData(dhLead.customer_type),
      date: DataValidator.normalizeDate(dhLead.date),
      sales_status: preserveData(dhLead.sales_status),
      whatsapp: whatsapp,
      created_by: dhLead.created_by || 'system',
    };

    logger.info(`syncSalespersonLead: Upserting lead ${dhLead.id} with phone: ${phone}, name: ${safeName}`);
    try {
      await SalespersonLead.upsertById(upsertPayload);
      logger.info(`syncSalespersonLead: Successfully synced lead ${dhLead.id} to salesperson_leads`);
    } catch (error) {
      logger.error(`syncSalespersonLead: Error syncing lead ${dhLead.id} to salesperson_leads: ${error.message}`);
      // Skip this lead and continue - don't throw to allow other leads to sync
    }
  }
}

module.exports = new LeadAssignmentService();


