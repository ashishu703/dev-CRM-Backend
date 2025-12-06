-- Drop hardcoded company_name CHECK constraints so organization names
-- are fully dynamic and driven from the organizations table.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop CHECK constraints on department_heads.company_name
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'department_heads'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%company_name%'
  LOOP
    EXECUTE format('ALTER TABLE department_heads DROP CONSTRAINT %I', r.conname);
  END LOOP;

  -- Drop CHECK constraints on department_users.company_name
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'department_users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%company_name%'
  LOOP
    EXECUTE format('ALTER TABLE department_users DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;


