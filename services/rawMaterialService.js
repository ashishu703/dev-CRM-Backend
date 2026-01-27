const RawMaterialRate = require('../models/RawMaterialRate');

// Get current raw material rates
const getCurrentRates = async () => {
  try {
    const rates = await RawMaterialRate.getCurrentRates();
    return rates;
  } catch (error) {
    console.error('Error in getCurrentRates service:', error);
    throw error;
  }
};

// Update raw material rates
const updateRates = async (newRates) => {
  try {
    const updatedRates = await RawMaterialRate.updateRates(newRates);
    return updatedRates;
  } catch (error) {
    console.error('Error in updateRates service:', error);
    throw error;
  }
};

module.exports = {
  getCurrentRates,
  updateRates
};
