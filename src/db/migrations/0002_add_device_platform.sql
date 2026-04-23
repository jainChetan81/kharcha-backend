-- Add platform column to devices table (nullable for existing rows)
-- Safe to run on existing data: nullable column, app layer enforces non-null on new inserts
DO $$ BEGIN
    CREATE TYPE device_platform AS ENUM ('ios', 'android');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE devices ADD COLUMN IF NOT EXISTS platform device_platform;
