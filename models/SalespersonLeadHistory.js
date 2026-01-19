const BaseModel = require('./BaseModel');

class SalespersonLeadHistory extends BaseModel {
  constructor() {
    super('salesperson_lead_history');
  }

  async ensureSchema() {
    try {
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS salesperson_lead_history (
          id SERIAL PRIMARY KEY,
          lead_id INTEGER NOT NULL,
          username VARCHAR(255),
          follow_up_status VARCHAR(100),
          follow_up_remark TEXT,
          follow_up_date DATE,
          follow_up_time TIME,
          sales_status VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await SalespersonLeadHistory.query(createTableSql);
      await SalespersonLeadHistory.query(
        'CREATE INDEX IF NOT EXISTS idx_sp_lead_hist_lead ON salesperson_lead_history(lead_id)'
      );
    } catch (error) {
      if (error && error.code === '23505' && /pg_type_typname_nsp_index/.test(error.constraint || '')) {
        return;
      }
      throw error;
    }
  }

  async addEntry(leadId, payload, username = null) {
    await this.ensureSchema();
    const {
      follow_up_status = null,
      follow_up_remark = null,
      follow_up_date = null,
      follow_up_time = null,
      sales_status = null,
    } = payload || {};

    // If nothing meaningful provided, skip
    if (!follow_up_status && !follow_up_remark && !follow_up_date && !follow_up_time && !sales_status) {
      return { rowCount: 0 };
    }

    const sql = `
      INSERT INTO salesperson_lead_history (
        lead_id, username, follow_up_status, follow_up_remark, follow_up_date, follow_up_time, sales_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `;
    const vals = [leadId, username, follow_up_status, follow_up_remark, follow_up_date, follow_up_time, sales_status];
    return await SalespersonLeadHistory.query(sql, vals);
  }

  async getByLead(leadId) {
    await this.ensureSchema();
    const sql = `SELECT * FROM salesperson_lead_history WHERE lead_id = $1 ORDER BY created_at ASC, id ASC`;
    const res = await SalespersonLeadHistory.query(sql, [leadId]);
    return res.rows || [];
  }
}

module.exports = new SalespersonLeadHistory();


