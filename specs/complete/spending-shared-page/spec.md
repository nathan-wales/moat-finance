# Shared Spending Intelligence Page

## Status

Draft. Created May 30, 2026 after reviewing the current web spending page, desktop spending page, desktop spending IPC handlers, shared `FinApiClient` contract, and existing `packages/features` extraction pattern.

## Goal

Move the spending page into the shared `@moat/features` package and have both `apps/web` and `apps/desktop` consume the same user-facing page.

The web app version is the product and UX source of truth. It is more complete than the desktop implementation today: it has the `Spending Intelligence` framing, anomaly alerts, top category ranking, pie/bar distribution tabs, stacked monthly category trends, and recurring expense list in one cohesive workflow. Desktop should adopt that experience instead of maintaining a simpler fork.

Success means:

- `apps/web` and `apps/desktop` render the same shared spending page component.
- The shared page uses the runtime-agnostic `FinApiClient` from `packages/contracts`, not `@moat/client-ts`, Next.js APIs, or Electron IPC directly.
- The web route stays visually and behaviorally equivalent to the current web implementation.
- The desktop route gains the web-grade spending intelligence experience without violating local-first IPC boundaries.
- Spending data calculations and response shapes are aligned enough that the shared page does not need host-specific branches for normal rendering.

## Product Context

Spending is one of the fastest ways for a user to understand whether Moat Finance has correctly learned their financial life. A good spending page should answer, at a glance:

- Where is my money going?
- Which categories dominate my monthly spend?
- Is my spending mix changing over time?
- Which recurring charges should I recognize?
- Is anything unusually high this month?

Moat Finance's desktop app is meant to become a local-first financial context OS for users and agents. If desktop has a weaker spending page than web, users lose confidence in the local experience and agents receive a less trustworthy context surface. Sharing the web implementation through `packages/features` keeps the two surfaces intentionally consistent while preserving their different data transports.

## Current Repo Context

### Web Source Page

Current file:

- `apps/web/src/app/(dashboard)/spending/page.tsx`

Current behavior:

- Client component titled `Spending Intelligence`.
- Four React Query reads:
  - `getSpendingCategoryBreakdown({ months: 3 })`
  - `getSpendingCategoryTrends({ months: 12 })`
  - `getRecurringExpenses()`
  - `getSpendingAnomalies()`
- Anomaly alert banner when unusual spending is detected.
- Top spending categories card showing top 8 categories, monthly average, percentage of total, and progress bar relative to the top category.
- Spending distribution card with `Tabs` for pie and bar views.
- Category trends stacked bar chart over 12 months with custom ranking, legend, and tooltip.
- Recurring expenses card with detected merchant/description, occurrence count, and monthly amount.

Important implementation detail:

- The web page currently imports generated HTTP functions directly from `@moat/client-ts`. That must not move into `packages/features`; the shared component must call `useApiClient()` instead.

### Desktop Current Page

Current renderer file:

- `apps/desktop/src/renderer/src/pages/spending.tsx`

Current behavior:

- Separate implementation titled `Spending`.
- Calls `useApiClient()` and React Query.
- Renders category breakdown, recurring expenses, and anomalies in simpler cards/tables.
- Does not render the web page's pie/bar distribution tabs.
- Does not render the web page's category trend chart.
- Does not share layout, wording, skeletons, colors, chart behavior, or empty-state behavior with web.

Desktop support files:

- `apps/desktop/src/main/ipc/spending.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/lib/ipc-api-client.ts`
- `packages/contracts/src/ipc/spending.ts`

### Shared Package Pattern

`packages/features` already hosts shared pages consumed by web and desktop:

- `OverviewDashboard`
- `BudgetPage`
- `CategoriesPage`
- `FinancialProfilePage`
- `PromptLibraryPage`
- `ScenariosPage`
- `WhatIfPage`

The spending page should follow this pattern:

- Shared UI lives under `packages/features/src/spending/`.
- The package root exports `SpendingPage`.
- The package `exports` map exposes `./spending`.
- Host apps provide data through `ApiClientProvider` and any host-only actions through props.

## Target Architecture

### Shared Feature Module

Create a new package module:

```text
packages/features/src/spending/
  index.ts
  spending-page.tsx
  spending-anomaly-alerts.tsx
  top-spending-categories-card.tsx
  spending-distribution-card.tsx
  category-trends-card.tsx
  recurring-expenses-card.tsx
  spending-chart-utils.ts
```

The exact split can change during implementation, but the final shape should avoid one large multi-component `.tsx` file. The current web page is already large enough that extracting the cards and chart helpers is preferable.

### Runtime Boundary

The shared page must depend only on runtime-agnostic surfaces:

- `useApiClient()` from `packages/features/src/api-client-context.tsx`
- Types from `@moat/contracts`
- UI primitives from `@moat/ui`
- `@tanstack/react-query`
- `recharts`
- Shared formatting utilities, either moved into a package or implemented locally in the feature module

The shared page must not import:

- `@moat/client-ts`
- `~/components/*`
- `~/lib/*`
- Next.js routing/session/server modules
- Electron `window.moatDesktop`, IPC channels, or preload types
- API app files or Prisma

### Host Consumption

Web route target:

```tsx
"use client";

import { SpendingPage } from "@moat/features";

export default function Page() {
  return <SpendingPage />;
}
```

Desktop renderer target:

```tsx
import { SpendingPage } from "@moat/features";
```

Then render the shared component for the `spending` page id in `apps/desktop/src/renderer/src/App.tsx` and delete the desktop-specific `pages/spending.tsx` once it has no remaining app-only behavior.

If host-specific header actions are needed later, add optional props such as `headerActions` or `distributionHeaderActions`. Phase 1 does not need host-specific actions.

## UX Requirements

The shared page should preserve the web page's hierarchy and behavior.

### Page Header

- Title: `Spending Intelligence`.
- Subtitle: `Insights into your spending patterns, recurring charges, and anomalies`.
- Use a constrained content width consistent with other shared pages, currently `mx-auto w-full max-w-5xl space-y-6 pb-24` in the web source.
- Desktop should not wrap the shared page in extra card chrome. The app shell can keep its existing scroll container and background.

### Anomaly Alerts

- Show only when anomalies exist.
- Render one alert row per anomaly.
- Include category, current amount, average amount, and ratio.
- Use an icon from `lucide-react` instead of the current literal warning glyph when moving into shared UI.
- Use muted amber styling that works in both web and desktop themes.

### Top Spending Categories

- Show the top 8 categories from the 3-month breakdown.
- Each row shows:
  - colored dot
  - category name
  - monthly average
  - percentage of total spending
  - progress bar relative to top category via `percentOfTop`
- Loading state shows skeleton rows.
- Empty state should say there is no spending data yet, not fail silently.

### Spending Distribution

- Keep the `Pie` and `Bar` tabs.
- Pie mode uses the top 8 category totals.
- Bar mode uses the top 8 category totals.
- Tooltips format values as currency.
- Labels must remain readable in desktop and web at common widths. If the current pie labels overlap in narrower containers, improve the shared component during extraction rather than preserving the overlap.

### Category Trends

- Show 12 months of spending trends.
- Preserve the web source behavior that ranks category segments within each month by amount before stacking them, so the largest categories remain visually prominent.
- Keep custom tooltip rows sorted by amount.
- Keep a custom legend outside the chart so category colors stay stable and readable.
- Loading state shows a chart-sized skeleton.
- Empty state should clearly say that trend data is not available yet.

### Recurring Expenses

- Show detected recurring expenses sorted by monthly amount.
- Each row shows description, occurrence count, and monthly amount badge.
- Preserve `No recurring expenses detected yet.` when empty.
- Descriptions should be display-safe and not logged or sent to analytics.

## Data And Contract Requirements

### Existing Shared `FinApiClient` Methods

The shared page can use these existing methods from `packages/contracts/src/api-client.ts`:

- `getSpendingCategoryBreakdown(input: SpendingInput): Promise<SpendingBreakdownResponse>`
- `getSpendingCategoryTrends(input: SpendingInput): Promise<SpendingTrendsResponse>`
- `getSpendingAnomalies(): Promise<SpendingAnomaliesResponse>`
- `getRecurringExpenses(): Promise<RecurringExpensesResponse>`

These are the correct contract-level methods. The extraction should not add a second spending-specific client unless a real new capability is required.

### Breakdown Shape Alignment

The `FinApiClient` contract expects `SpendingBreakdownResponse` to be an array of:

```ts
type CategoryBreakdown = {
  category: string;
  total: number;
  percentage: number;
  monthlyAvg: number;
  percentOfTop: number;
};
```

The web API already returns this shape through `@moat/domain`'s `getSpendingBreakdown`.

Desktop currently has a mismatch at the IPC layer:

- `packages/contracts/src/ipc/spending.ts` defines `SpendingBreakdownResponseSchema` as `{ items, totalSpend, months }`, and each item only has `category`, `total`, and `percentage`.
- `apps/desktop/src/main/ipc/spending.ts` returns `getSpendingBreakdown(appCtx, { months })`, which is an array with `monthlyAvg` and `percentOfTop`.
- `apps/desktop/src/renderer/src/lib/ipc-api-client.ts` defensively accepts `categories`, `items`, or the raw result.

This should be cleaned up as part of the shared page work:

- Prefer making the IPC spending breakdown response match the shared `FinApiClient` array shape.
- Remove defensive casting once preload, IPC contract, main handler, and `ipcApiClient` agree.
- Keep the transport boundary explicit; renderer still calls `window.moatDesktop.spending.getCategoryBreakdown()` through the typed preload bridge.

### Trend Shape Alignment

The shared trend contract expects:

```ts
type SpendingTrendsResponse = {
  months: Array<{ month: string; [category: string]: unknown }>;
  categories: string[];
};
```

Web currently returns true month-by-month category totals from the API.

Desktop currently returns a simplified trend: it asks the budget repository for period totals and places all totals into a single month bucket. That is not sufficient for the web-grade category trends chart.

Desktop needs a real local spending trend query before or during extraction:

- Aggregate expense transactions by canonical transaction month and category for the requested range.
- Include uncategorized transactions as `Uncategorized`.
- Respect hidden/deleted transaction semantics already used by local transaction listing and budgeting.
- Return months sorted ascending by `YYYY-MM`.
- Return categories sorted consistently. The shared UI applies its own color order based on the returned category list.

Preferred location:

- Add a repository/runtime method for category spending by month rather than embedding complex grouping in the IPC handler.
- If a short-term implementation stays in IPC, keep it typed, tested, and move it into the local data layer when the repository shape is available.

### Recurring Expenses Alignment

Web recurring expense detection pre-aggregates by normalized description and canonical month, then requires at least two months with monthly totals within 10 percent of average.

Desktop currently fetches recent transactions and groups raw transaction amounts by normalized description, requiring each transaction amount to be within 15 percent of average. This can misclassify merchants with multiple same-month charges and differs from web.

For parity, desktop should match the web algorithm:

- Aggregate to description x canonical month first.
- Use the same month window as web unless the shared client method grows an explicit months input.
- Require at least two months.
- Use the same variance threshold as web.
- Sort descending by monthly amount.

### Anomaly Alignment

Web anomaly detection aggregates category x month, compares current month to historical months, requires at least two historical months, and flags `currentAmount > avg * 1.75`.

Desktop already uses a similar approach but should be verified against web behavior:

- Use the same effective month window.
- Use the same category fallback.
- Use the same current-month key format.
- Respect local hidden/deleted transaction semantics.

### Reporting Period And Demo Snapshot

Web API reads use `getEffectiveNow(ctx)` so demo mode can operate against a stable snapshot date. Desktop uses local `new Date()` because it is local-first and not demo-session based. That difference is acceptable, but it should be documented in code comments or tests if date-sensitive assertions are added.

## Implementation Plan

### Phase 1 - Extract Shared Page Without Behavior Changes

1. Create `packages/features/src/spending/`.
2. Move the web page UI and chart helpers into shared components.
3. Replace direct `@moat/client-ts` calls with `const client = useApiClient()` calls.
4. Replace web-only UI imports with `@moat/ui` imports.
5. Replace `~/lib/forecasting` currency formatting with a shared helper. Prefer an existing package helper if one exists; otherwise add a small local `formatCurrency` utility in the spending module.
6. Export `SpendingPage` from `packages/features/src/spending/index.ts`.
7. Add `SpendingPage` to `packages/features/src/index.ts`.
8. Add `./spending` to `packages/features/package.json` exports.

Acceptance criteria:

- `pnpm --filter @moat/features run typecheck` passes.
- The shared page has no imports from `apps/web`, `apps/desktop`, `@moat/client-ts`, or Electron APIs.
- The shared page still renders the same sections as the current web source page.

### Phase 2 - Consume Shared Page In Web

1. Replace `apps/web/src/app/(dashboard)/spending/page.tsx` with a thin wrapper around `SpendingPage`.
2. Confirm the web dashboard route is still a client component.
3. Verify the web app's existing `ApiClientProvider` covers the dashboard route. If not, add the provider at the correct dashboard boundary rather than inside the spending page.
4. Preserve the current visual layout and query keys where practical.

Acceptance criteria:

- Web spending page renders with the same title, cards, charts, tabs, and recurring expenses behavior.
- `pnpm --filter moat-web run typecheck` passes.
- `pnpm --filter moat-web run check:write` passes.

### Phase 3 - Fix Desktop Spending Data Contracts

1. Align `packages/contracts/src/ipc/spending.ts` with the shared `FinApiClient` spending shapes.
2. Update `apps/desktop/src/preload/index.ts` spending bridge types.
3. Update `apps/desktop/src/main/ipc/spending.ts` to return the agreed shapes.
4. Update `apps/desktop/src/renderer/src/lib/ipc-api-client.ts` to remove defensive shape coercion for breakdown.
5. Implement real local category trends grouped by month and category.
6. Align desktop recurring expense detection with the web algorithm.
7. Verify anomaly detection parity and hidden/deleted transaction handling.

Acceptance criteria:

- `ipcApiClient.getSpendingCategoryBreakdown()` returns `SpendingBreakdownResponse` directly.
- `ipcApiClient.getSpendingCategoryTrends({ months: 12 })` returns multiple month buckets when local data spans multiple months.
- Desktop recurring expense detection matches the web algorithm for equivalent transaction fixtures.
- Renderer code does not know about IPC-specific spending response shapes.

### Phase 4 - Consume Shared Page In Desktop

1. Import `SpendingPage` from `@moat/features` in `apps/desktop/src/renderer/src/App.tsx`.
2. Render the shared page for `page === "spending"`.
3. Delete `apps/desktop/src/renderer/src/pages/spending.tsx` after the shared component fully replaces it.
4. Keep all data access through `ApiClientProvider client={ipcApiClient}`.

Acceptance criteria:

- Desktop spending page displays the same sections as web.
- Desktop no longer has a separate spending renderer page implementation.
- `pnpm --filter moat-desktop run typecheck` passes.
- `pnpm --filter moat-desktop run check:write` passes.

### Phase 5 - Visual And Interaction Verification

1. Run web locally and verify the spending route at desktop and narrow widths.
2. Run desktop locally and verify the spending route with local data.
3. Confirm chart labels and legends do not overlap in common viewport widths.
4. Confirm loading, empty, error, and populated states are all acceptable.
5. Confirm desktop chart rendering is nonblank and uses real monthly trends.

Acceptance criteria:

- Web and desktop screenshots show the same information architecture.
- Pie labels, legends, tabs, and stacked bars remain readable.
- Empty local desktop data shows empty states instead of broken charts.

## Testing Plan

### Shared Feature Tests

- Render `SpendingPage` with a mocked `FinApiClient` and QueryClient.
- Verify all four queries are requested with the intended inputs.
- Verify anomaly alerts render when anomalies exist and disappear when empty.
- Verify top category rows, pie/bar tabs, trend chart container, and recurring expenses render from fixture data.
- Verify empty states for breakdown, trends, and recurring expenses.

### Desktop Data Tests

- Add local repository or IPC tests for category trends grouped by month and category.
- Add recurring expense fixture tests that include multiple charges in one month to ensure monthly pre-aggregation matches web behavior.
- Add anomaly fixture tests for current-month spike detection.
- Add a contract test or focused unit test for `ipcApiClient` spending methods returning `FinApiClient` shapes.

### Manual Verification

- Web: `pnpm --filter moat-web run dev`, open `/spending` or the dashboard spending route.
- Desktop: `pnpm --filter moat-desktop run dev`, navigate to Spending.
- Typecheck shared package, web, and desktop.
- Run formatting/lint checks for web and desktop after edits.

## Analytics, Logging, And Privacy

- Do not add analytics in Phase 1. The page is read-only and high-signal enough without noisy chart interaction events.
- If analytics are added later, use Moat Finance's PostHog naming rules and only send counts/booleans/enums. Never send category names, descriptions, merchant strings, transaction descriptions, or raw amounts tied to user identity.
- Do not log recurring expense descriptions, category names from user data, transaction descriptions, or raw transaction rows.
- Desktop IPC errors should be observable through the existing app error handling patterns, but logs must avoid PII.

## Accessibility And Responsive Requirements

- Tabs must be keyboard accessible through `@moat/ui` tab primitives.
- Charts should have nearby textual summaries or card headings so the page is still understandable when chart details are not available to assistive tech.
- Text must not overlap chart labels, legends, card headers, or badges at desktop and narrow widths.
- Currency values should use tabular numeric styling where compact comparison matters.
- Color should not be the only signal for category identity; labels and tooltips must remain present.

## Non-Goals

- Do not redesign the spending page beyond the minimum needed to make it shared and responsive.
- Do not add new spending filters, date pickers, drill-down pages, or transaction links in this spec.
- Do not move API handler business logic into `apps/web` or `packages/features`.
- Do not expose raw SQLite, Prisma, AppRuntime, Node.js, or filesystem access to the desktop renderer.
- Do not add a second charting library.
- Do not solve broader transaction parity work here except where hidden/deleted semantics affect spending aggregates.

## Risks And Mitigations

### Risk: Shared UI Accidentally Imports Web-Only Code

Mitigation:

- Keep all shared files under `packages/features/src/spending/` using `@moat/ui`, `useApiClient`, and `@moat/contracts` only.
- Typecheck `@moat/features` before wiring hosts.

### Risk: Desktop Data Looks Broken After Adopting Web Charts

Mitigation:

- Fix trends before switching desktop to the shared page.
- Add empty states for no trend months and no categories.
- Use fixture tests for multi-month local spending data.

### Risk: IPC And API Shapes Drift Again

Mitigation:

- Make `FinApiClient` the only shape the shared page knows.
- Keep IPC response schemas named and close to the corresponding API client types.
- Remove defensive shape coercion in `ipcApiClient` once the transport contract is corrected.

### Risk: Pie Labels Become Crowded

Mitigation:

- During extraction, allow a small chart UX improvement such as hiding labels below a width threshold or moving labels into a legend/tooltip.
- Preserve the same information content even if label placement improves.

## Open Questions

- Should `getRecurringExpenses` accept an optional `{ months }` input in `FinApiClient` so web and desktop can explicitly share the same window, or should it remain fixed at the API/client layer?
- Should category trends include zero-filled months for months with no spending, or should the chart show only months with data as it does today?
- Should the shared spending page eventually include host-injected `Ask AI` actions for spending insights, matching the shared overview and budget patterns?
- Should spending aggregation exclude hidden categories as well as hidden transactions, or should hidden categories still count in totals under their names?

## Done Definition

This feature is done when:

- `packages/features` exports a shared `SpendingPage`.
- The web spending route is a thin wrapper around the shared component.
- The desktop spending route renders the shared component through `ipcApiClient`.
- The old desktop-specific spending page is removed.
- Desktop IPC spending contracts produce the same data shapes expected by `FinApiClient`.
- Desktop category trends are real monthly category trends, not a single-period approximation.
- Web and desktop typechecks pass.
- Web and desktop lint/format checks pass.
- Manual verification confirms the shared page renders correctly on both surfaces.