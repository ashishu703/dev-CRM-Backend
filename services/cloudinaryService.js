let cloudinary = null;
try {
  cloudinary = require('cloudinary').v2;
} catch (error) {
  // Cloudinary is optional - server can start without it
  console.warn('Cloudinary package not installed. File uploads will not work until package is installed.');
}

const { query } = require('../config/database');
const logger = require('../utils/logger');

class CloudinaryService {
  constructor() {
    this.isConfigured = false;
    this.config = null;
  }

  /**
   * Load Cloudinary configuration from database
   */
  async loadConfig() {
    if (!cloudinary) {
      logger.warn('Cloudinary package not installed. Please run: npm install cloudinary');
      return false;
    }

    try {
      const result = await query(
        `SELECT cloud_name, api_key, api_secret, upload_preset, default_folder 
         FROM cloudinary_configuration 
         WHERE is_active = true 
         ORDER BY created_at DESC 
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        logger.warn('Cloudinary configuration not found in database');
        return false;
      }

      this.config = result.rows[0];
      
      // Configure Cloudinary SDK
      cloudinary.config({
        cloud_name: this.config.cloud_name,
        api_key: this.config.api_key,
        api_secret: this.config.api_secret,
        secure: true
      });

      this.isConfigured = true;
      logger.info('Cloudinary configuration loaded successfully');
      return true;
    } catch (error) {
      logger.error('Error loading Cloudinary configuration:', error);
      return false;
    }
  }

  /**
   * Upload file to Cloudinary
   * @param {Buffer} fileBuffer - File buffer
   * @param {Object} options - Upload options
   * @returns {Promise<string>} Public URL of uploaded file
   */
  async uploadFile(fileBuffer, options = {}) {
    if (!cloudinary) {
      throw new Error('Cloudinary package is not installed. Please run: npm install cloudinary');
    }

    if (!this.isConfigured) {
      const loaded = await this.loadConfig();
      if (!loaded) {
        throw new Error('Cloudinary is not configured. Please configure it in the admin panel.');
      }
    }

    const {
      folder = this.config?.default_folder || 'uploads',
      publicId = null,
      resourceType = 'auto',
      format = null,
      transformation = []
    } = options;

    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: folder || this.config?.default_folder || 'uploads',
        resource_type: resourceType,
        ...(publicId && { public_id: publicId }),
        ...(format && { format: format }),
        ...(transformation.length > 0 && { transformation: transformation }),
        ...(this.config?.upload_preset && { upload_preset: this.config.upload_preset })
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            logger.info('File uploaded to Cloudinary:', result.secure_url);
            resolve(result.secure_url);
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Upload file from base64 string
   * @param {string} base64String - Base64 encoded file
   * @param {Object} options - Upload options
   * @returns {Promise<string>} Public URL of uploaded file
   */
  async uploadBase64(base64String, options = {}) {
    if (!cloudinary) {
      throw new Error('Cloudinary package is not installed. Please run: npm install cloudinary');
    }

    if (!this.isConfigured) {
      const loaded = await this.loadConfig();
      if (!loaded) {
        throw new Error('Cloudinary is not configured. Please configure it in the admin panel.');
      }
    }

    const {
      folder = this.config?.default_folder || 'uploads',
      publicId = null,
      resourceType = 'auto',
      transformation = []
    } = options;

    try {
      const uploadOptions = {
        folder: folder,
        resource_type: resourceType,
        ...(publicId && { public_id: publicId }),
        ...(transformation.length > 0 && { transformation: transformation }),
        ...(this.config?.upload_preset && { upload_preset: this.config.upload_preset })
      };

      const result = await cloudinary.uploader.upload(base64String, uploadOptions);
      logger.info('File uploaded to Cloudinary:', result.secure_url);
      return result.secure_url;
    } catch (error) {
      logger.error('Cloudinary upload error:', error);
      throw error;
    }
  }

  /**
   * Delete file from Cloudinary
   * @param {string} publicId - Public ID of the file
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFile(publicId) {
    if (!cloudinary) {
      throw new Error('Cloudinary package is not installed. Please run: npm install cloudinary');
    }

    if (!this.isConfigured) {
      const loaded = await this.loadConfig();
      if (!loaded) {
        throw new Error('Cloudinary is not configured');
      }
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      logger.error('Cloudinary delete error:', error);
      throw error;
    }
  }

  /**
   * Check if Cloudinary is configured
   */
  isReady() {
    return this.isConfigured;
  }
}

module.exports = new CloudinaryService();

