const BaseModel = require('./BaseModel');

class SalespersonLead extends BaseModel {
  constructor() {
    super('salesperson_leads');
  }

  /**
   * Upsert by id, enforcing salesperson_leads.id equals department_head_leads.id
   */
  async upsertById(payload) {
    const {
      id,
      dh_lead_id,
      name,
      phone,
      email,
      business,
      address,
      gst_no,
      product_type,
      state,
      lead_source,
      customer_type,
      date,
      sales_status,
      whatsapp,
      created_by,
    } = payload;

    const query = `
      INSERT INTO salesperson_leads (
        id, dh_lead_id, name, phone, email, business, address, gst_no, product_type,
        state, lead_source, customer_type, date, sales_status, whatsapp,
        created_by, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        dh_lead_id = EXCLUDED.dh_lead_id,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        business = EXCLUDED.business,
        address = EXCLUDED.address,
        gst_no = EXCLUDED.gst_no,
        product_type = EXCLUDED.product_type,
        state = EXCLUDED.state,
        lead_source = EXCLUDED.lead_source,
        customer_type = EXCLUDED.customer_type,
        date = EXCLUDED.date,
        sales_status = EXCLUDED.sales_status,
        whatsapp = EXCLUDED.whatsapp,
        updated_at = NOW()
    `;

    const values = [
      id,
      dh_lead_id,
      name,
      phone || '0000000000', // Provide default phone if null
      email,
      business,
      address,
      gst_no,
      product_type,
      state,
      lead_source,
      customer_type,
      date,
      sales_status,
      whatsapp,
      created_by,
    ];

    return await SalespersonLead.query(query, values);
  }

  async listForUser(username) {
    const query = `
      SELECT * FROM salesperson_leads
      WHERE 1=1
        AND (
          EXISTS (
            SELECT 1 FROM department_head_leads dhl
            WHERE dhl.id = salesperson_leads.dh_lead_id
              AND (dhl.assigned_salesperson = $1 OR dhl.assigned_telecaller = $1)
          )
        )
      ORDER BY updated_at DESC
    `;
    const result = await SalespersonLead.query(query, [username]);
    return result.rows || [];
  }

  async getById(id) {
    const result = await SalespersonLead.query('SELECT * FROM salesperson_leads WHERE id = $1', [id]);
    return result.rows && result.rows[0] ? result.rows[0] : null;
  }

  async updateById(id, update) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = [
      'name',
      'phone',
      'email',
      'business',
      'address',
      'gst_no',
      'product_type',
      'state',
      'lead_source',
      'customer_type',
      'date',
      'whatsapp',
      'sales_status',
      'sales_status_remark',
      'quotation_url',
      'quotation_count',
      'proforma_invoice_url',
      'payment_status',
      'payment_mode',
      'payment_receipt_url',
      'transferred_to',
      'quotation_verified_status',
      'quotation_verified_by',
      'pi_verification_status',
      'pi_verified_by'
    ];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(update, key)) {
        fields.push(`${key} = $${i++}`);
        values.push(update[key]);
      }
    }

    if (fields.length === 0) return { rowCount: 0 };
    values.push(id);

    const sql = `UPDATE salesperson_leads SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`;
    const result = await SalespersonLead.query(sql, values);
    return { rowCount: result.rowCount, row: result.rows && result.rows[0] };
  }
}

module.exports = new SalespersonLead();


