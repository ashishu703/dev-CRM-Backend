-- Add division column to salesperson_leads table
DO $$ 
BEGIN
  -- Add division column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'salesperson_leads' AND column_name = 'division'
  ) THEN
    ALTER TABLE salesperson_leads ADD COLUMN division VARCHAR(100);
    RAISE NOTICE 'Added division column to salesperson_leads table';
  ELSE
    RAISE NOTICE 'division column already exists in salesperson_leads table';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add division column: %', SQLERRM;
END $$;

-- Create index for division column
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'salesperson_leads' AND column_name = 'division') THEN
    CREATE INDEX IF NOT EXISTS idx_salesperson_leads_division ON salesperson_leads(division);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create index idx_salesperson_leads_division: %', SQLERRM;
END $$;
