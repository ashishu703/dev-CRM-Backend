const AaacCalculator = require('../models/AaacCalculator');
const logger = require('../utils/logger');

// Get all products with calculations
exports.getAllProducts = async (req, res) => {
  try {
    const result = await AaacCalculator.calculateAllProducts();
    logger.info('AAAC getAllProducts - Prices:', result.prices); // Debug log
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error getting all AAAC products:', error);
    // If no prices found, return empty data instead of error
    if (error.message && error.message.includes('No active prices found')) {
      return res.json({
        success: true,
        data: {
          prices: { alu_price_per_kg: 0, alloy_price_per_kg: 0 },
          products: []
        },
        message: 'No active prices found. Please contact account department.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching AAAC products',
      error: error.message
    });
  }
};

// Get current variable prices
exports.getCurrentPrices = async (req, res) => {
  try {
    const prices = await AaacCalculator.getCurrentPrices();
    if (!prices) {
      // Return success with null data instead of 404, so frontend can handle gracefully
      return res.json({
        success: true,
        data: null,
        message: 'No active prices found. Please set initial prices.'
      });
    }
    res.json({
      success: true,
      data: prices
    });
  } catch (error) {
    logger.error('Error getting current prices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prices',
      error: error.message
    });
  }
};

// Update variable prices (Account department only)
exports.updatePrices = async (req, res) => {
  try {
    // Check if user is from account department
    const user = req.user;
    const isAccountDepartment = 
      user?.departmentType === 'accounts' || 
      user?.role === 'accountsdepartmenthead' ||
      user?.department_type === 'accounts';
    
    if (!isAccountDepartment && user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only Account Department can update prices'
      });
    }

    const { alu_price_per_kg, alloy_price_per_kg } = req.body;
    const userId = user?.id || null;

    if (!alu_price_per_kg || !alloy_price_per_kg) {
      return res.status(400).json({
        success: false,
        message: 'Both alu_price_per_kg and alloy_price_per_kg are required'
      });
    }

    const updatedPrices = await AaacCalculator.updatePrices(
      parseFloat(alu_price_per_kg),
      parseFloat(alloy_price_per_kg),
      userId
    );

    // Broadcast price update to all connected clients via Socket.io
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('aaac:prices:updated', {
          alu_price_per_kg: updatedPrices.alu_price_per_kg,
          alloy_price_per_kg: updatedPrices.alloy_price_per_kg,
          effective_date: updatedPrices.effective_date,
          updated_by: user?.email || 'system',
          timestamp: new Date().toISOString()
        });
        logger.info(`✅ AAAC price update broadcasted: ALU=${updatedPrices.alu_price_per_kg}, ALLOY=${updatedPrices.alloy_price_per_kg}`);
      }
    } catch (socketError) {
      logger.warn('Failed to broadcast price update via Socket.io:', socketError);
      // Don't fail the request if Socket.io broadcast fails
    }

    res.json({
      success: true,
      message: 'Prices updated successfully',
      data: updatedPrices
    });
  } catch (error) {
    logger.error('Error updating prices:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating prices',
      error: error.message
    });
  }
};

// Calculate specific product
exports.calculateProduct = async (req, res) => {
  try {
    const { product_name, diameter, no_of_strands } = req.body;

    if (!product_name) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required'
      });
    }

    const result = await AaacCalculator.calculateProduct(
      product_name,
      diameter ? parseFloat(diameter) : null,
      no_of_strands ? parseInt(no_of_strands) : null
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error calculating product:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error calculating product',
      error: error.message
    });
  }
};
