-- Restore all fields to department_head_leads table
-- Add back all the fields that were removed
-- This migration safely checks column count before adding to avoid 1600 column limit error

DO $$ 
DECLARE
  column_count INTEGER;
  max_allowed INTEGER := 1550; -- Safe limit below 1600
BEGIN
  -- First, check how many columns the table currently has
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'department_head_leads';

  -- If we're at or near the limit, skip all column additions
  IF column_count >= max_allowed THEN
    RAISE NOTICE 'Table department_head_leads has % columns (limit: 1600). Skipping column additions to prevent limit error.', column_count;
    RETURN;
  END IF;

  -- Only proceed if we have room for new columns
  RAISE NOTICE 'Table department_head_leads has % columns. Proceeding with safe column additions.', column_count;

  -- Add product_names column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'product_names'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN product_names TEXT;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add product_names column: %', SQLERRM;
  END;

  -- Add created column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'created'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN created DATE;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add created column: %', SQLERRM;
  END;

  -- Add assigned column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'assigned'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN assigned VARCHAR(255);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add assigned column: %', SQLERRM;
  END;

  -- Add telecaller column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'telecaller'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN telecaller VARCHAR(255);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add telecaller column: %', SQLERRM;
  END;

  -- Add telecaller_status column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'telecaller_status'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN telecaller_status VARCHAR(20) DEFAULT 'INACTIVE';
    END IF;
    -- Add check constraint separately
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' 
      AND constraint_name LIKE '%telecaller_status%'
    ) THEN
      ALTER TABLE department_head_leads 
      ADD CONSTRAINT chk_dh_leads_telecaller_status 
      CHECK (telecaller_status IN ('ACTIVE', 'INACTIVE'));
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add telecaller_status column/constraint: %', SQLERRM;
  END;

  -- Add payment_status column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'payment_status'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN payment_status VARCHAR(20) DEFAULT 'PENDING';
    END IF;
    -- Add check constraint separately
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' 
      AND constraint_name LIKE '%payment_status%'
    ) THEN
      ALTER TABLE department_head_leads 
      ADD CONSTRAINT chk_dh_leads_payment_status 
      CHECK (payment_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED'));
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add payment_status column/constraint: %', SQLERRM;
  END;

  -- Add address column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'address'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN address TEXT;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add address column: %', SQLERRM;
  END;

  -- Add product_type column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'product_type'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN product_type VARCHAR(100);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add product_type column: %', SQLERRM;
  END;

  -- Add state column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'state'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN state VARCHAR(100);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add state column: %', SQLERRM;
  END;

  -- Add customer_type column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'customer_type'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN customer_type VARCHAR(50);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add customer_type column: %', SQLERRM;
  END;

  -- Add date column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'date'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN date DATE;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add date column: %', SQLERRM;
  END;

  -- Add connected_status column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'connected_status'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN connected_status VARCHAR(20) DEFAULT 'pending';
    END IF;
    -- Add check constraint separately
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' 
      AND constraint_name LIKE '%connected_status%'
    ) THEN
      ALTER TABLE department_head_leads 
      ADD CONSTRAINT chk_dh_leads_connected_status_restore 
      CHECK (connected_status IN ('connected', 'not_connected', 'pending'));
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add connected_status column/constraint: %', SQLERRM;
  END;

  -- Add final_status column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'final_status'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN final_status VARCHAR(20) DEFAULT 'open';
    END IF;
    -- Add check constraint separately
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' 
      AND constraint_name LIKE '%final_status%'
    ) THEN
      ALTER TABLE department_head_leads 
      ADD CONSTRAINT chk_dh_leads_final_status_restore 
      CHECK (final_status IN ('open', 'closed', 'next_meeting'));
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add final_status column/constraint: %', SQLERRM;
  END;

  -- Add whatsapp column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'whatsapp'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN whatsapp VARCHAR(20);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add whatsapp column: %', SQLERRM;
  END;

  -- Add assigned_salesperson column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'assigned_salesperson'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN assigned_salesperson VARCHAR(255);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add assigned_salesperson column: %', SQLERRM;
  END;

  -- Add assigned_telecaller column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'assigned_telecaller'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN assigned_telecaller VARCHAR(255);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add assigned_telecaller column: %', SQLERRM;
  END;

  -- Add phone column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'phone'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN phone VARCHAR(20);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add phone column: %', SQLERRM;
  END;

END $$;

-- Update existing rows with default values for new fields (only if columns exist)
-- Use dynamic SQL to safely update only columns that exist
DO $$ 
DECLARE
  update_sql TEXT := '';
  columns_to_update TEXT[] := ARRAY[
    'product_names', 'created', 'assigned', 'telecaller', 'telecaller_status',
    'payment_status', 'address', 'product_type', 'state', 'customer_type',
    'date', 'connected_status', 'final_status', 'whatsapp',
    'assigned_salesperson', 'assigned_telecaller'
  ];
  col TEXT;
  col_exists BOOLEAN;
  set_clauses TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Build SET clauses only for columns that exist
  FOREACH col IN ARRAY columns_to_update
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'department_head_leads' 
      AND column_name = col
    ) INTO col_exists;
    
    IF col_exists THEN
      IF col = 'created' OR col = 'date' THEN
        set_clauses := set_clauses || format('%I = COALESCE(%I, CURRENT_DATE)', col, col);
      ELSIF col = 'whatsapp' THEN
        -- Check if phone column exists for whatsapp
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'phone') THEN
          set_clauses := set_clauses || format('%I = COALESCE(%I, phone)', col, col);
        ELSE
          set_clauses := set_clauses || format('%I = COALESCE(%I, NULL)', col, col);
        END IF;
      ELSIF col = 'telecaller_status' THEN
        set_clauses := set_clauses || format('%I = COALESCE(%I, ''INACTIVE'')', col, col);
      ELSIF col = 'payment_status' THEN
        set_clauses := set_clauses || format('%I = COALESCE(%I, ''PENDING'')', col, col);
      ELSIF col = 'connected_status' THEN
        set_clauses := set_clauses || format('%I = COALESCE(%I, ''pending'')', col, col);
      ELSIF col = 'final_status' THEN
        set_clauses := set_clauses || format('%I = COALESCE(%I, ''open'')', col, col);
      ELSIF col = 'customer_type' THEN
        set_clauses := set_clauses || format('%I = COALESCE(%I, ''business'')', col, col);
      ELSIF col = 'assigned' OR col = 'assigned_salesperson' OR col = 'assigned_telecaller' THEN
        set_clauses := set_clauses || format('%I = COALESCE(%I, ''Unassigned'')', col, col);
      ELSE
        set_clauses := set_clauses || format('%I = COALESCE(%I, ''N/A'')', col, col);
      END IF;
    END IF;
  END LOOP;
  
  -- Only execute UPDATE if we have columns to update
  IF array_length(set_clauses, 1) > 0 THEN
    BEGIN
      update_sql := 'UPDATE department_head_leads SET ' || array_to_string(set_clauses, ', ');
      EXECUTE update_sql;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not update default values: %', SQLERRM;
    END;
  END IF;
END $$;

-- Create indexes for new fields (only if columns exist)
DO $$ BEGIN
  -- Only create indexes if the columns exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'product_names') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_product_names ON department_head_leads(product_names);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_product_names: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'created') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_created ON department_head_leads(created);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_created: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'assigned') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_assigned ON department_head_leads(assigned);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_assigned: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'telecaller') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_telecaller ON department_head_leads(telecaller);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_telecaller: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'telecaller_status') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_telecaller_status ON department_head_leads(telecaller_status);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_telecaller_status: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'payment_status') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_payment_status ON department_head_leads(payment_status);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_payment_status: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'address') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_address ON department_head_leads(address);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_address: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'product_type') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_product_type ON department_head_leads(product_type);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_product_type: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'state') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_state ON department_head_leads(state);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_state: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'customer_type') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_customer_type ON department_head_leads(customer_type);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_customer_type: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'date') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_date ON department_head_leads(date);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_date: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'connected_status') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_connected_status ON department_head_leads(connected_status);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_connected_status: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'final_status') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_final_status ON department_head_leads(final_status);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_final_status: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'whatsapp') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_whatsapp ON department_head_leads(whatsapp);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_whatsapp: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'assigned_salesperson') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_assigned_salesperson ON department_head_leads(assigned_salesperson);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_assigned_salesperson: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'assigned_telecaller') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_assigned_telecaller ON department_head_leads(assigned_telecaller);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_assigned_telecaller: %', SQLERRM;
    END;
  END IF;
EXCEPTION WHEN others THEN 
  -- Silently ignore any other errors
  RAISE NOTICE 'Index creation encountered an error: %', SQLERRM;
END $$;
