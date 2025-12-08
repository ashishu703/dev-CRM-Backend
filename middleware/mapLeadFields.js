function mapSingleLead(input) {
  if (!input || typeof input !== 'object') return {};

  // Generate customer ID if not provided
  const generateCustomerId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CUST-${timestamp}${random}`;
  };

  const nameVal = input.name || input.customer || input.customerName || input.nameText || '';
  const mapped = {
    name: nameVal,
    customer: input.customer || nameVal || '',
    phone: input.phone || input.mobileNumber || input.mobile || input.whatsapp || '',
    // Preserve null values - don't convert to 'N/A' (model will handle it)
    email: input.email !== undefined ? input.email : null,
    business: input.business !== undefined ? input.business : null,
    address: input.address !== undefined ? input.address : null,
    gstNo: input.gstNo !== undefined ? input.gstNo : (input.gstNumber !== undefined ? input.gstNumber : null),
    productNames: input.productNames !== undefined ? input.productNames : (input.productNamesText !== undefined ? input.productNamesText : (input['Product Name'] !== undefined ? input['Product Name'] : null)),
    state: input.state !== undefined ? input.state : null,
    leadSource: input.leadSource !== undefined ? input.leadSource : (input.lead_type !== undefined ? input.lead_type : (input.leadType !== undefined ? input.leadType : null)),
    customerType: input.customerType || 'business',
    date: input.date || input.createdAt || input['Created'] || new Date().toISOString().split('T')[0],
    connectedStatus: input.connectedStatus || 'pending',
    finalStatus: input.finalStatus || 'open',
    whatsapp: input.whatsapp || input.phone || input.mobileNumber || input.mobile || null,
    category: input.category !== undefined ? input.category : (input.businessCategory !== undefined ? input.businessCategory : null),
    assignedSalesperson: input.assignedSalesperson !== undefined ? input.assignedSalesperson : (input.assigned !== undefined ? input.assigned : null),
    assignedTelecaller: input.assignedTelecaller !== undefined ? input.assignedTelecaller : (input.telecaller !== undefined ? input.telecaller : null),
    customerId: input.customerId || generateCustomerId()
  };

  // Trim string values but preserve null/undefined
  Object.keys(mapped).forEach((key) => {
    const val = mapped[key];
    if (val === null || val === undefined) {
      // Preserve null/undefined - don't convert
      return;
    }
    if (typeof val === 'string') {
      const t = val.trim();
      // Only set to empty string for name/phone if truly empty, otherwise preserve null
      if (t.length === 0) {
        if (key === 'name' || key === 'phone') {
          mapped[key] = '';
        } else {
          // For optional fields, preserve null instead of 'N/A'
          mapped[key] = null;
        }
      } else {
        mapped[key] = t;
      }
    }
  });

  return mapped;
}

// Middleware: map fields for single lead in req.body
function mapLeadFields(req, _res, next) {
  if (req.body && !Array.isArray(req.body)) {
    req.body = { ...req.body, ...mapSingleLead(req.body) };
  }
  next();
}

// Middleware: map fields for CSV import array in req.body.leads
function mapLeadArray(req, _res, next) {
  if (req.body && Array.isArray(req.body.leads)) {
    req.body.leads = req.body.leads.map((l) => mapSingleLead(l));
  }
  next();
}

module.exports = { mapLeadFields, mapLeadArray, mapSingleLead };


