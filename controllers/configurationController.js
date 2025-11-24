const Configuration = require('../models/Configuration');
const cloudinaryService = require('../services/cloudinaryService');
const logger = require('../utils/logger');

class ConfigurationController {
  /**
   * Get all configurations
   */
  async getAll(req, res) {
    try {
      const [emailConfig, whatsappConfig, cloudinaryConfig, templates] = await Promise.all([
        Configuration.getEmailConfiguration(),
        Configuration.getWhatsAppConfiguration(),
        Configuration.getCloudinaryConfiguration(),
        Configuration.getEmailTemplates()
      ]);

      res.json({
        success: true,
        data: {
          email: emailConfig,
          whatsapp: whatsappConfig,
          cloudinary: cloudinaryConfig,
          templates
        }
      });
    } catch (error) {
      logger.error('Error fetching configurations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch configurations',
        error: error.message
      });
    }
  }

  /**
   * Save email configuration
   */
  async saveEmail(req, res) {
    try {
      const config = await Configuration.saveEmailConfiguration(req.body);
      
      res.json({
        success: true,
        message: 'Email configuration saved successfully',
        data: config
      });
    } catch (error) {
      logger.error('Error saving email configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save email configuration',
        error: error.message
      });
    }
  }

  /**
   * Save WhatsApp configuration
   */
  async saveWhatsApp(req, res) {
    try {
      const config = await Configuration.saveWhatsAppConfiguration(req.body);
      
      res.json({
        success: true,
        message: 'WhatsApp configuration saved successfully',
        data: config
      });
    } catch (error) {
      logger.error('Error saving WhatsApp configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save WhatsApp configuration',
        error: error.message
      });
    }
  }

  /**
   * Save Cloudinary configuration
   */
  async saveCloudinary(req, res) {
    try {
      const config = await Configuration.saveCloudinaryConfiguration(req.body);
      
      // Reload Cloudinary service with new config
      await cloudinaryService.loadConfig();
      
      res.json({
        success: true,
        message: 'Cloudinary configuration saved successfully',
        data: config
      });
    } catch (error) {
      logger.error('Error saving Cloudinary configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save Cloudinary configuration',
        error: error.message
      });
    }
  }

  /**
   * Get global settings
   */
  async getGlobalSettings(req, res) {
    try {
      const settings = await Configuration.getAllGlobalSettings();
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('Error fetching global settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch global settings',
        error: error.message
      });
    }
  }

  /**
   * Set global setting
   */
  async setGlobalSetting(req, res) {
    try {
      const { key, value, description } = req.body;
      
      if (!key || value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'key and value are required'
        });
      }

      const setting = await Configuration.setGlobalSetting(key, value, description);
      
      res.json({
        success: true,
        message: 'Global setting saved successfully',
        data: setting
      });
    } catch (error) {
      logger.error('Error saving global setting:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save global setting',
        error: error.message
      });
    }
  }

  /**
   * Get email templates
   */
  async getEmailTemplates(req, res) {
    try {
      const templates = await Configuration.getEmailTemplates();
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Error fetching email templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch email templates',
        error: error.message
      });
    }
  }

  /**
   * Create email template
   */
  async createEmailTemplate(req, res) {
    try {
      const { name, subject, description, htmlContent } = req.body;
      
      if (!name || !subject || !htmlContent) {
        return res.status(400).json({
          success: false,
          message: 'name, subject, and htmlContent are required'
        });
      }

      const template = await Configuration.createEmailTemplate({
        name,
        subject,
        description,
        htmlContent
      });
      
      res.json({
        success: true,
        message: 'Email template created successfully',
        data: template
      });
    } catch (error) {
      logger.error('Error creating email template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create email template',
        error: error.message
      });
    }
  }

  /**
   * Update email template
   */
  async updateEmailTemplate(req, res) {
    try {
      const { id } = req.params;
      const { name, subject, description, htmlContent } = req.body;
      
      const template = await Configuration.updateEmailTemplate(id, {
        name,
        subject,
        description,
        htmlContent
      });
      
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Email template updated successfully',
        data: template
      });
    } catch (error) {
      logger.error('Error updating email template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update email template',
        error: error.message
      });
    }
  }

  /**
   * Delete email template
   */
  async deleteEmailTemplate(req, res) {
    try {
      const { id } = req.params;
      
      const template = await Configuration.deleteEmailTemplate(id);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Email template deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting email template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete email template',
        error: error.message
      });
    }
  }
}

module.exports = new ConfigurationController();

