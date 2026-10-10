# Expedited Full RLS Cutover Runbook (zero users / planned downtime)

Use this when you can take the API/MCP offline for ~1 hour and have **no production end-user traffic**. Data is preserved; only access control and roles change.

## Why this is faster than the soft rollout

| Soft rollout | Expedited cutover |
|--------------|-------------------|
| ENABLE RLS, no FORCE | ENABLE + **FORCE** on all tables |
| Owner `DATABASE_URL` still bypasses | Owner is subject to RLS; prefer `moat_app` runtime |
| Opt-in actor context | Actor context **on by default** |
| Global Prisma missed GUCs | `db` proxy + AsyncLocalStorage inherits actor tx |
| Phase-1 financial tables only | **All 84 tables** policied |

## Actor model

| Actor | Set by | Sees |
|-------|--------|------|
| `user` / `demo` | `withAuth`, `withDemoOrAuth` | Own rows, plus household owner rows when acting as a member |
| `service` | `withServiceDatabaseActor`, `withPublic`, MCP auth/OAuth | Everything; used where no user identity exists yet |
| `admin` | `requireAdminUser` after the admin check | Everything; moderation and support queues |

There is no unauthenticated actor. A request with no context matches no rows.

## Pre-flight

1. Put API + MCP in maintenance (stop cron, pause Vercel or scale to zero).
2. Snapshot / confirm Neon PITR is available (no data delete required).
3. Ensure this PR is deployed to the environment you are cutting over.
4. Have owner credentials in `DIRECT_URL` and a password ready for `moat_app`.

## Cutover steps (~45–60 minutes)

```bash
# 1) Apply migrations (owner / DIRECT_URL)
cd apps/api
pnpm db:migrate:deploy

# 2) Create restricted runtime role (once per env)
psql "$DIRECT_URL" -f scripts/setup-moat-app-role.sql
# Set password in Neon console or:
# ALTER ROLE moat_app PASSWORD '<secret>';

# 3) Inspect
psql "$DIRECT_URL" -f scripts/inspect-rls-roles.sql
# Expect: all public tables rowsecurity=true, forcerowsecurity=true
# Expect: moat_app rolbypassrls=false, rolsuper=false

# 4) Prove isolation AS moat_app
psql "postgresql://moat_app:<secret>@HOST/DB?sslmode=require" \
  -f scripts/verify-rls-isolation.sql
# Expect PASS on every line, including all-tables-force-rls and
# all-tables-have-policies.

# 5) Prove the application actor plumbing against the same role
DATABASE_URL="postgresql://moat_app:<secret>@HOST/DB?sslmode=require" \
  npx tsx scripts/rls-smoke.ts
# Exercises the service startup option, request transactions, savepoint
# recovery, admin/service elevation, demo overlay access and cross-tenant
# denial. Any FAIL blocks the cutover.

# 6) Point runtime at moat_app + keep actor context on
# Vercel / GitHub env:
#   DATABASE_URL = pooled moat_app URL
#   DIRECT_URL   = owner direct URL
#   MOAT_DATABASE_ACTOR_CONTEXT = true   # default; set explicitly

# 7) Bring API + MCP back up. Re-enable cron.
```

### Confirm the service connection

Background jobs do not use an interactive transaction. They connect through a
second pool whose sessions start with `app.actor_type=service`, supplied as a
Postgres startup option on the connection string. Step 5 fails its first check
if the pooler strips that option.

If it is stripped, set `SERVICE_DATABASE_URL` to the **unpooled** connection
string and re-run. The code falls back to a transaction-scoped service actor
when no usable service connection exists, and logs
`service_db_startup_option_ignored` — watch for that line after the first cron
run. The fallback is bounded by the Prisma transaction timeout, so long syncs
will fail under it.

## Smoke checklist (15 minutes)

- [ ] Health endpoint
- [ ] Sign-in (Google/credentials) + session cookie API call
- [ ] Mobile JWT auth path if used
- [ ] Demo mode enter/exit
- [ ] Create transaction / list transactions
- [ ] Household invite accept (if testing membership)
- [ ] MCP PAT tool call (`moat.listAccounts`)
- [ ] Plaid webhook ingest (sandbox) or enqueue sync job
- [ ] Cron `process-provider-sync-jobs` with `CRON_SECRET`

## Rollback (no data loss)

`FORCE` applies to the table owner too, so reverting `DATABASE_URL` to the owner
role is **not** sufficient on its own — the owner is still denied without actor
context. Choose one:

1. **Keep RLS, drop the app role.** Revert `DATABASE_URL` to the owner and leave
   `MOAT_DATABASE_ACTOR_CONTEXT=true`. Actor context still satisfies every
   policy. This is the safest rollback and the one to reach for first.
2. **Turn RLS off.** Apply a new migration running
   `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY` for all tables, then set
   `MOAT_DATABASE_ACTOR_CONTEXT=false`. Never `migrate reset`.

Policies can stay in place while disabled; re-enabling is a one-line migration.

## What still requires care

- **Requests run inside one transaction.** Everything a request writes commits
  or rolls back together, and a failed statement aborts the rest unless it was
  inside a `db.$transaction(...)` block (those get a savepoint). Prefer `upsert`
  over create-then-catch-P2002 in request-path code.
- **External calls hold a connection.** A handler that calls Plaid or an LLM
  mid-transaction pins its database connection for the round trip, and is
  bounded by `MOAT_DATABASE_ACTOR_TIMEOUT_MS` (default 60s). Long agent SSE
  requests raise their own timeout. Revisit pooling before real load.
- **Advisory locks widen.** `pg_advisory_xact_lock` inside a nested
  `db.$transaction` now releases at the end of the request rather than the end
  of the inner block.
- **Elevation is deliberate.** `requireAdminUser` elevates to the admin actor
  after the admin check; invite-code redemption and the OAuth consent lookup
  elevate to a service actor and revert immediately. Grep for
  `withElevatedServiceActor` before adding another.
- **Unauthenticated routes are service actors.** `withPublic` resolves
  capability tokens across tenants by nature, so RLS adds nothing there. Keep
  that surface small and keep the authorization in the handler.
