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
    email: input.email || 'N/A',
    business: input.business || input.businessType || 'N/A',
    address: input.address || 'N/A',
    gstNo: input.gstNo || input.gstNumber || 'N/A',
    productNames: input.productNames || input.productNamesText || input.productNames || input['Product Name'] || 'N/A',
    state: input.state || 'N/A',
    leadSource: input.leadSource || input.lead_type || input.leadType || 'N/A',
    customerType: input.customerType || 'business',
    date: input.date || input.createdAt || input['Created'] || new Date().toISOString().split('T')[0],
    connectedStatus: input.connectedStatus || 'pending',
    finalStatus: input.finalStatus || 'open',
    whatsapp: input.whatsapp || input.phone || input.mobileNumber || input.mobile || 'N/A',
    category: input.category || input.businessCategory || 'N/A',
    assignedSalesperson: input.assignedSalesperson || input.assigned || null,
    assignedTelecaller: input.assignedTelecaller || input.telecaller || null,
    customerId: input.customerId || generateCustomerId()
  };

  Object.keys(mapped).forEach((key) => {
    const val = mapped[key];
    if (typeof val === 'string') {
      const t = val.trim();
      // Keep 'N/A' defaults; only blank-out name/phone to '' and leave others as 'N/A'
      if (t.length === 0) {
        if (key === 'name' || key === 'phone') {
          mapped[key] = '';
        } else {
          mapped[key] = 'N/A';
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


