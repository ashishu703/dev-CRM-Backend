const { query } = require('./config/database');

async function createRawMaterialsTable() {
  try {
    console.log('Creating raw_material_rates table...');
    
    // Create table
    await query(`
      CREATE TABLE IF NOT EXISTS raw_material_rates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          aluminium_ec_grade DECIMAL(10,2) DEFAULT 0,
          aluminium_cg_grade DECIMAL(10,2) DEFAULT 0,
          pvc_rp_inner DECIMAL(10,2) DEFAULT 0,
          pvc_rp_outer DECIMAL(10,2) DEFAULT 0,
          aluminium_alloy DECIMAL(10,2) DEFAULT 0,
          copper_lme_grade DECIMAL(10,2) DEFAULT 0,
          xlpe DECIMAL(10,2) DEFAULT 0,
          pvc_st1_type_a DECIMAL(10,2) DEFAULT 0,
          pvc_st2 DECIMAL(10,2) DEFAULT 0,
          fr_pvc DECIMAL(10,2) DEFAULT 0,
          frlsh_pvc DECIMAL(10,2) DEFAULT 0,
          gi_wire_0_6mm DECIMAL(10,2) DEFAULT 0,
          gi_wire_1_4mm DECIMAL(10,2) DEFAULT 0,
          gi_armouring_strip DECIMAL(10,2) DEFAULT 0,
          ld DECIMAL(10,2) DEFAULT 0,
          steel_rate DECIMAL(10,2) DEFAULT 0,
          pvc_st1_st2 DECIMAL(10,2) DEFAULT 0,
          aluminium_alloy_grade_t4 DECIMAL(10,2) DEFAULT 0,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Table created successfully!');
    
    // Create index
    await query(`
      CREATE INDEX IF NOT EXISTS idx_raw_material_rates_updated_at ON raw_material_rates(updated_at DESC)
    `);
    
    console.log('Index created successfully!');
    
    // Insert default record if table is empty
    const existingRecord = await query('SELECT COUNT(*) as count FROM raw_material_rates');
    
    if (parseInt(existingRecord.rows[0].count) === 0) {
      await query(`
        INSERT INTO raw_material_rates (
          aluminium_ec_grade, aluminium_cg_grade, pvc_rp_inner, pvc_rp_outer,
          aluminium_alloy, copper_lme_grade, xlpe, pvc_st1_type_a, pvc_st2,
          fr_pvc, frlsh_pvc, gi_wire_0_6mm, gi_wire_1_4mm, gi_armouring_strip,
          ld, steel_rate, pvc_st1_st2, aluminium_alloy_grade_t4, last_updated,
          created_at, updated_at
        ) VALUES (
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW(), NOW()
        )
      `);
      
      console.log('Default record inserted successfully!');
    }
    
    console.log('Raw materials table initialization completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error creating raw materials table:', error);
    process.exit(1);
  }
}

createRawMaterialsTable();
