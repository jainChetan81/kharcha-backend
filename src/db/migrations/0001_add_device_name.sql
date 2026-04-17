-- Add name and feature flag columns to devices table
-- Safe to run on existing data: nullable/default columns, existing rows get defaults
ALTER TABLE devices ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS gmail_sync_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_sync_enabled BOOLEAN NOT NULL DEFAULT false;
