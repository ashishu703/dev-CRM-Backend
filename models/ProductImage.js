const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class ProductImage extends BaseModel {
  constructor() {
    super('product_images');
  }

  /**
   * Save a product image/video
   * @param {Object} data - Image data
   * @returns {Promise<Object>} Saved image record
   */
  async saveProductImage(data) {
    const { product_name, size_index, file_url, file_type, file_name, file_size, uploaded_by } = data;
    
    const sqlQuery = `
      INSERT INTO product_images (
        product_name, size_index, file_url, file_type, file_name, file_size, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [product_name, size_index, file_url, file_type, file_name, file_size, uploaded_by];
    const result = await query(sqlQuery, values);
    return result.rows[0];
  }

  /**
   * Get all images for a product and size index
   * @param {string} productName - Product name
   * @param {number} sizeIndex - Size index
   * @returns {Promise<Array>} Array of image records
   */
  async getByProductAndSize(productName, sizeIndex) {
    const sqlQuery = `
      SELECT * FROM product_images
      WHERE product_name = $1 AND size_index = $2
      ORDER BY uploaded_at ASC
    `;
    
    const result = await query(sqlQuery, [productName, sizeIndex]);
    return result.rows;
  }

  /**
   * Get all images for a product
   * @param {string} productName - Product name
   * @returns {Promise<Object>} Object with size_index as keys
   */
  async getByProduct(productName) {
    const sqlQuery = `
      SELECT * FROM product_images
      WHERE product_name = $1
      ORDER BY size_index ASC, uploaded_at ASC
    `;
    
    const result = await query(sqlQuery, [productName]);
    
    // Group by size_index
    const grouped = {};
    result.rows.forEach(row => {
      if (!grouped[row.size_index]) {
        grouped[row.size_index] = [];
      }
      grouped[row.size_index].push({
        url: row.file_url,
        type: row.file_type,
        name: row.file_name,
        size: row.file_size,
        uploaded_at: row.uploaded_at
      });
    });
    
    return grouped;
  }

  /**
   * Delete a product image
   * @param {string} fileUrl - File URL to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteByUrl(fileUrl) {
    const sqlQuery = 'DELETE FROM product_images WHERE file_url = $1 RETURNING *';
    const result = await query(sqlQuery, [fileUrl]);
    return result.rowCount > 0;
  }

  /**
   * Delete all images for a product and size index
   * @param {string} productName - Product name
   * @param {number} sizeIndex - Size index
   * @returns {Promise<number>} Number of deleted records
   */
  async deleteByProductAndSize(productName, sizeIndex) {
    const sqlQuery = 'DELETE FROM product_images WHERE product_name = $1 AND size_index = $2';
    const result = await query(sqlQuery, [productName, sizeIndex]);
    return result.rowCount;
  }
}

module.exports = new ProductImage();

