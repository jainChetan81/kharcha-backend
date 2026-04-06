# Kharcha Backend

## Project Overview
Backend API for the Kharcha expense tracking iOS app. Receives bank transaction emails via Postmark inbound webhooks, parses them with regex parsers (Axis, HDFC, IndusInd) with Gemini AI fallback, and syncs to mobile app.

## Tech Stack
- **Runtime:** Bun
- **Framework:** Hono (lightweight web framework)
- **ORM:** Drizzle ORM with PostgreSQL
- **Lint/Format:** Biome
- **AI Fallback:** Google Gemini 1.5 Flash for unparseable emails

## Project Structure
```
src/
  index.ts          # App entry point, route mounting, error handler
  types/index.ts    # Shared TypeScript types
  lib/
    auth.ts         # Device auth middleware (x-device-id header)
    constants.ts    # All app constants, enums, error messages
    env.ts          # Environment variable validation
    gemini.ts       # Gemini AI fallback parser
    parsers/
      index.ts      # Router: picks parser by sender email
      utils.ts      # Shared helpers (parseAmount, dates, HTML decode)
      axis.ts       # Axis Bank parsers (UPI, credit card, subject line)
      hdfc.ts       # HDFC Bank parsers
      indusind.ts   # IndusInd Bank parsers
  db/
    index.ts        # Database client + connection pool
    schema.ts       # Drizzle schema (devices, transactions)
    check.ts        # Startup DB health check
    seed.ts         # Sample data seeder
  routes/
    register.ts     # POST /register — device registration
    sync.ts         # GET /sync — pull transactions
    webhook.ts      # POST /webhook/email/:token — Postmark inbound
    feature-flags.ts # GET /feature-flags
```

## Commands
- `bun run dev` — start with hot reload
- `bun run lint` — biome check
- `bun run lint:fix` — auto-fix
- `bun run typecheck` — tsc --noEmit
- `bun run quality` — lint + typecheck
- `bun run db:push` — push schema to DB
- `bun run db:seed` — seed sample data

## Conventions
- Use constants from `src/lib/constants.ts` for all string literals (error messages, headers, transaction types)
- Use Drizzle ORM for all database queries (no raw SQL except in db/check.ts)
- Keep route handlers thin — business logic in lib/, DB queries via Drizzle
- Format with tabs, double quotes (Biome config)
- All monetary amounts use `numeric(12,2)` in the DB schema
- Type and source_type columns use pgEnum for DB-level validation
- Wrap multi-step DB operations in db.transaction()
