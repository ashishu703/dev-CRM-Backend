const { query, getClient } = require('../config/database');


class CustomerCredit {
  constructor() {}

  async ensureSchema(client = null) {
    const runner = client ? client : { query };
    // Create table and unique index if missing (idempotent)
    await runner.query(`
      CREATE TABLE IF NOT EXISTS customer_credits (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        balance DECIMAL(15,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await runner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_credits_customer ON customer_credits(customer_id)`);
  }

  async getByCustomerId(customerId) {
    await this.ensureSchema();
    const res = await query('SELECT * FROM customer_credits WHERE customer_id = $1', [customerId]);
    return res.rows[0] || null;
  }

  async ensureForCustomer(customerId) {
    await this.ensureSchema();
    const existing = await this.getByCustomerId(customerId);
    if (existing) return existing;
    const ins = await query(
      'INSERT INTO customer_credits (customer_id, balance) VALUES ($1, 0) RETURNING *',
      [customerId]
    );
    return ins.rows[0];
  }

  async incrementBalance(customerId, amountDelta, client = null) {
    const runner = client ? client : { query };
    await this.ensureSchema(client);
    const res = await runner.query(
      `INSERT INTO customer_credits (customer_id, balance)
       VALUES ($1, 0)
       ON CONFLICT (customer_id)
       DO UPDATE SET balance = customer_credits.balance + EXCLUDED.balance + $2,
                     updated_at = NOW()
       RETURNING *`,
      [customerId, amountDelta]
    );
    return res.rows[0];
  }
}

module.exports = new CustomerCredit();


