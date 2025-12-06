-- Create marketing meetings and check-ins system tables
-- This migration creates tables for assigned meetings and location-based check-ins

-- Create marketing_meetings table (assigned meetings)
CREATE TABLE IF NOT EXISTS marketing_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Meeting identification
    meeting_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Customer/Lead references
    customer_id INTEGER,
    lead_id INTEGER,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    
    -- Location information
    address TEXT NOT NULL,
    location VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    
    -- Assignment information
    assigned_to VARCHAR(255) NOT NULL, -- salesperson email/ID
    assigned_by VARCHAR(255) NOT NULL, -- sales head email/ID
    
    -- Meeting scheduling
    meeting_date DATE NOT NULL,
    meeting_time TIME,
    scheduled_date DATE NOT NULL,
    
    -- Status and workflow
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
    notes TEXT,
    
    -- Standard timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create marketing_check_ins table (photo + location submissions)
CREATE TABLE IF NOT EXISTS marketing_check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Meeting reference
    meeting_id UUID NOT NULL,
    
    -- Salesperson information
    salesperson_id VARCHAR(255),
    salesperson_email VARCHAR(255) NOT NULL,
    salesperson_name VARCHAR(255),
    
    -- Photo information
    photo_url TEXT NOT NULL, -- Cloudinary URL
    
    -- Location information
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT, -- Reverse geocoded address
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    
    -- Check-in details
    check_in_time TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'Pending Review' CHECK (status IN ('Verified', 'Pending Review', 'Rejected')),
    notes TEXT,
    
    -- Standard timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance on marketing_meetings
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_meeting_id ON marketing_meetings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_assigned_to ON marketing_meetings(assigned_to);
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_assigned_by ON marketing_meetings(assigned_by);
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_meeting_date ON marketing_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_status ON marketing_meetings(status);
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_customer_id ON marketing_meetings(customer_id);
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_lead_id ON marketing_meetings(lead_id);

-- Create indexes for better performance on marketing_check_ins
CREATE INDEX IF NOT EXISTS idx_marketing_check_ins_meeting_id ON marketing_check_ins(meeting_id);
CREATE INDEX IF NOT EXISTS idx_marketing_check_ins_salesperson_email ON marketing_check_ins(salesperson_email);
CREATE INDEX IF NOT EXISTS idx_marketing_check_ins_check_in_time ON marketing_check_ins(check_in_time);
CREATE INDEX IF NOT EXISTS idx_marketing_check_ins_status ON marketing_check_ins(status);
CREATE INDEX IF NOT EXISTS idx_marketing_check_ins_location ON marketing_check_ins(latitude, longitude);

-- Create foreign key constraint for check-ins (with safe error handling)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_marketing_check_ins_meeting'
    ) THEN
        ALTER TABLE marketing_check_ins
        ADD CONSTRAINT fk_marketing_check_ins_meeting 
            FOREIGN KEY (meeting_id) 
            REFERENCES marketing_meetings(id) 
            ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Create trigger to automatically update updated_at timestamp for marketing_meetings
CREATE OR REPLACE FUNCTION update_marketing_meetings_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_marketing_meetings_updated_at_trigger ON marketing_meetings;
CREATE TRIGGER update_marketing_meetings_updated_at_trigger
BEFORE UPDATE ON marketing_meetings
FOR EACH ROW EXECUTE FUNCTION update_marketing_meetings_updated_at();

-- Add comments for documentation
COMMENT ON TABLE marketing_meetings IS 'Stores assigned meetings/customer visits for marketing salespersons';
COMMENT ON TABLE marketing_check_ins IS 'Stores location-based check-ins with photos for marketing meetings';
COMMENT ON COLUMN marketing_meetings.meeting_id IS 'Unique identifier for the meeting (can be auto-generated or custom)';
COMMENT ON COLUMN marketing_check_ins.photo_url IS 'URL of the selfie/photo uploaded to Cloudinary';
COMMENT ON COLUMN marketing_check_ins.latitude IS 'GPS latitude coordinate of check-in location';
COMMENT ON COLUMN marketing_check_ins.longitude IS 'GPS longitude coordinate of check-in location';

