const admin = require('firebase-admin');
const logger = require('../utils/logger');
const PushNotificationConfig = require('../models/PushNotificationConfig');

class FirebaseService {
  constructor() {
    this.app = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized && this.app) {
      return this.app;
    }

    try {
      const config = await PushNotificationConfig.get();
      
      if (!config || !config.notification_enabled) {
        logger.info('Firebase push notifications are disabled');
        return null;
      }

      if (!config.firebase_project_id || !config.firebase_client_email || !config.firebase_private_key) {
        logger.warn('Firebase configuration incomplete');
        return null;
      }

      const privateKey = config.firebase_private_key.replace(/\\n/g, '\n');

      if (this.app) {
        this.app.delete();
      }

      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase_project_id,
          clientEmail: config.firebase_client_email,
          privateKey: privateKey
        })
      }, 'push-notifications');

      this.isInitialized = true;
      logger.info('Firebase Admin SDK initialized successfully');
      return this.app;
    } catch (error) {
      logger.error('Failed to initialize Firebase:', error);
      this.isInitialized = false;
      this.app = null;
      return null;
    }
  }

  async reinitialize() {
    this.isInitialized = false;
    if (this.app) {
      try {
        await this.app.delete();
      } catch (error) {
        logger.warn('Error deleting Firebase app:', error);
      }
      this.app = null;
    }
    return this.initialize();
  }

  async sendWebPushNotification(userEmail, title, body, data = {}) {
    try {
      if (!this.isInitialized || !this.app) {
        await this.initialize();
        if (!this.isInitialized || !this.app) {
          logger.warn('Firebase not initialized, skipping push notification');
          return { success: false, error: 'Firebase not initialized' };
        }
      }

      const FCMToken = require('../models/FCMToken');
      const tokens = await FCMToken.getByUserEmail(userEmail);

      if (!tokens || tokens.length === 0) {
        logger.warn(`No FCM tokens found for user: ${userEmail}`);
        return { success: false, error: 'No tokens found' };
      }

      const fcmTokens = tokens.map(t => t.token).filter(Boolean);

      if (fcmTokens.length === 0) {
        return { success: false, error: 'No valid tokens' };
      }

          const message = {
            notification: {
              title,
              body
            },
            data: {
              ...data,
              click_action: data.url || '/'
            },
            tokens: fcmTokens
          };

      const response = await admin.messaging(this.app).sendEachForMulticast(message);

      const results = {
        successCount: response.successCount,
        failureCount: response.failureCount,
        results: response.responses.map((resp, idx) => ({
          token: fcmTokens[idx],
          success: resp.success,
          error: resp.error
        }))
      };

      for (let i = 0; i < response.responses.length; i++) {
        const resp = response.responses[i];
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code;
          if (errorCode === 'messaging/invalid-registration-token' || 
              errorCode === 'messaging/registration-token-not-registered') {
            await FCMToken.deactivateToken(fcmTokens[i]);
            logger.info(`Deactivated invalid token for user: ${userEmail}`);
          }
        }
      }

      logger.info(`Push notification sent to ${userEmail}: ${results.successCount} success, ${results.failureCount} failed`);
      return { success: true, ...results };
    } catch (error) {
      logger.error('Error sending push notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendToToken(token, title, body, data = {}) {
    try {
      if (!this.isInitialized || !this.app) {
        await this.initialize();
        if (!this.isInitialized || !this.app) {
          return { success: false, error: 'Firebase not initialized' };
        }
      }

      const message = {
        notification: { title, body },
        data: {
          ...data,
          click_action: data.url || '/'
        },
        token
      };

      const response = await admin.messaging(this.app).send(message);
      return { success: true, messageId: response };
    } catch (error) {
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        const FCMToken = require('../models/FCMToken');
        await FCMToken.deactivateToken(token);
      }
      return { success: false, error: error.message };
    }
  }

  getPublicVapidKey() {
    return PushNotificationConfig.get().then(config => {
      return config?.firebase_public_vapid_key || null;
    });
  }
}

module.exports = new FirebaseService();

