const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { query } = require('../config/database');

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
          this.io.to(`user:${normalizedEmail}`).emit('notification', {
            ...notification,
            details: typeof notification.details === 'string' 
              ? JSON.parse(notification.details) 
              : notification.details
          });
        }
      }

      return notifications;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
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
      const result = await query('SELECT email FROM super_admins');
      return result.rows.map(row => row.email);
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
    
    if (recipients.length > 0) {
      return this.sendNotification(recipients, notificationData);
    }
    
    return [];
  }

  async notifyLeadAssigned(leadData, assignedTo, performedBy) {
    const customerName = leadData.customer || leadData.name || 'N/A';
    
    const salespersonNotif = {
      type: 'lead_assigned',
      title: '🎯 New Lead Assigned',
      message: `${customerName} has been assigned to you by ${performedBy}`,
      details: {
        customer: customerName,
        business: leadData.business || 'N/A',
        product: leadData.product_names || leadData.product_type || 'N/A',
        phone: leadData.phone || 'N/A',
        state: leadData.state || 'N/A',
        assignedBy: performedBy,
        assignedAt: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    };
    
    await this.sendNotification(assignedTo, salespersonNotif);

    await this.notifyHierarchy({
      type: 'lead_activity',
      title: `📌 Lead Assigned: ${customerName}`,
      message: `${performedBy} assigned "${customerName}" (${leadData.business || 'N/A'}) to ${assignedTo} | Phone: ${leadData.phone || 'N/A'} | Product: ${leadData.product_names || leadData.product_type || 'N/A'}`,
      details: {
        action: 'lead_assigned',
        leadId: leadData.id,
        customer: customerName,
        business: leadData.business,
        product: leadData.product_names || leadData.product_type,
        phone: leadData.phone,
        state: leadData.state,
        assignedTo,
        assignedBy: performedBy,
        timestamp: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    });
  }

  async notifyLeadUpdated(leadData, updatedBy, changes) {
    const customerName = leadData.customer || leadData.name || 'N/A';
    const changesText = Object.keys(changes).join(', ');
    
    await this.notifyHierarchy({
      type: 'lead_activity',
      title: `✏️ Lead Updated: ${customerName}`,
      message: `${updatedBy} updated "${customerName}" | Changes: ${changesText} | Status: ${changes.final_status || changes.connected_status || 'No status change'}`,
      details: {
        action: 'lead_updated',
        leadId: leadData.id,
        customer: customerName,
        business: leadData.business,
        phone: leadData.phone,
        updatedBy,
        changes,
        fieldsUpdated: changesText,
        timestamp: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    });
  }

  async notifyLeadCreated(leadData, createdBy) {
    const customerName = leadData.customer || leadData.name || 'N/A';
    
    await this.notifyHierarchy({
      type: 'lead_activity',
      title: `✨ New Lead Created: ${customerName}`,
      message: `${createdBy} created new lead "${customerName}" | Business: ${leadData.business || 'N/A'} | Phone: ${leadData.phone || 'N/A'} | Product: ${leadData.product_names || leadData.product_type || 'N/A'} | State: ${leadData.state || 'N/A'}`,
      details: {
        action: 'lead_created',
        leadId: leadData.id,
        customer: customerName,
        business: leadData.business,
        phone: leadData.phone,
        product: leadData.product_names || leadData.product_type,
        state: leadData.state,
        leadSource: leadData.lead_source,
        createdBy,
        timestamp: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    });
  }

  async notifyLeadTransferred(leadData, transferredTo, transferredFrom, reason = '') {
    const customerName = leadData.customer || leadData.name || 'N/A';
    
    const salespersonNotif = {
      type: 'lead_transferred',
      title: `🔄 Lead Transferred from ${transferredFrom}`,
      message: `${customerName} has been transferred to you | Reason: ${reason || 'Not specified'}`,
      details: {
        customer: customerName,
        business: leadData.business,
        product: leadData.product_type,
        phone: leadData.phone,
        transferredFrom,
        reason,
        transferredAt: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    };
    
    await this.sendNotification(transferredTo, salespersonNotif);

    await this.notifyHierarchy({
      type: 'lead_activity',
      title: `🔄 Lead Transferred: ${customerName}`,
      message: `${transferredFrom} transferred "${customerName}" to ${transferredTo} | Phone: ${leadData.phone || 'N/A'} | Business: ${leadData.business || 'N/A'} | Reason: ${reason || 'Not specified'}`,
      details: {
        action: 'lead_transferred',
        leadId: leadData.id,
        customer: customerName,
        business: leadData.business,
        phone: leadData.phone,
        transferredFrom,
        transferredTo,
        reason,
        timestamp: new Date().toISOString()
      },
      referenceId: leadData.id?.toString(),
      referenceType: 'lead'
    });
  }

  async notifyPaymentAdded(paymentData, addedBy) {
    const amount = Number(paymentData.amount).toLocaleString('en-IN');
    
    await this.notifyHierarchy({
      type: 'payment_activity',
      title: `💰 Payment Added: ₹${amount}`,
      message: `${addedBy} added payment of ₹${amount} from ${paymentData.customer_name} | Mode: ${paymentData.payment_mode || 'N/A'} | Date: ${paymentData.payment_date || 'N/A'} | Quotation: ${paymentData.quotation_number || 'N/A'}`,
      details: {
        action: 'payment_added',
        paymentId: paymentData.id,
        customer: paymentData.customer_name,
        amount: paymentData.amount,
        paymentMode: paymentData.payment_mode,
        paymentDate: paymentData.payment_date,
        quotationNumber: paymentData.quotation_number,
        referenceNumber: paymentData.reference_number,
        addedBy,
        timestamp: new Date().toISOString()
      },
      referenceId: paymentData.id?.toString(),
      referenceType: 'payment'
    });
  }

  async notifyQuotationCreated(quotationData, createdBy) {
    const amount = Number(quotationData.total_amount || 0).toLocaleString('en-IN');
    
    await this.notifyHierarchy({
      type: 'quotation_activity',
      title: `📄 Quotation Created: ${quotationData.quotation_number}`,
      message: `${createdBy} created quotation ${quotationData.quotation_number} for ${quotationData.customer_name} | Amount: ₹${amount} | Products: ${quotationData.items_count || 'N/A'} items`,
      details: {
        action: 'quotation_created',
        quotationNumber: quotationData.quotation_number,
        customer: quotationData.customer_name,
        totalAmount: quotationData.total_amount,
        itemsCount: quotationData.items_count,
        quotationDate: quotationData.quotation_date,
        validUntil: quotationData.valid_until,
        createdBy,
        timestamp: new Date().toISOString()
      },
      referenceId: quotationData.id?.toString(),
      referenceType: 'quotation'
    });
  }

  async notifyQuotationStatusChange(quotationData, newStatus, changedBy, notes = '') {
    const amount = Number(quotationData.total_amount || 0).toLocaleString('en-IN');
    const statusEmoji = {
      'approved': '✅',
      'rejected': '❌',
      'pending': '⏳',
      'sent': '📤'
    };
    
    await this.notifyHierarchy({
      type: 'quotation_activity',
      title: `${statusEmoji[newStatus.toLowerCase()] || '📋'} Quotation ${newStatus}: ${quotationData.quotation_number}`,
      message: `${changedBy} ${newStatus.toLowerCase()} quotation ${quotationData.quotation_number} for ${quotationData.customer_name} | Amount: ₹${amount} | Notes: ${notes || 'None'}`,
      details: {
        action: `quotation_${newStatus.toLowerCase()}`,
        quotationNumber: quotationData.quotation_number,
        customer: quotationData.customer_name,
        totalAmount: quotationData.total_amount,
        changedBy,
        newStatus,
        notes,
        timestamp: new Date().toISOString()
      },
      referenceId: quotationData.id?.toString(),
      referenceType: 'quotation'
    });
  }

  async notifyMeetingScheduled(meetingData, scheduledBy) {
    const meetingDate = new Date(meetingData.scheduled_date).toLocaleDateString('en-IN');
    
    await this.notifyHierarchy({
      type: 'meeting_activity',
      title: `📅 Meeting Scheduled: ${meetingData.customer_name}`,
      message: `${scheduledBy} scheduled meeting with ${meetingData.customer_name} | Date: ${meetingDate} | Time: ${meetingData.scheduled_time || 'N/A'} | Location: ${meetingData.location || 'N/A'} | Purpose: ${meetingData.purpose || 'N/A'}`,
      details: {
        action: 'meeting_scheduled',
        customer: meetingData.customer_name,
        scheduledDate: meetingData.scheduled_date,
        scheduledTime: meetingData.scheduled_time,
        location: meetingData.location,
        purpose: meetingData.purpose,
        assignedTo: meetingData.assigned_to,
        scheduledBy,
        timestamp: new Date().toISOString()
      },
      referenceId: meetingData.id?.toString(),
      referenceType: 'meeting'
    });
  }

  async notifyFollowUpScheduled(followUpData, scheduledBy) {
    const followUpDate = new Date(followUpData.follow_up_date).toLocaleDateString('en-IN');
    
    await this.notifyHierarchy({
      type: 'followup_activity',
      title: `🔔 Follow-up Scheduled: ${followUpData.customer_name}`,
      message: `${scheduledBy} scheduled follow-up for ${followUpData.customer_name} | Date: ${followUpDate} | Time: ${followUpData.follow_up_time || 'N/A'} | Notes: ${followUpData.notes || 'N/A'}`,
      details: {
        action: 'followup_scheduled',
        customer: followUpData.customer_name,
        followUpDate: followUpData.follow_up_date,
        followUpTime: followUpData.follow_up_time,
        notes: followUpData.notes,
        leadStatus: followUpData.lead_status,
        scheduledBy,
        timestamp: new Date().toISOString()
      },
      referenceId: followUpData.lead_id?.toString(),
      referenceType: 'followup'
    });
  }

  async notifyFollowUpCompleted(followUpData, completedBy, outcome) {
    await this.notifyHierarchy({
      type: 'followup_activity',
      title: `✅ Follow-up Completed: ${followUpData.customer_name}`,
      message: `${completedBy} completed follow-up for ${followUpData.customer_name} | Outcome: ${outcome} | Next Status: ${followUpData.next_status || 'N/A'}`,
      details: {
        action: 'followup_completed',
        customer: followUpData.customer_name,
        outcome,
        nextStatus: followUpData.next_status,
        notes: followUpData.completion_notes,
        completedBy,
        timestamp: new Date().toISOString()
      },
      referenceId: followUpData.lead_id?.toString(),
      referenceType: 'followup'
    });
  }
}

module.exports = new NotificationService();
