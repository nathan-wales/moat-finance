# Insights Category Filter

## Status

Draft. Created 2026-09-17 after reviewing Insights page chrome, period/tab URL state, category parent grouping, and Insights/spending query inputs.

## Goal

Let users include or exclude income and expense categories from everything on the Insights page, without changing Transactions, dashboard widgets, retirement math, or iOS.

Success means:

- A filter icon to the right of the Insights date control opens a popover of checked income and expense categories, with Add more, Cancel, and Save
- Saving the selection changes Net Income, Income, and Spending tabs for that user
- Default (nothing excluded) matches today’s unfiltered Insights numbers
- Other surfaces stay unfiltered

## Product Context

Insights currently filters only by time range. Users who want to hide Salary, isolate grocery spend, or drop a noisy custom category have to leave the page. This control is an Insights-only view filter, not a catalog or transaction-list change.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Page shell | `packages/features/src/insights/insights-page.tsx` | Tabs left, period selector right; tab/period in URL |
| Period control | `packages/features/src/insights/insights-period-selector.tsx` | `h-9` outline dropdown |
| Income / net / spending tabs | `packages/features/src/insights/` | Period-only React Query keys |
| Insights APIs | `apps/api/src/lib/insights/` + `handlers/insights.ts` | `InsightsInput` is period ± custom dates |
| Spending APIs | `apps/api/src/server/handlers/spending.ts` | Breakdown/trends take range; recurring/anomalies are unfiltered GET |
| Transaction scope | `apps/api/src/lib/transaction-scope.ts` | Canonical date + hidden/split exclusions; name filters exist for Prisma `WhereInput` only |
| Category catalog | `packages/contracts` `Category.parentCategory` | `null` = ungrouped income/transfer/investment names |
| Filter popover pattern | `packages/features/src/transactions/filters/filters-popover/` | Draft on open, overflow body, sticky Cancel/Apply |
| Category view persistence | `packages/features/src/categories/use-persisted-category-view.ts` | localStorage, Insights-only keys already exist |
| Desktop IPC | `apps/desktop/src/main/ipc/insights.ts` + `spending.ts` | Duplicates SQL; net income uses domain `getNetIncome` |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `@moat/ui` Popover / Checkbox / Button / DropdownMenu | `packages/ui` | Nested Add more uses `DropdownMenu` with `modal={false}` |
| `listCategories()` | API client | Full `Category[]` including `parentCategory`, `isHidden`, `isRemoved` |
| `summarizeNetIncome` | `@moat/domain` | Reuse for filtered net-income totals; do not change `getNetIncome` callers in retirement |
| `FiltersPopover` footer | transactions filters | Cancel/Save pinned below overflow |

## Target Experience

Toolbar on Insights:

```
[Net Income] [Income] [Spending]          [Calendar This month v] [Filter]
```

Filter icon is `ListFilter`, `h-9` square, outline when idle, secondary when any category is excluded.

Popover (align end):

```
┌─────────────────────────────────┐
│ Income categories               │
│ [x] Salary                      │
│ [x] Rental Income               │
│ + Add more                      │
│                                 │
│ Expense categories              │
│ [x] Eating Out                  │
│ [x] Groceries                   │
│ …                               │
│ + Add more                      │
│─────────────────────────────────│
│              [Cancel] [Save]    │
└─────────────────────────────────┘
```

- Body scrolls; footer stays fixed
- Open copies applied state into a draft
- Uncheck removes the row from the selected list (it appears under Add more)
- Add more is a dropdown of remaining names for that section
- Cancel closes without saving; Save commits and refetches all three tabs
- Empty selected list is allowed and yields $0 / empty charts for that side

### Grouping

- **Income:** visible ungrouped catalog names (`parentCategory === null`, such as Salary and Credit card payment) plus every category that has at least one `INCOME` transaction in the selected period. A custom spend category such as Rental Income appears here when money came in under that name.
- **Expense:** visible categories with a spend parent, plus every category that has at least one `EXPENSE` transaction in the selected period.
- The same name can appear in both sections. Unchecking it under Income hides that category's income only.
- Hidden or removed categories (including Transfer) never appear.
- The allow-list is not applied until period activity has loaded, so excluding one income name cannot drop income that sits on a spend category.

### Persistence

localStorage key `insights-category-filter-exclusions` stores excluded names per section. New categories stay included. Tab and period stay in the URL.

## Architecture / Data Model

Optional include lists on existing request bodies. Omit = all categories. `[]` = match none.

| Input | Fields |
|-------|--------|
| `InsightsInput` | `incomeCategories?: string[]`, `expenseCategories?: string[]` |
| Spending range bodies | `expenseCategories?: string[]` |
| Recurring / anomalies GET | optional `expenseCategories` query (iOS GET with no params stays unfiltered) |

Apply by transaction type:

- Income aggregations: `type = INCOME` and resolved category name in `incomeCategories`
- Expense aggregations: `type = EXPENSE` and resolved category name in `expenseCategories`
- Net income: income side + expense side, then `summarizeNetIncome`

Resolved name matching uses category FK name, per-user override name, and legacy `t.category`, case-insensitive.

Unfiltered Insights (no exclusions) continues to call domain `getNetIncome` so retirement/dashboard numbers cannot drift. Filtered Insights uses scoped monthly totals instead.

Dashboard widgets and iOS omit the new fields.

## Implementation Plan

### Phase 1 — Spec, helpers, popover

1. Spec (this file)
2. Pure split/exclude/include helpers + tests
3. Popover UI wired to Insights toolbar and localStorage

**Acceptance criteria:** Filter control renders; draft Cancel/Save; exclusions persist in localStorage.

### Phase 2 — Query plumbing

1. `transactionScopeSql` category-name fragment
2. Insights + spending handlers/services, OpenAPI, contracts, desktop IPC
3. Pass include lists into all three tab query keys

**Acceptance criteria:** Unchecking Salary zeros income-side Insights; unchecking Groceries drops grocery spend; widgets unchanged.

## Acceptance Criteria

- [ ] Filter icon sits to the right of the Insights date control
- [ ] Popover lists checked income and expense categories with Add more, overflow body, and sticky Cancel/Save
- [ ] Default includes every visible catalog category; Insights numbers match pre-filter behavior
- [ ] Save applies to Net Income, Income, and Spending (including recurring and anomalies on Spending)
- [ ] Cancel discards the draft
- [ ] Exclusions persist across Insights visits in localStorage
- [ ] Dashboard spending widgets, Transactions, retirement, and iOS stay unfiltered

## Non-Goals

- iOS Insights filter UI
- Putting category filters in the URL
- Applying the Insights filter after drill-down to Transactions
- Changing retirement / overview `getNetIncome` math
- Filtering dashboard spending widgets

## Open Questions

- None for v1. Income membership follows period activity, so a spend-parent category with an income transaction appears under Income.

## Related Specs

- [Insights (shipped)](../../complete/insights.spec.md)
- [Category parent buckets](../category-parent-buckets/spec.md)

## Suggested Commit Message

```text
feat (web): add insights category filter
```
