-- Add division column to department_head_leads table
DO $$ 
BEGIN
  -- Add division column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'division'
  ) THEN
    ALTER TABLE department_head_leads ADD COLUMN division VARCHAR(100);
    RAISE NOTICE 'Added division column to department_head_leads table';
  ELSE
    RAISE NOTICE 'division column already exists in department_head_leads table';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add division column: %', SQLERRM;
END $$;

-- Create index for division column
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'division') THEN
    CREATE INDEX IF NOT EXISTS idx_dh_leads_division ON department_head_leads(division);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create index idx_dh_leads_division: %', SQLERRM;
END $$;
