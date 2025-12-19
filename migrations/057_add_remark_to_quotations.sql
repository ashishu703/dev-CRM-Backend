-- Add remark column to quotations table
DO $$ 
BEGIN
  -- Add remark column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'remark'
  ) THEN
    ALTER TABLE quotations ADD COLUMN remark TEXT;
    RAISE NOTICE 'Added remark column to quotations table';
  ELSE
    RAISE NOTICE 'remark column already exists in quotations table';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add remark column: %', SQLERRM;
END $$;
