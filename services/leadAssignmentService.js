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

    // Directly copy all fields from DH lead
    const upsertPayload = {
      id: dhLead.id,
      dh_lead_id: dhLead.id,
      name: dhLead.customer,
      phone: dhLead.phone,
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
      whatsapp: dhLead.whatsapp,
      created_by: dhLead.created_by,
    };

    await SalespersonLead.upsertById(upsertPayload);
  }
}

module.exports = new LeadAssignmentService();


