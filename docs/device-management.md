# Device & Feature Flag Management

Feature flags are stored on the `devices` table in PostgreSQL. Manage them via the Railway DB console.

All flags default to `false`. The app fetches flags on launch and caches them until the user pulls to refresh.

## Lookup Queries

### Find device by name

```sql
SELECT device_id, name, forwarding_email, gmail_sync_enabled, device_sync_enabled, created_at
FROM devices WHERE name ILIKE '%Chetan%';
```

### Find name by device ID

```sql
SELECT name, forwarding_email, gmail_sync_enabled, device_sync_enabled
FROM devices WHERE device_id = 'kharcha-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
```

### List all devices

```sql
SELECT device_id, name, gmail_sync_enabled, device_sync_enabled, created_at
FROM devices ORDER BY created_at DESC;
```

## Enable / Disable Feature Flags

### Enable gmail sync

```sql
UPDATE devices SET gmail_sync_enabled = true WHERE name ILIKE '%Chetan%';
```

### Enable device sync

```sql
UPDATE devices SET device_sync_enabled = true WHERE name ILIKE '%Chetan%';
```

### Enable all flags at once

```sql
UPDATE devices SET gmail_sync_enabled = true, device_sync_enabled = true
WHERE name ILIKE '%Chetan%';
```

### Disable a flag

```sql
UPDATE devices SET gmail_sync_enabled = false WHERE name ILIKE '%Chetan%';
```

## Update Device Name

```sql
UPDATE devices SET name = 'Chetan Jain' WHERE device_id = 'kharcha-XXXXXXXX';
```

## Migration

If upgrading from a version without these columns, run:

```sql
ALTER TABLE devices ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS gmail_sync_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_sync_enabled BOOLEAN NOT NULL DEFAULT false;
```

Or use `bun run db:push` to sync the Drizzle schema automatically.
