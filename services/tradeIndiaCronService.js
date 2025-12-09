const cron = require('node-cron');
const tradeIndiaService = require('./tradeIndiaService');
const logger = require('../utils/logger');

/**
 * TradeIndia Cron Job Service
 * Handles scheduled automatic fetching of leads from TradeIndia
 */
class TradeIndiaCronService {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  /**
   * Start the cron job
   * @param {string} schedule - Cron schedule expression (default: every 15 minutes)
   */
  start(schedule = '*/15 * * * *') {
    if (this.job) {
      logger.warn('TradeIndia cron job is already running');
      return;
    }

    logger.info(`Starting TradeIndia cron job with schedule: ${schedule}`);
    
    this.job = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        logger.warn('TradeIndia cron job is already executing, skipping this run');
        return;
      }

      this.isRunning = true;
      logger.info('⏰ Running TradeIndia auto-fetch cron job...');

      try {
        const result = await tradeIndiaService.fetchAndSaveAllLeads('system@tradeindia.cron');
        logger.info(`TradeIndia cron job completed: ${result.total.saved} leads saved`);
        
        if (result.total.errors.length > 0) {
          logger.warn(`TradeIndia cron job had ${result.total.errors.length} errors`);
        }
      } catch (error) {
        logger.error('TradeIndia cron job failed:', error.message);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    logger.info('TradeIndia cron job started successfully');
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('TradeIndia cron job stopped');
    }
  }

  /**
   * Restart the cron job with a new schedule
   * @param {string} schedule - New cron schedule expression
   */
  restart(schedule = '*/15 * * * *') {
    this.stop();
    this.start(schedule);
  }

  /**
   * Get cron job status
   */
  getStatus() {
    return {
      isRunning: !!this.job && this.isRunning,
      isScheduled: !!this.job
    };
  }
}

// Create singleton instance
const tradeIndiaCronService = new TradeIndiaCronService();

// Start cron job when module is loaded (if enabled via environment variable)
if (process.env.TRADEINDIA_CRON_ENABLED === 'true') {
  const schedule = process.env.TRADEINDIA_CRON_SCHEDULE || '*/15 * * * *';
  tradeIndiaCronService.start(schedule);
}

module.exports = tradeIndiaCronService;

