const BaseModel = require('./BaseModel');
const { getClient, query } = require('../config/database');

class ProformaInvoice extends BaseModel {
  constructor() {
    super('proforma_invoices');
  }

  async ensureSchema() {
    const sql = `
      DO $do$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proforma_invoices'
        ) THEN
          CREATE TABLE proforma_invoices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pi_number VARCHAR(50) UNIQUE NOT NULL,
            quotation_id TEXT,
            customer_id TEXT,
            salesperson_id TEXT,
            pi_date DATE,
            valid_until DATE,
            status VARCHAR(50) DEFAULT 'draft',
            subtotal NUMERIC(12,2) DEFAULT 0,
            tax_amount NUMERIC(12,2) DEFAULT 0,
            total_amount NUMERIC(12,2) DEFAULT 0,
            total_paid NUMERIC(12,2) DEFAULT 0,
            remaining_balance NUMERIC(12,2) DEFAULT 0,
            template VARCHAR(50) DEFAULT 'template1',
            dispatch_mode VARCHAR(50),
            transport_name VARCHAR(255),
            vehicle_number VARCHAR(100),
            transport_id INTEGER,
            lr_no VARCHAR(100),
            courier_name VARCHAR(255),
            consignment_no VARCHAR(100),
            by_hand VARCHAR(255),
            post_service VARCHAR(255),
            carrier_name VARCHAR(255),
            carrier_number VARCHAR(100),
            created_by VARCHAR(255),
            sent_to_customer_at TIMESTAMP NULL,
            customer_accepted_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_pi_quotation ON proforma_invoices(quotation_id);
          CREATE INDEX IF NOT EXISTS idx_pi_customer ON proforma_invoices(customer_id);
          CREATE INDEX IF NOT EXISTS idx_pi_number ON proforma_invoices(pi_number);
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END
      $do$;
      DO $do$
      BEGIN
        -- Ensure quotation_id is text to accept UUIDs
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'proforma_invoices' AND column_name = 'quotation_id'
          ) THEN
            -- Attempt type change only if not already text/character varying/uuid
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'proforma_invoices' AND column_name = 'quotation_id'
                AND data_type NOT IN ('text','character varying','uuid')
            ) THEN
              ALTER TABLE proforma_invoices 
                ALTER COLUMN quotation_id TYPE TEXT USING quotation_id::text;
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Ensure template column exists for storing PI template key
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'proforma_invoices'
              AND column_name = 'template'
          ) THEN
            ALTER TABLE proforma_invoices ADD COLUMN template VARCHAR(255);
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Migrate customer_id and salesperson_id to TEXT to support UUIDs
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'proforma_invoices' AND column_name = 'customer_id'
          ) THEN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'proforma_invoices' AND column_name = 'customer_id'
                AND data_type NOT IN ('text','character varying','uuid')
            ) THEN
              ALTER TABLE proforma_invoices 
                ALTER COLUMN customer_id TYPE TEXT USING customer_id::text;
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'proforma_invoices' AND column_name = 'salesperson_id'
          ) THEN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'proforma_invoices' AND column_name = 'salesperson_id'
                AND data_type NOT IN ('text','character varying','uuid')
            ) THEN
              ALTER TABLE proforma_invoices 
                ALTER COLUMN salesperson_id TYPE TEXT USING salesperson_id::text;
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        CREATE OR REPLACE FUNCTION update_pi_updated_at()
        RETURNS TRIGGER AS $pi$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $pi$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trg_pi_updated_at ON proforma_invoices;
        CREATE TRIGGER trg_pi_updated_at
        BEFORE UPDATE ON proforma_invoices
        FOR EACH ROW EXECUTE FUNCTION update_pi_updated_at();
        
        -- Add template column if it doesn't exist
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'proforma_invoices' AND column_name = 'template'
          ) THEN
            ALTER TABLE proforma_invoices 
            ADD COLUMN template VARCHAR(50) DEFAULT 'template1';
            COMMENT ON COLUMN proforma_invoices.template IS 'Template identifier: template1 (Classic), template2 (Modern), or template3 (Minimal)';
            CREATE INDEX IF NOT EXISTS idx_proforma_invoices_template ON proforma_invoices(template);
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      EXCEPTION WHEN OTHERS THEN NULL;
      END
      $do$;
    `;
    await query(sql);
  }

  // Create PI from quotation
  async createFromQuotation(quotationId, piData) {
    await this.ensureSchema();
    const client = await getClient();
    
    // Declare variables outside try block for error logging
    let piQuery = null;
    let piValues = null;
    
    try {
      await client.query('BEGIN');
      
      // Get quotation details
      const quotationQuery = 'SELECT * FROM quotations WHERE id = $1';
      const quotationResult = await client.query(quotationQuery, [quotationId]);
      const quotation = quotationResult.rows[0];
      
      if (!quotation) {
        throw new Error('Quotation not found');
      }
      
      // Generate PI number
      const piNumber = await this.generatePINumber();
      
      // Create PI with dispatch details and template
      // FIXED: Column count matches VALUES count (24 columns = 24 placeholders)
      piQuery = `
        INSERT INTO proforma_invoices (
          pi_number, quotation_id, customer_id, salesperson_id,
          pi_date, valid_until, status,
          subtotal, tax_amount, total_amount, remaining_balance,
          template,
          dispatch_mode, transport_name, vehicle_number, transport_id, lr_no,
          courier_name, consignment_no, by_hand, post_service,
          carrier_name, carrier_number,
          created_by
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19, $20,
          $21, $22, $23, $24
        ) RETURNING *
      `;
      
      // Use adjusted amounts if provided (for remaining amount PIs), otherwise use quotation amounts
      const subtotal = piData.subtotal !== undefined && piData.subtotal !== null 
        ? Number(piData.subtotal) 
        : quotation.subtotal;
      const taxAmount = piData.taxAmount !== undefined && piData.taxAmount !== null 
        ? Number(piData.taxAmount) 
        : quotation.tax_amount;
      const totalAmount = piData.totalAmount !== undefined && piData.totalAmount !== null 
        ? Number(piData.totalAmount) 
        : quotation.total_amount;
      
      const templateToSave = piData.template || quotation.template || null;
      
      // FIXED: 24 values matching 24 columns, removed duplicate template
      piValues = [
        piNumber,                                                    // $1 - pi_number
        quotationId,                                                 // $2 - quotation_id
        quotation.customer_id,                                      // $3 - customer_id
        quotation.salesperson_id,                                   // $4 - salesperson_id
        piData.piDate || new Date().toISOString().split('T')[0],    // $5 - pi_date
        piData.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // $6 - valid_until
        piData.status || 'draft',                                   // $7 - status
        subtotal,                                                    // $8 - subtotal
        taxAmount,                                                   // $9 - tax_amount
        totalAmount,                                                 // $10 - total_amount
        totalAmount,                                                 // $11 - remaining_balance
        templateToSave || 'template1',                              // $12 - template (using templateToSave, not duplicate)
        piData.dispatch_mode || piData.dispatchMode || null,        // $13 - dispatch_mode
        piData.transport_name || piData.transportName || null,      // $14 - transport_name
        piData.vehicle_number || piData.vehicleNumber || null,      // $15 - vehicle_number
        piData.transport_id || piData.transportId || null,          // $16 - transport_id
        piData.lr_no || piData.lrNo || null,                        // $17 - lr_no
        piData.courier_name || piData.courierName || null,          // $18 - courier_name
        piData.consignment_no || piData.consignmentNo || null,      // $19 - consignment_no
        piData.by_hand || piData.byHand || null,                    // $20 - by_hand
        piData.post_service || piData.postService || null,          // $21 - post_service
        piData.carrier_name || piData.carrierName || null,          // $22 - carrier_name
        piData.carrier_number || piData.carrierNumber || null,      // $23 - carrier_number
        piData.createdBy                                             // $24 - created_by
      ];
      
      const piResult = await client.query(piQuery, piValues);
      const pi = piResult.rows[0];
      
      await client.query('COMMIT');
      return pi;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating PI from quotation:', error);
      if (piQuery) {
        console.error('PI Query:', piQuery);
      }
      if (piValues) {
        console.error('PI Values:', piValues);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  // Update PI by ID
  async updateById(id, updateData) {
    await this.ensureSchema();
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Dynamic field updates
    const fieldMap = {
      dispatch_mode: updateData.dispatch_mode || updateData.dispatchMode,
      transport_name: updateData.transport_name || updateData.transportName,
      vehicle_number: updateData.vehicle_number || updateData.vehicleNumber,
      transport_id: updateData.transport_id || updateData.transportId,
      lr_no: updateData.lr_no || updateData.lrNo,
      courier_name: updateData.courier_name || updateData.courierName,
      consignment_no: updateData.consignment_no || updateData.consignmentNo,
      by_hand: updateData.by_hand || updateData.byHand,
      post_service: updateData.post_service || updateData.postService,
      carrier_name: updateData.carrier_name || updateData.carrierName,
      carrier_number: updateData.carrier_number || updateData.carrierNumber,
      template: updateData.template,
      status: updateData.status,
      pi_date: updateData.pi_date || updateData.piDate,
      valid_until: updateData.valid_until || updateData.validUntil
    };

    Object.entries(fieldMap).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const sql = `
      UPDATE proforma_invoices 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0];
  }

  // Send PI to customer
  async sendToCustomer(id, sentBy) {
    const sql = `
      UPDATE proforma_invoices 
      SET status = 'sent', 
          sent_to_customer_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // Customer accepts PI
  async acceptByCustomer(id, acceptedBy) {
    const sql = `
      UPDATE proforma_invoices 
      SET status = 'accepted', 
          customer_accepted_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // Update payment totals
  async updatePaymentTotals(id) {
    const sql = `
      UPDATE proforma_invoices 
      SET total_paid = (
        SELECT COALESCE(SUM(amount), 0) 
        FROM payments 
        WHERE pi_id = $1 AND status = 'completed'
      ),
      remaining_balance = total_amount - (
        SELECT COALESCE(SUM(amount), 0) 
        FROM payments 
        WHERE pi_id = $1 AND status = 'completed'
      ),
      updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // Get PIs by customer
  async getByCustomer(customerId) {
    await this.ensureSchema();
    const sql = `
      SELECT pi.*, 
             q.quotation_number,
             q.customer_name,
             COUNT(ph.id) as payment_count,
             COALESCE(SUM(ph.installment_amount), 0) as total_paid
      FROM proforma_invoices pi
      LEFT JOIN quotations q ON pi.quotation_id = q.id
      LEFT JOIN payment_history ph ON pi.quotation_id = ph.quotation_id AND ph.payment_status = 'completed' AND ph.is_refund = false
      WHERE pi.customer_id::text = $1::text
      GROUP BY pi.id, q.quotation_number, q.customer_name
      ORDER BY pi.created_at DESC
    `;
    
    const result = await query(sql, [customerId]);
    return result.rows;
  }

  // Generate PI number
  async generatePINumber() {
    await this.ensureSchema();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the latest PI number for this year and month
    const sql = `
      SELECT pi_number 
      FROM proforma_invoices 
      WHERE pi_number LIKE $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const prefix = `PI-${year}-${month}-%`;
    const result = await query(sql, [prefix]);
    
    let sequence = 1;
    if (result.rows.length > 0) {
      // Extract sequence number from last PI number (format: PI-YYYY-MM-XXX)
      const lastPiNumber = result.rows[0].pi_number;
      const lastSequence = parseInt(lastPiNumber.split('-').pop());
      sequence = lastSequence + 1;
    }
    
    return `PI-${year}-${month}-${String(sequence).padStart(4, '0')}`;
  }

  // Get PI with payments
  async getWithPayments(id) {
    await this.ensureSchema();
    const sql = 'SELECT * FROM proforma_invoices WHERE id = $1';
    const result = await query(sql, [id]);
    const pi = result.rows[0];
    if (!pi) return null;
    
    const paymentsResult = await query(
      `SELECT * FROM payment_history WHERE quotation_id = $1 AND payment_status = 'completed' AND is_refund = false ORDER BY payment_date ASC`,
      [pi.quotation_id]
    );
    
    pi.payments = paymentsResult.rows;
    return pi;
  }

  // Get PIs by quotation
  async getByQuotation(quotationId) {
    await this.ensureSchema();
    const sql = 'SELECT * FROM proforma_invoices WHERE quotation_id = $1 ORDER BY created_at DESC';
    const result = await query(sql, [quotationId]);
    return result.rows;
  }

  // Get PI by ID
  async getById(id) {
    await this.ensureSchema();
    const sql = 'SELECT * FROM proforma_invoices WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  async getAll(departmentType = null, companyName = null, createdBy = null) {
    await this.ensureSchema();
    let sql = `
      SELECT pi.*, 
             dhl.customer AS customer_name,
             dhl.business AS customer_business
      FROM proforma_invoices pi
      LEFT JOIN department_head_leads dhl ON pi.customer_id::text = dhl.id::text
      LEFT JOIN department_heads dh ON dh.email = dhl.created_by
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 1;

    if (departmentType) {
      sql += ` AND dh.department_type = $${paramCount}`;
      values.push(departmentType);
      paramCount++;
    }

    if (companyName) {
      sql += ` AND dh.company_name = $${paramCount}`;
      values.push(companyName);
      paramCount++;
    }

    if (createdBy) {
      sql += ` AND dhl.created_by = $${paramCount}`;
      values.push(createdBy);
    }

    sql += `
      ORDER BY 
        CASE 
          WHEN pi.status = 'pending_approval' THEN 1
          WHEN pi.status = 'approved' THEN 2
          WHEN pi.status = 'rejected' THEN 3
          ELSE 4
        END,
        pi.created_at DESC
    `;
    
    const result = await query(sql, values);
    return result.rows;
  }

  // Get all PIs pending approval
  async getPendingApproval() {
    await this.ensureSchema();
    const sql = `
      SELECT pi.*, 
             dh.customer AS customer_name,
             dh.business AS customer_business
      FROM proforma_invoices pi
      LEFT JOIN department_head_leads dh ON pi.customer_id::text = dh.id::text
      WHERE pi.status = 'pending_approval'
      ORDER BY pi.created_at DESC
    `;
    const result = await query(sql);
    return result.rows;
  }

  // Delete PI by ID
  async deleteById(id) {
    await this.ensureSchema();
    const sql = 'DELETE FROM proforma_invoices WHERE id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
  }
}

module.exports = new ProformaInvoice();
