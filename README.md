# kharcha-backend

Backend API for [Kharcha](https://github.com/jainChetan81/Kharcha) — a personal expense tracking iOS app. Receives bank transaction emails via Postmark inbound webhooks, parses them, and makes them available for sync to the mobile app.

## How It Works

```text
Bank (Axis/HDFC)
  │
  │ sends transaction alert email
  ▼
Gmail ──► forwards to sync+token@kharcha.app
              │
              ▼
         Postmark (inbound email service)
              │
              │ POST /webhook/email
              ▼
      ┌──────────────────┐
      │  kharcha-backend  │
      │   (Bun + Hono)    │
      │                    │
      │  1. looks up device│
      │     by forwarding  │
      │     email          │
      │  2. parses bank    │
      │     email body     │
      │  3. stores         │
      │     transaction    │
      │     in Postgres    │
      └────────┬───────────┘
               │
               │ GET /sync (x-device-id header)
               ▼
         Mobile App (Kharcha)
         pulls new transactions
         into local SQLite
```

### Full Flow

1. **Register** — mobile app sends `device_id` to `POST /register`. Backend generates a unique forwarding email (e.g. `sync+abc123@kharcha.app`) and stores the device.

2. **Set up forwarding** — user copies the forwarding email from the app and adds it as a forwarding address in Gmail settings. Bank alert emails now get forwarded to Postmark.

3. **Webhook** — Postmark receives the forwarded email and hits `POST /webhook/email`. Backend extracts the device from the `To` address, parses the email body (Axis Bank UPI / HDFC credit card), and inserts a transaction into Postgres.

4. **Sync** — mobile app calls `GET /sync` with `x-device-id` header. Backend returns all transactions created since `last_synced_at`, marks them as fetched. App inserts them into local SQLite.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Framework:** [Hono](https://hono.dev)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL
- **Infrastructure:** Docker Compose
- **Lint/Format:** [Biome](https://biomejs.dev)

## Running Locally

```bash
# Start everything (API on :3000 + Postgres on :5432)
docker compose up --build

# Start with hot-reload (watches src/ for changes, syncs to container)
docker compose up --build --watch

# Push schema to database (first time or after schema changes)
docker compose exec api bun run db:push

# Seed sample data (test device + 12 transactions)
docker compose exec api bun run db:seed

# Rebuild after code changes (if not using --watch)
docker compose up --build -d
```

> **Note:** Commands that need `DATABASE_URL` (like `db:push`, `db:seed`) must run inside the container via `docker compose exec api ...` because `.env.local` uses `postgres` as the hostname which only resolves inside the Docker network.

### Drizzle Studio (database GUI)

Drizzle Studio runs on the **host machine** (not inside Docker) and connects via the exposed port.

```bash
# Requires local Bun installation and Postgres port 5432 not in use by local Postgres
# If you have local Postgres running: brew services stop postgresql
bun run db:studio
```

Opens at `https://local.drizzle.studio`.

## API Endpoints

### `GET /`

Health check.

```json
{ "status": "ok", "app": "kharcha-backend" }
```

### `POST /register`

Register a device. Returns a unique forwarding email for Postmark routing. Idempotent — returns existing email if device is already registered.

**Request:**

```json
{ "device_id": "kharcha-d2a2cd0d-2832-4238-aa1d-9b923f0e5fc6" }
```

**Response (201 new / 200 existing):**

```json
{ "forwarding_email": "sync+a1b2c3d4e5f6a1b2@kharcha.app" }
```

### `GET /sync`

Fetch new transactions for the authenticated device. Marks fetched transactions with `fetched_at` timestamp.

**Headers:**

```
x-device-id: kharcha-d2a2cd0d-2832-4238-aa1d-9b923f0e5fc6
```

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `last_synced_at` | ISO 8601 string | No | Only return transactions created after this timestamp |

**Response:**

```json
{
  "transactions": [
    {
      "id": "uuid",
      "device_id": "kharcha-d2a2cd0d-...",
      "amount": 500.0,
      "merchant": "Swiggy",
      "date": "2026-04-04",
      "type": "expense",
      "source": "alerts@axisbank.com",
      "source_type": "synced",
      "created_at": "2026-04-04T10:00:00.000Z",
      "fetched_at": "2026-04-04T12:00:00.000Z"
    }
  ],
  "last_synced_at": "2026-04-04T12:00:00.000Z"
}
```

### `GET /feature-flags`

Returns feature flags for the mobile app. Used to control which features are visible per user.

**Response:**

```json
{
  "gmail_sync_enabled_for": ["Chetan", "User"]
}
```

The mobile app checks if the current user's name is in `gmail_sync_enabled_for` — if yes, the Gmail Sync row appears in the profile screen. Controlled via `GMAIL_SYNC_ENABLED_FOR` env var (comma-separated list of usernames).

### `POST /webhook/email`

Postmark inbound email webhook. Validates token, resolves device from `To` address, parses bank email, stores transaction.

**Headers:**

```
x-postmark-token: <POSTMARK_WEBHOOK_TOKEN>
```

**Request body:** Postmark inbound email JSON payload (uses `From`, `To`, `TextBody`).

**Response:**

```json
{ "ok": true, "parsed": true }
```

Returns `{ "ok": true, "parsed": false }` if the email format is not recognized.

## Supported Banks

| Bank      | Email Format              | Transaction Types |
|-----------|---------------------------|-------------------|
| Axis Bank | UPI debit/credit alerts   | expense, income   |
| HDFC Bank | Credit card charge alerts | expense           |

## Postmark Setup

1. Register a device via `POST /register` to get a forwarding email
2. Add the forwarding email in Gmail settings (Settings > Forwarding)
3. Configure Postmark:
   - Set up inbound domain (`kharcha.app`)
   - Point MX records to Postmark's inbound servers
   - Set webhook URL to `https://your-api.railway.app/webhook/email`
   - Set `POSTMARK_WEBHOOK_TOKEN` env var to match

## Deploy to Railway

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL service
3. Add a service from the `kharcha-backend` directory
4. Set environment variables (see below)
5. Deploy — Railway detects the Dockerfile automatically

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | — | Yes | PostgreSQL connection string |
| `PORT` | `3000` | No | HTTP server port |
| `POSTMARK_WEBHOOK_TOKEN` | — | Yes | Secret for validating Postmark webhooks |
| `EMAIL_DOMAIN` | `kharcha.app` | No | Domain for forwarding emails |
| `GMAIL_SYNC_ENABLED_FOR` | `""` | No | Comma-separated usernames with Gmail Sync access |

## Scripts

### Docker

```bash
docker compose up --build           # start (build + run)
docker compose up --build --watch   # start with hot-reload
docker compose up --build -d        # start in background
docker compose restart              # restart all services
docker compose restart api          # restart only the API
docker compose down                 # stop everything
docker compose logs -f api          # tail API logs
```

### Inside Docker (`docker compose exec api ...`)

```bash
bun run db:push                     # push schema to Postgres
bun run db:seed                     # seed default test device + 12 transactions
bun run db:seed <device_id>         # seed transactions for a specific device
```

#### Seeding for your device

1. Open the Device Sync screen in the app
2. Tap the User ID to copy it
3. Run:

```bash
docker compose exec api bun run db:seed <paste-your-user-id>
```

If the device is already registered, transactions are added to it. If not, a new test device is created. Then hit "Sync Now" in the app to pull them in.

#### Debugging

```bash
# List all registered devices
docker compose exec postgres psql -U postgres -d kharcha -c "SELECT device_id, forwarding_email FROM devices;"

# List device IDs that have transactions
docker compose exec postgres psql -U postgres -d kharcha -c "SELECT DISTINCT device_id FROM transactions;"

# Count transactions per device
docker compose exec postgres psql -U postgres -d kharcha -c "SELECT device_id, COUNT(*) FROM transactions GROUP BY device_id;"

# View all transactions for a specific device
docker compose exec postgres psql -U postgres -d kharcha -c "SELECT id, amount, merchant, date, type FROM transactions WHERE device_id = '<device_id>';"
```

### On host machine

```bash
bun run lint         # biome lint + format check
bun run lint:fix     # auto-fix lint issues
bun run typecheck    # tsc --noEmit
bun run quality      # lint + typecheck
bun run db:studio    # open Drizzle Studio (database GUI)
```
