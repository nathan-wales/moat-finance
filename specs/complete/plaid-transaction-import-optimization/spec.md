# Plaid Transaction Import — Batch Write Optimization

## Status

Draft. Created June 22, 2026 after observing per-row Prisma queries during initial Plaid link (thousands of `findUnique` + `upsert` pairs in dev logs).

## Goal

Speed up initial and incremental Plaid transaction sync by reducing database round-trips, without breaking cursor correctness, category preservation, or idempotent re-sync behavior.

Success means:

- Initial bank connect completes in a reasonable time for users with 1–2 years of history (target: under ~15s for ~5k transactions on Neon, measured not guessed).
- Incremental syncs remain correct when users have edited categories, split transactions, or hidden rows via rules.
- Cursor advancement stays safe: a failed import can be retried without duplicating or corrupting data.
- Dev/prod logs no longer show N× individual `INSERT … ON CONFLICT` + `SELECT` pairs for large imports.
- Observability exists to compare before/after (`addedCount`, `modifiedCount`, `dbWriteMs`, `rulesMs`).

## Product Context

When a user connects a bank via Plaid Link, Moat Finance:

1. Exchanges the public token and persists the Plaid item.
2. Syncs accounts.
3. Runs an initial historical transaction pull (often thousands of rows).
4. Applies transaction rules.
5. Backfills financial-connection provider metadata.

The Plaid API side is already paginated (500 transactions per `/transactions/sync` page). The bottleneck is the **database write path** in `apps/api`, which currently issues ~2 queries per transaction in the main sync loop, plus additional per-row work after commit.

This is a **performance and reliability** improvement, not a product behavior change. Users should see the same data; connect should just finish faster.

## Current Repo Context

### Primary files

| Concern | Location |
|---------|----------|
| Plaid transaction sync engine | `apps/api/src/server/plaid/syncTransactions.ts` |
| Plaid → Prisma field mapping | `apps/api/src/server/plaid/mapping.ts` |
| Token exchange + initial sync entry | `apps/api/src/server/plaid/service.ts` |
| Rules applied after sync | `apps/api/src/server/services/transaction-rules-on-import.service.ts` |
| Bulk rule writes (backfill only today) | `apps/api/src/server/rules-engine/backfill/apply-rule-mutation-bulk.ts` |
| Provider metadata backfill | `apps/api/src/server/services/financial-connections.service.ts` |
| Desktop mirror (same per-row pattern) | `apps/desktop/src/main/plaid/sync-transactions.ts` |
| Transaction unique constraint | `@@unique([userId, externalTransactionId], name: "unique_external_tx")` in `apps/api/prisma/schema.prisma` |

### Current write path (`paginateAndPersist`)

Correctness guarantees enforced today (must preserve):

1. Full Plaid pagination completes **before** any DB writes.
2. Transaction rows + cursor advancement are committed in **one** `db.$transaction`.
3. On `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION`, pagination restarts from the original cursor.
4. Removed transactions are soft-deleted via `removedAt` — never hard-deleted.
5. Per-item advisory lock prevents overlapping syncs.
6. Cursor only advances inside the same DB transaction as row writes.

Per-transaction loop (for both `added` and `modified` arrays):

```text
findUnique(userId + externalTransactionId)   → SELECT categoryId, category, splitGroupId
mapPlaidTransactionToDbInput(...)
upsert(...)                                  → INSERT … ON CONFLICT DO UPDATE
```

The pre-fetch exists so `mapPlaidTransactionToDbInput` can preserve user-managed categorization and split state on update. On **first connect** (`startingCursor === null`), the `added` array is almost entirely new rows — the `findUnique` calls return null every time but still run.

After the sync transaction commits:

- `applyRulesToSyncedTransactions` loops per transaction with individual `update` / `upsert` calls.
- `ensureFinancialConnectionForPlaidItem` → `backfillPlaidTransactionProviderMetadata` runs one `update` per transaction missing provider fields.

### Observed query pattern (dev logs)

For N synced transactions, expect roughly:

| Phase | Queries (approx.) |
|-------|-------------------|
| Sync loop (`added` + `modified`) | ~2N |
| Rules on import | ~1–5N (depends on rule count and hashtag mutations) |
| Provider metadata backfill | ~N (first connect only) |

Example: 5,000 transactions → **10,000+ queries** in the sync loop alone, all inside one long transaction.

## Problem Analysis

### Root cause

Prisma does not offer bulk upsert. The sync engine uses row-by-row `findUnique` + `upsert` inside a single `$transaction`. This is correct but slow at scale.

### Why first connect is worst

- Plaid returns up to ~2 years of history on initial link.
- Every row in `added` is a new insert, yet each still pays for a redundant `findUnique`.
- Rules and metadata backfill add a second and third pass over the same rows.

### Risks of the current approach

- Long-running transactions on Neon (lock duration, pool pressure, timeout risk).
- Slow Link callback / connect UX for power users with long history.
- Noisy dev logs that mask real errors.

### What we should not break

- Category preservation when `categoryId` is set by the user or rules.
- Split transaction amount preservation (`splitGroupId` guard in mapping).
- Idempotent upsert on `(userId, externalTransactionId)`.
- Cursor only advancing after successful row writes (or a clearly documented relaxed model for chunked writes).

## Non-Goals

- Changing Plaid API pagination or switching to `/transactions/get`.
- Rewriting the mapping layer or category resolution logic.
- Async background import with UI progress (possible Phase 3 follow-up; out of scope for initial optimization).
- Raw SQL bulk upsert in Phase 1 (deferred to Phase 3 unless Phase 2 is insufficient).
- Optimizing Apple FinanceKit or normalized MX/Finicity import in this spec (same patterns exist elsewhere; can follow after Plaid proves the approach).

## Implementation Plan

### Phase 1 — Low-risk query reduction (target: ~50% fewer sync-loop queries)

**Scope:** `apps/api/src/server/plaid/syncTransactions.ts` only.

- [x] **1.1 Bulk-prefetch existing rows**
  - Before the `added` / `modified` loops, collect all `externalTransactionId`s.
  - Run one `findMany` with `select: { externalTransactionId, categoryId, category, splitGroupId }`.
  - Build a `Map<string, ExistingTransactionLike>` for O(1) lookup in the loop.
  - Remove per-row `findUnique` calls.

- [x] **1.2 Skip prefetch on first historical sync for `added`**
  - When `startingCursor === null`, treat `added` rows as inserts-only (no existing lookup).
  - Still prefetch for `modified` (usually empty on first sync) and for all rows on incremental syncs.

- [x] **1.3 Batch soft-delete for removed transactions**
  - Replace the per-row `updateMany` loop with a single call:
    - `where: { userId, externalTransactionId: { in: removedIds }, removedAt: null }`
    - `data: { removedAt: now }`

- [x] **1.4 Add structured timing logs**
  - Log at end of `paginateAndPersist`: `{ addedCount, modifiedCount, removedCount, prefetchMs, dbWriteMs, totalMs }`.
  - Log at end of `applyRulesToSyncedTransactions`: `{ transactionCount, rulesMs }`.
  - Never log PII, raw descriptions, or full external IDs.

- [ ] **1.5 Verify**
  - Manual: connect a Plaid sandbox item with historical data; confirm row counts match and categories/rules still apply.
  - Compare query volume in dev logs before vs after.

**Expected impact:** ~50% reduction in sync-loop queries; near-zero lookup overhead on first connect.

---

### Phase 2 — Post-sync passes and chunked writes (target: faster end-to-end connect)

**Scope:** `syncTransactions.ts`, `transaction-rules-on-import.service.ts`, `financial-connections.service.ts`.

- [x] **2.1 Bulk rule application on import**
  - Refactor `applyRulesToSyncedTransactions` to reuse patterns from `applyRuleMutationBulk`:
    - Load rules once.
    - `findMany` all synced transactions once.
    - Evaluate rules in memory.
    - Batch scalar updates via `updateMany` grouped by mutation shape.
    - Batch hashtag joins and audit rows via `createMany({ skipDuplicates: true })`.
  - Preserve existing rule semantics (SKIP → hidden, first matched rule wins, etc.).

- [x] **2.2 Fold provider metadata into initial upsert**
  - Set `financialConnectionId`, `financialAccountId`, `dataProvider`, `providerAccountId`, `providerTransactionId`, `accountFingerprint`, `dedupeFingerprint`, and `rawProviderPayload` during the main upsert/create in `mapPlaidTransactionToDbInput` or the sync loop — not in a second pass.
  - Remove or narrow `backfillPlaidTransactionProviderMetadata` to incremental repair only.

- [x] **2.3 Chunk DB writes inside sync**
  - Write transactions in chunks of 250–500 rows (configurable constant).
  - Each chunk: prefetch (if needed) + upsert batch within a short `$transaction`.
  - **Final chunk transaction:** update `PlaidItem.cursor`, `lastSuccessfulSyncAt`, etc.
  - Document failure behavior: partial chunks are idempotent on retry; cursor does not advance until final commit succeeds.

- [ ] **2.4 Verify**
  - Connect with 2k+ transactions; measure total connect time and query count.
  - Re-sync same item; confirm incremental path still preserves user categories.
  - Confirm rules and provider metadata present on first connect without backfill pass.

**Expected impact:** End-to-end connect time dominated by Plaid API pagination, not DB writes.

---

### Phase 3 — Advanced (only if Phase 2 insufficient for large histories)

- [ ] **3.1 PostgreSQL bulk `INSERT … ON CONFLICT DO UPDATE` via `$executeRaw`**
  - Chunked raw SQL for pure insert-heavy first sync.
  - Fallback to Prisma upsert for rows needing category/split preservation logic.

- [ ] **3.2 Async initial import job**
  - Return from Link quickly; enqueue historical import with UI progress.
  - Requires product spec for loading states and partial-data UX.

- [ ] **3.3 Desktop parity**
  - Port Phase 1–2 optimizations to `apps/desktop/src/main/plaid/sync-transactions.ts`.

## Testing Matrix

| Scenario | Expected behavior |
|----------|-------------------|
| First Plaid link (cursor null) | All historical transactions imported; categories seeded from Plaid mapping; rules applied |
| Incremental webhook sync | Only changed rows upserted; user-edited `categoryId` not overwritten |
| Re-link same institution | Upsert idempotency; no duplicate rows |
| Split transaction updated by Plaid | Amount not overwritten when `splitGroupId` set |
| Removed transactions | `removedAt` set in batch; not hard-deleted |
| Sync failure mid-chunk (Phase 2+) | Retry succeeds; cursor not advanced until final commit |
| User with zero rules | Rules phase is a no-op with minimal queries |

## Success Metrics

| Metric | Baseline (today) | Target |
|--------|------------------|--------|
| DB queries per 1k added transactions (sync loop) | ~2,000 | ≤ 1,050 (Phase 1) → ≤ 550 (Phase 2 chunked) |
| Initial connect wall time (5k tx, sandbox) | Measure before change | ≤ 15s API-side DB+rules (excluding Plaid pagination latency) |
| Long transaction duration | Unbounded single `$transaction` | Chunk max ≤ 5s each |

## Progress Log

| Date | Phase | Notes |
|------|-------|-------|
| 2026-06-22 | — | Spec created from production dev log analysis and codebase audit |
| 2026-06-22 | 1–2 | Implemented bulk prefetch, chunked writes, provider metadata in upsert, bulk rules on import |

## Related Specs

- [Bank Sync Updates](../../complete/bank-sync-updates.spec.md) — sync scheduling, webhooks, balance vs transaction sync (orthogonal).
- [Triple Aggregator Sync](../../complete/triple-aggregator-sync/spec.md) — normalized import path uses same per-row upsert pattern; future follow-up.
- [Apple Wallet backlog](../../backlog/apple-wallet/spec.md) — mentions bulk upsert as a desired pattern.
