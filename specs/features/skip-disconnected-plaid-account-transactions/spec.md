# Skip disconnected Plaid account transactions

## Status

Draft. Created 2026-09-09 after reviewing Financial Profile **Disconnect** (`setAccountSyncEnabled(false)`), both Plaid sync engines, and Golden Ledger Decision 1.

## Goal

When a user disconnects a single synced account, Moat must stop ingesting that account’s Plaid transactions. Plaid still returns Item-level `/transactions/sync` data; Moat must drop rows whose `account_id` is not in the enabled account map instead of upserting orphans into spending.

Success means:

- `added` and `modified` rows for `syncEnabled: false` (or otherwise unmapped) accounts are not persisted.
- Enabled-account rows still upsert, pair, and take rules as today.
- `removed` still soft-deletes by `externalTransactionId` (Plaid’s removed list has no `account_id`).
- Both API and desktop engines return `skippedDisabledAccountCount`.

## Product Context

**Disconnect** on a Financial Profile synced account calls `setAccountSyncEnabled({ syncEnabled: false })` and removes the account from the profile. It does **not** call Plaid `itemRemove`. Plaid cannot drop one account from an Item, so later syncs still include those txs.

Hide only changes UI visibility. Institution-level disconnect revokes the whole Item. This spec is the per-account ingest filter Disconnect already promised: *“This stops sync and billing for this account only.”*

## Current Repo Context

Disconnect already sets `PlaidAccount.syncEnabled = false`. Both engines load the transaction account map with `syncEnabled: true` only, then previously upserted misses with `plaidAccountDbId: null`.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|--------|
| Disconnect → sync off | `packages/features/src/financial-profile/persist-account-details.ts` `deleteAccountFromProfile` | Calls `setAccountSyncEnabled(false)` |
| API toggle | `apps/api/src/server/plaid/set-account-sync-enabled.ts` | Also updates `FinancialAccount.syncEnabled` |
| Desktop toggle | `apps/desktop/src/main/ipc/plaid.ts` `setAccountSyncEnabled` | SQLite `PlaidAccount` only |
| Account map | `syncTransactions.ts` / `sync-transactions.ts` `loadAccountMapFromDatabase` | Already filters `syncEnabled: true` |
| Overlap skip | `packages/domain/src/transactions/transaction-sync-watermark.ts` | Pattern for a pure skip helper |
| Golden Ledger | `specs/features/plaid-integration-e2e-tests/spec.md` | Decision 1 option 2 |

## Target Experience

No UI change. After Disconnect, later Plaid pages that include that account’s txs leave no new transaction rows and do not change existing ones. Historical txs imported while the account was enabled stay (query-time spending exclusion is a follow-up). **Resume sync** only receives txs after the Item cursor; skipped rows during the off period do not come back.

## Architecture / Data Model

Shared helper `shouldSkipDisabledAccountTransaction`: skip when `plaidAccountId` is empty or not in the enabled map.

Write loops in both engines `continue` before upsert, increment `skippedDisabledAccountCount`, and do not pass skipped ids to rules/pairing. API `upsertPlaidTransactionRow` returns without writing if the map miss still occurs.

Cursor still advances (Item-level; cannot pause one account).

## Implementation Plan

1. Domain helper + unit tests.
2. API + desktop sync engines skip `added`/`modified`, return the skip count, log counts only (no descriptions).
3. Contract tests that skip runs before upsert.
4. Mark Golden Ledger Decision 1 resolved (option 2).

## Acceptance Criteria

- [x] `shouldSkipDisabledAccountTransaction` skips missing, empty, and unmapped ids; keeps mapped ids.
- [x] API `syncTransactionsForItem` does not upsert disabled/unknown `added`/`modified` rows; returns `skippedDisabledAccountCount`.
- [x] Desktop `syncTransactionsForItem` matches.
- [x] `removed` still soft-deletes by Plaid transaction id.
- [x] Logs include counts only — no merchant names, account numbers, or tokens.
- [x] Golden Ledger Decision 1 is option 2; expected-state must not include an orphan row for `disabledChecking` after later sync.

## Non-Goals

- Plaid `itemRemove` or per-account unlink at Plaid (impossible).
- UI copy or a new Disconnect control.
- Hiding historical txs from spending/list.
- Full `TransactionSyncAudit` identity (Golden Ledger Phase 2).

## Open Questions

None. Resume-gap after skip-while-cursor-advances is accepted: Disconnect means unlink going forward.

## Related Specs

- [Plaid Integration E2E Tests (Golden Ledger)](../plaid-integration-e2e-tests/spec.md) — Decision 1
- [Skip already-linked Plaid accounts](../skip-already-linked-plaid-accounts/spec.md) — live sibling Item, not per-account ingest
- [Plaid reconnect transaction dedupe](../plaid-reconnect-transaction-dedupe/spec.md) — Item revoke vs per-account `syncEnabled`

## Suggested Commit Message

```text
fix: skips txs for disconnected plaid accounts
```
