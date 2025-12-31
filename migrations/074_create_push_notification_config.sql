-- Create push notification configuration table
-- Migration: 074_create_push_notification_config.sql

CREATE TABLE IF NOT EXISTS push_notification_config (
    id SERIAL PRIMARY KEY,
    firebase_project_id VARCHAR(255) NOT NULL,
    firebase_client_email VARCHAR(255) NOT NULL,
    firebase_private_key TEXT NOT NULL,
    firebase_messaging_sender_id VARCHAR(255) NOT NULL,
    firebase_app_id VARCHAR(255) NOT NULL,
    firebase_public_vapid_key VARCHAR(255) NOT NULL,
    notification_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_push_notification_config_enabled ON push_notification_config(notification_enabled);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_push_notification_config_updated_at ON push_notification_config;
CREATE TRIGGER update_push_notification_config_updated_at
BEFORE UPDATE ON push_notification_config
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE push_notification_config IS 'Stores Firebase configuration for web push notifications';

