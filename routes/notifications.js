const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const email = (req.user?.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const isRead = req.query.is_read !== undefined ? req.query.is_read === 'true' : null;

    const notifications = await Notification.getByUserEmail(email, { limit, offset, isRead });
    const unreadCount = await Notification.getUnreadCount(email);

    const formattedNotifications = notifications.map(n => {
      // Convert timestamp to ISO string (UTC) for consistent timezone handling
      let timeValue = n.created_at;
      if (timeValue && !(timeValue instanceof Date)) {
        // If it's a string or other format, convert to Date then ISO
        const date = new Date(timeValue);
        timeValue = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
      } else if (timeValue instanceof Date) {
        timeValue = timeValue.toISOString();
      } else {
        timeValue = new Date().toISOString();
      }
      
      return {
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        time: timeValue,
        unread: !n.is_read,
        details: typeof n.details === 'string' ? JSON.parse(n.details) : n.details,
        referenceId: n.reference_id,
        referenceType: n.reference_type
      };
    });

    res.json({ 
      success: true, 
      data: formattedNotifications,
      unreadCount,
      total: formattedNotifications.length
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load notifications', error: e.message });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const email = (req.user?.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    const count = await Notification.getUnreadCount(email);
    res.json({ success: true, count });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to get unread count', error: e.message });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const email = (req.user?.email || '').toLowerCase();
    
    const notification = await Notification.markAsRead(id, email);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, data: notification });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to mark as read', error: e.message });
  }
});

// PATCH /api/notifications/:id/unread - Mark notification as unread
router.patch('/:id/unread', async (req, res) => {
  try {
    const { id } = req.params;
    const email = (req.user?.email || '').toLowerCase();
    
    const notification = await Notification.markAsUnread(id, email);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, data: notification });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to mark as unread', error: e.message });
  }
});

// POST /api/notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const email = (req.user?.email || '').toLowerCase();
    const count = await Notification.markAllAsRead(email);
    
    res.json({ success: true, message: `${count} notifications marked as read`, count });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to mark all as read', error: e.message });
  }
});

module.exports = router;


