-- Increase phone and whatsapp column length from VARCHAR(20) to VARCHAR(50)
-- This allows longer phone numbers including country codes and formatting

DO $$
BEGIN
  -- Update phone column in department_head_leads
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'department_head_leads' 
    AND column_name = 'phone'
    AND character_maximum_length = 20
  ) THEN
    ALTER TABLE department_head_leads 
    ALTER COLUMN phone TYPE VARCHAR(50);
    RAISE NOTICE 'Updated department_head_leads.phone from VARCHAR(20) to VARCHAR(50)';
  END IF;

  -- Update whatsapp column in department_head_leads
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'department_head_leads' 
    AND column_name = 'whatsapp'
    AND character_maximum_length = 20
  ) THEN
    ALTER TABLE department_head_leads 
    ALTER COLUMN whatsapp TYPE VARCHAR(50);
    RAISE NOTICE 'Updated department_head_leads.whatsapp from VARCHAR(20) to VARCHAR(50)';
  END IF;

  -- Update phone column in salesperson_leads
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'salesperson_leads' 
    AND column_name = 'phone'
    AND character_maximum_length = 20
  ) THEN
    ALTER TABLE salesperson_leads 
    ALTER COLUMN phone TYPE VARCHAR(50);
    RAISE NOTICE 'Updated salesperson_leads.phone from VARCHAR(20) to VARCHAR(50)';
  END IF;

  -- Update whatsapp column in salesperson_leads
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'salesperson_leads' 
    AND column_name = 'whatsapp'
    AND character_maximum_length = 20
  ) THEN
    ALTER TABLE salesperson_leads 
    ALTER COLUMN whatsapp TYPE VARCHAR(50);
    RAISE NOTICE 'Updated salesperson_leads.whatsapp from VARCHAR(20) to VARCHAR(50)';
  END IF;

  -- Update phone column in leads table (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'leads' 
    AND column_name = 'phone'
    AND character_maximum_length = 20
  ) THEN
    ALTER TABLE leads 
    ALTER COLUMN phone TYPE VARCHAR(50);
    RAISE NOTICE 'Updated leads.phone from VARCHAR(20) to VARCHAR(50)';
  END IF;

  -- Update whatsapp column in leads table (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'leads' 
    AND column_name = 'whatsapp'
    AND character_maximum_length = 20
  ) THEN
    ALTER TABLE leads 
    ALTER COLUMN whatsapp TYPE VARCHAR(50);
    RAISE NOTICE 'Updated leads.whatsapp from VARCHAR(20) to VARCHAR(50)';
  END IF;

EXCEPTION WHEN others THEN
  RAISE NOTICE 'Error updating phone/whatsapp columns: %', SQLERRM;
END $$;

