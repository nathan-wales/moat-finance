# Transaction Splits

## Status

Draft. Created September 16, 2026 after reviewing the existing two-row split handler (`apps/api/src/server/handlers/transaction.ts`), shared SidePanel editor (`packages/features/src/transactions/edit-transaction-dialog/`), list grouping (`transaction-table.tsx`), desktop SQLite gap, and the show-hidden spec.

## Goal

Make splitting a transaction feel like creating real, independently editable records — not an inline leftover on the original row.

Success means:

- Clicking **Split transaction** in the edit SidePanel opens a nested split view (back arrow top-left) without leaving the panel.
- A split of N legs hides the original bank row from lists and money aggregates and shows N child rows on the transactions page.
- Each child has its own name, category, tags, notes, and hide flag.
- A Split badge on each child opens the original group; row click edits that child.
- Web and desktop share the same UI; desktop local SQLite supports the same model.

## Product Context

Users split a merchant charge (Costco, Amazon) into the real things they bought so budgets, taxes, and review stay accurate. Today both legs keep the original name and the original row stays as the first leg, so the list does not look like two records.

## Current Repo Context

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Split columns | `apps/api/prisma/schema.prisma` | `splitGroupId`, `splitParentId`, `splitOriginalAmount` |
| Split handler | `apps/api/src/server/handlers/transaction.ts` | Two-way leftover: parent amount reduced, one child created |
| List scope | `apps/api/src/lib/transaction-scope.ts` | Canonical which-rows-count helper |
| SidePanel editor | `packages/features/src/transactions/edit-transaction-dialog/` | Nested view belongs here |
| FinApiClient | `packages/contracts/src/api-client.ts` | `splitTransaction` / `unsplitTransaction` optional |
| Desktop IPC | `packages/contracts/src/ipc/transactions.ts` | No split channels yet |
| SQLite schema | `packages/db-sqlite/prisma/schema.prisma` | No split columns |
| Show hidden | `specs/features/show-hidden-transactions/spec.md` | List includes `hidden: true`; do not reuse that flag for parents |

### Locked decisions

- Hidden parent: original bank row is excluded from lists/summaries; children are the spend rows.
- N-way: start with two legs; user can add/remove more. Amounts must sum to the original.
- Parent identity: `splitGroupId != null && splitParentId == null`. No new column.

## Target Experience

### Create split

1. Open a transaction in the SidePanel.
2. Tap **Split transaction**.
3. Header becomes back arrow + **Split transaction** + close.
4. Read-only original summary (name, account, full amount).
5. Two legs by default. Each leg: name, amount, category, tags, notes, hide.
6. **Add split** appends a $0 leg. Remove allowed when more than two legs.
7. Remainder line: original minus sum of legs. Save enabled when remainder is `0.00` and every leg has name, category, and amount > 0.
8. Back discards the draft. Save writes children, excludes the parent, closes the panel.

### After save

The transactions list shows the child rows (two records for a two-way split). Each has a Split badge on the far right.

- Row click → edit that child (name, category, tags, notes, hide). Amount edits happen in Manage split.
- Split badge click → nested split/original view for the group.
- **Manage split** on a child opens the same nested view. **Unsplit** lives there and restores the original bank row.

## Architecture / Data Model

### Parent vs child

| Role | `splitGroupId` | `splitParentId` | `amount` | Listed? |
|------|----------------|-----------------|----------|---------|
| Parent (original) | own `id` | `null` | original bank total | No |
| Child | parent `id` | parent `id` | that leg | Yes (unless user-hidden) |

Exclusion predicate (default in scope helpers, independent of `hidden`):

```text
NOT (splitGroupId IS NOT NULL AND splitParentId IS NULL)
```

Opt-in `includeSplitParents` only for split/unsplit/Plaid identity lookups.

### API

| Action | Route | Body |
|--------|-------|------|
| Split | `POST /api/v1/transaction/split` | `{ id, type, legs[] }` (legacy two-amount body still accepted) |
| Update split | `POST /api/v1/transaction/updateSplit` | `{ id, type, legs[] }` with optional per-leg `id` |
| Unsplit | `POST /api/v1/transaction/unsplit` | `{ id }` any group member; N children deleted |
| Get group | `POST /api/v1/transaction/getSplitGroup` | `{ id }` → `{ original, legs }` |

Each leg: `description`, `amount`, `categoryName`, `hashtags`, `notes`, `hidden`.

Cents-sum of legs must equal the parent’s original amount. Pending Plaid cannot be split.

### Existing data

Postgres migration copies the parent’s current (first-leg) state into a new child, then restores parent `amount` to `splitOriginalAmount`. Desktop has no existing split rows.

## Non-Goals

- Full iOS nested N-way editor (compatibility only: list without parent, unsplit still works).
- Reusing `Transaction.hidden` to hide the parent.
- Expanding the unused legacy web dialog at `apps/web/src/app/(dashboard)/transactions/edit-transaction-dialog.tsx`.

## Open Questions

None — product decisions locked in the implementation plan.

## Related Specs

- `specs/complete/transactions-shared-page/spec.md`
- `specs/features/show-hidden-transactions/spec.md`
- `specs/complete/plaid-transaction-import-optimization/spec.md`

## Suggested Commit Message

```text
feat: overhaul n-way transaction splits
```
