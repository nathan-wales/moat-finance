# Row-Level Security Audit — Moat Finance

**Date:** 2026-07-29  
**Scope:** `apps/api` Prisma/Postgres, auth boundaries, MCP, webhooks, cron, household sharing  
**Status:** App fixes + actor helper + ALS `db` proxy + phase-1 RLS + full FORCE migration for all tables. Expedited zero-user cutover: [row-level-security-cutover-runbook.md](./row-level-security-cutover-runbook.md).

---

## Executive summary

| Finding | Severity | Status |
|---------|----------|--------|
| No Postgres RLS on financial tables prior to this work | High (defense gap) | Phase 1 policies added |
| Runtime `DATABASE_URL` role assumed to be table owner (bypasses RLS unless non-owner/`FORCE`) | High (ops) | Documented + `moat_app` setup scripts |
| Rule create/update accepted foreign `hashtagId` (cross-user FK + name leak via include) | Medium | **Fixed** |
| Real-estate create/update accepted foreign `linkedPlaidAccountId` | Medium-low | **Fixed** |
| Agent stream routes skipped 2FA + household effective identity | Medium | **Fixed** |
| SQLite rule/account/plaid helpers mutated by id without ownership precheck | Medium (desktop) | **Fixed** |
| Many services use global Prisma singleton (blocks request-scoped GUCs) | Medium (cutover risk) | Documented; actor context opt-in |
| PAT/OAuth token tables need pre-identity lookup | — | Deferred from phase-1 RLS |

Application-layer isolation is generally strong: handlers use `withAuth` / `withDemoOrAuth`, and most queries include `userId` or fetch-then-check. RLS is defense in depth, not a replacement.

---

## Current architecture (pre-cutover)

- **DB access:** Prisma 6 → Neon Postgres (`DATABASE_URL` pooled, `DIRECT_URL` direct).
- **Authz:** TypeScript only. No prior `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` in migrations.
- **Identity:** NextAuth JWT cookie, mobile bearer JWT + `AuthSession`, demo mode, MCP PAT/OAuth, cron `CRON_SECRET`, Plaid/Stripe webhook signatures.
- **Household:** No `Household` table. `HouseholdMembership` maps `memberUserId` → `ownerUserId`. Wrappers set `ctx.userId = effectiveUserId` (owner).
- **Request DB context:** Historically none. Added `withDatabaseActor` + `MOAT_DATABASE_ACTOR_CONTEXT`.

---

## Actor matrix

| Actor | Identity verification | Scopes / roles | Ownership enforcement | DB identity today | Subject to user RLS? | Needs service context? |
|-------|----------------------|----------------|-----------------------|-------------------|----------------------|------------------------|
| Signed-in user | NextAuth cookie / mobile JWT | 2FA gate | `userId` predicates | Via wrappers when flag on | Yes (`effectiveUserId`) | No |
| Household member | Same + `HouseholdMembership` ACTIVE | Member (not billing owner) | Queries as owner id | `app.user_id=owner` | Yes | No |
| Household owner | Same | Owner-only asserts | `assertHouseholdOwner` | Same | Yes | No |
| Admin | Auth + email allowlist | App-level admin | Bypass per-user filters after `requireAdminUser` | `admin` actor, applied by `requireAdminUser` | No, once elevated | Elevation is automatic |
| MCP OAuth | Opaque hashed token + PKCE | MCP scopes | `context.userId` + scopes | Flag wires actor | Yes | No |
| PAT | Peppered hash | MCP scopes | Same as OAuth | Flag wires actor | Yes | No |
| Unauthenticated (`withPublic`) | Unguessable capability token — share slug, invite token, recovery code | Route-specific | Handler + token only | `service` actor | No | Yes; the lookups span tenants by nature |
| Plaid webhook | Plaid JWT + body hash | Provider | Map `item_id` → connection.userId | Service then user | After resolve | Yes for ingest |
| Stripe webhook | Stripe signature | Provider | Map customer/sub → user | Service | Billing tables later | Yes |
| FinanceKit import | `withAuth` | User | Strong `userId` filters | User actor | Yes | No |
| Cron / worker | `Bearer CRON_SECRET` | Secret capability | Job carries `userId` | Service (+ per-job user) | Per-job user data | Yes for scans |
| Migration | CI secrets + owner role | DDL | N/A | Owner | No | Owner role |
| Demo | Cookie/header + demo user | Read-oriented | Demo user id / overlay key | `demo` actor | Demo user only | Overlay session paths special |

---

## Table ownership matrix (all 84 models)

Legend: **RLS?** = phase-1 recommendation/status.

| Model / table | Sensitive data | Ownership | Owner columns | Indirect path | App authz | Reads scoped? | Writes scoped? | Inserts validate owner? | RLS? | Proposed policy | Indexes | Service actors | Risk | Notes / vulns |
|---------------|----------------|-----------|---------------|---------------|-----------|---------------|----------------|-------------------------|------|-----------------|---------|----------------|------|---------------|
| User | email, password, 2FA, billing ids | auth_session / mixed | `id` | — | session/JWT | self/admin | self/stripe | signup | Later | self or service | PK/email | Stripe, auth | High | No phase-1 RLS (bootstrap) |
| Account (OAuth) | OAuth tokens | auth_session | `userId` | User | NextAuth adapter | adapter | adapter | adapter | Later | user/service | +userId idx added | Auth.js | High | |
| Session | sessionToken | auth_session | `userId` | User | NextAuth | adapter | adapter | adapter | Later | user/service | +userId idx added | Auth.js | High | |
| VerificationToken | token | auth_session | identifier | — | Auth.js | token | token | token | No | service-only | unique token | Auth | Med | |
| TwoFactorToken | token | auth_session | `userId` | User | 2FA handlers | userId | userId | userId | Later | user/service | userId | Auth | High | |
| RefreshToken | token | auth_session | `userId` | User | token-manager | userId | userId | userId | Later | user/service | userId | Mobile auth | High | |
| AuthSession | device/ip | auth_session | `userId` | User | token-manager | userId | userId | userId | Later | user/service | userId | Mobile | High | |
| McpPersonalAccessToken | hash, scopes | user | `userId` | User | MCP handlers / verify | user/hash | user | actorUserId | **Deferred** | user after auth; service for hash lookup | userId, tokenHash | MCP verify | High | Pre-identity lookup |
| McpOAuthClient | secret hash | service_only | — | — | OAuth register | service | service | service | Later | service | clientId | MCP | Med | |
| McpOAuthAuthorizationCode | code hash | auth_session | `userId` | User | OAuth | hash | hash | user | Later | service/user | userId | MCP | High | |
| McpOAuthAccessToken | token hashes | auth_session | `userId` | User | OAuth | hash | hash | user | Later | service/user | tokenHash | MCP | High | |
| McpToolCall | summaries | mixed | userId?, householdId? | User | audit writer | user/admin | service | service | Later | user read / service write | userId+createdAt | MCP | Med | householdId no FK |
| HouseholdInvite | email, tokenHash | mixed | ownerUserId | User | household handlers | owner/invitee | owner | owner | Later | owner or invitee email/token | owner indexes | — | Med | |
| HouseholdMembership | membership | mixed | ownerUserId, memberUserId | Users | resolveHouseholdIdentity | member/owner | owner | owner | Later | member or owner | unique pair | — | High | RLS must allow member→owner |
| **Transaction** | amounts, merchants, raw | user | `userId` | — | handlers + scope SQL | **yes** | mostly predicate/fetch-check | userId | **Phase 1 ON** | userId or service | strong userId indexes | sync jobs | **Critical** | |
| Category | names | mixed | userId? | null=global | category handlers | user+global | user-owned only | user | Later | read global+own; write own | userId | seed | Med | |
| **CategoryBudget** | goals | user | userId | Category | spending handlers | yes | yes | yes | **Phase 1 ON** | userId/service | unique user+cat | — | High | |
| **Hashtag** | labels | user | userId | — | hashtag/rule | yes | yes | yes | **Phase 1 ON** | userId/service | unique user+name | — | High | **was attachable cross-user via rules** |
| **TransactionHashtag** | join | through | tx+tag | Transaction/Hashtag | hashtag handler | via tx | via tx | via tx | **Phase 1 ON** | both sides own | PK | — | High | RLS WITH CHECK both sides |
| **TransactionRule** | automation | user | userId | — | rule handlers | yes | yes | yes | **Phase 1 ON** | userId/service | userId+active | MCP | High | |
| **TransactionRuleCondition** | match values | through | ruleId | Rule | rule handlers | via rule | via rule | via rule | **Phase 1 ON** | via rule | ruleId | — | High | |
| **TransactionRuleAction** | actions/hashtag | through | ruleId | Rule/Hashtag | rule handlers | via rule | via rule | **fixed hashtag ownership** | **Phase 1 ON** | via rule + hashtag owner | ruleId | — | High | App fix + RLS |
| **TransactionRuleApplication** | audit link | through | tx+rule | both | engine | via tx | via tx | via tx | **Phase 1 ON** | both own | indexes | engine | Med | |
| UserSettings | prefs/age | user | userId | — | settings | yes | yes | yes | Later | userId | unique userId | — | Med | |
| **FinancialProfileData** | full profile JSON | user | userId | — | profile | yes | yes | yes | **Phase 1 ON** | userId/service | unique userId | — | **Critical** | |
| **Investment** | balances | user | userId | — | investment handlers | yes | yes | yes | **Phase 1 ON** | userId/service | userId | — | High | |
| **RealEstateInvestment** | property/loan | user | userId | optional PlaidAccount | real-estate | yes | yes | **fixed linked account** | **Phase 1 ON** | userId/service | userId | — | High | App fix |
| DemoOverlaySession | overlay JSON | mixed | userId?, sessionKey | — | demo services | sessionKey | sessionKey | public+key | Later | sessionKey/service | sessionKey | cron cleanup | Med | |
| ForecastScenario | assumptions | user | userId | — | forecast | yes | yes | yes | Later | userId | userId | — | Med | |
| **FinancialConnection** | encrypted tokens | user | userId | — | FC handlers | yes | yes | yes | **Phase 1 ON** | userId/service | userId | webhooks/sync | **Critical** | |
| **AppleFinanceKitAccount** | balances | user | userId | — | FinanceKit | yes | yes | yes | **Phase 1 ON** | userId/service | user+external | iOS | High | |
| **FinancialAccount** | balances/mask | user | userId | Connection | FC | yes | yes | yes | **Phase 1 ON** | userId/service | userId | sync | High | |
| ProviderWebhookEvent | raw payloads | background | — | connection id | webhook svc | service | service | service | Later | service-only | provider ids | webhooks | High | |
| ProviderSyncAttempt | sync meta | background | userId? | Connection | sync | service/admin | service | service | Later | service | connectionId | cron | Med | |
| ProviderSyncJob | queue | background | userId | Connection | cron | service | service | service | Later | service | status+scheduled | cron | Med | |
| CanonicalInstitution | catalog | reference | — | — | public/admin | global | admin | admin | No | read all; write admin | key | sync scripts | Low | |
| InstitutionProviderMapping | catalog | reference | — | Canonical | admin | global | admin | admin | No | same | provider unique | sync | Low | |
| InstitutionProviderPreference | catalog | reference | — | Canonical | admin | global | admin | admin | No | same | unique | admin | Low | |
| **PlaidItem** | access token enc | user | userId | — | plaid svc | yes | fetch-check | yes | **Phase 1 ON** | userId/service | userId | sync | **Critical** | |
| **PlaidAccount** | balances/mask | user | userId | PlaidItem | plaid | yes | yes | yes | **Phase 1 ON** | userId/service | userId | sync | High | |
| **BalanceSnapshot** | balances | user | userId | polymorphic source | snapshot svc | yes | yes | yes | **Phase 1 ON** | userId/service | unique tuple | jobs | High | |
| RetailConnection | retailer link | user | userId | — | retail | yes | yes | yes | Later | userId | unique | extension | Med | |
| RetailOrder | order totals/URLs | user | userId | — | retail | yes | yes | yes | Later | userId | unique | extension | Med | |
| RetailOrderItem | items | through | order | RetailOrder | retail | via order | via order | via order | Later | via order | orderId | — | Med | |
| ReferralRedemption | referral graph | mixed | referrer/referred | Users | referral | parties | service | service | Later | parties/service | indexes | billing | Low | |
| InviteCode | codes | admin | — | — | invite svc | validate | admin | admin | No | read for redeem; admin write | code | — | Low | |
| InviteCodeRedemption | redemption | user | userId | InviteCode | invite | user | user | user | Later | user | unique user | — | Low | |
| InviteCodeAttempt | attempts | user | userId | — | invite | user | user | user | Later | user | userId+time | — | Low | |
| DesktopInviteCode* | device | auth_session | desktopDeviceId | — | desktop | device | device | device | Later | device/service | device | desktop | Low | |
| DashboardWidget | layout | user | userId | — | dashboard | yes | yes | yes | Later | userId | userId | — | Low | |
| **Memory** | AI memory | user | userId | — | memory/MCP | yes | yes | yes | **Phase 1 ON** | userId/service | userId | MCP | High | |
| AgentConversation | chat | mixed | userId, householdId? | — | agent | userId | userId | userId | Later | userId (+household) | userId | agent | High | stream identity fixed |
| AgentMessage | content | through | conversation | Conversation | agent | via conv | via conv | via conv | Later | via conv | convId | agent | High | |
| AgentRun | run meta | mixed | userId | Conversation | agent | userId | userId | userId | Later | userId | unique clientRequestId | agent | High | |
| AgentRunStep | I/O JSON | through | run | Run | agent | via run | via run | via run | Later | via run | runId | agent | High | |
| AgentToolCall | I/O JSON | through | run | Run | agent | via run | via run | via run | Later | via run | runId | agent | High | |
| AgentTimelineBlock | content | through | conversation | Conversation | agent | via conv | via conv | via conv | Later | via conv | convId | agent | High | |
| AgentWidgetAction | I/O | mixed | userId | Conversation | agent | userId | userId | userId | Later | userId | userId | agent | High | |
| AiReport | report HTML | mixed | userId, visibility, shareSlug | — | ai-report | owner/public slug | owner | owner | Later | owner + public slug | shareSlug | public | High | public path |
| AiReportShare | snapshot | mixed | userId, shareSlug | Report | ai-report | slug/owner | owner | owner | Later | enabled slug / owner | shareSlug | public | High | |
| AiReportVersion | versions | through | reportId | Report | ai-report | via report | via report | via report | Later | via report | reportId | — | Med | |
| Feedback | message/screenshot | mixed | userId? | — | feedback | user/admin | user | user | Later | author/admin | userId | GitHub sync | Med | |
| WindowsWaitlist | email/ip | admin | — | — | public create | admin | admin | public | No | insert public; read admin | email | — | Low | |
| BetaAllowlist | email | admin | — | — | admin | admin | admin | admin | No | admin | email | — | Low | |
| BetaAccessRequest | email/reason | mixed | userId? | — | public/admin | admin/self | admin | public | Later | self/admin | email | — | Low | |
| DesktopVaultRecovery* | hashes/codes | auth_session | recoveryDeviceId | — | vault recovery | device | device | device | Later | device/service | device | desktop | High | |
| PromptCategory | labels | reference | — | — | public | global | admin | admin | No | read all | slug | — | Low | |
| UserPrompt | body | mixed | creatorId | — | prompt svc | owner/public/admin | owner/admin | creator | Later | visibility rules | creator | admin mod | Med | |
| PromptRevision | body | through | promptId | UserPrompt | prompt | via prompt | via prompt | via prompt | Later | via prompt | promptId | admin | Med | |
| PromptModerationEvent | moderation | admin | actorId | Prompt | admin | admin | admin | admin | Later | admin | promptId | admin | Low | |
| PromptPin | pins | user | userId | — | prompt | yes | yes | yes | Later | userId | unique | — | Low | |
| PromptLaunchStat | aggregates | service | — | — | service | global | service | service | No | service write; read ok | unique | — | Low | |
| PromptLaunchDaily | usage | user | userId | — | prompt | yes | yes | yes | Later | userId | unique | — | Low | |
| CommunityTip | tip body | public read / author write | authorUserId | — | community-tip | approved+own | author/admin | author | Later | complex | status indexes | admin/LLM | Med | |
| CommunityTipLike | likes | user | userId | Tip | community-tip | yes | yes | yes | Later | userId | unique tip+user | — | Low | |
| NotificationRule | conditions | user | userId | — | notifications | yes | yes | yes | Later (soon) | userId/service | userId | cron eval | High | |
| NotificationPreference | prefs | user | userId | — | notifications | yes | yes | yes | Later | userId | unique | — | Med | |
| NotificationDelivery | bodies | user | userId | Rule | notifications | yes | yes | yes | Later | userId/service | userId | cron | High | |
| DevicePushToken | push token | user | userId | — | push | yes | yes | yes | Later | userId | unique | — | High | |
| NotificationSuggestion | suggestions | user | userId | — | notifications | yes | yes | yes | Later | userId | unique | — | Low | |
| ExpectedRecurringEvent | amounts/accounts | user | userId | — | notifications | yes | yes | yes | Later | userId | userId | cron | Med | |

---

## Dangerous patterns reviewed

Searched for id-only `findUnique`/`update`/`delete`, unscoped `findMany`, `$queryRaw`, nested `connect`, admin/export/share/MCP paths.

**Real issues fixed**

1. `apps/api/src/server/handlers/rule.ts` — `hashtagId` on actions not ownership-checked (MCP already checked).
2. `apps/api/src/server/handlers/real-estate.ts` — `linkedPlaidAccountId` not ownership-checked.
3. Agent SSE routes — missing 2FA + household resolution.
4. SQLite repositories — rule update/delete/toggle, account upsert, plaid `setHidden`.

**Mitigated (fetch-then-check or scoped SQL)**

- Transaction list raw SQL via `transactionScopeSql` then `findMany` by ids.
- Split/unsplit, category, plaid disconnect, AI report domain layer, prompt ownership helpers, notification/memory services.

**System paths (expected cross-user, must use service actor under RLS)**

- Provider webhook ingest, sync job scanner, Stripe user mapping, cron cleanups, admin moderation lists.

---

## PostgreSQL / Neon role assumptions

Prisma datasource:

```prisma
url       = env("DATABASE_URL")
directUrl = env("DIRECT_URL")
```

Repository docs treat `DATABASE_URL` as pooled Neon and `DIRECT_URL` as direct/migration. There is **no committed proof** of `rolsuper` / `rolbypassrls` / table owner for staging/production — those must be inspected per environment:

```bash
psql "$DIRECT_URL" -f apps/api/scripts/inspect-rls-roles.sql
```

**Working assumption (typical Neon):** the role in `DATABASE_URL` owns `public` tables and therefore **bypasses RLS** unless `FORCE ROW LEVEL SECURITY` is set or the runtime role is switched to non-owner `moat_app`.

Phase 1 deliberately uses `ENABLE` without `FORCE` so current owner-based runtime keeps working.

---

## Phase 1 RLS design

### GUCs (transaction-local)

Set only inside `withDatabaseActor` via `set_config(..., true)`:

- `app.user_id` — effective data owner
- `app.actor_user_id` — authenticated actor
- `app.actor_type` — `user` | `demo` | `service` | `admin`

All three are written in one statement. Background jobs skip the transaction
entirely and get `app.actor_type=service` as a session startup option instead.

### Policy shape

```sql
USING (moat_is_service_actor() OR "userId" = moat_app_user_id())
WITH CHECK (moat_is_service_actor() OR "userId" = moat_app_user_id())
```

Indirect tables use `EXISTS` to parent ownership; `TransactionHashtag` / rule actions also require hashtag ownership on insert/update.

### Household

Because wrappers already rewrite `userId` to the owner’s id, phase-1 policies keyed on `app.user_id = effective owner` preserve household member access. Membership revocation is enforced in `resolveHouseholdIdentity` before context is set.

### Wiring

`MOAT_DATABASE_ACTOR_CONTEXT` defaults to on and wraps `withAuth`,
`withDemoOrAuth`, `withPublic`, cron and webhook entrypoints, MCP
`executeMcpTool`, and the MCP auth and OAuth routes.

---

## Full-table coverage (FORCE migration)

Migration `20260729140000_rls_force_all_tables` enables **FORCE RLS** on every public model with policies by ownership class:

- Auth/token tables → service actor for bootstrap (+ owner for self rows)
- User financial / notifications / memory → `userId` / `actor_user_id` match or service
- Indirect children → `EXISTS` parent ownership
- Catalogs (institutions, prompt categories) → world-readable SELECT, service writes
- Shared secrets (invite codes, OAuth clients, vault recovery) → service-only
- AI report shares / community tips → author, plus a narrow published-row read
- Demo overlay → service, the owning user, or a demo actor matching `demoUserId`
- Provider jobs/webhooks/waitlists → service-only

Auth hash lookups (PAT/session) run inside `createApiContext` / MCP `verifyAuthorizationHeader` under `serviceDatabaseActor`.

Helper functions are `STABLE PARALLEL SAFE`. SQL functions default to
`PARALLEL UNSAFE`, and a policy calling an unsafe function would disable
parallel plans for every query against that table.

---

## Remaining risks

1. **Request-scoped transactions pin a connection** for the wall-clock duration of the handler, including any external calls (Plaid, LLM). Bounded by `MOAT_DATABASE_ACTOR_TIMEOUT_MS`. Revisit under real load.
2. **Advisory locks widen.** `pg_advisory_xact_lock` inside a nested `db.$transaction` now releases at the end of the request, not the end of the inner block.
3. **Caught DB errors poison the request** unless they happen inside `db.$transaction(...)` (which gets a savepoint). Prefer `upsert` over create-then-catch-P2002 on the request path.
4. **HouseholdId scalars without FK** on agent/feedback/MCP audit rows — policy design unfinished.
5. **Performance** of EXISTS policies on join tables — indexes added; validate with `EXPLAIN ANALYZE` on staging.
6. **Post-cutover call-site gaps** (side effects outside actor scope, `userId` vs `actorUserId` on author-scoped tables, swallowed audit writes) — tracked in [database-actor-call-site-audit.md](./database-actor-call-site-audit.md).

---

## Verification commands

```bash
# App unit tests (ownership + actor helpers)
pnpm --filter moat-api run test:api-contracts

# Staging role/policy inspection
psql "$DIRECT_URL" -f apps/api/scripts/inspect-rls-roles.sql

# Isolation proof as moat_app
psql "$MOAT_APP_DATABASE_URL" -f apps/api/scripts/verify-rls-isolation.sql

# Application actor plumbing against the same role
DATABASE_URL="$MOAT_APP_DATABASE_URL" npx tsx apps/api/scripts/rls-smoke.ts
```

---

## Implementation summary checklist

- [x] Security audit document (this file)
- [x] Ownership / policy matrix
- [x] Application-layer authorization fixes
- [x] Restricted role setup SQL (`setup-moat-app-role.sql`)
- [x] `withDatabaseActor` helper + ALS-backed `db` proxy
- [x] Phase-1 RLS migration + full FORCE cutover migration
- [x] Cross-user tests (unit + SQL verification + `rls-smoke.ts`)
- [x] Background-job service connection (startup option, not a transaction)
- [x] Admin elevation, invite-code / OAuth consent elevation
- [x] MCP OAuth and auth routes under service actors
- [x] Deployment / cutover / rollback documentation
