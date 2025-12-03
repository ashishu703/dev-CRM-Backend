const { query } = require('../config/database');
const logger = require('../utils/logger');
const cloudinaryService = require('../services/cloudinaryService');
const DepartmentUser = require('../models/DepartmentUser');
const DepartmentHead = require('../models/DepartmentHead');

class TicketController {
  static async generateTicketId() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    
    const result = await query(
      `SELECT COUNT(*) as count FROM tickets WHERE ticket_id LIKE $1`,
      [`TIK-${month}${year}%`]
    );
    
    const count = parseInt(result.rows[0].count) + 1;
    return `TIK-${month}${year}${String(count).padStart(2, '0')}`;
  }

  async create(req, res) {
    try {
      const { name, email, phone, department = 'IT Department', priority, subject, description } = req.body;

      if (!name || !email || !priority || !subject || !description) {
        return res.status(400).json({
          success: false,
          message: 'Please provide all required fields: name, email, priority, subject, and description'
        });
      }

      const ticketId = await TicketController.generateTicketId();
      let fileUrl = null;
      let fileName = null;
      let fileSize = null;

      if (req.file) {
        const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
        fileUrl = await cloudinaryService.uploadFile(req.file.buffer, {
          folder: 'tickets',
          resourceType,
          publicId: `ticket-${Date.now()}-${Math.round(Math.random() * 1E9)}`
        });
        fileName = req.file.originalname;
        fileSize = req.file.size;
        logger.info('Ticket image uploaded to Cloudinary', { url: fileUrl });
      }

      const statusHistory = [{
        status: 'Open',
        timestamp: new Date().toISOString(),
        message: 'Ticket created and submitted',
        ...(fileUrl && { imageUrl: fileUrl, imageName: fileName })
      }];

      const slaHours = { critical: 1, high: 4, medium: 8, low: 24 };
      const slaRemaining = `${slaHours[priority] || 24}h remaining`;

      const result = await query(
        `INSERT INTO tickets (
          ticket_id, title, description, created_by_name, created_by_email, 
          created_by_phone, department, priority, status, file_path, file_name, 
          file_size, status_history, sla_remaining
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING ticket_id, title, status, created_at, sla_remaining`,
        [
          ticketId, subject, description, name, email, phone || null, department,
          priority, 'Open', fileUrl, fileName, fileSize,
          JSON.stringify(statusHistory), slaRemaining
        ]
      );

      const ticket = result.rows[0];
      logger.info('Ticket created successfully', { ticketId: ticket.ticket_id });

      res.status(201).json({
        success: true,
        message: `Ticket ${ticket.ticket_id} created successfully`,
        data: {
          id: ticket.ticket_id,
          ticketId: ticket.ticket_id,
          title: ticket.title,
          status: ticket.status,
          createdAt: ticket.created_at,
          sla: ticket.sla_remaining
        }
      });
    } catch (error) {
      logger.error('Create ticket error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to create ticket. Please try again or contact support if the issue persists.',
        error: error.message
      });
    }
  }

  async getAll(req, res) {
    try {
      const { status, priority, search, assignedTo } = req.query;
      let queryText = `
        SELECT ticket_id as id, title, created_by_name as "createdBy",
               assigned_to as "assignedTo", priority, status,
               created_at as "createdAt", sla_remaining as sla,
               description, status_history as "statusHistory",
               file_path as "filePath", file_name as "fileName"
        FROM tickets WHERE department = 'IT Department'
      `;
      const params = [];
      let paramCount = 1;

      if (assignedTo) {
        queryText += ` AND LOWER(assigned_to) = LOWER($${paramCount})`;
        params.push(assignedTo);
        paramCount++;
      }

      if (status && status !== 'all') {
        queryText += ` AND status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (priority && priority !== 'all') {
        queryText += ` AND priority = $${paramCount}`;
        params.push(priority);
        paramCount++;
      }

      if (search) {
        queryText += ` AND (title ILIKE $${paramCount} OR ticket_id ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      queryText += ` ORDER BY created_at DESC`;
      const result = await query(queryText, params);

      const tickets = result.rows.map(ticket => {
        const fileUrl = ticket.filePath?.startsWith('http') ? ticket.filePath : null;
        let statusHistory = Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
        
        if (fileUrl && statusHistory.length > 0 && !statusHistory[0].imageUrl) {
          statusHistory = statusHistory.map((entry, idx) => 
            idx === 0 ? { ...entry, imageUrl: fileUrl, imageName: ticket.fileName } : entry
          );
        }

        const latestResolution = statusHistory
          .filter(entry => entry.message && entry.message.trim() !== '' && 
                  !entry.message.includes('Status changed to') && 
                  !entry.message.includes('Ticket assigned to'))
          .slice(-1)[0]?.message || null;

        return {
          ...ticket,
          fileUrl,
          resolution: latestResolution,
          createdAt: ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: true
          }) : null,
          statusHistory
        };
      });

      res.json({ success: true, data: tickets });
    } catch (error) {
      logger.error('Get tickets error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to fetch tickets. Please refresh the page or contact support.',
        error: error.message
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT ticket_id as id, title, description, created_by_name as "createdBy",
               created_by_email as "createdByEmail", created_by_phone as "createdByPhone",
               assigned_to as "assignedTo", priority, status, created_at as "createdAt",
               sla_remaining as sla, status_history as "statusHistory",
               file_path as "filePath", file_name as "fileName"
        FROM tickets WHERE ticket_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Ticket ${id} not found`
        });
      }

      const ticket = result.rows[0];
      const fileUrl = ticket.filePath?.startsWith('http') ? ticket.filePath : null;
      let statusHistory = Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
      
      if (fileUrl && statusHistory.length > 0 && !statusHistory[0].imageUrl) {
        statusHistory = statusHistory.map((entry, idx) => 
          idx === 0 ? { ...entry, imageUrl: fileUrl, imageName: ticket.fileName } : entry
        );
      }

      const latestResolution = statusHistory
        .filter(entry => entry.message && entry.message.trim() !== '')
        .slice(-1)[0]?.message || null;

      ticket.fileUrl = fileUrl;
      ticket.resolution = latestResolution;
      ticket.createdAt = ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
      }) : null;
      ticket.statusHistory = statusHistory;

      res.json({ success: true, data: ticket });
    } catch (error) {
      logger.error('Get ticket by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to fetch ticket details. Please try again.',
        error: error.message
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { assignedTo, status, resolution } = req.body;

      const currentResult = await query(
        `SELECT status, status_history FROM tickets WHERE ticket_id = $1`,
        [id]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Ticket ${id} not found`
        });
      }

      const currentTicket = currentResult.rows[0];
      let statusHistory = Array.isArray(currentTicket.status_history) ? currentTicket.status_history : [];
      const updates = [];
      const params = [];
      let paramCount = 1;

      if (assignedTo !== undefined) {
        updates.push(`assigned_to = $${paramCount}`);
        params.push(assignedTo);
        paramCount++;

        if (assignedTo && currentTicket.status === 'Open') {
          updates.push(`status = $${paramCount}`);
          params.push('In Progress');
          paramCount++;
          
          let assignedUserName = assignedTo;
          try {
            const user = await DepartmentUser.findByEmail(assignedTo) || await DepartmentUser.findByUsername(assignedTo);
            if (user) {
              assignedUserName = user.username || assignedTo;
            }
          } catch (err) {
            logger.warn('Could not fetch user name for assignment', { email: assignedTo });
          }
          
          statusHistory.push({
            status: 'In Progress',
            timestamp: new Date().toISOString(),
            message: `Ticket assigned to ${assignedUserName}`
          });
        }
      }

      if (status !== undefined && status !== currentTicket.status) {
        updates.push(`status = $${paramCount}`);
        params.push(status);
        paramCount++;

        let imageUrl = null;
        let imageName = null;

        if (req.file) {
          const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
          imageUrl = await cloudinaryService.uploadFile(req.file.buffer, {
            folder: 'tickets',
            resourceType,
            publicId: `ticket-${Date.now()}-${Math.round(Math.random() * 1E9)}`
          });
          imageName = req.file.originalname;
          logger.info('Ticket resolution image uploaded to Cloudinary', { url: imageUrl });
        }

        const statusMessage = status === 'Resolved' 
          ? (resolution || 'resolved')
          : status === 'Closed'
          ? (resolution || 'Status changed to Closed')
          : `Status changed to ${status}`;
        
        statusHistory.push({
          status,
          timestamp: new Date().toISOString(),
          message: statusMessage,
          ...(imageUrl && { imageUrl, imageName })
        });
      } else if (resolution !== undefined && resolution.trim() !== '' && req.file) {
        let imageUrl = null;
        let imageName = null;

        const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
        imageUrl = await cloudinaryService.uploadFile(req.file.buffer, {
          folder: 'tickets',
          resourceType,
          publicId: `ticket-${Date.now()}-${Math.round(Math.random() * 1E9)}`
        });
        imageName = req.file.originalname;
        logger.info('Ticket resolution image uploaded to Cloudinary', { url: imageUrl });

        statusHistory.push({
          status: currentTicket.status,
          timestamp: new Date().toISOString(),
          message: resolution,
          ...(imageUrl && { imageUrl, imageName })
        });
      } else if (resolution !== undefined && resolution.trim() !== '') {
        statusHistory.push({
          status: currentTicket.status,
          timestamp: new Date().toISOString(),
          message: resolution
        });
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No changes provided to update'
        });
      }

      updates.push(`status_history = $${paramCount}`, `updated_at = CURRENT_TIMESTAMP`);
      params.push(JSON.stringify(statusHistory), id);

      await query(
        `UPDATE tickets SET ${updates.join(', ')} WHERE ticket_id = $${paramCount + 1}`,
        params
      );

      res.json({
        success: true,
        message: `Ticket ${id} updated successfully`
      });
    } catch (error) {
      logger.error('Update ticket error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to update ticket. Please try again or contact support.',
        error: error.message
      });
    }
  }

  async sendBackToHead(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (req.user.role !== 'department_user') {
        return res.status(403).json({
          success: false,
          message: 'Only department users can send tickets back to their head'
        });
      }

      if (!req.user.headUserId) {
        return res.status(400).json({
          success: false,
          message: 'User does not have an assigned department head'
        });
      }

      const DepartmentHead = require('../models/DepartmentHead');
      const departmentHead = await DepartmentHead.findById(req.user.headUserId);
      
      if (!departmentHead) {
        return res.status(404).json({
          success: false,
          message: 'Department head not found'
        });
      }

      const currentResult = await query(
        `SELECT assigned_to, status, status_history FROM tickets WHERE ticket_id = $1`,
        [id]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Ticket ${id} not found`
        });
      }

      const currentTicket = currentResult.rows[0];
      
      if (currentTicket.assigned_to !== req.user.email && currentTicket.assigned_to !== req.user.username) {
        return res.status(403).json({
          success: false,
          message: 'You can only send back tickets assigned to you'
        });
      }

      let statusHistory = Array.isArray(currentTicket.status_history) ? currentTicket.status_history : [];
      
      const headName = departmentHead.username || departmentHead.email;
      statusHistory.push({
        status: 'Open',
        timestamp: new Date().toISOString(),
        message: `Ticket sent back to ${headName}`,
        internalNote: reason || `Sent back by ${req.user.username || req.user.email}`
      });

      await query(
        `UPDATE tickets 
         SET assigned_to = $1, status = $2, status_history = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE ticket_id = $4`,
        [
          departmentHead.email,
          'Open',
          JSON.stringify(statusHistory),
          id
        ]
      );

      logger.info('Ticket sent back to department head', {
        ticketId: id,
        userId: req.user.id,
        headId: departmentHead.id
      });

      res.json({
        success: true,
        message: `Ticket sent back to department head successfully`
      });
    } catch (error) {
      logger.error('Send back to head error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to send ticket back. Please try again or contact support.',
        error: error.message
      });
    }
  }
}

module.exports = new TicketController();
