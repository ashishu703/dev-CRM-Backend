-- Create FCM tokens table for storing user device tokens
-- Migration: 075_create_fcm_tokens_table.sql

CREATE TABLE IF NOT EXISTS fcm_tokens (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    token TEXT NOT NULL,
    browser VARCHAR(100),
    device_type VARCHAR(20) CHECK (device_type IN ('mobile', 'desktop')),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_email, token)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_email ON fcm_tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active ON fcm_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_active ON fcm_tokens(user_email, is_active);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_fcm_tokens_updated_at ON fcm_tokens;
CREATE TRIGGER update_fcm_tokens_updated_at
BEFORE UPDATE ON fcm_tokens
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE fcm_tokens IS 'Stores FCM tokens for web push notifications mapped to users';

