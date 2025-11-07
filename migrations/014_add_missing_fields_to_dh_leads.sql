-- Add missing fields to department_head_leads table
-- This migration safely checks column count before adding to avoid 1600 column limit error
-- If table is at or near the limit, it will skip all additions gracefully

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

  -- Add gst_no column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'gst_no'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN gst_no VARCHAR(50);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add gst_no column: %', SQLERRM;
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
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add connected_status column: %', SQLERRM;
  END;

  -- Add check constraint for connected_status if it doesn't exist
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' 
      AND constraint_name = 'chk_dh_leads_connected_status'
    ) THEN
      ALTER TABLE department_head_leads 
      ADD CONSTRAINT chk_dh_leads_connected_status 
      CHECK (connected_status IN ('connected', 'not_connected', 'pending'));
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add connected_status constraint: %', SQLERRM;
  END;

  -- Add final_status column (with exception handling)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'final_status'
    ) THEN
      ALTER TABLE department_head_leads ADD COLUMN final_status VARCHAR(20) DEFAULT 'open';
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add final_status column: %', SQLERRM;
  END;

  -- Add check constraint for final_status if it doesn't exist
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' 
      AND constraint_name = 'chk_dh_leads_final_status'
    ) THEN
      ALTER TABLE department_head_leads 
      ADD CONSTRAINT chk_dh_leads_final_status 
      CHECK (final_status IN ('open', 'closed', 'next_meeting'));
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add final_status constraint: %', SQLERRM;
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

END $$;

-- Remove NOT NULL constraints to make all fields optional (only if they exist)
DO $$ 
BEGIN
  -- Check and drop NOT NULL from customer_id
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' 
      AND column_name = 'customer_id' 
      AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE department_head_leads ALTER COLUMN customer_id DROP NOT NULL;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not drop NOT NULL from customer_id: %', SQLERRM;
  END;

  -- Check and drop NOT NULL from customer
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'department_head_leads' 
      AND column_name = 'customer' 
      AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE department_head_leads ALTER COLUMN customer DROP NOT NULL;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not drop NOT NULL from customer: %', SQLERRM;
  END;
END $$;

-- Create indexes for new fields (only if columns exist)
DO $$ BEGIN
  -- Only create indexes if the columns exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department_head_leads' AND column_name = 'phone') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_dh_leads_phone ON department_head_leads(phone);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create index idx_dh_leads_phone: %', SQLERRM;
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
