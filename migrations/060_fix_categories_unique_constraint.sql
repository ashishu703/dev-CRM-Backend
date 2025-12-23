-- Fix categories unique constraint to allow same name under different parents
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- Add composite unique constraint on (name, parent_id)
-- This allows same category name under different parents
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categories_name_parent_id_key'
  ) THEN
    ALTER TABLE categories 
    ADD CONSTRAINT categories_name_parent_id_key 
    UNIQUE (name, parent_id);
  END IF;
END $$;

