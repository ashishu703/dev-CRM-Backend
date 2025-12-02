const { query } = require('../config/database');
const logger = require('../utils/logger');

class SecurityLogService {
  async logEvent({ logType, userEmail, userName, ipAddress, severity, details }) {
    try {
      const result = await query(
        `INSERT INTO security_logs (log_type, user_email, user_name, ip_address, severity, details)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [logType, userEmail || null, userName || null, ipAddress || null, severity, details || null]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to log security event', { error: error.message, logType });
      return null;
    }
  }

  async logFailedLogin(email, ipAddress, reason = 'Invalid credentials') {
    return this.logEvent({
      logType: 'Failed Login',
      userEmail: email,
      ipAddress,
      severity: 'high',
      details: reason
    });
  }

  async logApiFailure(endpoint, method, ipAddress, errorMessage) {
    return this.logEvent({
      logType: 'API Failure',
      userEmail: 'system',
      userName: 'system',
      ipAddress,
      severity: 'medium',
      details: `${method} ${endpoint} - ${errorMessage}`
    });
  }

  async logPermissionChange(userEmail, userName, ipAddress, details) {
    return this.logEvent({
      logType: 'Permission Change',
      userEmail,
      userName,
      ipAddress,
      severity: 'medium',
      details
    });
  }

  async logPasswordReset(userEmail, userName, ipAddress) {
    return this.logEvent({
      logType: 'Password Reset',
      userEmail,
      userName,
      ipAddress,
      severity: 'low',
      details: 'Password reset requested via email'
    });
  }

  async logUserLogin(userEmail, userName, ipAddress) {
    return this.logEvent({
      logType: 'User Login',
      userEmail,
      userName,
      ipAddress,
      severity: 'low',
      details: 'Successful login'
    });
  }

  async logDataExport(userEmail, userName, ipAddress, details) {
    return this.logEvent({
      logType: 'Data Export',
      userEmail,
      userName,
      ipAddress,
      severity: 'low',
      details
    });
  }
}

module.exports = new SecurityLogService();

