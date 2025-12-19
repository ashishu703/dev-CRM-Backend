-- Add remark column to quotation_items table for per-product remarks
DO $$ 
BEGIN
  -- Add remark column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_items' AND column_name = 'remark'
  ) THEN
    ALTER TABLE quotation_items ADD COLUMN remark TEXT;
    RAISE NOTICE 'Added remark column to quotation_items table';
  ELSE
    RAISE NOTICE 'remark column already exists in quotation_items table';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add remark column: %', SQLERRM;
END $$;
