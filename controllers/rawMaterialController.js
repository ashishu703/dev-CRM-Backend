const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * FIXED: Partial update API - only updates provided fields
 * Prevents accidental zero overwrites of existing database values
 */
const updateRawMaterialRates = async (req, res) => {
  try {
    const { rates } = req.body;
    
    // Validate input
    if (!rates || typeof rates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid rates data provided'
      });
    }
    
    // SAFETY CHECK: Filter out undefined/null values and validate numeric values
    const safeRates = {};
    const allowedFields = [
      'aluminium_ec_grade', 'aluminium_cg_grade', 'pvc_rp_inner', 'pvc_rp_outer',
      'aluminium_alloy', 'copper_lme_grade', 'xlpe', 'pvc_st1_type_a', 'pvc_st2',
      'fr_pvc', 'frlsh_pvc', 'gi_wire_0_6mm', 'gi_wire_1_4mm', 'gi_armouring_strip',
      'ld', 'steel_rate', 'pvc_st1_st2', 'aluminium_alloy_grade_t4'
    ];
    
    Object.keys(rates).forEach(key => {
      const value = rates[key];
      
      // Only process allowed fields with valid numeric values
      if (allowedFields.includes(key) && 
          value !== undefined && 
          value !== null && 
          !isNaN(parseFloat(value)) && 
          parseFloat(value) >= 0) {
        safeRates[key] = parseFloat(value);
      }
    });
    
    // Don't proceed if no valid rates to update
    if (Object.keys(safeRates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid rates provided for update'
      });
    }
    
    logger.info('Updating rates (partial):', safeRates);
    
    // Get current rates from database
    // Prefer active row; if none marked active, fall back to most recent row
    const activeResult = await query(
      `SELECT * FROM raw_material_rates WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
    );
    let currentRow = activeResult.rows[0];

    if (!currentRow) {
      const latestResult = await query(
        `SELECT * FROM raw_material_rates ORDER BY created_at DESC LIMIT 1`
      );
      currentRow = latestResult.rows[0];

      // If we found a latest row but it wasn't marked active, mark it active
      if (currentRow) {
        await query('UPDATE raw_material_rates SET is_active = false');
        await query('UPDATE raw_material_rates SET is_active = true WHERE id = $1', [currentRow.id]);
      }
    }

    const currentRates = {};
    if (currentRow) {
      allowedFields.forEach(field => {
        if (currentRow[field] !== undefined) {
          currentRates[field] = parseFloat(currentRow[field]) || 0;
        }
      });
    }
    
    // PARTIAL UPDATE: Merge new rates with existing rates
    const mergedRates = { ...currentRates, ...safeRates };
    
    // Deactivate current rates
    if (currentRow) {
      await query('UPDATE raw_material_rates SET is_active = false WHERE id = $1', [currentRow.id]);
    }
    
    // Insert new rates record with merged data
    const insertQuery = `
      INSERT INTO raw_material_rates (
        ${allowedFields.join(', ')},
        is_active, 
        created_at, 
        updated_at
      ) VALUES (
        ${allowedFields.map((_, index) => `$${index + 1}`).join(', ')},
        true, 
        NOW(), 
        NOW()
      ) RETURNING *
    `;
    
    const values = allowedFields.map(field => mergedRates[field] || 0);
    const result = await query(insertQuery, values);
    
    // Prepare response with only the updated fields for frontend
    const responseData = {};
    Object.keys(safeRates).forEach(key => {
      responseData[key] = safeRates[key];
    });
    
    // Add metadata
    responseData.lastUpdated = result.rows[0].updated_at;
    responseData.updatedFields = Object.keys(safeRates);
    
    logger.info('Successfully updated rates:', responseData);
    
    return res.status(200).json({
      success: true,
      message: 'Raw material rates updated successfully',
      data: responseData
    });
    
  } catch (error) {
    logger.error('Error updating raw material rates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update raw material rates'
    });
  }
};

/**
 * Get current raw material rates
 */
const getCurrentRates = async (req, res) => {
  try {
    // Try active row first
    const activeResult = await query(
      `SELECT * FROM raw_material_rates WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
    );

    let rates = activeResult.rows[0];

    // If no active row, fall back to most recent and mark it active
    if (!rates) {
      const latestResult = await query(
        `SELECT * FROM raw_material_rates ORDER BY created_at DESC LIMIT 1`
      );
      rates = latestResult.rows[0];

      if (rates) {
        await query('UPDATE raw_material_rates SET is_active = false');
        await query('UPDATE raw_material_rates SET is_active = true WHERE id = $1', [rates.id]);
      }
    }

    if (!rates) {
      const defaultRates = {
        aluminium_ec_grade: 0, aluminium_cg_grade: 0, pvc_rp_inner: 0, pvc_rp_outer: 0,
        aluminium_alloy: 0, copper_lme_grade: 0, xlpe: 0, pvc_st1_type_a: 0, pvc_st2: 0,
        fr_pvc: 0, frlsh_pvc: 0, gi_wire_0_6mm: 0, gi_wire_1_4mm: 0, gi_armouring_strip: 0,
        ld: 0, steel_rate: 0, pvc_st1_st2: 0, aluminium_alloy_grade_t4: 0,
        lastUpdated: null
      };
      return res.status(200).json({
        success: true,
        message: 'No rates found, returning defaults',
        data: defaultRates
      });
    }
    
    // Clean response - remove internal fields
    const responseData = {
      aluminium_ec_grade: rates.aluminium_ec_grade || 0,
      aluminium_cg_grade: rates.aluminium_cg_grade || 0,
      pvc_rp_inner: rates.pvc_rp_inner || 0,
      pvc_rp_outer: rates.pvc_rp_outer || 0,
      aluminium_alloy: rates.aluminium_alloy || 0,
      copper_lme_grade: rates.copper_lme_grade || 0,
      xlpe: rates.xlpe || 0,
      pvc_st1_type_a: rates.pvc_st1_type_a || 0,
      pvc_st2: rates.pvc_st2 || 0,
      fr_pvc: rates.fr_pvc || 0,
      frlsh_pvc: rates.frlsh_pvc || 0,
      gi_wire_0_6mm: rates.gi_wire_0_6mm || 0,
      gi_wire_1_4mm: rates.gi_wire_1_4mm || 0,
      gi_armouring_strip: rates.gi_armouring_strip || 0,
      ld: rates.ld || 0,
      steel_rate: rates.steel_rate || 0,
      pvc_st1_st2: rates.pvc_st1_st2 || 0,
      aluminium_alloy_grade_t4: rates.aluminium_alloy_grade_t4 || 0,
      lastUpdated: rates.updated_at || rates.created_at
    };
    
    return res.status(200).json({
      success: true,
      message: 'Current rates retrieved successfully',
      data: responseData
    });
    
  } catch (error) {
    logger.error('Error getting current rates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get current rates'
    });
  }
};

module.exports = {
  updateRawMaterialRates,
  getCurrentRates
};
