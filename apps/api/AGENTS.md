# apps/api — Agent Overlay

> **Baseline**: Read [CLAUDE.md](../../CLAUDE.md) first. This file adds API-specific context on top of it.

---

## Purpose

`apps/api` is the backend source of truth. It owns all database access (via Prisma), business logic, external integrations (Plaid, email), and the AI agent surface. All other apps call this API over HTTP.

---

## Commands

| Task | Command (from repo root) |
|------|--------------------------|
| Dev | `pnpm --filter moat-api run dev` |
| Typecheck | `pnpm --filter moat-api run typecheck` |
| Lint | `pnpm --filter moat-api run check` |
| Prisma studio | `cd apps/api && pnpm prisma studio` |
| Create migration (local dev) | `pnpm db:migrate:dev --name <change>` |
| Apply migrations (local dev) | `pnpm db:migrate` |
| Apply migrations (deployed) | `pnpm db:migrate:deploy` (self-host: the `migrate` compose service) |

---

## Code structure

```
apps/api/src/
├── server/
│   ├── api-context.ts         ← ApiContext type (req, userId, isDemoMode, etc.)
│   ├── handler-wrappers.ts    ← withAuth / withDemoOrAuth / withPublic
│   ├── handlers/              ← HTTP route handlers (thin — call services)
│   ├── handlers.ts            ← Barrel export of all handlers
│   ├── services/              ← Business logic + Prisma queries
│   ├── plaid/                 ← Plaid integration
│   ├── rules-engine/          ← Transaction categorization rule engine
│   ├── mcp/                   ← MCP-specific server utilities
│   ├── auth/                  ← Auth utilities (JWT, token validation)
│   └── context/               ← Context resolution (household identity, demo user)
├── lib/
│   ├── forecasting.ts         ← Cash flow forecasting logic
│   ├── email/                 ← Email sending (transactional)
│   ├── logger.ts              ← Structured logger (Axiom)
│   └── transaction-scope.ts   ← Reusable Prisma scoping helpers
└── agent/                     ← AI agent tools and orchestration
```

```
apps/api/prisma/
├── schema.prisma              ← Single source of truth for DB schema
└── migrations/                ← Migration history (never edit manually)
```

---

## Architecture

### Request lifecycle

```
Next.js API route (pages/api/) → handler wrapper (withAuth/withDemoOrAuth/withPublic)
  → handler function (validates input, calls service)
    → service function (business logic + Prisma queries)
      → Prisma → PostgreSQL
```

### Handler wrappers — always use them

All handlers **must** use a wrapper from `handler-wrappers.ts`. Never call `requireDemoOrAuthenticated()` manually.

| Wrapper | Use case |
|---------|----------|
| `withAuth` | Mutations and writes that require real identity |
| `withDemoOrAuth` | Reads and projections that work in demo mode |
| `withPublic` | Unauthenticated endpoints (health checks, webhooks) |

The wrappers resolve `userId` as a `string` (never null) in the handler context. See [docs/patterns/auth-permissions.md](../../docs/patterns/auth-permissions.md).

### Service layer

Business logic and all Prisma queries live in `services/`. Handlers should be thin — call a service function, not Prisma directly. See [docs/patterns/handler-service-layer.md](docs/patterns/handler-service-layer.md).

---

## Cron jobs

Schedules live in the `crons` array of [`vercel.json`](vercel.json) (`{ path, schedule }`, UTC) — the single source of truth. Vercel reads it directly for the hosted deploy; the self-hosted `cron` container runs them from `scripts/self-host/crontab`, so after editing `crons`, run `node scripts/self-host/generate-crontab.mjs`. Each job is an authenticated `GET /api/cron/*` with `Authorization: Bearer $CRON_SECRET`. All jobs currently run daily at `0 7 * * *` (07:00 UTC).

---

## Prisma and migrations

Read [docs/patterns/prisma-and-migrations.md](docs/patterns/prisma-and-migrations.md) before any schema change. Self-hosted deployment: [docs/self-hosting.md](../../docs/self-hosting.md).

- **Schema lives in `apps/api/prisma/schema.prisma`** — the single Postgres source of truth.
- **Every schema change needs a committed migration** — use `pnpm db:migrate:dev` locally; never `pnpm db:push` on Neon.
- **`apps/api/.env` is dev/local only** — deployed databases only get `migrate deploy`.
- **Never run `prisma migrate reset`** on shared Neon databases.
- The generated Prisma client is committed at `apps/api/generated/prisma/`.

---

## Change-type routing table

| When you are doing X… | Read |
|-----------------------|------|
| Adding a new API endpoint | [docs/patterns/handler-service-layer.md](docs/patterns/handler-service-layer.md) |
| Choosing withAuth vs withDemoOrAuth | [docs/patterns/auth-and-permissions.md](docs/patterns/auth-and-permissions.md) |
| Adding or modifying a Prisma model | [docs/patterns/prisma-and-migrations.md](docs/patterns/prisma-and-migrations.md) |
| Running or fixing a migration | [docs/patterns/prisma-and-migrations.md](docs/patterns/prisma-and-migrations.md) |
| Adding a Plaid webhook or integration | [docs/patterns/external-integrations.md](docs/patterns/external-integrations.md) |
| Writing tests for handlers or services | [docs/patterns/testing.md](docs/patterns/testing.md) |
| Deep-dive on auth/permissions | [../../docs/patterns/auth-permissions.md](../../docs/patterns/auth-permissions.md) |
| Deep-dive on API layer conventions | [../../docs/patterns/api-patterns.md](../../docs/patterns/api-patterns.md) |
| Error handling and observability | [../../docs/patterns/error-handling.md](../../docs/patterns/error-handling.md) |

## Testing matrix

| Change type | Test approach |
|-------------|---------------|
| Service function | `node:test` with a fake Prisma client |
| Handler | Contract test with mocked service |
| External integration | Unit test with mocked SDK; Golden Ledger for Plaid ingest |

See [docs/patterns/testing.md](docs/patterns/testing.md) for examples.

## SDD guidance

Before building a non-trivial API feature, check for a spec in `specs/features/[feature]/spec.md`. If none exists, write one first. Read [../../specs/mission.md](../../specs/mission.md) for product context.

---

## Anti-patterns

- **Don't call `requireDemoOrAuthenticated()` manually.** Always use `withAuth` / `withDemoOrAuth` / `withPublic`.
- **Don't query Prisma directly in handler files.** Handlers call services; services own DB access.
- **Don't build business logic in route files.** Route files validate input and delegate to services.
- **Don't share Prisma client across `apps/` except through the API.** `apps/web` and `apps/mcp` connect to the DB through the API HTTP interface, not via Prisma directly. (Exception: `apps/mcp` has its own Prisma instance for read access — see `apps/mcp/AGENTS.md`.)
- **Don't add raw `console.*` calls.** Use `~/lib/logger` for structured logs.
- **Don't use `pnpm db:push` on Neon Postgres.** Use `pnpm db:migrate:dev` and commit the migration SQL.
- **Don't run `migrate dev`, `db push`, or `migrate reset` against a deployed database.** Deployed databases get migrations only via `migrate deploy`.
- **Don't add a cron route without adding it to the `crons` array in `vercel.json`** and regenerating `scripts/self-host/crontab`.

---

## Active work

- Auth + Prisma migration: [specs/features/auth-migration/spec.md](../../specs/features/auth-migration/spec.md)
- Goals feature API: [specs/features/goals/spec.md](../../specs/features/goals/spec.md)
- Apple Wallet integration: [specs/features/apple-wallet/spec.md](../../specs/features/apple-wallet/spec.md)
