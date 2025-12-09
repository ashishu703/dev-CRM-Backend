const tradeIndiaService = require('../services/tradeIndiaService');
const logger = require('../utils/logger');

/**
 * TradeIndia Integration Controller
 * Handles webhook and manual fetch endpoints
 */
class TradeIndiaController {
  /**
   * Handle TradeIndia webhook
   * POST /webhook/tradeindia
   */
  async handleWebhook(req, res) {
    try {
      logger.info('TradeIndia webhook received:', JSON.stringify(req.body).substring(0, 200));
      
      // Get default creator from config or use system account
      const createdBy = 'system@tradeindia.integration';
      
      const result = await tradeIndiaService.processWebhook(req.body, createdBy);
      
      logger.info(`TradeIndia webhook processed: ${result.saved} leads saved`);
      
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        saved: result.saved,
        errors: result.errors.length > 0 ? result.errors : undefined
      });
    } catch (error) {
      logger.error('Error processing TradeIndia webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message
      });
    }
  }

  /**
   * Manually fetch leads from TradeIndia API
   * GET /api/tradeindia/fetch-leads
   */
  async fetchLeads(req, res) {
    try {
      const { endpoint } = req.query; // Optional: 'inquiry', 'buy_leads', or 'all'
      
      logger.info(`Manual TradeIndia fetch requested: ${endpoint || 'all'}`);
      
      let result;
      
      if (endpoint === 'inquiry') {
        const leads = await tradeIndiaService.fetchLeads('my_inquiry');
        const saveResult = await tradeIndiaService.saveLeads(leads, req.user?.email || 'system@tradeindia.integration');
        result = {
          inquiry: { leads, saved: saveResult.saved, errors: saveResult.errors },
          buyLeads: null
        };
      } else if (endpoint === 'buy_leads') {
        const leads = await tradeIndiaService.fetchLeads('my_buy_leads');
        const saveResult = await tradeIndiaService.saveLeads(leads, req.user?.email || 'system@tradeindia.integration');
        result = {
          inquiry: null,
          buyLeads: { leads, saved: saveResult.saved, errors: saveResult.errors }
        };
      } else {
        // Fetch all endpoints
        result = await tradeIndiaService.fetchAndSaveAllLeads(req.user?.email || 'system@tradeindia.integration');
      }

      res.json({
        success: true,
        message: 'Leads fetched and saved successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error fetching TradeIndia leads:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leads',
        error: error.message
      });
    }
  }

  /**
   * Get TradeIndia API status and configuration info
   * GET /api/tradeindia/status
   */
  async getStatus(req, res) {
    try {
      const Configuration = require('../models/Configuration');
      const config = await Configuration.getTradeIndiaConfiguration();
      
      if (!config) {
        return res.json({
          success: false,
          message: 'TradeIndia configuration not found',
          configured: false
        });
      }

      res.json({
        success: true,
        configured: true,
        hasApiKey: !!config.api_key,
        hasApiSecret: !!config.api_secret,
        webhookUrl: config.webhook_url,
        // Don't expose sensitive data
        tokenConfigured: !!(config.access_token || config.refresh_token)
      });
    } catch (error) {
      logger.error('Error getting TradeIndia status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get status',
        error: error.message
      });
    }
  }
}

module.exports = new TradeIndiaController();

