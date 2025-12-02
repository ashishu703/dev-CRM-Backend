-- Create tickets table for IT Department ticket management
-- Migration: 045_create_tickets_table.sql

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_id VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_by_phone VARCHAR(50),
  department VARCHAR(100) DEFAULT 'IT Department',
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  assigned_to VARCHAR(255),
  file_path TEXT,
  file_name VARCHAR(255),
  file_size INTEGER,
  status_history JSONB DEFAULT '[]'::jsonb,
  sla_remaining VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_department ON tickets(department);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

