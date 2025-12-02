-- Create security_logs table for tracking security events and failures
-- Migration: 046_create_security_logs_table.sql

CREATE TABLE IF NOT EXISTS security_logs (
  id SERIAL PRIMARY KEY,
  log_type VARCHAR(50) NOT NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  ip_address VARCHAR(45),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  details TEXT,
  assigned_to VARCHAR(255),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed', 'sent_back')),
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_security_logs_type ON security_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_status ON security_logs(status);
CREATE INDEX IF NOT EXISTS idx_security_logs_assigned_to ON security_logs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_security_logs_updated_at ON security_logs;
CREATE TRIGGER update_security_logs_updated_at
BEFORE UPDATE ON security_logs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

