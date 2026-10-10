# Show Hidden Transactions

## Status

Draft. Created 2026-07-16 after reviewing transaction list scope, hide mutations, and web/iOS hide UX.

## Goal

Soft-hidden transactions (`Transaction.hidden = true`) remain visible in the transactions list on web and iOS, shown as faded rows with a Hidden tag. Users can restore them via Unhide inside the edit transaction UI. Aggregates (cash flow, spending, budget, summaries) continue to exclude hidden rows.

Success means:

- Hidden transactions appear in `getAll` / list `count` results
- List rows are grayed out with a Hidden tag
- Edit dialog/sheet toggles Hide ↔ Unhide; Unhide is not on list chrome
- Budgets, charts, and summaries still ignore `hidden: true`

## Product Context

Hide is a soft remove-from-view, not a hard delete. Users need to see what they hid and restore mistakes without a separate trash view.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Scope helper | `apps/api/src/lib/transaction-scope.ts` | `includeHidden` defaults false |
| List handlers | `apps/api/src/server/handlers/transaction.ts` | `getAll` / `count` exclude hidden today |
| Hide mutation | same file `delete` / `bulkDelete` | Sets `hidden: true` |
| Web table | `packages/features/src/transactions/transaction-table.tsx` | Already `opacity-40` optimistically |
| Edit dialog | `packages/features/src/transactions/edit-transaction-dialog.tsx` | Hide only |
| iOS list/detail | `apps/ios/Moat/Features/Transactions/Views/transactions-view.swift` | Refresh drops hidden rows |
| Schema | `Transaction.hidden` | Boolean, no migration needed |

## Target Experience

1. User hides a transaction → row stays in the list, faded, with a **Hidden** tag.
2. User opens the transaction (edit/detail) → button reads **Unhide transaction**.
3. User unhides → row returns to normal styling; aggregates include it again.
4. Context menu, bulk bar, and page toolbar never show Unhide.

## Architecture / Data Model

- `getAll` and list `count` pass `includeHidden: true` into scope helpers.
- Scope default remains `false` for aggregates.
- New `POST /api/v1/transaction/unhide` with `{ id }` sets `hidden: false`.
- Do not include category-hidden or `removedAt` rows.

## Acceptance Criteria

- [ ] Hidden txs appear in web and iOS transaction lists, faded with Hidden tag
- [ ] Unhide only in edit dialog/sheet; label toggles with `hidden`
- [ ] Aggregates/summaries still exclude hidden
- [ ] OpenAPI + TS clients expose `unhideTransaction`
- [ ] No Unhide on context menu / bulk bar / list toolbar

## Non-Goals

- Electron / SQLite local list changes
- Showing category-hidden or Plaid-removed rows
- MCP unhide tool
- Filter toggle for “Hidden only”

## Open Questions

None — product decisions locked in the implementation plan.

## Related Specs

- `specs/complete/transactions-shared-page/spec.md` — hide naming and shared UI
- `specs/complete/spending-shared-page/spec.md` — aggregate hidden semantics

## Suggested Commit Message

```text
feat: show hidden transactions grayed
```
