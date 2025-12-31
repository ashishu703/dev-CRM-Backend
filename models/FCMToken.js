const { query } = require('../config/database');

class FCMToken {
  static async save(userEmail, token, browser = null, deviceType = null, userAgent = null) {
    const normalizedEmail = userEmail.toLowerCase().trim();
    
    const result = await query(
      `INSERT INTO fcm_tokens (user_email, token, browser, device_type, user_agent, last_used_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_email, token)
       DO UPDATE SET 
         browser = COALESCE(EXCLUDED.browser, fcm_tokens.browser),
         device_type = COALESCE(EXCLUDED.device_type, fcm_tokens.device_type),
         user_agent = COALESCE(EXCLUDED.user_agent, fcm_tokens.user_agent),
         is_active = true,
         last_used_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [normalizedEmail, token, browser, deviceType, userAgent]
    );
    return result.rows[0];
  }

  static async getByUserEmail(userEmail) {
    const normalizedEmail = userEmail.toLowerCase().trim();
    const result = await query(
      'SELECT * FROM fcm_tokens WHERE user_email = $1 AND is_active = true ORDER BY last_used_at DESC',
      [normalizedEmail]
    );
    return result.rows;
  }

  static async getByToken(token) {
    const result = await query(
      'SELECT * FROM fcm_tokens WHERE token = $1 AND is_active = true LIMIT 1',
      [token]
    );
    return result.rows[0] || null;
  }

  static async deactivateToken(token) {
    const result = await query(
      'UPDATE fcm_tokens SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE token = $1 RETURNING *',
      [token]
    );
    return result.rows[0];
  }

  static async deactivateUserTokens(userEmail) {
    const normalizedEmail = userEmail.toLowerCase().trim();
    const result = await query(
      'UPDATE fcm_tokens SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_email = $1 RETURNING *',
      [normalizedEmail]
    );
    return result.rows;
  }
}

module.exports = FCMToken;

