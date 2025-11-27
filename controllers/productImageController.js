const ProductImage = require('../models/ProductImage');
const cloudinaryService = require('../services/cloudinaryService');
const logger = require('../utils/logger');

class ProductImageController {
  /**
   * Upload and save product image/video
   * POST /api/product-images
   */
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        logger.error('No file uploaded in request');
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const { product_name, size_index } = req.body;
      
      if (!product_name || size_index === undefined) {
        logger.error('Missing required fields:', { product_name, size_index });
        return res.status(400).json({
          success: false,
          message: 'product_name and size_index are required'
        });
      }

      logger.info('Uploading file to Cloudinary:', {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimetype: req.file.mimetype,
        product_name,
        size_index
      });

      // Upload to Cloudinary
      const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
      const resourceType = fileType === 'image' ? 'image' : 'video';
      
      let fileUrl;
      try {
        fileUrl = await cloudinaryService.uploadFile(req.file.buffer, {
          folder: `products/${product_name.replace(/[^a-zA-Z0-9]/g, '_')}`,
          resourceType: resourceType
        });
        logger.info('File uploaded to Cloudinary successfully:', fileUrl);
      } catch (cloudinaryError) {
        logger.error('Cloudinary upload error:', cloudinaryError);
        return res.status(500).json({
          success: false,
          message: cloudinaryError.message || 'Failed to upload file to storage. Please check Cloudinary configuration.',
          error: cloudinaryError.message
        });
      }

      // Save to database
      let imageRecord;
      try {
        imageRecord = await ProductImage.saveProductImage({
          product_name: product_name,
          size_index: parseInt(size_index),
          file_url: fileUrl,
          file_type: fileType,
          file_name: req.file.originalname,
          file_size: req.file.size,
          uploaded_by: req.user?.email || req.user?.username || 'unknown'
        });
        logger.info('Image record saved to database:', imageRecord.id);
      } catch (dbError) {
        logger.error('Database save error:', dbError);
        // If database save fails, the file is already uploaded to Cloudinary
        // This is not ideal but we'll return success with a warning
        return res.status(500).json({
          success: false,
          message: 'File uploaded but failed to save to database. Please try again.',
          error: dbError.message
        });
      }

      res.json({
        success: true,
        message: 'File uploaded and saved successfully',
        data: {
          url: fileUrl,
          id: imageRecord.id,
          type: fileType
        }
      });
    } catch (error) {
      logger.error('Error uploading product image:', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload file',
        error: error.message
      });
    }
  }

  /**
   * Get all images for a product
   * GET /api/product-images/:productName
   */
  async getProductImages(req, res) {
    try {
      const { productName } = req.params;
      const images = await ProductImage.getByProduct(productName);
      
      res.json({
        success: true,
        data: images
      });
    } catch (error) {
      logger.error('Error fetching product images:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch images',
        error: error.message
      });
    }
  }

  /**
   * Delete a product image
   * DELETE /api/product-images
   */
  async deleteImage(req, res) {
    try {
      const { file_url } = req.body;
      
      if (!file_url) {
        return res.status(400).json({
          success: false,
          message: 'file_url is required'
        });
      }

      const deleted = await ProductImage.deleteByUrl(file_url);
      
      if (deleted) {
        res.json({
          success: true,
          message: 'Image deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }
    } catch (error) {
      logger.error('Error deleting product image:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete image',
        error: error.message
      });
    }
  }
}

module.exports = new ProductImageController();

