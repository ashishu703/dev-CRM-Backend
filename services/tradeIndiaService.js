const axios = require('axios');
const Configuration = require('../models/Configuration');
const DepartmentHeadLead = require('../models/DepartmentHeadLead');
const logger = require('../utils/logger');

/**
 * TradeIndia Integration Service
 * Handles fetching leads from TradeIndia API and processing them
 * Follows OOP and DRY principles
 */
class TradeIndiaService {
  constructor() {
    this.baseUrl = 'https://www.tradeindia.com/utils';
  }

  /**
   * Get TradeIndia configuration from database
   */
  async getConfig() {
    const config = await Configuration.getTradeIndiaConfiguration();
    if (!config || !config.api_key) {
      throw new Error('TradeIndia configuration not found or incomplete. Please configure API key in Settings.');
    }
    return config;
  }

  /**
   * Build API URL with query parameters
   * @param {string} endpoint - API endpoint (my_inquiry or my_buy_leads)
   * @param {Object} config - TradeIndia configuration
   * @returns {string} - Complete API URL
   */
  buildApiUrl(endpoint, config) {
    // Extract user_id and profile_id from config or use defaults
    // These can be configured in the TradeIndia config or use defaults from the original implementation
    const userId = config.user_id || process.env.TRADEINDIA_USER_ID || '12414753';
    const profileId = config.profile_id || process.env.TRADEINDIA_PROFILE_ID || '23313892';
    
    const params = new URLSearchParams({
      user_id: userId,
      profile_id: profileId,
      key: config.api_key
    });
    return `${this.baseUrl}/${endpoint}.html?${params.toString()}`;
  }

  /**
   * Fetch leads from TradeIndia API
   * @param {string} endpoint - API endpoint type
   * @returns {Promise<Array>} - Array of leads
   */
  async fetchLeads(endpoint = 'my_inquiry') {
    try {
      const config = await this.getConfig();
      const url = this.buildApiUrl(endpoint, config);
      
      logger.info(`Fetching TradeIndia leads from: ${endpoint}`);
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'ANOCAB-Lead-Management/1.0'
        }
      });

      return this.parseResponse(response.data, endpoint);
    } catch (error) {
      logger.error(`Error fetching TradeIndia leads from ${endpoint}:`, error.message);
      throw new Error(`Failed to fetch TradeIndia leads: ${error.message}`);
    }
  }

  /**
   * Parse TradeIndia API response
   * Handles different response formats
   * @param {*} data - API response data
   * @param {string} source - Source endpoint name
   * @returns {Array} - Parsed leads array
   */
  parseResponse(data, source) {
    if (!data) return [];

    // Handle array response
    if (Array.isArray(data)) {
      return data.map(lead => this.normalizeLead(lead, source));
    }

    // Handle object with data property
    if (data.data && Array.isArray(data.data)) {
      return data.data.map(lead => this.normalizeLead(lead, source));
    }

    // Handle object with leads property
    if (data.leads && Array.isArray(data.leads)) {
      return data.leads.map(lead => this.normalizeLead(lead, source));
    }

    // Handle single object
    if (typeof data === 'object' && data !== null) {
      return [this.normalizeLead(data, source)];
    }

    logger.warn('Unexpected TradeIndia response format:', typeof data);
    return [];
  }

  /**
   * Normalize TradeIndia lead data to match our database schema
   * @param {Object} lead - Raw lead from TradeIndia API
   * @param {string} source - Source of the lead (my_inquiry, my_buy_leads)
   * @returns {Object} - Normalized lead object
   */
  normalizeLead(lead, source) {
    return {
      customer: this.extractValue(lead, ['name', 'customer_name', 'buyer_name', 'company_name', 'customer']) || 'N/A',
      phone: this.extractValue(lead, ['phone', 'mobile', 'contact_number', 'phone_number', 'telephone']),
      email: this.extractValue(lead, ['email', 'email_id', 'buyer_email']),
      business: this.extractValue(lead, ['business', 'company', 'business_name', 'company_name']),
      address: this.extractValue(lead, ['address', 'location', 'city', 'full_address']),
      state: this.extractValue(lead, ['state', 'state_name']),
      productNames: this.extractValue(lead, ['product', 'product_name', 'product_type', 'item', 'product_names']),
      leadSource: 'TRADEINDIA',
      category: this.extractValue(lead, ['category', 'product_category']),
      gstNo: this.extractValue(lead, ['gst', 'gst_no', 'gst_number', 'gstn']),
      customerType: this.extractValue(lead, ['customer_type', 'type', 'buyer_type']),
      date: this.extractDate(lead),
      whatsapp: this.extractValue(lead, ['whatsapp', 'whatsapp_number']),
      // Store raw data for reference
      rawData: lead,
      source: source
    };
  }

  /**
   * Extract value from object using multiple possible keys
   * @param {Object} obj - Source object
   * @param {Array<string>} keys - Array of possible keys
   * @returns {string|null} - Extracted value or null
   */
  extractValue(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        const value = String(obj[key]).trim();
        if (value && value.toLowerCase() !== 'n/a') {
          return value;
        }
      }
    }
    return null;
  }

  /**
   * Extract and normalize date from lead data
   * @param {Object} lead - Lead object
   * @returns {string|null} - Normalized date string (YYYY-MM-DD) or null
   */
  extractDate(lead) {
    const dateKeys = ['date', 'created_date', 'inquiry_date', 'lead_date', 'created_at'];
    const dateValue = this.extractValue(lead, dateKeys);
    
    if (!dateValue) return null;

    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      logger.warn(`Invalid date format: ${dateValue}`);
    }
    
    return null;
  }

  /**
   * Process and save leads to database
   * @param {Array} leads - Array of normalized leads
   * @param {string} createdBy - Email of the creator (default: system)
   * @returns {Promise<Object>} - Result with saved count and errors
   */
  async saveLeads(leads, createdBy = 'system@tradeindia.integration') {
    if (!Array.isArray(leads) || leads.length === 0) {
      return { saved: 0, errors: [] };
    }

    const errors = [];
    let savedCount = 0;

    // Process leads in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      try {
        const result = await DepartmentHeadLead.bulkCreateFromUi(batch, createdBy);
        savedCount += result.rowCount || 0;
        
        if (result.skippedRows && result.skippedRows.length > 0) {
          errors.push(...result.skippedRows);
        }
      } catch (error) {
        logger.error(`Error saving TradeIndia leads batch ${i / batchSize + 1}:`, error.message);
        errors.push({
          batch: i / batchSize + 1,
          error: error.message
        });
      }
    }

    return { saved: savedCount, errors };
  }

  /**
   * Fetch and save leads from all TradeIndia endpoints
   * @param {string} createdBy - Email of the creator
   * @returns {Promise<Object>} - Result with saved counts per endpoint
   */
  async fetchAndSaveAllLeads(createdBy = 'system@tradeindia.integration') {
    const endpoints = ['my_inquiry', 'my_buy_leads'];
    const results = {
      inquiry: { saved: 0, errors: [] },
      buyLeads: { saved: 0, errors: [] },
      total: { saved: 0, errors: [] }
    };

    for (const endpoint of endpoints) {
      try {
        const leads = await this.fetchLeads(endpoint);
        const saveResult = await this.saveLeads(leads, createdBy);
        
        const key = endpoint === 'my_inquiry' ? 'inquiry' : 'buyLeads';
        results[key] = saveResult;
        results.total.saved += saveResult.saved;
        results.total.errors.push(...saveResult.errors);
      } catch (error) {
        logger.error(`Error processing ${endpoint}:`, error.message);
        const key = endpoint === 'my_inquiry' ? 'inquiry' : 'buyLeads';
        results[key].errors.push({ error: error.message });
      }
    }

    return results;
  }

  /**
   * Process webhook payload from TradeIndia
   * @param {Object} payload - Webhook payload
   * @param {string} createdBy - Email of the creator
   * @returns {Promise<Object>} - Result with saved count
   */
  async processWebhook(payload, createdBy = 'system@tradeindia.integration') {
    try {
      logger.info('Processing TradeIndia webhook payload');
      
      // Normalize webhook payload to lead format
      const leads = Array.isArray(payload) 
        ? payload.map(lead => this.normalizeLead(lead, 'webhook'))
        : [this.normalizeLead(payload, 'webhook')];

      return await this.saveLeads(leads, createdBy);
    } catch (error) {
      logger.error('Error processing TradeIndia webhook:', error.message);
      throw error;
    }
  }
}

module.exports = new TradeIndiaService();

