# Plaid Integration E2E Tests (Golden Ledger)

## Status

Shipped (Phases 1–7), revision 7. Created 2026-09-09 from [context.md](context.md). Revision 7 is a post-implementation review against the code: line numbers, CI matrix, package layout, Playwright vs headless ownership, and open questions. Remaining follow-ups are listed explicitly; they are not unfinished phases of this plan.

Reviewed: `@moat/plaid-golden-ledger`, `apps/api/src/server/plaid/**`, `apps/api/src/server/services/provider-{webhook,sync-job}.service.ts`, `apps/api/pages/api/webhook/plaid.ts`, `apps/api/pages/api/cron/process-provider-sync-jobs.ts`, `apps/desktop/src/main/plaid/**`, `apps/web/e2e/**`, `apps/desktop/e2e/**`, `.github/workflows/{ci,plaid-golden-e2e,plaid-golden-desktop-e2e,plaid-sandbox-nightly}.yml`, `packages/domain/src/transactions/transaction-sync-audit.ts`, `packages/openapi/api-v1.yaml`, and the sibling Plaid specs.

## Goal

Prove that web (API + Postgres) and desktop (Electron + SQLite) ingest the same 365-day Plaid history into the **same canonical financial meaning**, even though they get there differently (queued webhook jobs + status polling vs local retry/polling).

Do this with a version-controlled **Golden Ledger** fixture and a mocked Plaid network boundary — not by asking Plaid Sandbox to encode every edge case.

Success means:

- Starting from an empty database, both platforms ingest the Golden Ledger through production connect/sync/mapping/rules/pairing/visibility code and dump a `NormalizedFinancialState` that equals a checked-in expected snapshot.
- Web and desktop are each compared to that snapshot (not only to each other), so a shared bug cannot pass.
- Idempotent re-sync, duplicate webhook delivery, duplicate sync pages, later added/modified/removed mutations, transfer un-pairing, and reconnect/already-linked do not change identity or double-count spending.
- Every `staging` sync can prove the above without talking to Plaid. Nightly jobs prove the real Plaid adapter still works against Sandbox. Pushing `main` does not run CI.

## Product Context

Connecting a bank is the moment Moat becomes a financial graph instead of an empty app. Users judge that moment by whether:

- Recent activity appears quickly.
- The rest of the year arrives without duplicate spending.
- Costco is Groceries (unless a rule says otherwise).
- Checking → savings and card payments disappear from spending without disappearing from the transaction list.
- Disconnecting and linking the same bank does not clone a year of history.

Web and desktop already share mapping, rules, pairing, watermarks, and visibility rules. They diverge on **where work runs** and **how the rest of the year arrives**. A conventional Playwright happy-path (“Link opened, overlay dismissed”) will not catch a pairing window change that hides two legitimate $900 purchases, or a reconnect watermark that re-imports 11 months of Costco. This suite is the regression net for that pipeline.

This is infrastructure for product trust, not a user-facing screen. It supports the mission that categorization and cash-flow numbers are accurate enough to trust without manual correction.

## Current Repo Context

### What exists

`@moat/plaid-golden-ledger` is the shared fixture, mock Plaid server, expected-state projector, dump contract, webhook signer, and reconnect ledger. Headless runners and Playwright Goldens consume it. Nightly Sandbox smoke talks to real Plaid and is **not** a second Golden snapshot.

| Layer | Today |
|-------|--------|
| Test runner | `node:test` via `tsx` everywhere. **No Jest, no Vitest.** `turbo.json` has no `test` pipeline. |
| Staging tests | Root `pnpm ci:test` on every `staging` push: API contracts, `@moat/ui`, Golden ledger package, headless web Golden (including reconnect), desktop Plaid unit + headless Golden (including reconnect), `@moat/domain`, `@moat/db-sqlite`, `@moat/category-mapping`, `@moat/financial-data-providers`. Pushing `main` does not run CI. |
| Not in CI | `apps/mcp` tests. |
| `apps/web` | `test:e2e:plaid-golden` (Playwright). No unit `test` script. |
| `apps/desktop` | `test` (unit), `test:plaid-golden` (headless), `test:e2e:plaid-golden` (Playwright Electron, unpacked `electron-vite` build). |
| E2E workflows | Called from `deploy-staging.yml` on every `staging` push. Also `workflow_dispatch`. Nightly Sandbox: `.github/workflows/plaid-sandbox-nightly.yml` (smoke only; skips cleanly without secrets). |
| CI database | `ci.yml` and the web Playwright workflow run Postgres 16 and `pnpm db:migrate:deploy`. Existing API contract tests still use inline `createMockDb()` fakes. |
| CI path filters | None on staging. Full unit + Playwright Goldens run on every sync. |
| Electron in CI | `ELECTRON_SKIP_BINARY_DOWNLOAD=1` at `ci.yml`, `security.yml`, `deploy-staging.yml` deploy job, `deploy-production.yml`. Desktop Playwright Golden runs `ensure-electron` (electron's `install.js`) plus a zip cache; `desktop-release.yml` downloads Electron. Neither runs `electron-builder` for Golden. |
| Docs | `apps/api/docs/patterns/testing.md` documents `node:test` + `tsx`. `apps/web/docs/patterns/testing.md` and `apps/web/e2e/README.md` document Playwright Golden. `apps/desktop/e2e/README.md` documents the unpacked Electron runner. Playwright is recorded in [tech-stack.md](../../tech-stack.md). |

### Golden path (production)

Shared sequence after Plaid Link returns a `public_token`:

1. Exchange token, upsert `PlaidItem` (encrypted access token, institution id/name).
2. Already-linked / reconnect matching: collapse live duplicates, skip sibling live accounts, adopt revoked rows.
3. `/accounts/get` → `PlaidAccount` upserts. `syncEnabled: false` accounts are omitted from the transaction account map. Added/modified txs for those Plaid `account_id`s are **not persisted** ([skip-disconnected-plaid-account-transactions](../skip-disconnected-plaid-account-transactions/spec.md)).
4. Web also creates `FinancialConnection` / `FinancialAccount`. Desktop does not. Both persist billed/available/consented products.
5. First `/transactions/sync` with a null cursor (typically ~30 recent days, not the full 365). **All pages are collected before any writes** (`syncTransactions.ts` restart loop at `:435`). Upsert key is `(userId, externalTransactionId)`. Removed ids are soft-deleted (`removedAt`). Reconnect overlap windows skip re-import of `added` rows.
6. Seed category from Plaid Personal Finance Category v2 (`packages/category-mapping/src/plaid.ts`). Existing non-Uncategorized `categoryId` is not overwritten (`apps/api/src/server/plaid/mapping.ts:178-181, 249`), and this applies to `modified` rows too because both engines prefetch `existingTransaction` for the modified path.
7. Active user rules run on the synced ids only (`applyRulesToSyncedTransactions` / `applyRulesAfterDesktopPlaidSync`).
8. Transfer pairing (`packages/domain/src/transfer-pairing/match-transfer-legs.ts`) hides matching legs (`hidden` + `autoHiddenAsTransfer`) and `reconcileBrokenTransferPairs` un-hides auto-hidden pairs that no longer match.
9. Web takes a net-worth snapshot and records account-balance history. Desktop records balance history on later scheduled syncs.
10. Rest of the year: web via **queued** webhook jobs plus overlay polling of `getImportStatus`; desktop via `waitForTransactionsProductReady` then `catchUpHistoricalTransactions` (no webhooks).
11. UI unblocks when accounts exist and historical import is complete (or the overlay times out at `IMPORT_SYNCING_TIMEOUT_MS` = `150_000`). React Query caches invalidate.
12. Visibility is query-time: the transaction list can include hidden transfer rows (grayed); spending/budget/cash-flow use `apps/api/src/lib/transaction-scope.ts` (hidden, `removedAt`, and hidden categories excluded by default, canonical date `COALESCE(postedDate, date)`). Hidden / `syncEnabled: false` accounts stay off the profile and out of net worth.

### The web historical path is a job queue, not an inline sync

A webhook POST does *not* run the sync engine in the same request. The full chain is:

```text
POST /api/webhook/plaid                       apps/api/pages/api/webhook/plaid.ts:119
  → verifyPlaidSignature (ES256 JWT)                                        :48-117
  → storeProviderWebhookEvent({ providerConnectionId: item_id })            :168
  → processProviderWebhookEvent(event.id)                                   :193
      → FinancialConnection lookup by (provider, providerConnectionId)
        provider-webhook.service.ts:130   (falls back to PlaidItem.plaidItemId + ensureFinancialConnection)
      → enqueueProviderSyncJob(...)                                         :232
          → db.providerSyncJob.create(...)      provider-sync-job.service.ts:87
          → scheduleProviderSyncJobKick(job.id)                             :103
              → void fetch(POST /api/cron/process-provider-sync-jobs)
                provider-sync-job-kick.ts:49   ← fire-and-forget, needs CRON_SECRET
  → 204 returned to Plaid (sync has NOT run)

POST /api/cron/process-provider-sync-jobs      pages/api/cron/process-provider-sync-jobs.ts:47
  → processProviderSyncJobById(jobId)           provider-sync-job.service.ts:155
      → runSync → syncTransactionsForPlaidItem  connection-sync-orchestrator.service.ts:81
          → syncTransactionsForItem             plaid-connection-sync.service.ts:174
                                                → syncTransactions.ts:292
```

Consequences for this suite (all shipped):

- Tests **drive the worker explicitly** — `processProviderSyncJobById` in-process (headless + Playwright `golden:drive-historical`). Relying on the fire-and-forget kick is a race.
- Headless runners `delete process.env.CRON_SECRET` so `kickProviderSyncJob` logs `provider_sync_job_kick_skipped_missing_secret` and returns without firing. Playwright sets `CRON_SECRET` to `""` in `apps/web/playwright.config.ts`.
- `ProviderWebhookEvent` and `ProviderSyncJob` status transitions are assertable. Headless asserts duplicate `HISTORICAL_UPDATE` → `IGNORED_DUPLICATE` and **no second job**. Playwright `drive-historical` posts the duplicate (expects 204) but does not re-assert job count.
- The fallback drain is a Vercel daily cron (`apps/api/vercel.json:15-18`, `0 7 * * *`) — irrelevant to tests but explains why nothing self-heals quickly in production.

Webhook HTTP aliases still exist: `pages/api/webhooks/plaid.ts` and `pages/api/plaid/webhook.ts` (both `export { config, default }`). Production link tokens attach the **plural** URL `${API_BASE_URL ?? NEXTAUTH_URL}/api/webhooks/plaid` (`link.ts:63-74`). Golden posts hit the singular `/api/webhook/plaid` route; both are the same handler.

### `getImportStatus` can finish the import without any webhook

`getHistoricalImportStatusForItem` (`service.ts:601-657`) probes Plaid directly with `transactionsSync({ cursor, count: 1 })` and reads `transactions_update_status`. When it equals `HISTORICAL_UPDATE_COMPLETE` **and** the probe shows undelivered data (`has_more` or non-empty added/modified/removed), it calls `syncTransactionsForItem` to drain. So:

- `transactions_update_status` comes from **`/transactions/sync`**, not `/item/get`. The mock returns it on sync responses.
- While status is not complete, polling returns `false` and imports nothing. Polling is a *completion detector plus final drain* — not a substitute for the webhook-driven middle pages.
- The web historical phase therefore has **two independently testable routes**, and both matter: the queued webhook job (imports middle pages) and the polling drain (finishes and unblocks the overlay).

The overlay poll lives in `apps/web/src/lib/plaid-import-status.ts` (3s interval, `GET /api/v1/plaid/getImportStatus?itemId=`). The operation is in `packages/openapi/api-v1.yaml` (`operationId: getPlaidImportStatus`). The overlay can keep using raw `fetch`.

### What differs (web vs desktop)

| Step | Web | Desktop |
|------|-----|---------|
| After Link success | One API call: `exchangePublicTokenForItem` (exchange + accounts + **first transaction sync** + snapshot) | `connectItem` (exchange + accounts only, **no transactions**), then renderer `syncItem` |
| Rest of the year | Webhook → `ProviderSyncJob` → cron worker → sync engine; overlay polls `getImportStatus` | `waitForTransactionsProductReady` then `catchUpHistoricalTransactions` |
| Database | Postgres via `apps/api` | SQLite in Electron main (`@moat/db-sqlite`, SQLCipher) |
| Concurrency guard | `pg_advisory_lock` (`plaid/lock.ts:51`) | In-process `Map<string, Promise>` mutex (`sync-transactions.ts:81`) |
| Sync result shape | `SyncTransactionsResult` = `{ addedCount, modifiedCount, removedCount, nextCursor, skippedDisabledAccountCount, reconnectOverlapSkipped, audit }` | Same shape (desktop historically exposed `skippedHistoricalCount`; audit field is now `reconnectOverlapSkipped`) |
| Product-not-ready | Not detected in the API engine at all | Empty first page + no cursor (`sync-transactions.ts:483-487`) + `isTransactionsProductNotReady` |
| Ongoing updates | Webhooks + cached/stale sync | 30-minute `apps/desktop/src/main/plaid/scheduler.ts` |
| Holdings | Not part of first exchange; later connection sync | `syncItem` calls `maybeSyncHoldingsForItem` after transactions (`service.ts:643`) |
| Link token | Attaches webhook URL, default `${API_BASE_URL ?? NEXTAUTH_URL}/api/webhooks/plaid` (`link.ts:63-74`) | No webhook |
| Connect UX | `DirectPlaidConnectLauncher` opens Link immediately | Privacy notice dialog first, then Link |

There is no standalone reconciliation/dedup job after sync. Identity is the `(userId, externalTransactionId)` unique key plus reconnect watermarks during upsert. Transfer-pair reconciliation is the closest “reconcile” step.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|--------|
| Token exchange + accounts + initial sync | `apps/api/src/server/plaid/service.ts` `exchangePublicTokenForItem` (`120-433`) | Web production entry; returns `ExchangePublicTokenResult` with `outcome` |
| Desktop connect / sync | `apps/desktop/src/main/plaid/service.ts` `connectItem` (`79-389`), `syncItem` (`560-650`) | Desktop production entries. `syncItem` accepts optional `catchUpDeps` |
| Transaction sync engine | `apps/api/src/server/plaid/syncTransactions.ts` `syncTransactionsForItem` (`292`) | Pages-before-writes, chunked upserts, advisory lock, `count: 500` |
| Desktop sync engine | `apps/desktop/src/main/plaid/sync-transactions.ts` | Same guarantees; in-process mutex |
| Mutation-during-pagination restart | `isPlaidMutationDuringPagination` + `restartNeeded` loop (`syncTransactions.ts:435`) | Restarts from the original cursor; mock `armMutationDuringPagination()` |
| Webhook HTTP + signature | `apps/api/pages/api/webhook/plaid.ts` (`verifyPlaidSignature` `48-117`) | Aliases re-export the same handler. Unsigned POST → 401 (`webhook-unsigned.test.ts`) |
| Webhook store/process | `apps/api/src/server/services/provider-webhook.service.ts` | `storeProviderWebhookEvent` (`13-90`), `processProviderWebhookEvent` (`92-259`) |
| Job queue + worker | `provider-sync-job.service.ts`, `pages/api/cron/process-provider-sync-jobs.ts` | `ProviderSyncJob` Prisma table; POST `{ jobId }` or GET batch of 25 |
| Webhook classify | `packages/financial-data-providers/src/providers/plaid/plaid.webhook.ts` | `SYNC_UPDATES_AVAILABLE`, `INITIAL_UPDATE`, `HISTORICAL_UPDATE`, `DEFAULT_UPDATE`; requires `webhook_type === "TRANSACTIONS"` |
| Import status | `getHistoricalImportStatusForItem` (`service.ts:601-657`); polled by `apps/web/src/lib/plaid-import-status.ts` | In OpenAPI as `GET /api/v1/plaid/getImportStatus` |
| Desktop catch-up | `apps/desktop/src/main/plaid/initial-sync-retry.ts` | `PRODUCT_NOT_READY_RETRY_DELAYS_MS` (`38-40`), `HISTORICAL_CATCH_UP_RETRY_DELAYS_MS` (`43-45`, sums to ~10 minutes after first non-empty page), `DesktopTransactionSyncCatchUpDeps` (`145-150`). Also `PLAID_CATCH_UP_DELAYS_MS` / `PLAID_HISTORICAL_CATCH_UP_DELAYS_MS` env |
| PFC → Moat category | `packages/category-mapping/src/plaid.ts` | `FOOD_AND_DRINK_GROCERIES` → `"Groceries"` (`21`), `TRANSFER_OUT`/`TRANSFER_IN` → `"Transfer"` (`51-52`), unknown → `"Uncategorized"` (`77`) |
| Canonical category seed | `CANONICAL_DEFAULT_CATEGORIES` (`packages/category-mapping/src/canonical-categories.ts`); `apps/api/prisma/seed.ts`; `seedDefaultCategories(db)` (`packages/db-sqlite/src/migrations.ts:1596`) | SQLite ids are deterministic `default-<slug>` via `canonicalCategoryId(name)` |
| Category name → id | `loadCategoryNameToIdMap` / `buildCategoryNameToIdMap` (`apps/api/src/server/services/category-import.service.ts`) | |
| Category preservation | `apps/api/src/server/plaid/mapping.ts`, `apps/desktop/src/main/plaid/mapping.ts` | Desktop sets `categoryId` only (no denormalized `category` column) |
| Rules on import | `applyRulesToSyncedTransactions(userId, externalTransactionIds)` (`transaction-rules-on-import.service.ts:30`) | Desktop: `applyRulesAfterDesktopPlaidSync(transactionIds, deps?)`. **Both return `Promise<void>`**; audit `rulesApplied` is currently `0` |
| Transfer pairing | `match-transfer-legs.ts` (`legsFormValidTransferPair` `112-128`); adapters `apps/api/src/server/services/transfer-pairing.service.ts`, `apps/desktop/src/main/plaid/transfer-pairing.ts` | Adapters return `{ pairsCreated, pairsReconciled }` |
| Pair reconciliation | `reconcileBrokenTransferPairs` (api `:376`, desktop `:352`) | Clears `transferPairId`, `hidden`, `autoHiddenAsTransfer` for auto-hides only |
| Overlap skip | `packages/domain/src/transactions/transaction-sync-watermark.ts` | Pure helpers only; load/advance live in `apps/{api,desktop}/.../transaction-sync-watermarks.ts` |
| Already-linked | `apps/api/src/server/plaid/match-live-accounts.ts` + `account-fingerprints.ts` | Desktop mirror: `apps/desktop/src/main/plaid/match-live-accounts.ts` |
| Adopt revoked | `adopt-revoked-accounts.ts` (both apps), `match-adoptable-accounts.ts` (desktop) | Adoption is institution-scoped; fingerprints are not |
| Connect outcome | `ExchangePublicTokenOutcome` = `"connected" \| "already_linked" \| "partial"` (`service.ts:75-77`); desktop `ConnectItemOutcome` (`service.ts:64`) | |
| Net worth sign | `accountNetWorthContribution` (`packages/domain/src/dashboard/account-net-worth.ts:28`) | Credit/loan negated; loans/mortgages default out |
| Transaction scope | `apps/api/src/lib/transaction-scope.ts` | No desktop equivalent file — production UI queries live in `packages/db-sqlite/src/repositories/*`. Golden dumps do **not** call those helpers (see dump aggregates below) |
| Unit tests to keep | `apps/api/src/server/plaid/*.test.ts`, `apps/desktop/src/main/plaid/*.test.ts`, `packages/category-mapping/*.test.ts`, pairing + watermark tests | Golden E2E does not replace these |
| Golden-fixture precedent | `packages/domain/src/retirement/golden-ledger.test.ts` | Inline fixture builders + explicit `assert.equal` identities — not on-disk snapshots. Style precedent only |

### Remaining follow-ups (not unfinished phases)

These are the only items still deferred after Phases 1–7:

- **`rulesApplied` is always `0`.** Both rules functions still return `Promise<void>`. Land counts with the production audit-logging PR.
- **Production structured audit log** is still a separate PR after the tests. Engines already return `TransactionSyncAudit`; they do not emit it to Axiom yet.
- **Dump aggregates are computed in `@moat/plaid-golden-ledger` `assembleNormalizedState`**, from already-normalized dump rows (exclude `hidden` / `removed` / category `Transfer`; net worth via `accountNetWorthContribution` on `syncEnabled && !hidden` accounts). They do **not** call `transaction-scope.ts` or sqlite repositories. A later tightening can wire dumps through production query helpers if those filters drift.
- **Playwright does not own every named stop.** Headless owns initial-dump equality, duplicate-job asserts, second-pass, mutation, reconnect A, and reconnect B `partial`. Playwright owns overlay copy, query invalidation, transaction-list Hidden rows, profile account row, already-linked overlay, and **final** dump = `expected-state`. Spending/budget/cash-flow **pages** are not driven; their numbers are covered by dump aggregates.
- **Headless desktop does not call `syncItem`.** It calls `connectItem` then `syncTransactionsForItem` + `waitForTransactionsProductReady` + `catchUpHistoricalTransactions` with `ZERO_DELAY`, so it can disable `disabledChecking` between initial and historical. Playwright hits production `syncItem` via IPC and uses a 15s first historical delay (`PLAID_HISTORICAL_CATCH_UP_DELAYS_MS=15000,0,…`) plus `prepareAfterInitial` to disable the account in that window.

Shipped seams that used to be listed as gaps:

- `PLAID_BASE_PATH` + `resetPlaidClientForTests()` on api (`plaidClient.ts:12-57`) and desktop (`client.ts:14-59`).
- Unsigned webhook → 401 (`webhook-unsigned.test.ts`, included in `test:api-contracts`).
- Desktop `syncItem({ catchUpDeps })` plus env delay injection.
- Desktop `MOAT_E2E` / `MOAT_E2E_USER_DATA` / `MOAT_E2E_GOLDEN_PLAID_JSON` (unpacked builds only; `e2e-bootstrap` requires `!app.isPackaged`).
- `setAccountSyncEnabled` extracted to `apps/desktop/src/main/plaid/set-account-sync-enabled.ts`; IPC delegates.
- `getImportStatus` in OpenAPI.
- Postgres service + path-filtered Playwright workflows.
- Real vault with a known password on a fresh `userData` dir (no skip-vault flag).
- Web entitlements: fresh user `trialEndsAt` default is enough. Desktop: harness writes a cached billing snapshot with a future `trialEndsAt`.
- Disabled-account skip is asserted on a **later** sync after `setAccountSyncEnabled(false)` (web exchange is atomic).

## Prerequisite Decisions

These were settled before Phase 1. Each was a **separate, single-purpose PR**.

### Decision 1 — Disabled-account transactions (**resolved: option 2**)

Shipped in [skip-disconnected-plaid-account-transactions](../skip-disconnected-plaid-account-transactions/spec.md). `added`/`modified` txs whose Plaid `account_id` is not in the enabled map are skipped; engines return `skippedDisabledAccountCount`. **`expected-state` must not include an orphan row** for `disabledChecking` after the later sync. Historical rows imported while the account was still enabled remain until a follow-up excludes them from spending at query time.

### Decision 2 — Audit scope (**identity fields shipped; `rulesApplied` still a follow-up**)

`TransactionSyncAudit` lives in `packages/domain/src/transactions/transaction-sync-audit.ts` and is assembled by both engines:

```text
receivedFromPlaid = added.length + modified.length + removed.length   (summed over all pages)

unexplained = receivedFromPlaid
            − persistedNew            (added rows that created a row)
            − persistedUpdated        (added rows that already existed + modified rows)
            − reconnectOverlapSkipped (added rows inside an overlap window)
            − disabledAccountSkipped  (Decision 1 option 2; engines return skippedDisabledAccountCount)
            − markedRemoved           (removed ids that flipped removedAt)
            − removedNoOp             (removed ids already removed or never present)
```

`seededCategories`, `rulesApplied`, `transferPairsCreated`, and `transferPairsRemoved` are reported but **not** part of the identity. `rulesApplied` is hardcoded `0` until the rules functions return counts.

### Decision 3 — Frozen clock (**resolved: LEDGER_TODAY offsets**)

The fixture exports `LEDGER_TODAY` (`PINNED_LEDGER_TODAY = "2026-09-09"`, overridable via `PLAID_GOLDEN_LEDGER_TODAY`) and derives every transaction date as a **negative day offset** from it. `expected-initial-state.ts` / `expected-state.ts` re-project those offsets at import time via `project-state.ts` — they are not hand-authored date tables. Nightly Sandbox can set `LEDGER_TODAY` to the real current date; Golden dumps always use the pinned clock unless overridden.

Balance-snapshot and balance-history *rows* stay out of the shared dump; net worth is asserted as an aggregate computed from balances.

## Target Experience

No new product UI. The “experience” is what CI and a developer must be able to see.

### Developer inner loop

```bash
# Headless Golden (no browser, same fixture, both platforms)
pnpm --filter @moat/plaid-golden-ledger test
pnpm --filter moat-api run test:plaid-golden
pnpm --filter moat-desktop run test:plaid-golden

# Full-app UI (Playwright)
pnpm --filter moat-web run test:e2e:plaid-golden
# desktop: build unpacked first
pnpm --filter moat-desktop run build
pnpm --filter moat-desktop run test:e2e:plaid-golden
```

Failure output names the **phase** (`initial` / `historical` / `playwright-historical` / `second-pass` / mutation / reconnect) and the first differing normalized field via `assertNormalizedStateEqual` / `firstNormalizedStateDiff`.

### Who owns which stop

| Stop | Headless web | Headless desktop | Web Playwright | Desktop Playwright |
|------|--------------|------------------|----------------|--------------------|
| Empty world (seed user, categories, Costco rule) | Yes | Yes | Yes (`global-setup`) | Yes (vault + bootstrap) |
| UI → Plaid boundary (Connect / privacy notice) | No | No | Yes | Yes |
| Initial dump = `expected-initial-state` | Yes | Yes | Overlay syncing + `addedCount > 0` only | Transaction count ≥ initial only |
| Disable `disabledChecking` | Yes | Yes | Yes (`golden:drive-historical`) | Yes (`prepareAfterInitial`) |
| Historical webhook → job → worker | Yes | N/A | Yes (drive-historical) | N/A (no webhooks; asserted) |
| Duplicate webhook → `IGNORED_DUPLICATE`, job count = 1 | Yes | N/A | Duplicate POST 204 only | N/A |
| Poll / catch-up → overlay Success + final dump = `expected-state` | Yes (direct `getImportStatus`) | Yes (zero delays) | Yes | Yes (env delays) |
| Second pass / mutation | Yes | Yes | No | No |
| Transaction list Hidden transfers | Dump flags | Dump flags | Yes | Yes |
| Spending/budget/cash-flow **pages** | Dump aggregates | Dump aggregates | No | No |
| Reconnect A (revoke → relink) | Yes | Yes | No | No |
| Reconnect B `already_linked` (no second exchange) | Yes | Yes | Yes | Yes |
| Reconnect B `partial` | Yes | Yes | No | No |

### User-visible flows the UI E2E still exercises

**Web** (`moat-api` on **3101** and `moat-web` on **3100**; Golden mock on **18080**. Dedicated ports so a local `pnpm dev` on 3000/3001 is not required.)

1. Sign in as the empty test user via an injected `authjs.session-token` cookie (NextAuth v5 JWT, `AUTH_SECRET` shared by both apps; documented in `apps/web/e2e/README.md`).
2. Open Financial Profile → **Connect account** (`DirectPlaidConnectLauncher`, `data-testid="connect-account"`).
3. Plaid Link is *not* driven. When `NEXT_PUBLIC_E2E === "1"`, the launcher reads `window.__moatGoldenPlaid` (Playwright `addInitScript`) and calls `handlePlaidSuccess` with `golden-public-token`.
4. Overlay shows **“Syncing account...”** after exchange; initial ~30-day batch is already on the server.
5. Test CLI `golden:drive-historical` posts a signed `HISTORICAL_UPDATE` webhook and drives the cron worker; overlay keeps polling `getImportStatus` every 3s.
6. Mock flips `transactions_update_status` to `HISTORICAL_UPDATE_COMPLETE`; overlay reaches **“Success!”**.
7. Dump equals `expected-state`. Transactions table shows Costco plus a Hidden transfer row. Second Connect shows **Already in Moat** without a second `/item/public_token/exchange`.

**Desktop**

1. Launch unpacked Electron from a fresh `userData` dir (`MOAT_E2E=1`, `MOAT_E2E_USER_DATA`); set up the vault with known password `golden-vault-password`; seed a cached billing snapshot with a future `trialEndsAt`.
2. Financial Profile → **Connect account**.
3. Assert the **Privacy Notice** dialog before Link — title `Privacy Notice`, body beginning “You are enabling automatic bank syncing through” (the word Plaid is a separate emphasized span), buttons **Cancel** (`privacy-notice-cancel`) and **I Understand** (`privacy-notice-understand`).
4. Same mocked public token as web, via preload `getGoldenFixture` gated on `MOAT_E2E === "1"` (`preload/index.ts`).
5. Overlay holds on syncing through `syncItem`. Catch-up delays come from `PLAID_CATCH_UP_DELAYS_MS` / `PLAID_HISTORICAL_CATCH_UP_DELAYS_MS` (first historical delay is 15s so `prepareAfterInitial` can run).
6. Overlay reaches success. Normalized dump equals the same Golden snapshot. Mock must **not** have seen `/webhook_verification_key/get`.
7. Transactions table shows Costco plus a Hidden transfer row. Second Connect (privacy notice again) shows **Already in Moat** without another exchange.

Overlay copy (identical strings on both platforms, `IMPORT_SYNCING_TIMEOUT_MS = 150_000`):

| Phase | Heading | Button | `data-testid` |
|-------|---------|--------|----------------|
| `syncing` | `Syncing account...` | — | `connection-import-overlay-syncing` |
| `background` | `Still importing` | `Continue` | `connection-import-overlay-background` / `-continue` |
| `success` | `Success!` | `Done` | `connection-import-overlay-success` / `-done` |
| `already_linked` | `Already in Moat` | `Done` | `connection-import-overlay-already_linked` / `-done` |
| `partial` | `Connected` | `Done` | `connection-import-overlay-partial` / `-done` |

Do not automate the real Plaid Link iframe in the PR-blocking suite.

## Architecture / Data Model

### Two independent layers

```text
┌───────────────────────────┐
│ Controlled Plaid adapter  │  exact deterministic HTTP
└─────────────┬─────────────┘
              │  every PR
              ▼
     full Moat correctness (Golden Ledger)

┌───────────────────────────┐
│ Real Plaid Sandbox        │  live API shape / Link
└─────────────┬─────────────┘
              │  nightly / pre-release
              ▼
     adapter compatibility only
```

They catch different bugs. Sandbox catches Plaid request/response drift. The Golden Ledger catches Moat logic regressions. **Do not use Sandbox as the Golden fixture.**

### Mock boundary (non-negotiable)

```text
TEST CONTROLLED                  PRODUCTION CODE
Plaid HTTP responses             exchange / connectItem
        │                        accounts/get
        ▼                        transactions/sync
                                 webhook route + job queue + worker
                                 mapping, rules, pairing
                                 watermarks, snapshots
                                 queries, overlay, UI
```

Mock **Plaid's server**. Do not mock `applyRulesToSyncedTransactions`, `detectAndPairTransfers`, Prisma, SQLite, React Query, IPC, or the job queue.

Seam: point the real `PlaidApi` SDK at a local mock server via `PLAID_BASE_PATH` inside `getPlaidEnv()` (ignored unless set), plus `resetPlaidClientForTests()` for in-process runners.

The mock server is **stateful per test run** (`startGoldenPlaidMock({ platform: "web" | "desktop" })`):

| Call | Behavior |
|------|----------|
| `linkTokenCreate` | Returns a fixed `link_token`; records whether a `webhook` was attached (web yes, desktop no) |
| `itemPublicTokenExchange` | Maps `golden-public-token` → access token + `item_id` (reconnect tokens too) |
| `accountsGet` / `accountsBalanceGet` | Golden accounts + balances |
| `itemGet` | Institution id + `billed_products` / `available_products` / `consented_products` |
| `institutionsGetById` | Golden institution name |
| `transactionsSync` | Cursor + call-count machine. Returns `transactions_update_status` and can raise `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` on demand (`armMutationDuringPagination`, skips `count: 1` probes) |
| `itemRemove` | Marks Item revoked for reconnect scenarios |
| `webhookVerificationKeyGet` | Test JWK so the suite can sign `Plaid-Verification` |
| `investmentsHoldingsGet` | `PRODUCT_NOT_READY` by default (holdings are out of the primary ledger) |

Control endpoints under `/_golden/*` (`health`, `calls`, `sign`, `enable-historical`, `complete-historical`, `arm-mutation-during-pagination`, replay) exist for runners. They are not Plaid API.

Desktop `transactionsSync` call sequence for the happy historical path:

1. Recent (~30-day) pages (multiple `has_more` pages).
2. Product-not-ready empty response (`added/modified/removed` empty, no cursor progress) — exercises `isTransactionsProductNotReady`.
3. Historical pages.
4. Empty catch-up (completion condition in `nextHistoricalCatchUpState`).

Web historical path does **not** fake that sequence inside `exchangePublicTokenForItem`. After the initial sync returns, the test posts a signed webhook, drives the cron worker, then lets `getImportStatus` detect completion and drain.

### Golden Ledger fixture

Workspace package `@moat/plaid-golden-ledger`: `private: true`, `version: "0.0.0"`, `type: "module"`, `main`/`types` pointing at `src/index.ts`, `exports` map to **TS source** (`.`, `./audit`, `./mock`), `tsconfig.json` extending `packages/config/tsconfig.base.json`, scripts `typecheck`, `test` (`tsx --test $(find src -name '*.test.ts' | sort)` so pnpm/CI expand the glob), `start-mock:web`, `start-mock:desktop`.

```text
packages/plaid-golden-ledger/
  src/
    index.ts
    types.ts                  NormalizedFinancialState, TransactionSyncAudit
    ledger-today.ts           LEDGER_TODAY + dayOffset()
    ledger.ts                 provider-shaped accounts + scripted sync pages
    project-state.ts          projects expected dumps from the ledger
    expected-initial-state.ts dump after the first ~30-day sync only
    expected-state.ts         canonical dump after full import
    expected-state.test.ts    locks adversarial cases against the projection
    reconnect-ledger.ts       Item A revoke → Item B overlap (variations A and B)
    reconnect-assertions.ts
    sort.ts                   deterministic array sort
    dump-contract.ts          field list, sort keys, cross-platform field mapping
    assert-state.ts           firstNormalizedStateDiff / assertNormalizedStateEqual
    audit.ts                  re-exports domain identity helpers
    mock-server.ts            ten Plaid methods + /_golden controls
    webhook-signing.ts        test JWK + ES256 JWT + body hash
    plaid-shape.ts / utc-date.ts
    start-mock-web.ts / start-mock-desktop.ts
```

The fixture is **adversarial on purpose**, compact enough for CI, and split across mock pages so pagination is real. The mock scripts pages of ~10 rows (`GOLDEN_PAGE_SIZE`) with `has_more: true` regardless of the engine's `count: 500` request.

Accounts in the primary ledger (`GOLDEN_ACCOUNT_IDS`): `checking`, `savings`, `credit` (Plaid subtype `"credit card"`; not the key `creditCard`), `disabledChecking`.

Include at least:

| Case | Expected behavior |
|------|-------------------|
| Costco + `FOOD_AND_DRINK_GROCERIES` | Seed category **Groceries** from PFC |
| Active rule matching Costco | Rule overrides seed category after insert (final category **Shopping**) |
| User-set category on an existing row | Later `modified` from Plaid does not overwrite it |
| Rule that changes a Transfer leg's category | Pairing **stops matching** — pairing keys on category *name*, and rules run before pairing |
| Checking → savings $1,000, opposite legs, category `Transfer` | Both stored, paired, `hidden` + `autoHiddenAsTransfer` |
| Checking → credit card $2,000, category `Credit card payment` | Same; guard requires one credit + one non-credit account |
| Transfer legs 4 days apart | Paired |
| Transfer legs **exactly 5 days** apart | Paired — the window is `<=`, inclusive |
| Transfer legs 6 days apart | Not paired; both visible |
| Transfer leg still `pending` | Not paired — candidates require `pending: false` |
| Two real Starbucks purchases, same amount/date, distinct `transaction_id`s | Both survive |
| Pending → posted (`modified`, same `transaction_id`) | One logical row, `pending` flips false |
| `modified` transaction | Existing row updated in place |
| `removed` transaction | `removedAt` set; not hard-deleted |
| `removed` id delivered twice | Second delivery is a no-op (`removedNoOp`), not a second write |
| Tx for `syncEnabled: false` account (post-disable later sync) | Not persisted; counted in `skippedDisabledAccountCount` |
| Reconnect overlap dates | `added` rows inside the window skipped; counted in `reconnectOverlapSkipped` |
| Duplicate sync page (same cursor payload twice) | Idempotent (`replayNextSyncPage`) |
| `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` mid-pagination | Engine restarts from the original cursor; final state unchanged |
| Duplicate `HISTORICAL_UPDATE` webhook | `ProviderWebhookEvent` → `IGNORED_DUPLICATE`; **no second `ProviderSyncJob`** (headless) |
| Same rule applied twice | Same final state |
| Previously paired transfer amount changes | Pair removed; auto-hidden legs unhidden |
| Uncategorized row later remapped | Uncategorized is *not* treated as a user category, so it can be remapped |

`disabledChecking` is imported as a normal account on first connect (web cannot disable mid-exchange). After the **initial** phase, the test calls the production `setAccountSyncEnabled(false)` path, then historical/later pages include a transaction for that Plaid `account_id` (`gtx-disabled-later`) that must be **skipped** (not in `expected-state`).

Seed **before connect**:

- Canonical categories — `apps/api/prisma/seed.ts` for Postgres, `seedDefaultCategories(db)` for SQLite. Both must include `Uncategorized`, or `loadCategoryNameToIdMap` cannot resolve.
- One Costco rule (description contains Costco → **Shopping**, so the override is observable against the PFC seed of Groceries).
- Empty user otherwise: no `PlaidItem`, no `FinancialConnection`, no transactions.

Fixture files may contain synthetic merchant names. Nothing from the fixture may reach logs or PostHog.

### Normalized dump (shared equality)

Do **not** compare raw Prisma rows to raw SQLite rows. The schemas genuinely diverge:

| Concern | Postgres | SQLite | Dump rule |
|---------|----------|--------|-----------|
| `Transaction.amount` | `Decimal` | `Float` | Coerce to `number` via `Number(x.toFixed(2))` |
| Category | `category` string **and** `categoryId` | `categoryId` only | Resolve `categoryId` → category **name** on both |
| Plaid tx id | `externalTransactionId` (also has `providerTransactionId`) | `externalTransactionId` | Dump `providerTransactionId` from `externalTransactionId` on both |
| Account hidden | `PlaidAccount.accountHidden` | `PlaidAccount.isHidden` | Map to one `hidden` field |
| Account owner | `PlaidAccount.userId` | none (user via `PlaidItem`) | Not in the dump |
| Cloud identity | `FinancialConnection` / `FinancialAccount` | none | Web-only assertions, outside the shared dump |
| Pair link | `Transaction.transferPairId` UUID (no join table) | same | Replace with a sorted pair of provider tx ids |
| Postgres-only fields | `authorizedDate`, `dedupeFingerprint`, `splitGroupId`, `lastTransactionSyncAt`, … | absent | Not in the dump |

Each platform exposes a **test-only** dump:

- Headless: `dumpPostgresNormalizedState` / `dumpSqliteNormalizedState` (throw unless `NODE_ENV=test` or `MOAT_E2E=1`).
- Web Playwright: `moat-api` CLI `golden:dump`.
- Desktop Playwright: `globalThis.__moatGoldenDesktop.dumpNormalizedState`, registered only when `MOAT_E2E=1` **and** `!app.isPackaged`.

```ts
type NormalizedFinancialState = {
  accounts: Array<{
    providerAccountId: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string | null;
    syncEnabled: boolean;
    hidden: boolean;
    currentBalance: number | null;
    availableBalance: number | null;
  }>;
  transactions: Array<{
    providerTransactionId: string;
    providerAccountId: string | null;
    amount: number;
    date: string; // YYYY-MM-DD, postedDate ?? date, UTC
    category: string;
    description: string;
    type: "INCOME" | "EXPENSE";
    pending: boolean;
    hidden: boolean;
    autoHiddenAsTransfer: boolean;
    removed: boolean;
    transferPairKey: string | null; // sorted "<idA>|<idB>" of provider tx ids
    hashtags: string[];
  }>;
  aggregates: {
    spending: number;
    income: number;
    transfers: number;
    netWorth: number;
  };
};
```

Rules:

- Sort every array deterministically (`providerAccountId`, then `providerTransactionId`); `hashtags` sorted too.
- `transferPairKey` is a **sorted pair of provider transaction ids**, not the database UUID.
- Aggregates are computed by `assembleNormalizedState` from dump rows (see remaining follow-ups). Net worth uses `accountNetWorthContribution`.
- `BalanceSnapshot` / `AccountBalanceHistory` rows are excluded.
- `assertNormalizedStateEqual(dump, expectedInitialState | expectedState, phase)` on **each** platform — not only web === desktop.
- Web-only extras (`FinancialConnection` exists, `FinancialAccount` count, `ProviderSyncJob` / `ProviderWebhookEvent` statuses) are asserted in the web **headless** test.

### Transaction sync audit

Each sync run returns (and headless tests require) the audit defined in Prerequisite Decision 2. `unexplained` must be `0`. Counts only — never descriptions, account numbers, or tokens. Desktop's overlap skip is the same field (`reconnectOverlapSkipped`) as the API.

### Test phases (one scenario, not five environments)

The primary Golden E2E is **one scenario with named stops**. Headless executes 1 and 3–7 without Playwright. UI E2E adds 2 and 8 and dumps the same **final** state after 5.

1. **Empty world** — migrate a fresh Postgres (or fresh SQLite), create a test user (default `trialEndsAt` already satisfies entitlements on web; seed a cached billing snapshot on desktop), seed canonical categories + the Costco rule.
2. **UI to Plaid boundary** — click Connect (desktop: privacy notice). The seam returns `golden-public-token`.
3. **Initial sync stop** — after the first `/transactions/sync` pages land, **before** historical catch-up. Headless asserts `expected-initial-state`: counts, Costco = Shopping, paired recent transfers, `disabledChecking.syncEnabled === true` still, web `FinancialConnection` exists. Overlay still on **“Syncing account...”**.
4. **Disable `disabledChecking`** via the production `setAccountSyncEnabled` path. Apply `USER_CATEGORY_OVERRIDES_AFTER_INITIAL`.
5. **Historical phase**
   - Web 5a: post a signed `HISTORICAL_UPDATE` webhook → assert `ProviderWebhookEvent` stored and a `ProviderSyncJob` created → drive `processProviderSyncJobById` → assert the job reaches `SUCCESS` and middle pages landed.
   - Web 5b: post the **same** webhook again → headless asserts `IGNORED_DUPLICATE` and **no second job**.
   - Web 5c: flip the mock to `HISTORICAL_UPDATE_COMPLETE` → `getImportStatus` poll detects completion and drains remaining pages → overlay reaches success.
   - Desktop 5d: mock call sequence + catch-up with injected delays → overlay reaches success.
   - Assert `expected-state` on both.
6. **Second pass** — headless only. Unchanged Plaid data; `replayNextSyncPage`; transaction count, pair count, and net spending unchanged.
7. **Provider mutation** — headless only. Next `/transactions/sync` returns `{ added, modified, removed }` including a transfer-leg amount change ($2,000 / $2,000 → $2,000 / $1,900). Assert the pair is removed, both legs have `autoHiddenAsTransfer === false` and are visible again, the removed id has `removedAt`, and the new tx is present.
8. **UI visibility** — Playwright: the transaction list shows auto-hidden transfer rows grayed (`Hidden`); `disabledChecking` is absent from the profile. Dump aggregates cover spending/income/transfers/net worth.

### Reconnect Golden (mandatory, separate scenario)

Same package, second fixture (`reconnect-ledger.ts`). Headless variations A and B run on **every staging sync** via `test:plaid-golden`. Playwright covers the already-linked overlay, not variation A or partial.

**Variation A — revoke then relink**

1. Item A: checking `****1234`, credit `****5678`.
2. Disconnect via production `disconnectItem` (keeps local rows, calls `itemRemove`, retains watermarks) per [plaid-reconnect-transaction-dedupe](../plaid-reconnect-transaction-dedupe/spec.md).
3. Item B: same institution, same fingerprints, **new** Plaid `account_id` / `transaction_id` values, overlapping history plus newer txs.
4. Run the normal Link-success path.

Assert: adopted internal account identity, no second logical checking row, `added` rows at or before `transactionsSyncedThrough` skipped, only post-watermark activity added, one live Item owns the accounts, `reconnectOverlapSkipped > 0` in the audit.

Live matching keys on `mask:${mask}|${type}|${subtype}` then `name:${normalizedName}|${type}` (`account-fingerprints.ts` `liveMatchFingerprints`). Adoption adds the weaker `mask:${mask}|${type}` (`accountFingerprints`) and is scoped by `plaidInstitutionKey` in `adopt-revoked-accounts.ts`. Institution is **not** part of the fingerprint itself.

**Variation B — live sibling**

Item A remains live. Item B selects overlapping accounts plus one new account. Assert `outcome: "partial"` (or `"already_linked"` when every selected account matches) per [skip-already-linked-plaid-accounts](../skip-already-linked-plaid-accounts/spec.md): no duplicate live rows, and — when all accounts already exist — `itemPublicTokenExchange` is **not called at all**. Overlay copy path (`Already in Moat` / `Connected`) is covered in UI E2E for `already_linked` only.

### Auth, data, and secrets

| Concern | Approach |
|---------|----------|
| Web login | Mint a NextAuth v5 JWT with the shared `AUTH_SECRET` and inject the `authjs.session-token` cookie (`__Secure-` prefix only in production). Not demo mode. |
| Desktop identity | Fresh Electron `userData`; vault set up with a known password. Seed the cached billing snapshot so `assertDesktopSyncAccess` passes offline. |
| Postgres | Ephemeral DB via CI `services: postgres` plus `prisma migrate deploy`. Never the shared Neon. Headless Golden skips (does not fail) if `DATABASE_URL` is unset locally. |
| SQLite | Temp dir per test, destroyed after — `createSqliteClientHandle` + `runMigrations`. |
| Job queue determinism | Leave `CRON_SECRET` **unset** / empty so the fire-and-forget kick is skipped; drive the worker explicitly from the test. |
| Plaid secrets | PR jobs need dummy `PLAID_CLIENT_ID` / `PLAID_SECRET` (`golden-client-id` / `golden-secret`) plus `PLAID_BASE_PATH`. Nightly Sandbox uses GitHub Actions secrets `PLAID_SANDBOX_CLIENT_ID` / `PLAID_SANDBOX_SECRET` (mapped into `PLAID_*` for the smoke). Do **not** reuse `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` — those bake production Plaid into desktop releases. |
| Other API env | `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `ENCRYPTION_KEY`, `WEB_ORIGIN`. Quote `ENCRYPTION_KEY` in GitHub Actions YAML (`"0000…64"`); unquoted zeros parse as integer `0`. Web adds `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_E2E=1` for Playwright. |
| PII | Synthetic names only. Logging rules in [AGENTS.md](../../../AGENTS.md) still apply. |

### CI matrix

| When | What |
|------|------|
| Every staging sync (`deploy-staging.yml`) | `pnpm ci:test`: API contracts (includes unsigned webhook 401), `@moat/ui`, `@moat/plaid-golden-ledger`, headless web Golden + reconnect, desktop unit + headless Golden + reconnect, `@moat/domain`, `@moat/db-sqlite`, `@moat/category-mapping`, `@moat/financial-data-providers` |
| Every staging sync | Headless second-pass idempotency + duplicate webhook / duplicate page (inside `golden-ledger.test.ts`) |
| Every staging sync | Web Playwright Golden (overlay + final dump + already-linked + Hidden row) |
| Every staging sync | Desktop Playwright Golden (privacy notice + overlay + final dump + already-linked). Job runs `ensure-electron` so the runtime binary exists even when the pnpm store was cached from a skip-download job |
| Nightly (`plaid-sandbox-nightly.yml`, `0 7 * * *` + `workflow_dispatch`) | **Sandbox adapter smoke only** (api + desktop `test:plaid-sandbox-smoke`). Skips with exit 0 when secrets are absent. Does **not** re-run Playwright Goldens |
| Release | 1-minute **manual** real-bank connect on staging (`apps/desktop/RELEASE.md`) |

Headless Golden and Playwright run on every `staging` push (`pnpm sync:branches`). Pushing `main` does not run CI. Nightly Sandbox is **compatibility**, not a second Golden Ledger: create a Link token / exchange a Sandbox public token / confirm the first sync returns *some* transactions and the path does not 500. Do not snapshot Sandbox rows.

## Implementation Plan

Phases 0–7 are **done**. Deviations from the original plan are recorded here so future edits do not re-litigate them.

### Phase 0 — Prerequisite decisions

Done. Decisions 1 and 3 in production; Decision 2 identity fields in Phase 2; `rulesApplied` still a follow-up.

### Phase 1 — Contracts and fixture

Done. `@moat/plaid-golden-ledger` plus `getImportStatus` in OpenAPI. Expected dumps are **projected** from `ledger.ts` rather than stored as offset tables.

### Phase 2 — Mock Plaid server and production seams

Done. `PLAID_BASE_PATH`, mock of all ten SDK methods, webhook signing, unsigned 401 test, `syncItem` `catchUpDeps` + env delays, extracted desktop `setAccountSyncEnabled`, `TransactionSyncAudit` with `unexplained === 0`.

### Phase 3 — Headless Golden runners (PR gate)

Done. Postgres in `ci.yml`. Web runner: `apps/api/src/server/plaid/golden/golden-ledger.test.ts`. Desktop runner: `apps/desktop/src/main/plaid/golden/golden-ledger.test.ts` (catch-up helpers, not `syncItem`). `ci:test` includes the previously unrun suites.

### Phase 4 — Web Playwright Golden

Done. `@playwright/test` in `apps/web`, `test:e2e:plaid-golden`, overlay test ids, mock `:18080` / API `:3101` / web `:3100`, `NEXT_PUBLIC_E2E` + `window.__moatGoldenPlaid`. Recorded in `tech-stack.md`. Session helper documented in `e2e/README.md`.

### Phase 5 — Desktop Playwright Golden

Done. Playwright Electron against unpacked `out/main/index.js`. Own CI job downloads Electron. Vault + billing seed. Privacy notice + overlay. `MOAT_E2E` paths require `!app.isPackaged`.

### Phase 6 — Reconnect Golden

Done. Headless A and B on every PR. Playwright already-linked overlay on both platforms. Partial overlay copy is implemented in UI but not driven by Playwright.

### Phase 7 — Nightly Sandbox + docs

Done. Scheduled workflow skips without secrets. Testing docs no longer claim Jest. Playwright in `tech-stack.md`. Real-bank checklist in `apps/desktop/RELEASE.md`. Nightly is Sandbox smoke **only** (not both Playwright Goldens).

## Acceptance Criteria

- [x] Prerequisite Decision 1 is resolved (option 2: skip ingest). Decision 3 is resolved (`LEDGER_TODAY` offsets). Decision 2 identity fields landed; `rulesApplied` remains a follow-up.
- [x] `disabledChecking` later-sync txs are **not** in `expected-state`; `skippedDisabledAccountCount > 0`; the account is absent from the profile and net worth.
- [x] `@moat/plaid-golden-ledger` holds the adversarial fixture, `LEDGER_TODAY` offsets, expected initial state, expected final state, mock server, and the reconnect fixture.
- [x] Production Plaid SDK calls can be aimed at a local mock via `PLAID_BASE_PATH` (+ `resetPlaidClientForTests()`) without mocking Moat sync/rules/pairing/queue.
- [x] The mock implements all ten Plaid methods the codebase calls, returns `transactions_update_status`, and can raise `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION`.
- [x] Headless web Golden: empty Postgres → exchange → initial dump = `expected-initial-state` → signed webhook through the real route → `ProviderSyncJob` created → cron worker driven → poll/drain → final dump = `expected-state`.
- [x] Headless desktop Golden: empty SQLite → `connectItem` → catch-up machine with zero delays → same `expected-state`.
- [x] `assertNormalizedStateEqual(webDump, expected)` and `assertNormalizedStateEqual(desktopDump, expected)` (not only web === desktop).
- [x] Headless second pass with unchanged Plaid data does not change transaction count, pair count, or spending aggregate.
- [x] Headless mutation phase: added/modified/removed applied; the transfer amount change unpairs and unhides both auto-hidden legs.
- [x] Duplicate sync page is idempotent; a duplicate `HISTORICAL_UPDATE` webhook becomes `IGNORED_DUPLICATE` with **no second `ProviderSyncJob`** (headless).
- [x] An unsigned webhook POST returns 401.
- [x] Mid-pagination mutation error restarts the sync from the original cursor and converges on the same state.
- [x] Costco PFC → Groceries seed, Costco rule overrides to Shopping, user-set category survives a `modified` event, and `Uncategorized` remains remappable.
- [x] Transfer pairing: 4-day and exactly-5-day pairs hide; 6-day does not; `pending` legs do not pair; a rule that changes a leg's category prevents pairing; two identical Starbucks ids both remain.
- [x] `TransactionSyncAudit.unexplained === 0` on Golden headless runs, per the documented identity equation.
- [x] Web Playwright: Connect → “Syncing account...” while history is incomplete → “Success!” after `getImportStatus` completes → final dump = `expected-state`.
- [x] Desktop Playwright: Privacy Notice (`Cancel` / `I Understand`) before Link; overlay waits through catch-up; no webhook.
- [x] Reconnect Golden (headless): adopt-on-relink without duplicate history; live sibling `partial` / `already_linked` with no exchange call when everything is already linked. Playwright covers `already_linked` overlay only.
- [x] Transaction list includes hidden transfer rows (Playwright). Dump aggregates exclude hidden and removed rows.
- [x] CI: Postgres service container; headless Golden + web/desktop Playwright Goldens on every staging sync. Pushing `main` does not run CI.
- [x] Desktop Playwright job downloads Electron.
- [x] `ci:test` also runs the desktop, `@moat/domain`, `@moat/db-sqlite`, `@moat/category-mapping`, and `@moat/financial-data-providers` suites.
- [x] Nightly Sandbox smoke exists, skips cleanly without secrets, and is **not** used as the Golden expected snapshot.
- [x] `getImportStatus` is in the OpenAPI spec.
- [x] Test-only dumps, the Link seam, and any test env flags cannot activate in production or in a packaged desktop build (`NEXT_PUBLIC_E2E` unset in prod; desktop bootstrap requires `!app.isPackaged && MOAT_E2E=1`).
- [x] Playwright is recorded in `specs/tech-stack.md`.
- [x] `apps/api/docs/patterns/testing.md` no longer documents Jest.
- [x] No PII/tokens/raw descriptions in CI logs.

## Non-Goals

- Automating the real Plaid Link UI (bank selection, OAuth, MFA) in PR CI.
- Using Plaid Sandbox custom users as the Golden Ledger.
- iOS / FinanceKit / MX / Finicity E2E.
- Holdings / Investments in the primary Golden accounts list (covered by existing unit tests and [plaid-investments-flag](../plaid-investments-flag/spec.md); the mock returns `PRODUCT_NOT_READY` for holdings).
- Mocking or rewriting the rules engine, pairing matcher, job queue, or Prisma/SQLite in these tests.
- A post-sync “reconciliation job” that does not exist in production.
- Testing the Vercel daily cron schedule itself, or `SYNC_UPDATES_AVAILABLE` ongoing-sync behavior beyond the mutation phase.
- Expanding pairing, watermark, or already-linked *behavior* — this spec locks current behavior. Product changes belong in those specs first, then Golden expected-state updates.
- Jest, Cypress, Vitest, or a second ORM for the test DB.
- Running packaged `dist:mac` / `dist:win` as the PR E2E (nightly may; PR must not depend on it).
- Replacing the existing `node:test` unit suite.
- Driving spending/budget/cash-flow **pages** in Playwright (dump aggregates cover the numbers).
- Re-running Playwright Goldens on the nightly Sandbox workflow.

## Open Questions

All original questions are resolved. Remaining work is listed under “Remaining follow-ups”.

- **Web Link seam shape:** **Resolved.** Playwright-installed `window.__moatGoldenPlaid` read only when `process.env.NEXT_PUBLIC_E2E === "1"`. Desktop uses preload `getGoldenFixture` gated on `MOAT_E2E === "1"` (JSON from `MOAT_E2E_GOLDEN_PLAID_JSON`), not a raw `plaid:exchangePublicToken` IPC bypass from the test.
- **Where `getNormalizedFinancialState` lives:** **Resolved.** In-process helpers for headless runners. Playwright reaches them through a worker CLI (`golden:dump`) on web and a main-process `globalThis` hook on desktop. No public debug endpoint.
- **Desktop billing snapshot seeding:** **Resolved.** Write the cached snapshot (`harness.ts` / e2e bootstrap). `resolveDesktopSyncAccess` returns `allowed` from a fresh cache without network.
- **`rulesApplied` in the audit:** **Resolved for v1 — leave it out.** Add it with the production audit-logging PR. Identity equation does not include it.
- **Second-pass rule idempotency:** **Resolved.** The dump excludes `updatedAt`. Headless second pass asserts dump equality against `expected-state`.
- **Nightly runner:** **Resolved.** GitHub Actions with Sandbox secrets; skip if secrets are missing. Nightly is Sandbox smoke only, not Playwright Golden.

## Related Specs

- [context.md](context.md) — design conversation this spec formalizes
- [Skip disconnected Plaid account transactions](../skip-disconnected-plaid-account-transactions/spec.md) — Decision 1 option 2 (skip ingest)
- [Transfer pairing](../transfer-pairing/spec.md) — 5-day inclusive window, hide/unhide, CC-payment guard
- [Plaid reconnect transaction dedupe](../plaid-reconnect-transaction-dedupe/spec.md) — watermarks, keep-local disconnect
- [Skip already-linked Plaid accounts](../skip-already-linked-plaid-accounts/spec.md) — live sibling collapse, `already_linked` / `partial`
- [Show hidden transactions](../show-hidden-transactions/spec.md) — list includes hidden rows, aggregates exclude them
- [Plaid investments](../plaid-investments-flag/spec.md) — optional product; out of the primary Golden accounts
- [Plaid transaction import optimization](../../complete/plaid-transaction-import-optimization/spec.md) — pagination-before-writes invariants the Golden run must not violate
- [docs/patterns/external-integrations.md](../../../docs/patterns/external-integrations.md) — Plaid boundary
- [apps/api/docs/patterns/testing.md](../../../apps/api/docs/patterns/testing.md) — `node:test` + `tsx`
- [apps/web/docs/patterns/testing.md](../../../apps/web/docs/patterns/testing.md) — Playwright Golden + headless vs Sandbox
- [apps/web/e2e/README.md](../../../apps/web/e2e/README.md) — session cookie + Link seam
- [apps/desktop/e2e/README.md](../../../apps/desktop/e2e/README.md) — unpacked Electron Golden

## Suggested Commit Message

```text
docs: aligns golden ledger spec with shipped suite
```
