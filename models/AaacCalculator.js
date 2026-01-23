const { query } = require('../config/database');
const logger = require('../utils/logger');

class AaacCalculator {
  static async getAllProducts() {
    try {
      const result = await query(
        'SELECT * FROM aaac_products WHERE is_active = TRUE ORDER BY nominal_area ASC'
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching AAAC products:', error);
      throw error;
    }
  }

  static async getProductByName(name) {
    try {
      const result = await query(
        'SELECT * FROM aaac_products WHERE name = $1 AND is_active = TRUE',
        [name]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching AAAC product by name:', error);
      throw error;
    }
  }

  static async getCurrentPrices() {
    try {
      const result = await query(
        'SELECT * FROM aaac_variable_prices WHERE is_active = TRUE ORDER BY effective_date DESC LIMIT 1'
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching current prices:', error);
      throw error;
    }
  }

  static async getPriceHistory() {
    try {
      const result = await query(
        'SELECT * FROM aaac_variable_prices ORDER BY effective_date DESC'
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching price history:', error);
      throw error;
    }
  }

  static async updatePrices(aluPrice, alloyPrice, userId = null) {
    try {
      const existingPrice = await query(
        'SELECT id FROM aaac_variable_prices WHERE effective_date = CURRENT_DATE'
      );

      let result;
      if (existingPrice.rows.length > 0) {
        result = await query(
          `UPDATE aaac_variable_prices 
           SET alu_price_per_kg = $1, alloy_price_per_kg = $2, is_active = TRUE, 
               updated_at = CURRENT_TIMESTAMP, created_by = $3
           WHERE effective_date = CURRENT_DATE
           RETURNING *`,
          [aluPrice, alloyPrice, userId]
        );
      } else {
        result = await query(
          `INSERT INTO aaac_variable_prices 
           (alu_price_per_kg, alloy_price_per_kg, effective_date, created_by, is_active) 
           VALUES ($1, $2, CURRENT_DATE, $3, TRUE) 
           RETURNING *`,
          [aluPrice, alloyPrice, userId]
        );
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating prices:', error);
      throw error;
    }
  }

  static calculateNominalArea(diameter, noOfStrands) {
    return diameter * diameter * 0.785 * noOfStrands * 1.02;
  }

  static calculateAluminiumWeight(diameter, noOfStrands) {
    return diameter * diameter * 0.785 * noOfStrands * 1.02 * 2.703;
  }

  static calculateCostAluminiumPerMtr(aluPrice, aluminiumWeight) {
    return (aluPrice * aluminiumWeight * 1.1) / 1000;
  }

  // Calculate cost of conductor (Alloy) per meter
  static calculateCostAlloyPerMtr(alloyPrice, aluminiumWeight) {
    return (alloyPrice * aluminiumWeight * 1.1) / 1000;
  }

  // Calculate cost of conductor (Aluminium) per KG
  static calculateCostAluminiumPerKg(aluPrice) {
    return aluPrice * 1.1;
  }

  // Calculate cost of conductor (Alloy) per KG
  static calculateCostAlloyPerKg(alloyPrice) {
    return alloyPrice * 1.1;
  }

  // Calculate all values for a product
  static async calculateProduct(productName, customDiameter = null, customNoOfStrands = null) {
    try {
      let product;
      
      if (productName === 'Custom') {
        if (!customDiameter || !customNoOfStrands) {
          throw new Error('Custom product requires diameter and number of strands');
        }
        product = {
          name: 'Custom',
          nominal_area: 0,
          no_of_strands: customNoOfStrands,
          diameter: customDiameter
        };
      } else {
        product = await this.getProductByName(productName);
        if (!product) {
          throw new Error(`Product ${productName} not found`);
        }
      }

      const prices = await this.getCurrentPrices();
      if (!prices) {
        throw new Error('No active prices found. Please contact account department.');
      }

      const nominalArea = this.calculateNominalArea(
        product.diameter,
        product.no_of_strands
      );

      const aluminiumWeight = this.calculateAluminiumWeight(
        product.diameter,
        product.no_of_strands
      );

      const aluPrice = parseFloat(prices.alu_price_per_kg) || 0;
      const alloyPrice = parseFloat(prices.alloy_price_per_kg) || 0;

      const costAluPerMtr = this.calculateCostAluminiumPerMtr(
        aluPrice,
        aluminiumWeight
      );

      const costAlloyPerMtr = this.calculateCostAlloyPerMtr(
        alloyPrice,
        aluminiumWeight
      );

      const costAluPerKg = this.calculateCostAluminiumPerKg(aluPrice);
      const costAlloyPerKg = this.calculateCostAlloyPerKg(alloyPrice);

      return {
        product: {
          name: product.name,
          nominal_area: product.nominal_area,
          no_of_strands: product.no_of_strands,
          diameter: product.diameter
        },
        prices: {
          alu_price_per_kg: aluPrice,
          alloy_price_per_kg: alloyPrice
        },
        calculations: {
          nominal_area: parseFloat(nominalArea.toFixed(2)),
          aluminium_weight: parseFloat(aluminiumWeight.toFixed(2)),
          cost_alu_per_mtr: parseFloat(costAluPerMtr.toFixed(8)),
          cost_alloy_per_mtr: parseFloat(costAlloyPerMtr.toFixed(8)),
          cost_alu_per_kg: parseFloat(costAluPerKg.toFixed(2)),
          cost_alloy_per_kg: parseFloat(costAlloyPerKg.toFixed(2))
        }
      };
    } catch (error) {
      logger.error('Error calculating product:', error);
      throw error;
    }
  }

  // Calculate all products at once
  static async calculateAllProducts() {
    try {
      const products = await this.getAllProducts();
      const prices = await this.getCurrentPrices();
      
      if (!prices) {
        throw new Error('No active prices found. Please contact account department.');
      }

      const results = products.map(product => {
        const nominalArea = this.calculateNominalArea(
          product.diameter,
          product.no_of_strands
        );

        const aluminiumWeight = this.calculateAluminiumWeight(
          product.diameter,
          product.no_of_strands
        );

        const aluPrice = parseFloat(prices.alu_price_per_kg) || 0;
        const alloyPrice = parseFloat(prices.alloy_price_per_kg) || 0;

        const costAluPerMtr = this.calculateCostAluminiumPerMtr(
          aluPrice,
          aluminiumWeight
        );

        const costAlloyPerMtr = this.calculateCostAlloyPerMtr(
          alloyPrice,
          aluminiumWeight
        );

        const costAluPerKg = this.calculateCostAluminiumPerKg(aluPrice);
        const costAlloyPerKg = this.calculateCostAlloyPerKg(alloyPrice);

        return {
          ...product,
          calculated_nominal_area: parseFloat(nominalArea.toFixed(2)),
          aluminium_weight: parseFloat(aluminiumWeight.toFixed(2)),
          cost_alu_per_mtr: parseFloat(costAluPerMtr.toFixed(8)),
          cost_alloy_per_mtr: parseFloat(costAlloyPerMtr.toFixed(8)),
          cost_alu_per_kg: parseFloat(costAluPerKg.toFixed(2)),
          cost_alloy_per_kg: parseFloat(costAlloyPerKg.toFixed(2))
        };
      });

      return {
        prices: {
          alu_price_per_kg: parseFloat(prices.alu_price_per_kg) || 0,
          alloy_price_per_kg: parseFloat(prices.alloy_price_per_kg) || 0
        },
        products: results
      };
    } catch (error) {
      logger.error('Error calculating all products:', error);
      throw error;
    }
  }
}

module.exports = AaacCalculator;
