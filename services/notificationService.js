const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const DepartmentUser = require('../models/DepartmentUser');
const DepartmentHead = require('../models/DepartmentHead');
const SuperAdmin = require('../models/SuperAdmin');
const firebaseService = require('./firebaseService');

class NotificationService {
  constructor() {
    this.io = null;
  }

  initialize(io) {
    this.io = io;
    logger.info('NotificationService initialized with Socket.IO');
  }

  async sendNotification(userEmails, notificationData) {
    try {
      const emails = Array.isArray(userEmails) ? userEmails : [userEmails];
      const notifications = [];

      for (const email of emails) {
        if (!email) continue;
        
        const normalizedEmail = email.toLowerCase().trim();
        const notification = await Notification.create({
          userEmail: normalizedEmail,
          ...notificationData
        });
        
        notifications.push(notification);

        if (this.io) {
          const notificationPayload = {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            time: notification.created_at,
            unread: !notification.is_read,
            details: typeof notification.details === 'string' 
              ? JSON.parse(notification.details) 
              : notification.details,
            referenceId: notification.reference_id,
            referenceType: notification.reference_type
          };
          
          this.io.to(`user:${normalizedEmail}`).emit('notification', notificationPayload);
        }

        firebaseService.sendWebPushNotification(
          normalizedEmail,
          notificationData.title,
          notificationData.message,
          {
            notificationId: notification.id?.toString(),
            type: notificationData.type,
            url: '/'
          }
        ).catch(error => {
          logger.warn(`Firebase push notification failed for ${normalizedEmail}:`, error.message);
        });
      }

      return notifications;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  async getUsernameFromEmail(email) {
    if (!email) return email;
    
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      let user = await DepartmentUser.findByEmail(normalizedEmail, true);
      if (user?.username) return user.username;
      
      user = await DepartmentHead.findByEmail(normalizedEmail, true);
      if (user?.username) return user.username;
      
      user = await SuperAdmin.findByEmail(normalizedEmail);
      if (user?.username) return user.username;
      
      return email.split('@')[0] || email;
    } catch (error) {
      return email.split('@')[0] || email;
    }
  }

  async getDepartmentHeads(departmentType = null) {
    try {
      const sql = departmentType
        ? 'SELECT email FROM department_heads WHERE is_active = true AND department_type = $1'
        : 'SELECT email FROM department_heads WHERE is_active = true';
      const params = departmentType ? [departmentType] : [];
      const result = await query(sql, params);
      return result.rows.map(row => row.email);
    } catch (error) {
      logger.error('Error fetching department heads:', error);
      return [];
    }
  }

  async getSuperAdmins() {
    try {
      const result = await query('SELECT email FROM superadmins WHERE email IS NOT NULL');
      return result.rows.map(row => row.email).filter(Boolean);
    } catch (error) {
      logger.error('Error fetching super admins:', error);
      return [];
    }
  }

  async notifyHierarchy(notificationData, includeHeads = true, includeSuperAdmins = true, departmentType = null) {
    const recipients = [];
    
    if (includeHeads) {
      const heads = await this.getDepartmentHeads(departmentType);
      recipients.push(...heads);
    }
    
    if (includeSuperAdmins) {
      const admins = await this.getSuperAdmins();
      recipients.push(...admins);
    }
    
    return recipients.length > 0 ? this.sendNotification(recipients, notificationData) : [];
  }

  _buildLeadDetails(leadData) {
    return {
      customer: leadData.customer || leadData.name || 'N/A',
      business: leadData.business || 'N/A',
      product: leadData.product_names || leadData.product_type || 'N/A',
      phone: leadData.phone || 'N/A',
      state: leadData.state || 'N/A'
    };
  }

  async notifyLeadAssigned(leadData, assignedToEmail, performedByEmail) {
    const details = this._buildLeadDetails(leadData);
    const assignedToUsername = await this.getUsernameFromEmail(assignedToEmail);
    const performedByUsername = await this.getUsernameFromEmail(performedByEmail);
    
    await this.sendNotification(assignedToEmail, {
      type: 'lead_assigned',
      title: '🎯 New Lead Assigned',
      message: `${performedByUsername} assigned "${details.customer}" to you`,
      details: {
        ...details,
        assignedBy: performedByUsername,
        assignedAt: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    });

    await this.notifyHierarchy({
      type: 'lead_activity',
      title: `📌 Lead Assigned: ${details.customer}`,
      message: `${performedByUsername} assigned "${details.customer}" to ${assignedToUsername} | Business: ${details.business} | Phone: ${details.phone}`,
      details: {
        action: 'lead_assigned',
        leadId: leadData.id,
        ...details,
        assignedTo: assignedToUsername,
        assignedBy: performedByUsername,
        timestamp: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    });
  }

  async notifyLeadUpdated(leadData, updatedByEmail, changes) {
    const details = this._buildLeadDetails(leadData);
    const updatedByUsername = await this.getUsernameFromEmail(updatedByEmail);
    const changesText = Object.keys(changes).join(', ');
    
    await this.notifyHierarchy({
      type: 'lead_activity',
      title: `✏️ Lead Updated: ${details.customer}`,
      message: `${updatedByUsername} updated "${details.customer}" | Changes: ${changesText} | Status: ${changes.final_status || changes.connected_status || 'No status change'}`,
      details: {
        action: 'lead_updated',
        leadId: leadData.id,
        ...details,
        updatedBy: updatedByUsername,
        changes,
        fieldsUpdated: changesText,
        timestamp: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    });
  }

  async notifyLeadCreated(leadData, createdByEmail) {
    const details = this._buildLeadDetails(leadData);
    const createdByUsername = await this.getUsernameFromEmail(createdByEmail);
    
    await this.notifyHierarchy({
      type: 'lead_activity',
      title: `✨ New Lead Created: ${details.customer}`,
      message: `${createdByUsername} created new lead "${details.customer}" | Business: ${details.business} | Phone: ${details.phone} | Product: ${details.product}`,
      details: {
        action: 'lead_created',
        leadId: leadData.id,
        ...details,
        leadSource: leadData.lead_source,
        createdBy: createdByUsername,
        timestamp: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    });
  }

  async notifyLeadTransferred(leadData, transferredToEmail, transferredFromEmail, reason = '') {
    if (!leadData || !transferredToEmail) return;

    try {
      const details = this._buildLeadDetails(leadData);
      const transferredToUsername = await this.getUsernameFromEmail(transferredToEmail);
      const transferredFromUsername = await this.getUsernameFromEmail(transferredFromEmail);
      const reasonText = reason || 'Not specified';
      const methodText = reason.includes('edit form') ? 'via edit form' : reason.includes('transfer') ? 'via transfer' : '';
      
      await this.sendNotification(transferredToEmail, {
        type: 'lead_transferred',
        title: `🔄 Lead Transferred`,
        message: `${transferredFromUsername} transferred "${details.customer}" to ${transferredToUsername} ${methodText} | Reason: ${reasonText}`,
        details: {
          ...details,
          transferredFrom: transferredFromUsername,
          transferredTo: transferredToUsername,
          reason: reasonText,
          transferredAt: new Date().toISOString()
        },
        referenceId: leadData.id?.toString(),
        referenceType: 'lead'
      });

      await this.notifyHierarchy({
        type: 'lead_activity',
        title: `🔄 Lead Transferred: ${details.customer}`,
        message: `${transferredFromUsername} transferred "${details.customer}" to ${transferredToUsername} ${methodText} | Phone: ${details.phone} | Business: ${details.business} | Reason: ${reasonText}`,
        details: {
          action: 'lead_transferred',
          leadId: leadData.id,
          ...details,
          transferredFrom: transferredFromUsername,
          transferredTo: transferredToUsername,
          reason: reasonText,
          timestamp: new Date().toISOString()
        },
        referenceId: leadData.id?.toString(),
        referenceType: 'lead'
      });
    } catch (error) {
      logger.error('Error in notifyLeadTransferred:', error);
      throw error;
    }
  }

  async notifyPaymentAdded(paymentData, addedByEmail) {
    const amount = Number(paymentData.amount).toLocaleString('en-IN');
    const addedByUsername = await this.getUsernameFromEmail(addedByEmail);
    
    await this.notifyHierarchy({
      type: 'payment_activity',
      title: `💰 Payment Added: ₹${amount}`,
      message: `${addedByUsername} added payment of ₹${amount} from ${paymentData.customer_name} | Mode: ${paymentData.payment_mode || 'N/A'} | Date: ${paymentData.payment_date || 'N/A'}`,
      details: {
        action: 'payment_added',
        paymentId: paymentData.id,
        customer: paymentData.customer_name,
        amount: paymentData.amount,
        paymentMode: paymentData.payment_mode,
        paymentDate: paymentData.payment_date,
        quotationNumber: paymentData.quotation_number,
        referenceNumber: paymentData.reference_number,
        addedBy: addedByUsername,
        timestamp: new Date().toISOString()
      },
      referenceId: paymentData.id?.toString(),
      referenceType: 'payment'
    });
  }

  async notifyQuotationCreated(quotationData, createdByEmail) {
    const amount = Number(quotationData.total_amount || 0).toLocaleString('en-IN');
    const createdByUsername = await this.getUsernameFromEmail(createdByEmail);
    
    await this.notifyHierarchy({
      type: 'quotation_activity',
      title: `📄 Quotation Created: ${quotationData.quotation_number}`,
      message: `${createdByUsername} created quotation ${quotationData.quotation_number} for ${quotationData.customer_name} | Amount: ₹${amount} | Products: ${quotationData.items_count || 'N/A'} items`,
      details: {
        action: 'quotation_created',
        quotationNumber: quotationData.quotation_number,
        customer: quotationData.customer_name,
        totalAmount: quotationData.total_amount,
        itemsCount: quotationData.items_count,
        quotationDate: quotationData.quotation_date,
        validUntil: quotationData.valid_until,
        createdBy: createdByUsername,
        timestamp: new Date().toISOString()
      },
      referenceId: quotationData.id?.toString(),
      referenceType: 'quotation'
    });
  }

  async notifyQuotationStatusChange(quotationData, newStatus, changedByEmail, notes = '') {
    const amount = Number(quotationData.total_amount || 0).toLocaleString('en-IN');
    const changedByUsername = await this.getUsernameFromEmail(changedByEmail);
    const statusEmoji = { approved: '✅', rejected: '❌', pending: '⏳', sent: '📤' };
    
    await this.notifyHierarchy({
      type: 'quotation_activity',
      title: `${statusEmoji[newStatus.toLowerCase()] || '📋'} Quotation ${newStatus}: ${quotationData.quotation_number}`,
      message: `${changedByUsername} ${newStatus.toLowerCase()} quotation ${quotationData.quotation_number} for ${quotationData.customer_name} | Amount: ₹${amount} | Notes: ${notes || 'None'}`,
      details: {
        action: `quotation_${newStatus.toLowerCase()}`,
        quotationNumber: quotationData.quotation_number,
        customer: quotationData.customer_name,
        totalAmount: quotationData.total_amount,
        changedBy: changedByUsername,
        newStatus,
        notes,
        timestamp: new Date().toISOString()
      },
      referenceId: quotationData.id?.toString(),
      referenceType: 'quotation'
    });
  }

  async notifyMeetingScheduled(meetingData, scheduledByEmail) {
    const meetingDate = new Date(meetingData.scheduled_date).toLocaleDateString('en-IN');
    const scheduledByUsername = await this.getUsernameFromEmail(scheduledByEmail);
    
    await this.notifyHierarchy({
      type: 'meeting_activity',
      title: `📅 Meeting Scheduled: ${meetingData.customer_name}`,
      message: `${scheduledByUsername} scheduled meeting with ${meetingData.customer_name} | Date: ${meetingDate} | Time: ${meetingData.scheduled_time || 'N/A'} | Location: ${meetingData.location || 'N/A'}`,
      details: {
        action: 'meeting_scheduled',
        customer: meetingData.customer_name,
        scheduledDate: meetingData.scheduled_date,
        scheduledTime: meetingData.scheduled_time,
        location: meetingData.location,
        purpose: meetingData.purpose,
        assignedTo: meetingData.assigned_to,
        scheduledBy: scheduledByUsername,
        timestamp: new Date().toISOString()
      },
      referenceId: meetingData.id?.toString(),
      referenceType: 'meeting'
    });
  }

  async notifyFollowUpScheduled(followUpData, scheduledByEmail) {
    const followUpDate = new Date(followUpData.follow_up_date).toLocaleDateString('en-IN');
    const scheduledByUsername = await this.getUsernameFromEmail(scheduledByEmail);
    
    await this.notifyHierarchy({
      type: 'followup_activity',
      title: `🔔 Follow-up Scheduled: ${followUpData.customer_name}`,
      message: `${scheduledByUsername} scheduled follow-up for ${followUpData.customer_name} | Date: ${followUpDate} | Time: ${followUpData.follow_up_time || 'N/A'}`,
      details: {
        action: 'followup_scheduled',
        customer: followUpData.customer_name,
        followUpDate: followUpData.follow_up_date,
        followUpTime: followUpData.follow_up_time,
        notes: followUpData.notes,
        leadStatus: followUpData.lead_status,
        scheduledBy: scheduledByUsername,
        timestamp: new Date().toISOString()
      },
      referenceId: followUpData.lead_id?.toString(),
      referenceType: 'followup'
    });
  }

  async notifyFollowUpCompleted(followUpData, completedByEmail, outcome) {
    const completedByUsername = await this.getUsernameFromEmail(completedByEmail);
    
    await this.notifyHierarchy({
      type: 'followup_activity',
      title: `✅ Follow-up Completed: ${followUpData.customer_name}`,
      message: `${completedByUsername} completed follow-up for ${followUpData.customer_name} | Outcome: ${outcome} | Next Status: ${followUpData.next_status || 'N/A'}`,
      details: {
        action: 'followup_completed',
        customer: followUpData.customer_name,
        outcome,
        nextStatus: followUpData.next_status,
        notes: followUpData.completion_notes,
        completedBy: completedByUsername,
        timestamp: new Date().toISOString()
      },
      referenceId: followUpData.lead_id?.toString(),
      referenceType: 'followup'
    });
  }
}

module.exports = new NotificationService();
