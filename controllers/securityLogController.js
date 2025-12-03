const { query } = require('../config/database');
const logger = require('../utils/logger');
const DepartmentUser = require('../models/DepartmentUser');

class SecurityLogController {
  async getAll(req, res) {
    try {
      const { status, severity, logType } = req.query;
      let queryText = `
        SELECT id, log_type as "logType", user_email as "userEmail", 
               user_name as "userName", ip_address as "ipAddress",
               severity, details, assigned_to as "assignedTo", status,
               resolution, created_at as "createdAt", updated_at as "updatedAt",
               assigned_at as "assignedAt", resolved_at as "resolvedAt"
        FROM security_logs WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (status && status !== 'all') {
        queryText += ` AND status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (severity && severity !== 'all') {
        queryText += ` AND severity = $${paramCount}`;
        params.push(severity);
        paramCount++;
      }

      if (logType && logType !== 'all') {
        queryText += ` AND log_type = $${paramCount}`;
        params.push(logType);
        paramCount++;
      }

      queryText += ` ORDER BY created_at DESC`;
      const result = await query(queryText, params);

      const logs = result.rows.map(log => ({
        ...log,
        createdAt: log.createdAt ? new Date(log.createdAt).toLocaleString('en-US', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: true
        }) : null
      }));

      res.json({ success: true, data: logs });
    } catch (error) {
      logger.error('Get security logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to fetch security logs',
        error: error.message
      });
    }
  }

  async assign(req, res) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      if (!assignedTo) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user email is required'
        });
      }

      const user = await DepartmentUser.findByEmail(assignedTo) || await DepartmentUser.findByUsername(assignedTo);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Department user not found'
        });
      }

      const result = await query(
        `UPDATE security_logs 
         SET assigned_to = $1, status = 'assigned', assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, assigned_to, status, assigned_at`,
        [assignedTo, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Security log not found'
        });
      }

      logger.info('Security log assigned', { logId: id, assignedTo });

      res.json({
        success: true,
        message: 'Security log assigned successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Assign security log error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to assign security log',
        error: error.message
      });
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, resolution } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const updates = [`status = $1`, `updated_at = CURRENT_TIMESTAMP`];
      const params = [status];
      let paramCount = 2;

      if (resolution) {
        updates.push(`resolution = $${paramCount}`);
        params.push(resolution);
        paramCount++;
      }

      if (status === 'resolved' || status === 'closed') {
        updates.push(`resolved_at = CURRENT_TIMESTAMP`);
      }

      params.push(id);

      const result = await query(
        `UPDATE security_logs SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Security log not found'
        });
      }

      res.json({
        success: true,
        message: 'Security log status updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update security log status error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to update security log status',
        error: error.message
      });
    }
  }

  async sendBack(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await query(
        `UPDATE security_logs 
         SET status = 'open', assigned_to = NULL, assigned_at = NULL, updated_at = CURRENT_TIMESTAMP,
             resolution = $1
         WHERE id = $2 
         RETURNING *`,
        [reason || 'Sent back to department head', id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Security log not found'
        });
      }

      logger.info('Security log sent back', { logId: id });

      res.json({
        success: true,
        message: 'Security log sent back successfully'
      });
    } catch (error) {
      logger.error('Send back security log error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to send back security log',
        error: error.message
      });
    }
  }
}

module.exports = new SecurityLogController();

