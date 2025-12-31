const PushNotificationConfig = require('../models/PushNotificationConfig');
const FCMToken = require('../models/FCMToken');
const firebaseService = require('../services/firebaseService');
const logger = require('../utils/logger');

class PushNotificationController {
  async getConfig(req, res) {
    try {
      const config = await PushNotificationConfig.get();
      
      if (!config) {
        return res.json({
          success: true,
          data: {
            firebase_project_id: '',
            firebase_client_email: '',
            firebase_private_key: '',
            firebase_messaging_sender_id: '',
            firebase_app_id: '',
            firebase_public_vapid_key: '',
            notification_enabled: false
          }
        });
      }

      res.json({
        success: true,
        data: {
          firebase_project_id: config.firebase_project_id,
          firebase_client_email: config.firebase_client_email,
          firebase_private_key: config.firebase_private_key,
          firebase_messaging_sender_id: config.firebase_messaging_sender_id,
          firebase_app_id: config.firebase_app_id,
          firebase_public_vapid_key: config.firebase_public_vapid_key,
          notification_enabled: config.notification_enabled
        }
      });
    } catch (error) {
      logger.error('Error getting push notification config:', error);
      res.status(500).json({ success: false, message: 'Failed to get configuration', error: error.message });
    }
  }

  async saveConfig(req, res) {
    try {
      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Only SuperAdmin can update push notification configuration' });
      }

      const {
        firebase_project_id,
        firebase_client_email,
        firebase_private_key,
        firebase_messaging_sender_id,
        firebase_app_id,
        firebase_public_vapid_key,
        notification_enabled
      } = req.body;

      if (!firebase_project_id || !firebase_client_email || !firebase_private_key || 
          !firebase_messaging_sender_id || !firebase_app_id || !firebase_public_vapid_key) {
        return res.status(400).json({
          success: false,
          message: 'All Firebase configuration fields are required'
        });
      }

      const config = await PushNotificationConfig.save({
        firebase_project_id,
        firebase_client_email,
        firebase_private_key,
        firebase_messaging_sender_id,
        firebase_app_id,
        firebase_public_vapid_key,
        notification_enabled: notification_enabled === true || notification_enabled === 'true'
      });

      await firebaseService.reinitialize();

      res.json({
        success: true,
        message: 'Push notification configuration saved successfully',
        data: {
          id: config.id,
          notification_enabled: config.notification_enabled
        }
      });
    } catch (error) {
      logger.error('Error saving push notification config:', error);
      res.status(500).json({ success: false, message: 'Failed to save configuration', error: error.message });
    }
  }

  async getPublicVapidKey(req, res) {
    try {
      const config = await PushNotificationConfig.get();
      
      if (!config || !config.notification_enabled) {
        return res.json({
          success: true,
          vapid_key: null,
          enabled: false
        });
      }

      res.json({
        success: true,
        vapid_key: config.firebase_public_vapid_key,
        enabled: true
      });
    } catch (error) {
      logger.error('Error getting VAPID key:', error);
      res.status(500).json({ success: false, message: 'Failed to get VAPID key', error: error.message });
    }
  }

  async saveToken(req, res) {
    try {
      const { token, browser, device_type, user_agent } = req.body;
      const userEmail = req.user.email;

      if (!token) {
        return res.status(400).json({ success: false, message: 'Token is required' });
      }

      const deviceType = device_type || (user_agent?.includes('Mobile') ? 'mobile' : 'desktop');
      const savedToken = await FCMToken.save(userEmail, token, browser, deviceType, user_agent);

      res.json({
        success: true,
        message: 'FCM token saved successfully',
        data: savedToken
      });
    } catch (error) {
      logger.error('Error saving FCM token:', error);
      res.status(500).json({ success: false, message: 'Failed to save token', error: error.message });
    }
  }

  async sendTestNotification(req, res) {
    try {
      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Only SuperAdmin can send test notifications' });
      }

      const { user_email, title, body } = req.body;

      if (!user_email || !title || !body) {
        return res.status(400).json({
          success: false,
          message: 'user_email, title, and body are required'
        });
      }

      const result = await firebaseService.sendWebPushNotification(
        user_email,
        title,
        body,
        { test: 'true', url: '/' }
      );

      res.json({
        success: result.success,
        message: result.success ? 'Test notification sent' : 'Failed to send notification',
        data: result
      });
    } catch (error) {
      logger.error('Error sending test notification:', error);
      res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
    }
  }
}

module.exports = new PushNotificationController();

