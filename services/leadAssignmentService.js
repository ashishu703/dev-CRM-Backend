const DepartmentHeadLead = require('../models/DepartmentHeadLead');
const SalespersonLead = require('../models/SalespersonLead');

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
    if (!dhLead) return;

    // Only create/maintain a salesperson lead if it is assigned to a salesperson or telecaller
    if (!dhLead.assigned_salesperson && !dhLead.assigned_telecaller) {
      // Nothing to sync if no assignment exists
      return;
    }

    const upsertPayload = {
      id: dhLead.id,
      dh_lead_id: dhLead.id,
      name: dhLead.customer || null,
      phone: dhLead.phone || null,
      email: dhLead.email || null,
      business: dhLead.business || null,
      address: dhLead.address || null,
      gst_no: dhLead.gst_no || null,
      product_type: dhLead.product_names || null,
      state: dhLead.state || null,
      lead_source: dhLead.lead_source || null,
      customer_type: dhLead.customer_type || null,
      date: dhLead.date || null,
      connected_status: dhLead.connected_status || null,
      final_status: dhLead.final_status || null,
      whatsapp: dhLead.whatsapp || null,
      created_by: dhLead.created_by,
    };

    await SalespersonLead.upsertById(upsertPayload);
  }
}

module.exports = new LeadAssignmentService();


