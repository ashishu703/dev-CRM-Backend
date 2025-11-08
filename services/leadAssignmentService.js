const DepartmentHeadLead = require('../models/DepartmentHeadLead');
const SalespersonLead = require('../models/SalespersonLead');
const logger = require('../utils/logger');

/**
 * LeadAssignmentService
 * - Keeps salesperson_leads table synchronized with department_head_leads
 * - Ensures salesperson_leads.id equals department_head_leads.id for 1:1 relation
 */
class LeadAssignmentService {
  /**
   * Sync a DH lead into salesperson_leads if assigned to any department user
   * Always upserts by using the DH lead id as the PK in salesperson_leads
   */
  async syncSalespersonLead(dhLeadId) {
    if (!dhLeadId) return;

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

    // Directly copy all fields from DH lead
    const safeName = (dhLead.customer && dhLead.customer.trim())
      || (dhLead.business && dhLead.business.trim())
      || (dhLead.phone && String(dhLead.phone).trim())
      || (dhLead.customer_id && String(dhLead.customer_id).trim())
      || 'Unknown';

    // Ensure phone is never null - use existing data from department_head_leads
    // Check phone field first, then whatsapp as fallback
    let phone = null;
    
    // Try phone field - check for null, undefined, empty string, and "N/A"
    if (dhLead.phone !== null && dhLead.phone !== undefined) {
      const phoneStr = String(dhLead.phone).trim();
      if (phoneStr.length > 0 && phoneStr.toLowerCase() !== 'n/a' && phoneStr !== 'null') {
        phone = phoneStr;
      }
    }
    
    // If phone is still null/empty, try whatsapp field
    if (!phone || phone.length === 0) {
      if (dhLead.whatsapp !== null && dhLead.whatsapp !== undefined) {
        const whatsappStr = String(dhLead.whatsapp).trim();
        if (whatsappStr.length > 0 && whatsappStr.toLowerCase() !== 'n/a' && whatsappStr !== 'null') {
          phone = whatsappStr;
        }
      }
    }
    
    // If still no phone, check existing salesperson lead to preserve existing data
    if (!phone || phone.length === 0) {
      const existingLead = await SalespersonLead.getById(dhLead.id);
      if (existingLead && existingLead.phone) {
        const existingPhoneStr = String(existingLead.phone).trim();
        if (existingPhoneStr.length > 0 && existingPhoneStr.toLowerCase() !== 'n/a' && existingPhoneStr !== 'null') {
          phone = existingPhoneStr;
        }
      }
    }
    
    // Log for debugging
    logger.info(`syncSalespersonLead: Lead ${dhLead.id} - phone from dhLead: ${dhLead.phone}, whatsapp: ${dhLead.whatsapp}, final phone: ${phone}`);
    
    // Final check: if no phone available, skip sync (should not happen if data exists in department_head_leads)
    if (!phone || phone.length === 0) {
      logger.warn(`Skipping sync for lead ${dhLead.id} (${safeName}) - no phone/mobile number found. dhLead.phone=${dhLead.phone}, dhLead.whatsapp=${dhLead.whatsapp}`);
      return;
    }
    
    // Use whatsapp from dhLead, fallback to phone if whatsapp is empty
    let whatsapp = null;
    if (dhLead.whatsapp !== null && dhLead.whatsapp !== undefined) {
      const whatsappStr = String(dhLead.whatsapp).trim();
      if (whatsappStr.length > 0 && whatsappStr.toLowerCase() !== 'n/a' && whatsappStr !== 'null') {
        whatsapp = whatsappStr;
      }
    }
    if (!whatsapp) {
      whatsapp = phone; // Use phone as fallback for whatsapp
    }

    const upsertPayload = {
      id: dhLead.id,
      dh_lead_id: dhLead.id,
      name: safeName,
      phone: phone, // Ensured to be non-empty
      email: dhLead.email,
      business: dhLead.business,
      address: dhLead.address,
      gst_no: dhLead.gst_no,
      product_type: dhLead.product_names,
      state: dhLead.state,
      lead_source: dhLead.lead_source,
      customer_type: dhLead.customer_type,
      date: dhLead.date,
      sales_status: dhLead.sales_status,
      whatsapp: whatsapp,
      created_by: dhLead.created_by,
    };

    logger.info(`syncSalespersonLead: Upserting lead ${dhLead.id} with phone: ${phone}`);
    await SalespersonLead.upsertById(upsertPayload);
  }
}

module.exports = new LeadAssignmentService();


