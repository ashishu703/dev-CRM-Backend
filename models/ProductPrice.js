const BaseModel = require('./BaseModel');

class ProductPrice extends BaseModel {
  constructor() {
    super('product_prices');
  }

  async getApprovedPrice(productSpec) {
    const queryText = `
      SELECT *
      FROM product_prices
      WHERE product_spec = $1 AND status = 'approved'
      ORDER BY COALESCE(valid_until, CURRENT_DATE) DESC, approved_at DESC, created_at DESC
      LIMIT 1
    `;
    const result = await ProductPrice.query(queryText, [productSpec]);
    return result.rows[0] || null;
  }

  async upsertApprovedPrice(productSpec, unitPrice, validUntil, approvedBy) {
    const queryText = `
      INSERT INTO product_prices (product_spec, unit_price, valid_until, status, approved_by, approved_at)
      VALUES ($1, $2, $3, 'approved', $4, NOW())
      RETURNING *
    `;
    const result = await ProductPrice.query(queryText, [
      productSpec,
      unitPrice,
      validUntil || null,
      approvedBy || null
    ]);
    return result.rows[0] || null;
  }
}

module.exports = new ProductPrice();
