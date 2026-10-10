# Database Actor Call-Site Audit (post–FORCE RLS)

**Date:** 2026-08-03  
**Trigger:** MCP `McpToolCall` audit inserts failed under FORCE RLS because `logToolCall` ran outside `withDatabaseActor` ([PR #129](https://github.com/tyler16smith/moat-finance/pull/129)).  
**Scope:** `apps/mcp`, `apps/api` — any Prisma read/write on FORCE RLS tables without an active actor, with the wrong actor class, or with `userId` / `actorUserId` identity mismatch.  
**Related:** [row-level-security-audit.md](./row-level-security-audit.md), [row-level-security-deployment.md](./row-level-security-deployment.md), migration `20260729140000_rls_force_all_tables`.

---

## How to read this

Under FORCE RLS, Prisma only succeeds when the connection has Postgres GUCs set via `withDatabaseActor(...)`:

| GUC | Meaning |
|-----|---------|
| `app.user_id` | Effective data owner (household owner when a member acts) |
| `app.actor_user_id` | Authenticated person (token owner / session user) |
| `app.actor_type` | `user` \| `demo` \| `service` \| `admin` |

**Correct entrypoints already in repo**

| Pattern | Where |
|---------|-------|
| Request handlers | `withAuth` / `withDemoOrAuth` / `withPublic` in `apps/api/src/server/handler-wrappers.ts` |
| MCP credential bootstrap | `withMcpServiceActor` / `withDatabaseActor(service…)` in verify-token + HTTP OAuth |
| MCP authenticated tool body | `withDatabaseActor(user…)` in `apps/mcp/src/tools/registry.ts` |
| MCP tenant side effects after tool | `withMcpUserActor` in `apps/mcp/src/lib/with-user-actor.ts` (used by audit fix) |
| Actor-aware `db` proxy | `apps/api/src/server/db.ts`, `apps/mcp/src/lib/db.ts` |

**Bug shapes**

1. Touch FORCE RLS table on bare Prisma / after actor transaction ends  
2. Wrong actor class (user vs service vs admin) for that table’s policy  
3. Write with one identity, list/filter with the other (`userId` ≠ `actorUserId`)  
4. Silent failure: `try/catch` or `.catch(() => undefined)` that hides RLS denials  

Severity ranking used below: **silent failure → user-visible empty data → hard 500** (plus security when service elevation skips ownership filters).

---

## Ranked findings

### 1. Community Tips — author identity is `userId`, RLS write requires `actor_user_id`

| | |
|---|---|
| **Severity** | Hard 500 on create/update for household members; empty / wrong “my tips” + likes |
| **Type** | Identity mismatch (same class as the MCP audit bug) |
| **Policy** | `CommunityTip` write: `authorUserId = moat_actor_user_id()` only (not `moat_app_user_id()`). SELECT allows author **or** `APPROVED`. |
| **MCP** | `apps/mcp/src/tools/community-tips.ts` — create/update/list-mine/rate-limit/fingerprint/likes use `context.userId` |
| **API** | `apps/api/src/server/handlers/community-tip.ts` passes `ctx.userId` into `community-tip.service.ts` for author ownership |

For household members, `context.userId` / `ctx.userId` is the **owner**, while `actorUserId` is the member. Creates fail WITH CHECK; “my tips” filters by owner id under a member actor → empty or incorrectly includes owner’s approved tips.

**Proposed fix (MCP + API):** use `actorUserId` for Community Tip authorship, ownership checks, fingerprints, submission rate limits, “my tips”, and like attribution. Keep `userId` (effective owner) only for household financial tools. Mirror PR #129: align write identity with the list/read filter.

---

### 2. Feedback GitHub sync — fire-and-forget DB writes after actor scope

| | |
|---|---|
| **Severity** | Silent side-effect failure (row created; GitHub status update may never land) |
| **Type** | Write after / outside actor transaction + swallowed errors |
| **MCP** | `apps/mcp/src/tools/feedback.ts` calls `scheduleFeedbackGitHubSync` inside the tool body |
| **Shared** | `apps/api/src/server/services/github-feedback-sync.service.ts` — `void sync…().catch(log)`; updates `Feedback` via global `db` |

`createFeedbackRecord` runs inside the tool’s user actor (ALS), so the insert can succeed. The scheduled sync continues after `withDatabaseActor` returns: it may hold a closed transaction client via ALS, or fall back to no actor and hit FORCE RLS. Failures are logged only.

**Proposed fix:** do not spawn DB-touching work from inside an actor transaction. In the scheduler, open a **new** actor context, e.g. `withServiceDatabaseActor` / `withMcpServiceActor` (or a user actor keyed by the feedback owner) before any Prisma call. Keep structured logs; optionally surface `githubSyncStatus: FAILED` as the durable signal.

Same pattern applies when API `feedback.service.ts` schedules sync from a request that is about to end.

---

### 3. Agent failure / cancel persistence — `.catch(() => undefined)`

| | |
|---|---|
| **Severity** | Silent failure (stale `AgentRun` / steps / tool calls / widget actions) |
| **Type** | Swallowed audit/status writes (parallel to pre-fix MCP audit) |
| **Sites** | `apps/api/src/agent/moat-agent.ts`, `loop-controller.ts`, `widgets/action-executor.ts` |

Failure paths intentionally best-effort-persist, but RLS / closed-transaction errors are invisible.

**Proposed fix:** replace empty catches with a small helper that logs structured context (`feature: "agent"`, `operation`, `runId` / `stepId`, no PII) then continues. Prefer writing failure state **before** the outer actor transaction closes when possible.

---

### 4. Agent tool timeout — work continues after actor callback settles

| | |
|---|---|
| **Severity** | Hard 500 / silent partial side effects |
| **Type** | Background work after actor scope exits |
| **Sites** | `apps/api/src/agent/tools/executor.ts` (`runWithTimeout`), used under `withDatabaseActor` in chat/widget stream routes |

Timeout rejects the wrapper promise without cancelling `fn()`. Late DB writes can hit a closing or closed actor client.

**Proposed fix:** AbortSignal through tools; on timeout abort and await settle (or log late completion). Do not treat timeout as “actor context still valid.”

---

### 5. Institution catalog seed on user-scoped search

| | |
|---|---|
| **Severity** | Hard 500 on fresh/empty catalog |
| **Type** | Wrong actor class (service-only write under user/demo) |
| **Sites** | `institution-catalog.service.ts` → `ensureInitialInstitutionCatalog()` from `institutions.search` (`withDemoOrAuth`); CLI apply/sync scripts without service actor |

`CanonicalInstitution` / mappings / preferences: world-readable SELECT, **service-only** writes.

**Proposed fix:** wrap seed/apply writes in `withServiceDatabaseActor` / `withElevatedServiceActor`. Keep search reads on the request user actor. Scripts: wrap DB phase in service actor (same as `prisma/seed.ts` patterns).

---

### 6. `auth.revoke` — service actor + unscoped `sessionId` revoke

| | |
|---|---|
| **Severity** | Security (cross-session revoke if `sessionId` known); not an empty-data bug |
| **Type** | Wrong elevation for authenticated path + missing ownership filter |
| **Sites** | `apps/api/src/server/handlers/auth.ts` (`withPublic`); `token-manager.revokeSession(sessionId)` updates by id only |

`withPublic` correctly uses a service actor for capability-token flows (refresh token). Authenticated `sessionId` / `allDevices` paths stay on that service actor and never switch to a user actor; `revokeSession` has no `userId` predicate.

**Proposed fix:** keep refresh-token revoke under `withPublic` + service actor. Move `sessionId` / `allDevices` to `withAuth`. Add `revokeSessionForUser(actorUserId, sessionId)` with `updateMany({ where: { id, userId } })` and fail closed on count 0. Same ownership filter for mobile/extension revoke helpers that call bare `revokeSession`.

---

### 7. MCP `db` proxy — no missing-actor warning

| | |
|---|---|
| **Severity** | Observability gap (empty reads / write denials harder to diagnose) |
| **Type** | Silent emptiness without call-site signal |
| **Site** | `apps/mcp/src/lib/db.ts` |

API `apps/api/src/server/db.ts` rate-limits `database_actor_context_missing` with a stack snippet. MCP falls back to `mcpPrismaBase` quietly.

**Proposed fix:** mirror the API warning in the MCP proxy.

---

### 8. MCP audit insert — fixed, still fail-open

| | |
|---|---|
| **Severity** | Silent audit gap if insert fails for other reasons |
| **Type** | Known fixed instance + residual swallow |
| **Site** | `apps/mcp/src/audit/log-tool-call.ts` |

PR #129 wraps insert in `withMcpUserActor` and stores `userId: actorUserId` (matches `listMcpLogs` / PAT / OAuth ownership). Catch still logs and continues so tools succeed without a row.

**Proposed fix (product choice):** fail-closed for write tools, or durable outbox/retry with its own actor + alerting. Do not remove the structured log.

---

### 9. Legacy Prisma scripts without service actor

| | |
|---|---|
| **Severity** | Empty data / write failure for one-off ops |
| **Type** | No actor on restricted role |
| **Sites** | e.g. `apps/api/prisma/migrate-categories.ts`, `backfill-category-ids.ts` |

**Proposed fix:** `withServiceDatabaseActor` or `buildServiceDatabaseUrl` before queries; assert service actor before destructive writes.

---

### 10. Auth token validation — DB errors look like invalid tokens

| | |
|---|---|
| **Severity** | Silent auth failure → unexplained 401 |
| **Type** | Broad catch around DB under actor bootstrap |
| **Sites** | `api-context.validateJWT`, `token-manager.validateRefreshToken` |

**Proposed fix:** keep quiet for parse/verify failures; log DB-looking errors with operation name only (no token/PII).

---

## Verified correct (do not re-hunt)

| Area | Evidence |
|------|----------|
| MCP PAT/OAuth validate + `lastUsedAt` | `verify-token.ts` wraps resolve in `serviceDatabaseActor` |
| MCP DCR / authorize / token / revoke | `http.ts` uses `withMcpServiceActor` |
| MCP tool execution body | `registry.ts` wraps in user actor and injects `context.db` |
| MCP audit insert identity | `log-tool-call.ts` + `withMcpUserActor` + `userId: actorUserId` |
| MCP rate limit | Redis/in-memory only — no Prisma |
| API handler wrappers | service bootstrap → household resolve → user/demo actor |
| API `withPublic` | service actor for capability-token routes |
| API admin | `requireAdminUser` → `elevateToAdminDatabaseActor` |
| Nested `$transaction` | savepoint shim in `db-actor.ts` preserves GUCs |
| Webhooks / cron | generally `withServiceDatabaseActor` |

---

## Suggested fix order

1. **Community Tips identity** (MCP + API) — same class as #129; household members broken today.  
2. **Feedback GitHub sync actor** — silent post-request writes.  
3. **Agent fail-state logging + timeout cancellation** — silent / late DB under streams.  
4. **Institution catalog seed elevation** — hard 500 on empty catalog.  
5. **`auth.revoke` ownership + wrapper split** — security under service actor.  
6. **MCP `db` missing-actor warning** — cheap observability.  
7. Scripts + auth DB-error logging — ops quality.

For each fix, reuse existing helpers (`withMcpUserActor` / `withMcpServiceActor` / `withServiceDatabaseActor` / `withAuth`); align write/read identity; never swallow RLS denials without a structured log.

---

## Checklist for future reviews

For every new DB read/write on an RLS table:

1. Is there an active `withDatabaseActor` (or wrapper) on this connection?  
2. User vs service vs admin — correct for that table’s policy?  
3. Is the row’s ownership column the same identity the list/read path filters on (`actorUserId` vs effective `userId`)?  
4. Are failures observable, or swallowed like the original MCP audit?  
5. Nested `$transaction` / fire-and-forget — still on the actor client, or a new pool connection that drops GUCs?
