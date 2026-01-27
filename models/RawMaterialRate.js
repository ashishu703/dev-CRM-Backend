const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class RawMaterialRate extends BaseModel {
  constructor() {
    super('raw_material_rates');
  }

  static async getCurrentRates() {
    try {
      const result = await query(`
        SELECT * FROM raw_material_rates 
        ORDER BY updated_at DESC 
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        // Create default rates if none exist
        const defaultRates = {
          aluminium_ec_grade: 0,
          aluminium_cg_grade: 0,
          pvc_rp_inner: 0,
          pvc_rp_outer: 0,
          aluminium_alloy: 0,
          copper_lme_grade: 0,
          xlpe: 0,
          pvc_st1_type_a: 0,
          pvc_st2: 0,
          fr_pvc: 0,
          frlsh_pvc: 0,
          gi_wire_0_6mm: 0,
          gi_wire_1_4mm: 0,
          gi_armouring_strip: 0,
          ld: 0,
          steel_rate: 0,
          pvc_st1_st2: 0,
          aluminium_alloy_grade_t4: 0,
          last_updated: new Date()
        };

        await query(`
          INSERT INTO raw_material_rates (
            aluminium_ec_grade, aluminium_cg_grade, pvc_rp_inner, pvc_rp_outer,
            aluminium_alloy, copper_lme_grade, xlpe, pvc_st1_type_a, pvc_st2,
            fr_pvc, frlsh_pvc, gi_wire_0_6mm, gi_wire_1_4mm, gi_armouring_strip,
            ld, steel_rate, pvc_st1_st2, aluminium_alloy_grade_t4, last_updated,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
          )`, Object.values(defaultRates));

        return defaultRates;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error in getCurrentRates model:', error);
      throw error;
    }
  }

  static async updateRates(rates) {
    try {
      // Check if any record exists
      const existingRecord = await query(`
        SELECT id FROM raw_material_rates 
        ORDER BY updated_at DESC 
        LIMIT 1
      `);

      const fields = [
        'aluminium_ec_grade', 'aluminium_cg_grade', 'pvc_rp_inner', 'pvc_rp_outer',
        'aluminium_alloy', 'copper_lme_grade', 'xlpe', 'pvc_st1_type_a', 'pvc_st2',
        'fr_pvc', 'frlsh_pvc', 'gi_wire_0_6mm', 'gi_wire_1_4mm', 'gi_armouring_strip',
        'ld', 'steel_rate', 'pvc_st1_st2', 'aluminium_alloy_grade_t4'
      ];

      const values = fields.map(field => parseFloat(rates[field]) || 0);

      if (existingRecord.rows.length > 0) {
        // Update existing record
        const updateFields = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        
        await query(`
          UPDATE raw_material_rates 
          SET ${updateFields}, last_updated = NOW(), updated_at = NOW()
          WHERE id = $${fields.length + 1}
        `, [...values, existingRecord.rows[0].id]);
      } else {
        // Insert new record
        const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
        
        await query(`
          INSERT INTO raw_material_rates (
            ${fields.join(', ')}, last_updated, created_at, updated_at
          ) VALUES (
            ${placeholders}, NOW(), NOW(), NOW()
          )
        `, values);
      }

      // Return updated rates
      return await this.getCurrentRates();
    } catch (error) {
      console.error('Error in updateRates model:', error);
      throw error;
    }
  }
}

module.exports = RawMaterialRate;
