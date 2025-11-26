const { query } = require('../config/database');

class Configuration {
  /**
   * Get global setting by key
   */
  static async getGlobalSetting(key) {
    const result = await query(
      'SELECT * FROM global_settings WHERE key = $1',
      [key]
    );
    return result.rows[0] || null;
  }

  /**
   * Set or update global setting
   */
  static async setGlobalSetting(key, value, description = null) {
    const result = await query(
      `INSERT INTO global_settings (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [key, value, description]
    );
    return result.rows[0];
  }

  /**
   * Get all global settings
   */
  static async getAllGlobalSettings() {
    const result = await query('SELECT * FROM global_settings ORDER BY key');
    return result.rows;
  }

  /**
   * Get email configuration
   */
  static async getEmailConfiguration() {
    const result = await query(
      'SELECT * FROM email_configuration WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );
    return result.rows[0] || null;
  }

  /**
   * Save email configuration
   */
  static async saveEmailConfiguration(config) {
    // Deactivate all existing configurations
    await query('UPDATE email_configuration SET is_active = false');

    const result = await query(
      `INSERT INTO email_configuration (
        host, port, username, password, from_name, from_email,
        recipients, cc_recipients, bcc_recipients, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *`,
      [
        config.host,
        config.port,
        config.username,
        config.password,
        config.fromName,
        config.fromEmail,
        config.recipients || null,
        config.ccRecipients || null,
        config.bccRecipients || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Get WhatsApp configuration
   */
  static async getWhatsAppConfiguration() {
    const result = await query(
      'SELECT * FROM whatsapp_configuration WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );
    return result.rows[0] || null;
  }

  /**
   * Save WhatsApp configuration
   */
  static async saveWhatsAppConfiguration(config) {
    // Deactivate all existing configurations
    await query('UPDATE whatsapp_configuration SET is_active = false');

    const result = await query(
      `INSERT INTO whatsapp_configuration (
        flow_id, flow_name, api_key, phone_number, is_active
      ) VALUES ($1, $2, $3, $4, true)
      RETURNING *`,
      [
        config.flowId || null,
        config.flowName || null,
        config.apiKey,
        config.phoneNumber || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Get Cloudinary configuration
   */
  static async getCloudinaryConfiguration() {
    const result = await query(
      'SELECT * FROM cloudinary_configuration WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );
    return result.rows[0] || null;
  }

  /**
   * Save Cloudinary configuration
   */
  static async saveCloudinaryConfiguration(config) {
    // Deactivate all existing configurations
    await query('UPDATE cloudinary_configuration SET is_active = false');

    const result = await query(
      `INSERT INTO cloudinary_configuration (
        cloud_name, api_key, api_secret, upload_preset, default_folder, is_active
      ) VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *`,
      [
        config.cloudName,
        config.apiKey,
        config.apiSecret,
        config.uploadPreset || null,
        config.folder || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Get all email templates
   */
  static async getEmailTemplates() {
    const result = await query(
      'SELECT * FROM email_templates WHERE is_active = true ORDER BY created_at DESC'
    );
    return result.rows;
  }

  /**
   * Get email template by ID
   */
  static async getEmailTemplateById(id) {
    const result = await query(
      'SELECT * FROM email_templates WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create email template
   */
  static async createEmailTemplate(template) {
    const result = await query(
      `INSERT INTO email_templates (name, subject, description, html_content, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [
        template.name,
        template.subject,
        template.description || null,
        template.htmlContent
      ]
    );
    return result.rows[0];
  }

  /**
   * Update email template
   */
  static async updateEmailTemplate(id, template) {
    const result = await query(
      `UPDATE email_templates 
       SET name = $2, subject = $3, description = $4, html_content = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        template.name,
        template.subject,
        template.description || null,
        template.htmlContent
      ]
    );
    return result.rows[0];
  }

  /**
   * Delete email template (soft delete)
   */
  static async deleteEmailTemplate(id) {
    const result = await query(
      `UPDATE email_templates 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get Indiamart configuration
   */
  static async getIndiamartConfiguration() {
    const result = await query(
      'SELECT * FROM indiamart_configuration WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );
    return result.rows[0] || null;
  }

  /**
   * Save Indiamart configuration
   */
  static async saveIndiamartConfiguration(config) {
    // Deactivate all existing configurations
    await query('UPDATE indiamart_configuration SET is_active = false');

    const result = await query(
      `INSERT INTO indiamart_configuration (
        api_key, api_secret, access_token, refresh_token, token_expires_at, webhook_url, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *`,
      [
        config.apiKey,
        config.apiSecret,
        config.accessToken || null,
        config.refreshToken || null,
        config.tokenExpiresAt || null,
        config.webhookUrl || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Get TradeIndia configuration
   */
  static async getTradeIndiaConfiguration() {
    const result = await query(
      'SELECT * FROM tradeindia_configuration WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );
    return result.rows[0] || null;
  }

  /**
   * Save TradeIndia configuration
   */
  static async saveTradeIndiaConfiguration(config) {
    // Deactivate all existing configurations
    await query('UPDATE tradeindia_configuration SET is_active = false');

    const result = await query(
      `INSERT INTO tradeindia_configuration (
        api_key, api_secret, access_token, refresh_token, token_expires_at, webhook_url, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *`,
      [
        config.apiKey,
        config.apiSecret,
        config.accessToken || null,
        config.refreshToken || null,
        config.tokenExpiresAt || null,
        config.webhookUrl || null
      ]
    );
    return result.rows[0];
  }
}

module.exports = Configuration;

