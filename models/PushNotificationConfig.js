const { query } = require('../config/database');

class PushNotificationConfig {
  static async get() {
    const result = await query(
      'SELECT * FROM push_notification_config ORDER BY id DESC LIMIT 1'
    );
    return result.rows[0] || null;
  }

  static async save(config) {
    await query('DELETE FROM push_notification_config');
    
    const result = await query(
      `INSERT INTO push_notification_config (
        firebase_project_id, firebase_client_email, firebase_private_key,
        firebase_messaging_sender_id, firebase_app_id, firebase_public_vapid_key,
        notification_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        config.firebase_project_id,
        config.firebase_client_email,
        config.firebase_private_key,
        config.firebase_messaging_sender_id,
        config.firebase_app_id,
        config.firebase_public_vapid_key,
        config.notification_enabled || false
      ]
    );
    return result.rows[0];
  }
}

module.exports = PushNotificationConfig;

