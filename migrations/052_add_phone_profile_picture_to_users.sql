-- Add phone and profile_picture columns to user tables
-- Migration: 052_add_phone_profile_picture_to_users.sql

-- Add columns to department_users table
DO $$
BEGIN
  -- Add phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'department_users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE department_users ADD COLUMN phone VARCHAR(20);
  END IF;

  -- Add profile_picture column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'department_users' AND column_name = 'profile_picture'
  ) THEN
    ALTER TABLE department_users ADD COLUMN profile_picture TEXT;
  END IF;
END $$;

-- Add columns to department_heads table
DO $$
BEGIN
  -- Add phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'department_heads' AND column_name = 'phone'
  ) THEN
    ALTER TABLE department_heads ADD COLUMN phone VARCHAR(20);
  END IF;

  -- Add profile_picture column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'department_heads' AND column_name = 'profile_picture'
  ) THEN
    ALTER TABLE department_heads ADD COLUMN profile_picture TEXT;
  END IF;
END $$;

-- Add columns to superadmins table
DO $$
BEGIN
  -- Add phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'superadmins' AND column_name = 'phone'
  ) THEN
    ALTER TABLE superadmins ADD COLUMN phone VARCHAR(20);
  END IF;

  -- Add profile_picture column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'superadmins' AND column_name = 'profile_picture'
  ) THEN
    ALTER TABLE superadmins ADD COLUMN profile_picture TEXT;
  END IF;
END $$;

