# Category Parent Buckets

## Status

Draft. Created 2026-08-29 after reviewing category overrides, canonical defaults, net-income insights, spending insights, and the categories management page.

## Goal

Give every spend category a user-editable parent — Fixed, Flexible, or Non-monthly — and let users toggle insights, spending, and the categories page between the current flat category list and three rolled-up parent totals.

Success means:

- Every expense category (defaults and customs) has a parent the user can change; Income/Transfer stay ungrouped
- Where Your Income Went, Top Spending, and Spending Distribution can switch to three parent rows/slices
- Categories page shows the parent as the row badge and can regroup into parent sections
- Web, desktop, and iOS share the same behavior

## Product Context

Moat’s catalog is a flat chart of accounts (`isDefault` vs custom). Users already think about spend as bills vs lifestyle vs irregular. Parent buckets are a second axis on the same categories, not a replacement for Default vs Custom, retirement essentiality, or transaction type.

This is distinct from:

- Default vs Custom — how the catalog is managed
- Retirement Essential / Flexible on `RetirementSpendingCategoryPlan` — lifestyle in retirement; do not reuse or sync
- Transaction `INCOME` / `EXPENSE` — already on the transaction

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Canonical defaults | `packages/category-mapping/src/canonical-categories.ts` | Name, sortOrder, optional isHidden. No parent. |
| Postgres Category | `apps/api/prisma/schema.prisma` | Global defaults (`userId` null) + per-user customs |
| Overrides | `CategoryOverride` + `packages/data-access/src/category-overrides.ts` | Sparse name/icon/hidden/removed overlay |
| Category API | `apps/api/src/server/handlers/category.ts` + `category.service.ts` | list/create/update/delete/toggleHidden |
| SQLite | `packages/db-sqlite` | Same catalog + override merge |
| Categories UI | `packages/features/src/categories/` | Default/Custom sections; Default/Custom badge |
| Net income | `packages/features/src/insights/net-income/net-income-tab-sections.tsx` | Where Your Income Went; Income/Net Income bookends |
| Spending | `packages/features/src/spending/top-spending-categories-card.tsx` + `spending-distribution-card.tsx` | Flat top 8 |
| Drill-down | `packages/features/src/insights/use-insights-drill-down.ts` | Single `category` query param today; transactions already parse comma-separated names |
| iOS | `apps/ios/Moat/Features/Categories/` and Insights spending/net-income sections | Parallel Swift screens |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Override merge | `applyCategoryOverride` | Add `parentCategory` the same way as name/icon |
| Mutation split | `category.service.ts` / `SqliteCategoryRepository` | Custom → row; default → override |
| Tabs | `@moat/ui` Tabs | Same pattern as pie/bar on spending distribution |
| Transaction filters | `packages/features/src/transactions/page.tsx` | `category` is already a comma-separated list |

## Target Experience

### Categories page

Row badge is the parent label (`Fixed` / `Flexible` / `Non-monthly`). Income/Transfer/Salary/Reimbursement/Credit card payment/Investments have no parent badge.

Page header toggle (right of title, left of “Category”):

- **Category** — current Default Categories / Custom Categories sections
- **Parent** — sections Fixed, Flexible, Non-monthly, plus Ungrouped for income, transfer, and investments

Create/edit dialog: parent Select, required for spend categories. Hidden for ungrouped system categories. New customs default to Flexible.

### Where Your Income Went

Card header: title left, Category / Parent toggle top-right.

- Category mode: today’s list (Income bookend, category rows, Net Income)
- Parent mode: Income bookend, three parent rows (bar vs total income, monthly avg unchanged), Net Income

Click a parent row → transactions filtered to that parent’s expense category display names + current period.

### Spending

One shared toggle on Top Spending Categories, lifted to the spending tab and passed into Spending Distribution so pie/bar becomes three slices. Category trends, recurring, and anomalies stay at category grain.

### iOS

Same toggle labels and grouping. Segmented control, not an unstyled `Toggle`.

### Copy

| Surface | Copy |
|---------|------|
| Toggle | Category / Parent |
| Parent labels | Fixed, Flexible, Non-monthly |
| Ungrouped section | Ungrouped |
| Dialog field | Parent |

## Architecture / Data Model

```prisma
enum CategoryParent {
  FIXED
  FLEXIBLE
  NON_MONTHLY
}

model Category {
  parentCategory CategoryParent?
  // ...existing fields
}

model CategoryOverride {
  parentCategory CategoryParent?
  // ...existing fields
}
```

Reads merge `COALESCE(override.parentCategory, category.parentCategory)`. Mutation:

- Custom → write `Category.parentCategory`
- Default → upsert override; store null overlay when it matches the canonical seed

`list` / create / update DTOs include `parentCategory: "FIXED" | "FLEXIBLE" | "NON_MONTHLY" | null`.

Spending and net-income breakdown rows include `parentCategory` (resolved for the current user). Clients roll up with a shared helper.

### Canonical seed

| Parent | Categories |
|--------|------------|
| None | Salary, Reimbursement, Transfer, Credit card payment, Investments |
| Fixed | Mortgage & Rent, Bills & Utilities, Insurance, Subscriptions, Loans |
| Flexible | Groceries, Gas, Auto & Transport, Health & Medical, Kids, Pets, Education, Eating Out, Shopping, Clothing, Entertainment, Sports & Fitness, Business Services, Fees, Uncategorized |
| Non-monthly | Home, Cars, Travel, Flights, Gifts & Donations, Taxes |

Existing custom categories with null parent are backfilled to Flexible.

New customs default to Flexible.

### View preference

Persist independently per surface in `localStorage`:

- `insights-net-income-category-view`
- `insights-spending-category-view`
- `categories-list-view`

Values: `category` | `parent`.

## Implementation Plan

### Phase 1 — Spec (this file)

**Acceptance criteria:** Seed map, copy, non-goals, and locked product decisions are written down.

### Phase 2 — Schema and API

Postgres + SQLite columns, seed, backfill, override merge, OpenAPI, contracts, IPC.

### Phase 3 — Categories UI (web/desktop)

Dialog, badges, page toggle.

### Phase 4 — Insights and spending

Breakdown `parentCategory`, rollup helper, toggles, multi-category drill-down.

### Phase 5 — iOS

DTO, editor picker, three screens.

## Acceptance Criteria

- [ ] Expense default categories seed with the parent map above; Salary, Reimbursement, Transfer, Credit card payment, and Investments stay `null`
- [ ] User can change parent on any spend category (default via override, custom on the row) without affecting other users’ defaults
- [ ] New custom categories default to Flexible
- [ ] Existing custom categories are backfilled to Flexible
- [ ] Categories page badge shows parent (or none for ungrouped); Category vs Parent grouping toggle works
- [ ] Where Your Income Went parent mode keeps Income and Net Income bookends and shows three parent totals
- [ ] Spending Top Categories and Distribution share one toggle and roll up to three parents
- [ ] Clicking a parent drills to transactions filtered to that parent’s categories
- [ ] Web, desktop, and iOS all expose parent editing and the three view toggles
- [ ] Retirement essentiality is unchanged and not synced

## Non-Goals

- Parent-level budgets
- New MCP tools (Category DTO already carries the field)
- Forecast / cash-flow grouping by parent
- Category trends, recurring expenses, or anomalies grouped by parent
- Nested expandable parent rows on insights (this iteration is three summary rows only)
- Syncing with retirement Essential / Flexible
- Reset-parent-to-seed UI

## Open Questions

None for this iteration. Investments is ungrouped so purchases do not roll into spend-parent totals.

## Related Specs

- `specs/features/category-overrides/spec.md` — overlay pattern to extend
- `specs/complete/apple-finance-kit-categories.spec.md` — canonical default catalog

## Suggested Commit Message

```text
feat: add category parent buckets
```
