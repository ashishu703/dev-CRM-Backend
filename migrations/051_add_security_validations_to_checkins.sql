-- Add security and validation fields to marketing meetings and check-ins
-- This migration adds fields needed for location validation and duplicate prevention

-- Add latitude and longitude to marketing_meetings for location validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketing_meetings' 
        AND column_name = 'meeting_latitude'
    ) THEN
        ALTER TABLE marketing_meetings
        ADD COLUMN meeting_latitude DECIMAL(10, 8),
        ADD COLUMN meeting_longitude DECIMAL(11, 8);
    END IF;
END $$;

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_location ON marketing_meetings(meeting_latitude, meeting_longitude);

-- Add unique constraint to prevent duplicate check-ins for same meeting by same salesperson
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uq_marketing_check_ins_meeting_salesperson'
    ) THEN
        -- First, we need to handle existing duplicates if any
        -- Create a unique index with a condition
        CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_check_ins_meeting_salesperson 
        ON marketing_check_ins(meeting_id, salesperson_email) 
        WHERE status != 'Rejected';
    END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add distance_from_meeting field to track validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketing_check_ins' 
        AND column_name = 'distance_from_meeting'
    ) THEN
        ALTER TABLE marketing_check_ins
        ADD COLUMN distance_from_meeting DECIMAL(10, 2), -- Distance in meters
        ADD COLUMN location_validated BOOLEAN DEFAULT false,
        ADD COLUMN validation_message TEXT;
    END IF;
END $$;

-- Add photo metadata for validation (EXIF data timestamp, etc.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketing_check_ins' 
        AND column_name = 'photo_taken_at'
    ) THEN
        ALTER TABLE marketing_check_ins
        ADD COLUMN photo_taken_at TIMESTAMP, -- When photo was actually taken (from EXIF)
        ADD COLUMN photo_source VARCHAR(50) DEFAULT 'camera'; -- 'camera' or 'upload'
    END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN marketing_meetings.meeting_latitude IS 'GPS latitude of meeting location for validation';
COMMENT ON COLUMN marketing_meetings.meeting_longitude IS 'GPS longitude of meeting location for validation';
COMMENT ON COLUMN marketing_check_ins.distance_from_meeting IS 'Distance in meters from meeting location';
COMMENT ON COLUMN marketing_check_ins.location_validated IS 'Whether location validation was performed';
COMMENT ON COLUMN marketing_check_ins.photo_taken_at IS 'Actual timestamp when photo was taken (from EXIF data)';
COMMENT ON COLUMN marketing_check_ins.photo_source IS 'Source of photo: camera or upload';

