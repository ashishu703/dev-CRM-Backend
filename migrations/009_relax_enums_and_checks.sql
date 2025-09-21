
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'department_heads' AND column_name = 'department_type'
  ) THEN
    BEGIN
      ALTER TABLE department_heads ALTER COLUMN department_type TYPE VARCHAR(50);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'department_heads' AND column_name = 'company_name'
  ) THEN
    BEGIN
      ALTER TABLE department_heads ALTER COLUMN company_name TYPE VARCHAR(255);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'department_users' AND column_name = 'department_type'
  ) THEN
    BEGIN
      ALTER TABLE department_users ALTER COLUMN department_type TYPE VARCHAR(50);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'department_users' AND column_name = 'company_name'
  ) THEN
    BEGIN
      ALTER TABLE department_users ALTER COLUMN company_name TYPE VARCHAR(255);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;


