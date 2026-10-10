# Pattern: Prisma and Migrations (apps/api)

## Schema ownership

The single source of truth for the database schema is `apps/api/prisma/schema.prisma`. No other app should have a competing Postgres schema or run migrations.

- The generated Prisma client is committed at `apps/api/generated/prisma/`.
- After modifying `schema.prisma`, regenerate the client: `pnpm db:generate` (from repo root).
- Self-hosted deployment and upgrades: [docs/self-hosting.md](../../../docs/self-hosting.md).

---

## Environment model

Use **separate Postgres databases** per environment:

```txt
dev/local  -> apps/api/.env (DATABASE_URL / DIRECT_URL), e.g. ./start-database.sh
deployed   -> your deployment's own secrets (self-hosted: the root .env, see docs/self-hosting.md)
```

`apps/api/.env` must point at the **dev/local** database only. Never use deployed (production) credentials in local `.env` files to apply schema changes.

### Row-level security roles

RLS policies live in SQL migrations (not in `schema.prisma`). Preserve them when creating future migrations — do not let a generated diff drop policies. Every public table is FORCE-enabled after `20260729140000_rls_force_all_tables`.

| Variable | Role | Purpose |
|----------|------|---------|
| `DATABASE_URL` | `moat_app` | Runtime pooled traffic subject to RLS |
| `DIRECT_URL` | migration/owner | Migrations and DDL |
| `SERVICE_DATABASE_URL` | optional | Background-job pool; use unpooled if the pooler strips startup options |
| `MOAT_DATABASE_ACTOR_CONTEXT` | n/a | Defaults on; wraps handlers/MCP in `withDatabaseActor` |

Full cutover steps, inspection SQL, and rollback: [docs/security/row-level-security-deployment.md](../../../docs/security/row-level-security-deployment.md). Planned-downtime runbook: [docs/security/row-level-security-cutover-runbook.md](../../../docs/security/row-level-security-cutover-runbook.md). Audit matrix: [docs/security/row-level-security-audit.md](../../../docs/security/row-level-security-audit.md).

---

## Migration workflow

Every schema change must produce a **committed migration file**. Migrations are the only supported path for Neon Postgres — not `db push`.

### Local dev (create migrations)

After editing `schema.prisma`:

```bash
pnpm db:migrate:dev --name descriptive_change_name
pnpm db:generate
pnpm db:validate
```

Review the generated SQL in `apps/api/prisma/migrations/` before committing. Commit `schema.prisma` and the new migration folder in the same PR.

Optional: `pnpm db:migrate` applies pending migrations to the local dev database via `migrate deploy`.

### Deployed databases (apply migrations)

Deployed databases only ever get committed migrations via `migrate deploy`:

```bash
pnpm db:migrate:deploy
```

The self-hosted Docker stack does this automatically: the one-shot `migrate` service runs `prisma migrate deploy` before `api` and `mcp` start (see [docs/self-hosting.md](../../../docs/self-hosting.md#upgrading)).

---

## Do / Don't (humans and agents)

| Do | Don't |
|----|-------|
| Use `pnpm db:migrate:dev` locally to create migrations | Use `pnpm db:push` on any Neon database (dev, staging, production) |
| Commit `schema.prisma` + migration SQL together | Change `schema.prisma` without a migration file |
| Review generated migration SQL before committing | Edit migration files that are already applied in any environment |
| Apply only `pnpm db:migrate:deploy` to deployed databases | Run `migrate dev`, `db push`, or `migrate reset` against a deployed database |
| Keep `apps/api/.env` on a dev/local database only | Point local `.env` at a deployed database to "quickly apply" schema changes |
| Create a new migration to fix a bad migration | Manually patch production schema outside migration history |

### Why `db push` is forbidden on Neon

`prisma db push` applies schema changes without writing migration history. That causes drift: fresh databases fail `migrate deploy`, CI breaks, and staging/production fall out of sync with `prisma/migrations/`.

Desktop SQLite (`packages/db-sqlite`) is separate — local Electron migrations follow [apps/desktop/AGENTS.md](../../../desktop/AGENTS.md).

---

## When a migration fails (P3018)

1. Fix the SQL in the **pending** migration file (or add a follow-up migration if already applied elsewhere).
2. On the affected database: `pnpm exec prisma migrate resolve --rolled-back <migration_name>` (from `apps/api`).
3. Re-run `pnpm db:migrate:deploy`.

**Never manually edit migrations that are already applied in production.** If the SQL must change after deploy, add a new migration instead.

**Never run `prisma migrate reset`** on shared Neon databases — it wipes all data.

Legacy recovery (db-push databases with no migration history) is a one-time manual operation documented in git history. Normal workflow should never require it again if the rules above are followed.

---

## Schema conventions

- **All user-owned models have a `userId` field** (string, foreign key to `User.id`).
- **All models have `createdAt` and `updatedAt`** timestamps (use `@default(now())` and `@updatedAt`).
- **Foreign key relations are named clearly** — avoid Prisma's generated `userId_fk` names by specifying `@relation` explicitly.
- **Use `cuid()` for IDs** (`@default(cuid())`) — consistent with existing models.

```prisma
model Goal {
  id          String   @id @default(cuid())
  userId      String
  name        String
  targetAmount Decimal
  targetDate  DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

---

## Prisma in services

All Prisma access belongs in `src/server/services/`. The `db` client is imported from `~/server/db`.

```ts
import { db } from "~/server/db";

// Always scope queries to userId — never return data without a userId filter
const goals = await db.goal.findMany({
  where: { userId },
  orderBy: { createdAt: "desc" },
});
```

### Ownership checks before mutations

Before any `update` or `delete`, verify the record belongs to the requesting user:

```ts
const existing = await db.goal.findFirst({
  where: { id: input.id, userId },
});
if (!existing) {
  throw new Error("Not found");
}
await db.goal.update({ where: { id: input.id }, data: { ... } });
```

---

## `transaction-scope.ts`

`src/lib/transaction-scope.ts` provides reusable Prisma / SQL scoping helpers for transaction queries:

```ts
import {
  buildTransactionWhere,
  transactionScopeSql,
} from "~/lib/transaction-scope";

db.transaction.findMany({
  where: buildTransactionWhere({ userId: ctx.userId, /* filters */ }),
});
```

Household access is modeled by resolving `effectiveUserId` (owner) in handler wrappers, not a separate `householdId` filter on transactions.

### Ownership helpers

Prefer ownership predicates in the query itself. For foreign IDs from the client, use:

```ts
import { assertOwnedHashtagIds, assertOwnedPlaidAccountId } from "~/server/lib/ownership";
```

For request-scoped Postgres RLS context (when enabled):

```ts
import { userDatabaseActor, withDatabaseActor } from "~/server/db-actor";

await withDatabaseActor(userDatabaseActor({ userId, actorUserId }), async (db) => {
  return db.transaction.findMany({ where: { userId } });
});
```

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a new model + migration | This file |
| Self-hosted deployment and upgrades | [docs/self-hosting.md](../../../docs/self-hosting.md) |
| Auth context for userId scoping | [auth-and-permissions.md](auth-and-permissions.md) |
| External data that Prisma stores | [external-integrations.md](external-integrations.md) |
