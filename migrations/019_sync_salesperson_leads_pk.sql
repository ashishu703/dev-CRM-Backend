-- Ensure salesperson_leads uses same id space as department_head_leads
-- and supports UPSERT by id

DO $$ BEGIN
  -- Drop default/sequence if present (from SERIAL)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'salesperson_leads' AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE salesperson_leads ALTER COLUMN id DROP DEFAULT;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  -- Ensure id type is INTEGER
  ALTER TABLE salesperson_leads ALTER COLUMN id TYPE INTEGER USING id::INTEGER;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  -- Re-assert primary key on id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'salesperson_leads' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE salesperson_leads ADD PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- Ensure unique index on id (redundant with PK but ok if PK missing earlier)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ux_salesperson_leads_id'
  ) THEN
    CREATE UNIQUE INDEX ux_salesperson_leads_id ON salesperson_leads(id);
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;


