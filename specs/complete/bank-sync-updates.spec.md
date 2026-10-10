# Bank Sync Updates — Audit & Implementation Plan

## Status

**Phases 1–4 implemented** (June 8, 2026). Scheduled balance/transaction crons (FinancialConnection-centric), rate-limited manual sync, cost-aware Plaid call logging, async webhook job queue, MX/Finicity cached adapter sync in API layer, optional gated real-time balance refresh, Plaid holdings when investments product enabled, and UI freshness/stale indicators are live.

## Goal

Keep account balances reasonably fresh in the UI without accidentally running up provider costs — especially Plaid's billable `/accounts/balance/get` (Balance product). Separate transaction sync from cached balance sync from optional real-time balance refresh, with clear timestamps, rate limits, and observability.

**Do not implement until this spec is approved.**

---

## Executive Summary

| Finding | Impact |
|---------|--------|
| Webhook-triggered sync never refreshes balances (`refreshBalances: false`) | **Primary cause of stale balances** — transactions update daily; balances may be days/weeks old |
| No scheduled balance refresh job on `apps/api` | Balances only update on manual sync, reconnect, or initial link |
| `/accounts/get` is used correctly when balances *are* refreshed; `/accounts/balance/get` is **never called** | No billable real-time balance risk today |
| `lastSuccessfulSyncAt` on `PlaidItem` tracks **transaction** sync, but UI labels it "Synced" | Users believe balances are fresh when they may not be |
| `ProviderSyncAttempt` exists but lacks sync type/mode/cost metadata | Limited observability for cost-aware operations |
| MX/Finicity adapters are foundation-only stubs | No live sync; webhooks are stored but jobs are `SKIPPED` |
| Desktop app runs a 30-minute scheduler with `refreshBalances: true` | Desktop is ahead of web API on balance freshness |

---

## 1. Current Plaid Endpoint Usage

### 1.1 `/accounts/get` (`accountsGet`)

**Yes — we call it.** It is the only balance refresh path in production.

| Location | Trigger | Updates DB balances? | Updates timestamps? |
|----------|---------|----------------------|---------------------|
| `apps/api/src/server/plaid/syncAccounts.ts` | Called by `syncAccountsForItem()` | Yes — `currentBalance`, `availableBalance`, metadata on `PlaidAccount` | Yes — `PlaidAccount.lastBalanceSyncAt`; propagated to `FinancialAccount.lastBalanceSyncAt` via `ensureFinancialConnectionForPlaidItem` |
| `apps/desktop/src/main/plaid/sync-accounts.ts` | Same logic for local SQLite | Same | Same |

**When `syncAccountsForItem` runs (API):**

| Trigger | `refreshBalances` | Calls `accountsGet`? |
|---------|-------------------|----------------------|
| `exchangePublicTokenForItem` (new link) | N/A — always calls `syncAccountsForItem` directly before tx sync | Yes |
| `runSyncForItem` / `plaid.syncItem` (manual) | `true` | Yes |
| `syncAllItemsForUser` / `plaid.syncAll` | `true` per item | Yes |
| `runReconnectForItem` | `true` | Yes |
| `runWebhookSyncForItem` (webhook) | `false` | **No** |
| `syncTransactionsForItem` default | `false` | **No** |
| Initial tx sync after link (`exchangePublicTokenForItem`) | `false` for tx leg | No (balances already synced in prior step) |

**`refreshAccountsForItem`** in `apps/api/src/server/plaid/service.ts` wraps `syncAccountsForItem` but is **not called from any handler or job** — dead entry point today.

### 1.2 `/accounts/balance/get` (`accountsBalanceGet`)

**No — we do not call it anywhere** in the monorepo (API, web, desktop, packages). No string references to `accounts/balance/get` or `accountsBalanceGet`.

This is good from a cost perspective but means we rely entirely on cached balances from `/accounts/get`.

### 1.3 `/transactions/sync` (`transactionsSync`)

| Location | Notes |
|----------|-------|
| `apps/api/src/server/plaid/syncTransactions.ts` | Primary engine; paginates fully before DB writes; cursor advanced atomically |
| `apps/desktop/src/main/plaid/sync-transactions.ts` | Mirror for local SQLite |

**Triggers:** webhooks, manual sync, sync-all, reconnect, initial link, desktop 30-min scheduler.

**Updates:** `PlaidItem.cursor`, `PlaidItem.lastSyncAt`, `PlaidItem.lastSuccessfulSyncAt`, transaction rows. Does **not** update `lastBalanceSyncAt` unless `refreshBalances: true`.

### 1.4 Investment endpoints

**No calls** to `investmentsHoldingsGet`, `investmentsTransactionsGet`, or related Plaid Investments APIs.

Investment account balances in the UI come from `/accounts/get` cached balances on `type: investment` accounts. Contribution forecasting uses transaction history (`refreshPlaidInvestmentContributionInputs`), not holdings APIs.

`PLAID_PRODUCTS` is removed. Link products are hardcoded in `apps/api/src/server/plaid/link-products.ts`: Transactions required, Investments optional.

### 1.5 Other Plaid API calls

| Endpoint | Location | Purpose |
|----------|----------|---------|
| `linkTokenCreate` | `apps/api/src/server/plaid/link.ts`, `apps/desktop/src/main/plaid/service.ts` | Link + reconnect tokens |
| `itemPublicTokenExchange` | `apps/api/src/server/plaid/service.ts`, desktop | Token exchange on connect |
| `itemGet` | `apps/api/src/server/plaid/service.ts`, desktop | Institution metadata fallback |
| `institutionsGetById` | Same | Institution name resolution |
| `itemRemove` | Disconnect flows | Provider-side item removal |
| `webhookVerificationKeyGet` | `apps/api/pages/api/webhook/plaid.ts` | Webhook JWT verification |

### 1.6 Plaid Link token creation

- **Handler:** `plaid.createLinkToken` → `createLinkTokenForUser` → `createPlaidLinkTokenForUser`
- **Multi-provider path:** `createFinancialConnectionLinkSession` routes to Plaid when provider is `PLAID`
- **Products:** hardcoded `products: ["transactions"]`, `optional_products: ["investments"]`
- **Webhook URL:** `PLAID_WEBHOOK` or `${API_BASE_URL}/api/webhooks/plaid`
- **Update mode:** `createReconnectLinkTokenForItem` passes `access_token`; does not re-specify products

---

## 2. Current MX and Finicity/Mastercard Sync Behavior

### 2.1 Adapter implementation status

Both adapters in `packages/financial-data-providers/` are **scaffolding only**:

| Capability | MX (`mx.adapter.ts`) | Finicity (`finicity.adapter.ts`) |
|------------|----------------------|----------------------------------|
| `listInstitutions` / `searchInstitutions` | Returns empty | Returns empty |
| `createLinkSession` | Returns widget URL from env | Returns connect URL from env |
| `syncConnection` | Returns empty accounts + transactions | Returns empty accounts + transactions |
| `disconnectConnection` | No-op | No-op |

### 2.2 API sync job behavior

`apps/api/src/server/services/financial-sync.service.ts`:

- For `connection.provider === "PLAID"`: delegates to `runWebhookSyncForItem` (transaction sync only)
- For `MX` / `FINICITY`: logs `"Provider sync skipped until adapter sync is configured"` and marks `ProviderSyncAttempt` as `SKIPPED`

### 2.3 Webhook classifiers

`mx.webhook.ts` and `finicity.webhook.ts` classify these event codes as `SYNC_CONNECTION`:

- `aggregation_complete`, `history_available`, `data_ready`, `balance_changed`

Even when classified as sync-worthy, the API job still **skips** because adapters are not implemented.

### 2.4 Billable / rate-limit considerations (future)

When adapters are built, research per-provider billing before implementation:

| Provider | Likely billable operations | Notes |
|----------|---------------------------|-------|
| MX | Member/account aggregation refresh, transaction history pulls | Contract-dependent; treat refresh endpoints as `unknown_contract_dependent` until documented |
| Finicity/Mastercard | Customer/account refresh, transaction aggregation | `balance_changed` webhooks should trigger **cached** refresh first, not assume real-time |

No provider-specific rate limiting exists today beyond Plaid per-item advisory locks.

---

## 3. Current Webhook Behavior

### 3.1 Routes

| Provider | Public path | Alias |
|----------|-------------|-------|
| Plaid | `/api/webhook/plaid` | `/api/webhooks/plaid` (re-export) |
| MX | `/api/webhooks/mx` | — |
| Finicity | `/api/webhooks/finicity` | — |

### 3.2 Verification

| Provider | Method |
|----------|--------|
| Plaid | JWT in `Plaid-Verification` header; body hash + 5-minute replay window |
| MX | HTTP Basic Auth (`MX_WEBHOOK_BASIC_AUTH_*`); fail-closed in production |
| Finicity | HMAC-SHA256 `x-finicity-signature`; fail-closed in production |

### 3.3 Event handling

**Plaid:**

- Stores event via `storeProviderWebhookEvent` (redacted payload)
- Only `TRANSACTIONS` + `SYNC_UPDATES_AVAILABLE` triggers `SYNC_CONNECTION`
- All other types/codes: stored, marked processed, no sync
- **Does not handle** `HOLDINGS`, `ITEM`, `LIABILITIES`, or balance-specific webhook types

**MX / Finicity:**

- Stores event, updates `FinancialConnection.lastWebhookAt`
- Classifier may return `SYNC_CONNECTION` for balance/aggregation events
- Sync job runs inline but ends in `SKIPPED` for non-Plaid

### 3.4 Job durability and execution model

| Aspect | Current behavior |
|--------|------------------|
| Background queue | **No** — sync runs **inline** in the webhook HTTP handler |
| Durability | `ProviderWebhookEvent` + `ProviderSyncAttempt` persisted; failed syncs update attempt status |
| Retries | Plaid returns 204 even on sync failure (prevents infinite retries); error logged + item error state updated |
| Concurrency | Postgres advisory locks per `PlaidItem` and per `FinancialConnection` |
| Separation of sync types | **No** — one code path; Plaid webhooks only run transaction sync |

### 3.5 Payload logging

- Raw payloads stored in `ProviderWebhookEvent.rawPayload` after **redaction** (`redactProviderPayload`)
- Cron `cleanup-raw-webhook-payloads` clears payloads >30 days; deletes events >90 days; failed events >7 days
- Structured logs use prefixes (e.g. `plaidItemIdPrefix`) — no tokens or PII

### 3.6 Failed webhook/sync persistence

- `ProviderWebhookEvent.status`: `FAILED` with `errorMessage`
- `ProviderSyncAttempt.status`: `FAILED` with `errorCode` / `errorMessage`
- `FinancialConnection`: `lastErrorAt`, `lastErrorCode`, `consecutiveFailures`
- `PlaidItem`: `lastErrorCode`, `lastErrorMessage`, `requiresReconnect`

---

## 4. Current Schema / Timestamp Model

### 4.1 Plaid-specific models

**`PlaidItem`:**

| Field | Meaning today |
|-------|---------------|
| `cursor` | Transaction sync cursor |
| `lastSyncAt` | Last transaction sync attempt (success or failure) |
| `lastSuccessfulSyncAt` | Last successful **transaction** sync |
| `requiresReconnect`, `lastErrorCode`, `lastErrorMessage` | Connection health |

Missing: `lastBalanceSyncAt`, `lastTransactionSyncAt` (explicit), `lastRealtimeBalanceSyncAt`, `lastHoldingsSyncAt`, `lastProviderWebhookAt`

**`PlaidAccount`:**

| Field | Meaning |
|-------|---------|
| `currentBalance`, `availableBalance` | Stored cached balances from `/accounts/get` |
| `lastBalanceSyncAt` | Last time balances were refreshed via `accountsGet` |

### 4.2 Provider-agnostic models (triple-aggregator foundation)

**`FinancialConnection`:**

| Field | Meaning |
|-------|---------|
| `lastSuccessfulSyncAt` | Mirrors Plaid tx sync time (via `ensureFinancialConnectionForPlaidItem`) — **not balance-specific** |
| `lastWebhookAt` | Last webhook received for this connection |
| `syncCursorEncrypted` | Encrypted transaction cursor |
| `status`, error fields | Connection health |

**`FinancialAccount`:** mirrors `PlaidAccount` balances + `lastBalanceSyncAt`

**`ProviderWebhookEvent`:** durable webhook receipt with idempotency

**`ProviderSyncAttempt`:** durable sync log with counts but **no**:

- `syncType` (transactions / balances / holdings / realtime_balance)
- `syncMode` (cached / realtime)
- `reason` (scheduled, manual, webhook, etc.)
- `endpointsCalled` or cost category
- Per-user rate-limit tracking

**`SyncTrigger` enum exists:** `WEBHOOK | SCHEDULED | USER_REFRESH | INITIAL_LINK | BACKFILL | PROVIDER_SWITCH` — used on `ProviderSyncAttempt.trigger` but Plaid manual sync does not create attempts today (only webhook path via `financial-sync.service`).

### 4.3 Other `lastSyncedAt` usages (unrelated to bank sync)

- `InstitutionCatalog` entries: catalog fetch timestamp
- Browser extension retailers: retail sync timestamp
- Not used for Plaid bank balance freshness

---

## 5. Current UI Behavior and Confusing Labels

### 5.1 Balance data source

All dashboard/net-worth views read **stored DB values** (`PlaidAccount.currentBalance` / `FinancialAccount.currentBalance`). No live provider fetch on page load.

Balance history charts use `BalanceSnapshot` records created after sync (`takeSnapshot` in `runSyncForItem` / token exchange).

### 5.2 Freshness labels

| Surface | What's shown | What it actually means |
|---------|--------------|------------------------|
| `InstitutionRow` (`institution-row.tsx`) | "Synced {time} ago" | `lastSuccessfulSyncAt ?? lastSyncAt` on **PlaidItem** = **transaction** sync |
| Financial profile accounts (`financial-profile.ts`) | `lastSynced` per account | `lastBalanceSyncAt ?? lastSuccessfulSyncAt ?? lastSyncAt` — better, but falls back to tx sync |
| `getFinancialProfileData` (domain package) | `lastSynced` date | Item-level `lastSuccessfulSyncAt` only — **ignores** `lastBalanceSyncAt` |
| `InvestmentCard` "Synced" badge | Static label | Means Plaid-linked; **no timestamp** |
| `AccountCard` | Balance only | `lastBalanceSyncAt` in props but **not displayed** |

### 5.3 Manual sync controls

| Control | Endpoint | Behavior |
|---------|----------|----------|
| `SyncButton` per institution | `POST /api/v1/plaid/syncItem` | Tx sync + `accountsGet` (`refreshBalances: true`) — **safe/cached** |
| `SyncAllButton` | `POST /api/v1/plaid/syncAll` | Same for all items — **component exists but is not imported anywhere** |
| Reconnect flow | `plaid.reconnectItem` | Tx sync + balance refresh |

**No** "Refresh real-time balance" action exists.

**No** client-side or API rate limiting on manual sync — users can spam sync.

### 5.4 Desktop divergence

`apps/desktop/src/main/plaid/scheduler.ts`:

- Runs every **30 minutes**
- Syncs items stale >30 min with `refreshBalances: true`
- Web API has **no equivalent** scheduled job

---

## 6. Risks / Bugs Found

### 6.1 Critical — stale balances (confirmed)

Webhook path (`runWebhookSyncForItem` → `refreshBalances: false`) is the **primary** data refresh mechanism for connected users. It updates transactions but **never** calls `/accounts/get`. Balances go stale while UI shows "Synced" based on transaction sync time.

### 6.2 High — misleading "Synced" label

Institution-level "Synced X ago" reflects transaction sync, not balance freshness. Users reasonably interpret this as "my balances are X old" when balances may be much older.

### 6.3 Medium — no scheduled balance refresh (web)

Unlike desktop, production web has no cron to periodically call cached balance sync. Users who never click manual sync may see balances from initial link date only (plus any reconnect).

### 6.4 Medium — no manual sync rate limiting

Repeated manual sync is mostly cheap today (`/accounts/get` + `/transactions/sync`) but still consumes provider quota and server resources. Abuse or accidental double-clicks are unbounded.

### 6.5 Low — `refreshAccountsForItem` unused

Dedicated balance-only function exists but no API exposes it. Missed opportunity for lightweight balance refresh without full transaction pagination.

### 6.6 Low — `ProviderSyncAttempt` not used for manual Plaid sync

Manual sync bypasses the provider-agnostic sync log, making cross-provider observability incomplete.

### 6.7 Low — inline webhook sync timeout risk

Comment in webhook handler notes Vercel timeout risk for large initial syncs. Balance refresh added to webhook path would increase latency — favors async job queue long-term.

### 6.8 None today — billable real-time balance exposure

`/accounts/balance/get` is not called. **Future risk:** adding "refresh balance" without gating could incur per-request Plaid Balance charges.

---

## 7. Recommended Target Architecture

### 7.1 Core principles

1. **Separate sync dimensions:** transactions, cached balances, holdings, real-time balances — each with its own timestamp and job type.
2. **Default to cheap paths:** Plaid `/accounts/get` for routine balance refresh; never auto-call `/accounts/balance/get`.
3. **Provider-aware orchestration:** route through `@moat/financial-data-providers` adapters as they mature; Plaid remains special-cased until full migration.
4. **Cost-aware wrapper:** every provider HTTP call tagged with `cached_or_included | billable_per_request | unknown_contract_dependent`.
5. **Durable jobs:** webhook ack fast, sync work in background where possible.
6. **Rate limits at API layer:** server-side enforcement, not UI-only.

### 7.2 Sync modes and reasons (proposed)

```ts
type SyncMode = "cached" | "realtime";

type SyncType =
  | "transactions"
  | "cached_balances"
  | "realtime_balances"
  | "holdings"
  | "connection_health";

type SyncReason =
  | "scheduled_balance_sync"
  | "scheduled_transaction_fallback"
  | "manual_sync_button"
  | "manual_realtime_balance_refresh"
  | "provider_webhook"
  | "account_connection_created"
  | "payment_risk_check";
```

### 7.3 Sync flows

```
┌─────────────────────────────────────────────────────────────────┐
│                        Trigger sources                           │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ Webhook      │ Cron 12-24h  │ Manual btn   │ Real-time action   │
│ (tx avail)   │ balance sync │ (cached)     │ (explicit, gated)  │
└──────┬───────┴──────┬───────┴──────┬───────┴─────────┬──────────┘
       │              │              │                 │
       v              v              v                 v
  transactions    cached_balances  tx + cached_bal   realtime_balances
  sync only       per connection   (rate-limited)    (heavy rate-limit)
       │              │              │                 │
       v              v              v                 v
  lastTransaction   lastBalance    ProviderSyncLog   lastRealtimeBalance
  SyncAt            SyncAt         + cost category   SyncAt
```

### 7.4 Plaid endpoint mapping

| Sync type | Mode | Plaid endpoint | Cost category |
|-----------|------|----------------|---------------|
| Transactions | cached | `/transactions/sync` | `cached_or_included` |
| Balances (routine) | cached | `/accounts/get` | `cached_or_included` |
| Balances (explicit) | realtime | `/accounts/balance/get` | `billable_per_request` |
| Holdings | cached | `/investments/holdings/get` | `unknown_contract_dependent` (when product enabled) |
| Link | — | `/link/token/create` | `cached_or_included` |

### 7.5 Scheduled jobs (new)

| Job | Interval | Action | Skip when |
|-----|----------|--------|-----------|
| `scheduled-balance-sync` | 12–24h | Cached balance refresh per active connection | `DISCONNECTED`, `REAUTH_REQUIRED`, sync paused (billing), error streak > N |
| `scheduled-transaction-fallback` | 6–12h | Tx sync for connections with stale `lastTransactionSyncAt` and no recent webhook | Same skips |
| `cleanup-*` (existing) | daily | Webhook payload retention | — |

### 7.6 Webhook behavior (target)

1. **Acknowledge fast** — store event, return 204, enqueue work.
2. **Plaid `SYNC_UPDATES_AVAILABLE`** → enqueue `transactions` sync only (unchanged).
3. **Future: Plaid holdings webhooks** → enqueue `holdings` sync when Investments product enabled.
4. **MX/Finicity `balance_changed`** → enqueue `cached_balances` only (not realtime).
5. Webhooks **never** trigger realtime balance endpoints automatically.

### 7.7 Cost-aware provider call wrapper (proposed)

New module: `apps/api/src/server/providers/cost-aware-client.ts` (or extend `packages/financial-data-providers`)

```ts
type ProviderCostCategory =
  | "cached_or_included"
  | "billable_per_request"
  | "unknown_contract_dependent";

type ProviderCallLog = {
  provider: FinancialDataProvider;
  endpoint: string;
  costCategory: ProviderCostCategory;
  connectionId?: string;
  userId?: string;
  syncAttemptId?: string;
  result: "success" | "error";
  durationMs: number;
};
```

Log to structured logger + attach to `ProviderSyncAttempt.metadata.endpointsCalled[]`.

---

## 8. Proposed Schema Changes

### 8.1 `PlaidItem` — add explicit timestamps

```prisma
lastTransactionSyncAt      DateTime?
lastBalanceSyncAt          DateTime?  // item-level rollup (max of accounts or explicit)
lastRealtimeBalanceSyncAt  DateTime?
lastHoldingsSyncAt         DateTime?
lastProviderWebhookAt      DateTime?
```

Migration: backfill `lastTransactionSyncAt` from `lastSuccessfulSyncAt`; backfill `lastBalanceSyncAt` from max(`PlaidAccount.lastBalanceSyncAt`).

### 8.2 `FinancialConnection` — mirror timestamps

```prisma
lastTransactionSyncAt      DateTime?
lastBalanceSyncAt          DateTime?
lastRealtimeBalanceSyncAt  DateTime?
lastHoldingsSyncAt         DateTime?
// lastWebhookAt already exists
// Deprecate overloading of lastSuccessfulSyncAt — keep for compat, write both during transition
```

### 8.3 `ProviderSyncAttempt` — extend

```prisma
syncType     String   // transactions | cached_balances | realtime_balances | holdings | connection_health
syncMode     String?  // cached | realtime (null for tx-only)
reason       String?  // maps to SyncReason
endpointsCalled Json? // [{ endpoint, costCategory, durationMs, status }]
estimatedCostCategory String? // highest cost in batch
userId       String?  // denormalized for rate-limit queries
```

Alternatively, introduce `ProviderSyncLog` as a rename/enhancement of `ProviderSyncAttempt` — prefer extending existing model to avoid parallel tables.

### 8.4 Rate-limit tracking (optional lightweight)

```prisma
model ProviderSyncRateLimitBucket {
  id           String   @id @default(cuid())
  userId       String
  connectionId String?  // null = user-wide limit
  syncType     String
  syncMode     String
  windowStart  DateTime
  requestCount Int      @default(0)

  @@unique([userId, connectionId, syncType, syncMode, windowStart])
  @@index([userId])
}
```

Could also use Redis/Upstash if already in stack — check infra before migration.

---

## 9. Proposed API / Job Changes

### 9.1 Refactor Plaid sync orchestration

Split `runSyncForItem` into composable operations:

```ts
syncTransactionsForConnection({ connectionId, reason, trigger })
syncCachedBalancesForConnection({ connectionId, reason, trigger })
syncRealtimeBalancesForConnection({ connectionId, reason, trigger }) // gated
syncHoldingsForConnection({ connectionId, reason, trigger }) // when enabled
```

Manual `plaid.syncItem` becomes:

```ts
await syncTransactionsForConnection(...)
await syncCachedBalancesForConnection(...)
// holdings if product enabled
```

With single `ProviderSyncAttempt` or parent/child attempts per sync type.

### 9.2 New endpoints

| Endpoint | Auth | Behavior |
|----------|------|----------|
| `POST /api/v1/sync/connection` | `withAuth` | Cached manual sync (tx + balances + holdings if applicable); rate-limited |
| `POST /api/v1/sync/connection/realtime-balance` | `withAuth` + feature flag | Plaid `/accounts/balance/get` only; heavy rate limit |
| `POST /api/v1/plaid/syncItem` | keep | Delegate to new cached sync; deprecate direct `refreshBalances` flag |

### 9.3 Cron endpoints (new)

| Route | Schedule | Action |
|-------|----------|--------|
| `/api/cron/scheduled-balance-sync` | every 12–24h | Cached balance refresh for eligible connections |
| `/api/cron/scheduled-transaction-fallback` | every 6–12h | Tx sync for connections missing recent webhook-driven sync |

Secure with `CRON_SECRET`. Add to `apps/api/vercel.json` crons when deployed.

### 9.4 Webhook handler changes

- Plaid/MX/Finicity handlers: store event → enqueue job (Vercel background function, Inngest, or queue) → return 204 immediately
- Phase 1 (minimal): keep inline but add **separate** balance cron; Phase 2: async queue

### 9.5 Wire manual sync through `financial-sync.service`

Unify Plaid manual sync with `ProviderSyncAttempt` logging and rate-limit checks.

### 9.6 Implement MX/Finicity cached sync (later phase)

When adapters are built:

- Account list + balance refresh via provider-specific cached endpoints
- Transaction import via normalized import service (`importNormalizedFinancialData`)
- Webhook `balance_changed` → `cached_balances` only

---

## 10. Proposed UI Changes

### 10.1 Separate freshness labels

Replace ambiguous "Synced" with specific copy:

| Location | Current | Proposed |
|----------|---------|----------|
| Institution row | "Synced 2h ago" | "Transactions synced 2h ago · Balances updated 1d ago" |
| Account card | (none) | Subtle "Balance as of 3h ago" from `lastBalanceSyncAt` |
| Financial profile | `lastSynced` | Split into transaction + balance timestamps |

### 10.2 Manual sync button

- Rename to **"Sync latest data"** (cached path)
- Show toast with what updated: "3 transactions added · balances refreshed"
- Disable with countdown when rate-limited (e.g. "Available in 8 min")
- Surface `SyncAllButton` on accounts page header (currently orphaned)

### 10.3 Optional real-time balance refresh

- Hidden behind account detail overflow menu or settings
- Label: **"Refresh live balance"** with helper text explaining it may be slower and limited
- Show remaining daily quota
- Behind feature flag / paid tier / admin flag initially

### 10.4 Stale balance indicator

If `lastBalanceSyncAt` > 48h, show amber "Balance may be outdated" on net-worth surfaces.

### 10.5 API response shape

Extend `getConnectedInstitutions` (and financial profile) to return:

```ts
{
  lastTransactionSyncAt: string | null;
  lastBalanceSyncAt: string | null;
  lastRealtimeBalanceSyncAt: string | null;
  lastHoldingsSyncAt: string | null;
}
```

Per institution and per account.

---

## 11. Rate-Limit Rules

| Action | Scope | Limit | Endpoint cost |
|--------|-------|-------|---------------|
| Cached manual sync | Per institution (connection) | 1 per 10 min (configurable 5–15) | Low |
| Cached manual sync | Per user | 10 per hour | Low |
| Sync all | Per user | 2 per hour | Low |
| Real-time balance | Per institution | 1 per 6h | **Billable** |
| Real-time balance | Per user | 3 per day | **Billable** |
| Scheduled balance | Per connection | 1 per 12h (cron dedupes) | Low |
| Webhook-triggered tx | Per connection | Deduped by advisory lock + idempotency | Low |

Return `429` with `Retry-After` header and typed error body. Log rate-limit hits to observability (not PII).

---

## 12. Migration / Backfill Strategy

1. **Schema migration** — add new timestamp columns (nullable).
2. **Backfill script:**
   - `lastTransactionSyncAt` ← `PlaidItem.lastSuccessfulSyncAt`
   - `lastBalanceSyncAt` (item) ← `max(PlaidAccount.lastBalanceSyncAt)` per item
   - `FinancialConnection` mirrors from linked Plaid item
3. **Dual-write period** — write both old (`lastSuccessfulSyncAt`) and new fields for 1–2 releases.
4. **UI cutover** — switch labels to new fields once backfill verified.
5. **No provider calls during backfill** — timestamps only from existing data.
6. **Post-deploy:** run one-time `scheduled-balance-sync` cron manually to refresh stale balances after enabling.

---

## 13. Testing Plan

### 13.1 Unit tests

- Cost-aware wrapper categorizes endpoints correctly
- Rate-limit bucket logic (per-user, per-connection windows)
- Webhook classifiers for each provider
- Timestamp updates: tx sync does not touch `lastBalanceSyncAt`; balance sync does not touch `lastTransactionSyncAt`

### 13.2 Integration tests (API)

- Manual cached sync calls `accountsGet`, not `accountsBalanceGet` (mock Plaid client)
- Webhook sync calls `transactionsSync` only
- Scheduled balance cron skips disconnected/error items
- Real-time endpoint rejected without feature flag; rejected when rate-limited
- `ProviderSyncAttempt` records `syncType`, `endpointsCalled`, cost category

### 13.3 E2E / manual

- Connect sandbox institution → verify balances on link
- Wait for webhook-only period → confirm balances stale, transactions fresh
- Manual sync → balances update, UI shows separate timestamps
- Rapid manual sync clicks → 429 after limit
- Real-time refresh (sandbox) → `lastRealtimeBalanceSyncAt` updates, daily limit enforced

### 13.4 Desktop parity

- Align desktop scheduler with web cron policy (12–24h balance, optional tx fallback) or document intentional offline-first differences

---

## 14. Implementation Phases

### Phase 0 — Approval & metrics baseline (1–2 days)

- [ ] Approve this spec
- [ ] Add dashboard/logging query for current `lastBalanceSyncAt` age distribution
- [ ] Confirm Plaid billing plan (is `/accounts/get` included; Balance product pricing)

### Phase 1 — Fix stale balances without new infra (3–5 days)

**Highest ROI; addresses root cause.**

- [ ] Add `scheduled-balance-sync` cron (12–24h) calling `syncAccountsForItem` per eligible Plaid item
- [ ] Add `lastTransactionSyncAt` / `lastBalanceSyncAt` to `PlaidItem` + backfill
- [ ] Update item-level timestamps in `syncAccountsForItem` and `syncTransactions` separately
- [ ] UI: split "Synced" label into transaction vs balance freshness
- [ ] Rate-limit manual `syncItem` / `syncAll` (server-side)
- [ ] Wire manual sync through `ProviderSyncAttempt` with `syncType`

### Phase 2 — Cost-aware wrapper + unified sync service (5–8 days)

- [ ] Provider cost-aware call wrapper with structured logging
- [ ] Refactor sync entry points to `financial-sync.service` composable jobs
- [ ] Extend `ProviderSyncAttempt` with `syncType`, `syncMode`, `reason`, `endpointsCalled`
- [ ] Add `scheduled-transaction-fallback` cron for webhook gaps
- [ ] Expose `SyncAllButton` in accounts UI

### Phase 3 — Real-time balance (optional, gated) (3–5 days)

- [x] Feature flag + `POST financialConnections/refreshRealtimeBalance` + `POST plaid/refreshRealtimeBalance`
- [x] Plaid `accountsBalanceGet` behind wrapper (`billable_per_request`)
- [x] UI affordance with quota display
- [x] `lastRealtimeBalanceSyncAt` timestamps

### Phase 4 — Async webhook jobs + MX/Finicity (larger)

- [x] Background job queue for webhook-triggered sync (`ProviderSyncJob` + 5-min cron)
- [x] MX/Finicity cached sync via API-layer adapter clients
- [x] Holdings sync when Investments product enabled
- [x] Scheduled crons migrated to `FinancialConnection` as source of truth

---

## Appendix A — File Reference Map

| Concern | Primary files |
|---------|---------------|
| Plaid account sync | `apps/api/src/server/plaid/syncAccounts.ts` |
| Plaid tx sync | `apps/api/src/server/plaid/syncTransactions.ts` |
| Plaid orchestration | `apps/api/src/server/plaid/service.ts` |
| Plaid handlers | `apps/api/src/server/handlers/plaid.ts` |
| Webhook (Plaid) | `apps/api/pages/api/webhook/plaid.ts` |
| Webhook (MX/Finicity) | `apps/api/pages/api/webhooks/mx.ts`, `finicity.ts` |
| Provider-agnostic sync | `apps/api/src/server/services/financial-sync.service.ts` |
| Webhook storage | `apps/api/src/server/services/provider-webhook.service.ts` |
| Connection mirror | `apps/api/src/server/services/financial-connections.service.ts` |
| UI sync buttons | `apps/web/src/components/plaid/sync-button.tsx`, `institution-row.tsx` |
| Desktop scheduler | `apps/desktop/src/main/plaid/scheduler.ts` |
| Schema | `apps/api/prisma/schema.prisma` |
| Provider adapters | `packages/financial-data-providers/src/providers/` |

## Appendix B — Open Questions for Approval

1. **Cron interval:** 12h vs 24h for scheduled balance sync — trade freshness vs provider load?
2. **Job queue:** Is Vercel background functions sufficient, or should we introduce Inngest/Trigger.dev now?
3. **Real-time balance:** Ship in Phase 3 or defer indefinitely?
4. **Investments product:** Enabled globally via `optional_products` (see [plaid-investments-flag](../features/plaid-investments-flag/spec.md)).
5. **Desktop parity:** Should desktop adopt the same 12–24h balance cadence instead of 30-min full sync?

---

## Approval Checklist

- [ ] Engineering review
- [ ] Product review (UI copy, real-time balance gating)
- [ ] Finance review (Plaid Balance product cost acceptance)
- [ ] Phase 1 scope locked
