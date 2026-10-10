# Internal Transfer Pairing

## Status

Updated 2026-09-08: same-account pairs and CSV import hook.

## Goal

When money moves between the user’s own accounts — including credit card statement payments and CSV-imported transfers — pair the equal opposite legs and soft-hide both so income and spending are not double-counted.

Success means:

- Legs categorized as **Transfer** or **Credit card payment** can pair with each other (including mixed pairs) within **5 days**, including on the **same account**
- Pairs require equal amount/currency, opposite direction, and a resolvable account on both legs
- Credit-card-payment pairs add a soft account-type guard when both account types are known (credit ↔ non-credit) **and** the legs are on distinct accounts
- One-sided transfers (no matching opposite leg) stay visible
- Plaid sync, nightly Plaid jobs, and CSV import all run the same matcher after rules
- Existing customers can backfill via `pairInternalTransfers` (`fullHistory: true`)

## Product Context

Paying a credit card from checking creates an expense on the bank and an income on the card. A savings↔checking transfer does the same. CSV imports often assign both files to one destination account, so pairing must allow same-account legs. Uncategorized legs stay visible unless a rule recategorizes them to Transfer or Credit card payment first.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Shared matcher | `packages/domain/src/transfer-pairing/match-transfer-legs.ts` | Pure match, hide, validity |
| Unit tests | `packages/domain/src/transfer-pairing/match-transfer-legs.test.ts` | Pure matcher tests |
| API adapter | `apps/api/src/server/services/transfer-pairing.service.ts` | Postgres load/persist/reconcile |
| Desktop adapter | `apps/desktop/src/main/plaid/transfer-pairing.ts` | SQLite load/persist/reconcile |
| Plaid sync hook | `apps/api/src/server/plaid/syncTransactions.ts` | Calls `detectAndPairTransfers` after rules |
| Desktop sync hook | `apps/desktop/src/main/plaid/sync-transactions.ts` | Same post-sync pairing |
| CSV import (web) | `apps/api/src/server/services/transaction-import.service.ts` | Rules, then pairing by internal ids |
| CSV import (desktop) | `apps/desktop/src/main/services/import-post-process.ts` | Shared helper for IPC, MCP, HTTP |
| Backfill handler | `apps/api/src/server/handlers/transaction.ts` → `pairInternalTransfers` | `fullHistory: true` |
| Desktop backfill | `apps/desktop/src/main/plaid/transfer-pairing-backfill.ts` | One-shot `fullHistory` on launch |
| Category mapping | `packages/category-mapping/src/plaid.ts` | CC payment + Transfer names |
| Schema | `Transaction.transferPairId`, `autoHiddenAsTransfer`, `hidden` | Soft-hide + pair link |
| Scope | `apps/api/src/lib/transaction-scope.ts` | Aggregates exclude `hidden` |

## Matching Rules

A pair is created and both legs soft-hidden (`hidden` + `autoHiddenAsTransfer`) when all of:

1. Opposite direction (`EXPENSE` + `INCOME`)
2. Exact amount to cents + same currency
3. Both legs have a resolvable account (`accountKey` not null). Same account is allowed. Unassigned (`null`) legs never pair.
4. Posted only; not split; not already paired
5. Both legs categorized **Transfer** or **Credit card payment** (either/or; mixed allowed) within **5 days** on `postedDate ?? date`. Non-pairable categories (e.g. Uncategorized, Shopping, Salary) never pair on amount alone.
6. Soft account-type guard: if either leg is `Credit card payment`, the accounts are **distinct**, and **both** account types are known, require one credit and one non-credit account. Same-account pairs skip this guard. If either type is unknown, still pair on category + amount + window

User-initiated hides are never overwritten. Reconciliation only un-hides system auto-hides.

## Ingest order

All ingest paths that pair run **persist → apply rules → detectAndPairTransfers**. Rules run first so they can recategorize a leg to Transfer before matching. Pairing failures are logged and must not fail the sync or import.

CSV rows have no Plaid `externalTransactionId`. API pairing accepts `candidateTransactionIds` (internal ids) and looks back ±5 days around those rows.

## Backfill

After deploy, call authenticated `pairInternalTransfers` (or `detectAndPairTransfers({ userId, fullHistory: true })`) once per affected user. Incremental Plaid sync and CSV import continue to pair with a ±5 day lookback around written rows.

## Acceptance Criteria

- [x] `Credit card payment` ↔ `Credit card payment` pairs and hides when amount/window/accounts match
- [x] `Credit card payment` ↔ `Transfer` (mixed) pairs
- [x] `Transfer` ↔ `Transfer` still pairs, including same account within 5 days
- [x] Uncategorized never pairs with Transfer or Credit card payment
- [x] Non-pairable categories (e.g. Shopping ↔ Salary) never pair on amount alone
- [x] CC-payment pairs rejected when both accounts are known, distinct, and both credit or both non-credit
- [x] CC-payment pairs allowed when either account type is unknown
- [x] CC-payment same-account pairs skip the account-type guard
- [x] CSV import (web + desktop IPC/MCP/HTTP) applies rules then pairing
- [x] Unit tests cover the above
- [x] Spec documents backfill via `pairInternalTransfers`

## Non-Goals

- Blanket `Category.isHidden` on `Credit card payment` (one-sided payments stay visible)
- Pure amount matching with classification gate disabled
- Partial payments / fee-skewed amounts
- Calling pairing from FinanceKit import (separate follow-up)
- Changing insights/MCP exclusion lists independently of `hidden`
- Pairing Uncategorized with Transfer or Credit card payment
- Auto-assigning CSV rows to different accounts from a description column
- Pairing two unassigned (`accountKey` null) imports

## Open Questions

None — product decisions locked in the implementation plan.

## Related Specs

- `specs/complete/insights.spec.md` — exclude transfers / CC payments from income & spending
- `specs/features/show-hidden-transactions/spec.md` — soft-hide list UX
- `specs/complete/apple-finance-kit-categories.spec.md` — FinanceKit often maps payments as Transfer
- `specs/features/shared-csv-transaction-import/spec.md` — CSV import

## Suggested Commit Message

```text
feat: pair same-account transfers on import
```
