const rawMaterialService = require('../services/rawMaterialService');

// Get current raw material rates
const getCurrentRates = async (req, res) => {
  try {
    const rates = await rawMaterialService.getCurrentRates();
    res.json({
      success: true,
      data: rates
    });
  } catch (error) {
    console.error('Error fetching raw material rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch raw material rates',
      message: error.message
    });
  }
};

// Update raw material rates
const updateRates = async (req, res) => {
  try {
    const { rates } = req.body;
    
    if (!rates || typeof rates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid rates data',
        message: 'Rates object is required'
      });
    }

    const updatedRates = await rawMaterialService.updateRates(rates);
    res.json({
      success: true,
      data: updatedRates,
      message: 'Raw material rates updated successfully'
    });
  } catch (error) {
    console.error('Error updating raw material rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update raw material rates',
      message: error.message
    });
  }
};

module.exports = {
  getCurrentRates,
  updateRates
};
