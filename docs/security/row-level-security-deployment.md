# Row-Level Security Deployment & Rollback

**Related:** [row-level-security-audit.md](./row-level-security-audit.md), [database-actor-call-site-audit.md](./database-actor-call-site-audit.md), [apps/api/docs/patterns/prisma-and-migrations.md](../../apps/api/docs/patterns/prisma-and-migrations.md)

---

## Goals

1. Keep application-layer authorization (unchanged requirement).
2. Add PostgreSQL RLS as defense in depth — phase 1 financial tables, then full FORCE cutover.
3. Introduce a restricted runtime role (`moat_app`) that cannot bypass RLS.
4. Pass trusted request identity into Postgres with transaction-local GUCs (AsyncLocalStorage `db` proxy).

**Zero users / planned downtime:** use the expedited path in [row-level-security-cutover-runbook.md](./row-level-security-cutover-runbook.md) to FORCE RLS on every table in one maintenance window.

---

## Environment variables

| Variable | Purpose | Who uses it |
|----------|---------|-------------|
| `DATABASE_URL` | Pooled runtime connection | API, MCP |
| `DIRECT_URL` | Direct connection for migrations / DDL | Prisma migrate |
| `DATABASE_MIGRATION_URL` | Optional alias; if set, prefer for migrate deploy | CI (optional) |
| `MOAT_DATABASE_ACTOR_CONTEXT` | When `true`/`1` (the default), handler wrappers and MCP tools wrap work in `withDatabaseActor` | API, MCP |
| `SERVICE_DATABASE_URL` | Optional. Connection used for background jobs; defaults to `DATABASE_URL`. Set this to an unpooled URL if the pooler strips startup options | API |
| `MOAT_DATABASE_ACTOR_TIMEOUT_MS` | Request transaction timeout (default 60000) | API |
| `MOAT_DATABASE_ACTOR_MAX_WAIT_MS` | How long a request waits for a pool connection (default 5000) | API |

Do **not** put production credentials in local `.env` files.

### Recommended end state

```txt
DATABASE_URL            -> moat_app (pooled, no BYPASSRLS, not table owner)
DIRECT_URL              -> migration/owner role (direct)
MOAT_DATABASE_ACTOR_CONTEXT=true
```

### After full cutover migration (`20260729140000_rls_force_all_tables`)

FORCE RLS is on for all tables. The table-owner role **no longer bypasses** policies. Runtime must use actor context (`MOAT_DATABASE_ACTOR_CONTEXT` defaults to true) and should use `moat_app` for `DATABASE_URL`.

---

## Manual Neon setup (required before role switch)

Run as the owner/migration role against each environment:

```bash
psql "$DIRECT_URL" -f apps/api/scripts/setup-moat-app-role.sql
# Then set a strong password via Neon console or:
# ALTER ROLE moat_app PASSWORD '<secret>';
```

Inspect:

```bash
psql "$DIRECT_URL" -f apps/api/scripts/inspect-rls-roles.sql
```

Verify isolation **while connected as `moat_app`**:

```bash
psql "postgresql://moat_app:...@.../db?sslmode=require" \
  -f apps/api/scripts/verify-rls-isolation.sql
```

Expect `PASS` lines for deny-without-context, own-row reads, blocked cross-user writes, blocked mismatched inserts, service-actor elevation, and the two coverage checks (`all-tables-force-rls`, `all-tables-have-policies`).

Then verify the application plumbing against the same role:

```bash
DATABASE_URL="postgresql://moat_app:...@.../db?sslmode=require" \
  npx tsx apps/api/scripts/rls-smoke.ts
```

This covers the service startup option, request-scoped transactions, savepoint recovery after a denied write, admin and service elevation, demo overlay access, and cross-tenant denial.

---

## Deploy sequence

1. Merge migration `20260729120000_rls_phase1_financial_tables`.
2. Let CI run `pnpm db:migrate:deploy` on staging (owner/`DIRECT_URL`).
3. Run `setup-moat-app-role.sql` on staging.
4. Run `inspect-rls-roles.sql` and confirm:
   - phase-1 tables have `rowsecurity = true`
   - `moat_app.rolbypassrls = false`
   - `moat_app.rolsuper = false`
   - current runtime role ownership understood
5. Enable `MOAT_DATABASE_ACTOR_CONTEXT=true` on staging API/MCP.
6. Smoke-test authenticated reads/writes, household member access, demo mode, MCP PAT tool call, Plaid webhook → sync job, cron sync.
7. Run `verify-rls-isolation.sql` as `moat_app`.
8. Only then switch staging `DATABASE_URL` to `moat_app`.
9. Repeat for production after staging soak.

### Background jobs

Cron handlers, webhooks and the MCP auth path call `withServiceDatabaseActor`,
which does **not** open a transaction. It connects through a second pool whose
sessions already carry `app.actor_type=service`, supplied as a Postgres startup
option (`options=-c app.actor_type=service`) on the connection string. A sync
that runs for minutes would otherwise blow past the Prisma transaction timeout
and pin a connection the whole time.

The client verifies the option took effect on first use. If it did not, it logs
`service_db_startup_option_ignored` and falls back to a transaction-scoped
service actor — correct, but time-bounded. Point `SERVICE_DATABASE_URL` at the
unpooled connection string if that happens.

Do **not** give ordinary user traffic a `BYPASSRLS` role.

---

## Local development

1. Apply migrations with owner credentials (`pnpm db:migrate:dev`).
2. Optionally create local `moat_app` and point a second URL at it for RLS experiments.
3. Keep day-to-day `DATABASE_URL` on the owner role until actor context is enabled and validated.

Custom SQL policies live in migration files. Future `prisma migrate dev` schema diffs will not model policies in `schema.prisma`; do not let a generated migration drop them. Prefer additive SQL migrations for policy changes.

---

## Rollback (non-destructive)

Prefer disabling RLS over dropping policies/data:

```sql
ALTER TABLE "Transaction" DISABLE ROW LEVEL SECURITY;
-- repeat for each phase-1 table listed in the audit
```

Or revert runtime credentials:

1. Point `DATABASE_URL` back to the owner role.
2. Leave `MOAT_DATABASE_ACTOR_CONTEXT=true`. Once the full cutover migration has
   run, `FORCE` applies to the owner too, so clearing actor context denies
   everything. Only set it to `false` after RLS has been disabled.
3. Redeploy API/MCP.

To fully remove policies, add a follow-up migration that `DROP POLICY` / `DISABLE ROW LEVEL SECURITY` — never `migrate reset` on shared Neon databases.

---

## Credential rotation

1. Create a new password for `moat_app` in Neon.
2. Update Vercel/GitHub secrets for `DATABASE_URL`.
3. Redeploy API and MCP.
4. Revoke the old password after soak.

Owner/migration credentials rotate independently via `DIRECT_URL`.

---

## Observability

| Log | Emitted when | What it means |
|-----|--------------|---------------|
| `database_actor_rls_denied` | A statement inside `withDatabaseActor` is refused by a policy | Includes `actorType`, `hasUserId`/`hasActorUserId`, optional `requestId` |
| `database_actor_context_missing` | The global `db` client is used with no actor scope | Throttled to once a minute, with the call site. Under FORCE RLS these queries match nothing rather than erroring, so treat it as a bug |
| `service_db_startup_option_ignored` | The service connection came up without `app.actor_type=service` | Background jobs fell back to transaction-scoped context and are now time-bounded |
| `service_db_connect_failed` | The service connection could not be established | Same fallback as above |

Never log tokens, financial payloads, or raw SQL parameters containing PII.
