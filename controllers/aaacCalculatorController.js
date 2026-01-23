const logger = require('../utils/logger');
const AaacCalculator = require('../models/AaacCalculator');

// Get current variable prices (for Account Department to load existing prices)
exports.getCurrentPrices = async (req, res) => {
  try {
    const prices = await AaacCalculator.getCurrentPrices();
    
    if (!prices) {
      return res.json({
        success: true,
        data: null,
        message: 'No active prices found. Please contact account department.'
      });
    }
    
    res.json({
      success: true,
      data: {
        alu_price_per_kg: prices.alu_price_per_kg,
        alloy_price_per_kg: prices.alloy_price_per_kg,
        effective_date: prices.effective_date
      }
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

// Get all daily price history
exports.getPriceHistory = async (req, res) => {
  try {
    const result = await AaacCalculator.getPriceHistory();
    
    res.json({
      success: true,
      data: result,
      message: `Retrieved ${result.length} price records`
    });
  } catch (error) {
    logger.error('Error getting price history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching price history',
      error: error.message
    });
  }
};

// Download price history as CSV
exports.downloadPriceHistory = async (req, res) => {
  try {
    const result = await AaacCalculator.getPriceHistory();
    
    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No price history records found'
      });
    }

    // Create CSV content
    let csvContent = 'Date,Aluminium Price (₹/kg),Alloy Price (₹/kg),Status,Last Updated\n';
    
    result.forEach(record => {
      const date = new Date(record.effective_date).toLocaleDateString('en-IN');
      const aluPrice = parseFloat(record.alu_price_per_kg).toFixed(2);
      const alloyPrice = parseFloat(record.alloy_price_per_kg).toFixed(2);
      const status = record.is_active ? 'Active' : 'Inactive';
      const updatedAt = new Date(record.updated_at).toLocaleString('en-IN');
      
      csvContent += `"${date}","${aluPrice}","${alloyPrice}","${status}","${updatedAt}"\n`;
    });

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=AAAC-Price-History.csv');
    res.send(csvContent);
    
    logger.info(`✅ Price history downloaded - ${result.length} records`);
  } catch (error) {
    logger.error('Error downloading price history:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading price history',
      error: error.message
    });
  }
};

// Update variable prices - for broadcasting to other clients
// ANY AUTHENTICATED USER can update prices (for now) 
// TODO: Restrict to specific department when account department is properly configured
exports.updatePrices = async (req, res) => {
  try {
    // Get user info
    const user = req.user;
    
    logger.info(`📝 AAAC Price Update Request:`, {
      userId: user?.id,
      email: user?.email,
      role: user?.role,
      departmentType: user?.departmentType,
    });

    const { alu_price_per_kg, alloy_price_per_kg } = req.body;

    if (!alu_price_per_kg || !alloy_price_per_kg) {
      return res.status(400).json({
        success: false,
        message: 'Both alu_price_per_kg and alloy_price_per_kg are required'
      });
    }

    const aluPrice = parseFloat(alu_price_per_kg);
    const alloyPrice = parseFloat(alloy_price_per_kg);
    const userId = user?.id || null;

    if (isNaN(aluPrice) || isNaN(alloyPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Prices must be valid numbers'
      });
    }

    logger.info(`💰 Parsed prices: ALU=${aluPrice}, ALLOY=${alloyPrice}`);

    // Save to database
    const savedPrices = await AaacCalculator.updatePrices(aluPrice, alloyPrice, userId);

    logger.info(`✅ AAAC prices saved to database:`, { 
      id: savedPrices.id,
      alu: savedPrices.alu_price_per_kg, 
      alloy: savedPrices.alloy_price_per_kg,
      date: savedPrices.effective_date,
      updatedBy: user?.email
    });

    // Broadcast price update to all connected clients via Socket.io
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('aaac:prices:updated', {
          alu_price_per_kg: aluPrice,
          alloy_price_per_kg: alloyPrice,
          effective_date: new Date().toISOString().split('T')[0],
          updated_by: user?.email || 'system',
          timestamp: new Date().toISOString()
        });
        logger.info(`📡 AAAC price update broadcasted to all clients via Socket.io`);
      } else {
        logger.warn(`⚠️ Socket.io instance not found for broadcasting`);
      }
    } catch (socketError) {
      logger.warn('Failed to broadcast price update via Socket.io:', socketError);
      // Don't fail the request if Socket.io broadcast fails
    }

    res.json({
      success: true,
      message: 'Prices updated successfully and broadcasted',
      data: {
        alu_price_per_kg: aluPrice,
        alloy_price_per_kg: alloyPrice,
        effective_date: new Date().toISOString().split('T')[0],
        updated_by: user?.email
      }
    });
  } catch (error) {
    logger.error('❌ Error updating prices:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating prices',
      error: error.message
    });
  }
};
