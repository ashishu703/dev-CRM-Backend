const ProductPrice = require('../models/ProductPrice');

class ProductPriceController {
  async getApprovedPrice(req, res) {
    try {
      const { productSpec } = req.params;
      if (!productSpec) {
        return res.status(400).json({ success: false, message: 'productSpec is required' });
      }
      const price = await ProductPrice.getApprovedPrice(productSpec);
      if (!price) {
        return res.status(404).json({ success: false, message: 'No approved price found' });
      }
      res.json({ success: true, data: price });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch price', error: error.message });
    }
  }

  async createApprovedPrice(req, res) {
    try {
      const dept = (req.user?.departmentType || '').toLowerCase();
      const isAccounts = dept.includes('accounts');
      if (!isAccounts && req.user?.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Only Accounts can update price list' });
      }

      const { productSpec, unitPrice, validUntil } = req.body;
      if (!productSpec || unitPrice === undefined) {
        return res.status(400).json({ success: false, message: 'productSpec and unitPrice are required' });
      }

      const price = await ProductPrice.upsertApprovedPrice(
        productSpec,
        unitPrice,
        validUntil,
        req.user?.email || req.user?.username
      );
      res.status(201).json({ success: true, data: price });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update price list', error: error.message });
    }
  }
}

module.exports = new ProductPriceController();
