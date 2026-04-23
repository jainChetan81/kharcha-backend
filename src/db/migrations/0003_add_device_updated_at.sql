-- Add updated_at column to devices, populated with created_at for existing rows
-- Drizzle's $onUpdate() hook bumps it on subsequent updates
ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE devices SET updated_at = created_at WHERE created_at IS NOT NULL;
