-- sqlfluff: dialect=postgres
-- Relax department_type constraints to allow dynamic department labels.
-- After this migration, the backend no longer enforces a fixed enum list;
-- values come from the frontend / database and are only validated as strings.

DO $$
BEGIN
  -- Drop strict CHECK constraints on department_heads
  BEGIN
    ALTER TABLE IF EXISTS department_heads
      DROP CONSTRAINT IF EXISTS department_heads_department_type_check;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not drop department_heads_department_type_check: %', SQLERRM;
  END;

  -- Drop strict CHECK constraints on department_users
  BEGIN
    ALTER TABLE IF EXISTS department_users
      DROP CONSTRAINT IF EXISTS department_users_department_type_check;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not drop department_users_department_type_check: %', SQLERRM;
  END;

  -- Legacy admin table, if still present
  BEGIN
    ALTER TABLE IF EXISTS admin_department_users
      DROP CONSTRAINT IF EXISTS admin_department_users_department_type_check;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not drop admin_department_users_department_type_check: %', SQLERRM;
  END;
END $$;


