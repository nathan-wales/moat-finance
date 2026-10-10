# iOS Insights Page

## Status

Draft. Created July 1, 2026 after shipping the web/desktop Insights page ([insights.spec.md](./insights.spec.md)) and reviewing the current native Spending implementation.

Do not implement until this spec is approved.

## Goal

Replace the standalone iOS **Spending** screen in the More menu with a native **Insights** page that matches the cross-platform Insights product: three top tabs (**Spending**, **Income**, **Net Income**) and a shared time-range control.

The current Spending screen content should move into the **Spending** tab with minimal visual or behavioral change. Income and Net Income are new native tabs backed by the existing Insights API endpoints.

Success means:

- iOS users open **Insights** from the More menu and land on the **Spending** tab by default.
- The Spending tab preserves today's charts, cards, drill-down links, loading/error/refresh behavior, and Moat design-system styling.
- Income and Net Income tabs render the same sections as web/desktop, using native SwiftUI layouts that feel like siblings of the Spending tab — not a separate product surface.
- Period selection is shared across all three tabs and stays in sync while the user switches tabs.
- Dashboard widgets and any existing Spending deep links route to Insights with the Spending tab selected.

## Product Context

Moat Finance Insights answers three related questions:

- **Spending** — where did money go?
- **Income** — where did money come from?
- **Net Income** — am I getting ahead or falling behind?

The iOS app already has a polished native Spending screen, but it lives alone in the More menu and only covers spending. Users on web and desktop now get a unified Insights page; iOS should match that information architecture while keeping the native look and feel users already have on Spending.

This is a native SwiftUI feature. Do not embed a web view or share React components from `packages/features/`. Reuse API contracts and product rules from the shared Insights backend, not shared UI code.

## Related Specs

- [insights.spec.md](./insights.spec.md) — canonical cross-platform Insights product spec (web/desktop implementation reference)
- [apps/ios/AGENTS.md](../../apps/ios/AGENTS.md) — iOS architecture, API client, and design conventions

---

## Current Repo Context

### iOS Spending (existing native screen)

| Asset | Location | Notes |
|-------|----------|-------|
| Screen | `apps/ios/Moat/Features/Spending/Views/spending-view.swift` | Scrollable page with summary card, monthly trend bars, categories, recurring, anomalies |
| View model | `apps/ios/Moat/Features/Spending/ViewModels/spending-view-model.swift` | `@MainActor ObservableObject`; states: idle, loading, loaded, refreshing, error |
| Service | `apps/ios/Moat/Features/Spending/Services/spending-service.swift` | Parallel fetch to four spending endpoints |
| Models | `apps/ios/Moat/Features/Spending/Models/spending-models.swift` | `SpendingCategoryBreakdown`, `SpendingTrendResponse`, `RecurringExpense`, `SpendingAnomaly` |
| Navigation entry | `apps/ios/Moat/App/app-destination.swift` | `AppDestination.spending` titled "Spending", icon `chart.bar.xaxis` |
| More menu routing | `apps/ios/Moat/App/more-menu-view.swift` | `.spending` → `SpendingView()` |
| Dashboard link | `apps/ios/Moat/Features/Dashboard/Views/DashboardView.swift` | `spending-by-category` widget links to `.spending` |

Current Spending behavior to preserve:

- Navigation title: `Spending`
- Period control: toolbar calendar menu with **3, 6, 12, 24 months** (stored as `selectedMonths: Int`, default **6**)
- Pull-to-refresh and top refresh overlay while reloading
- `LoadingView`, `ErrorStateView`, `.finPageBackground()`, `MoatCard`, `MoatTheme` tokens
- Category/recurring/anomaly rows navigate into `TransactionsView` with prefilled filters
- Custom native bar chart in `SpendingTrendCard` (not a third-party chart library)

Current Spending API calls (unchanged for Spending tab v1):

| Endpoint | Method | Body |
|----------|--------|------|
| `/api/v1/spending/getCategoryBreakdown` | POST | `{ "months": number }` |
| `/api/v1/spending/getCategoryTrends` | POST | `{ "months": number }` |
| `/api/v1/spending/getRecurringExpenses` | GET | — |
| `/api/v1/spending/getAnomalies` | GET | — |

### Shared Insights backend (already shipped)

| Asset | Location | Notes |
|-------|----------|-------|
| Income handler | `apps/api/src/server/handlers/insights.ts` | `getIncomeInsights` via `withDemoOrAuth` |
| Net income handler | `apps/api/src/server/handlers/insights.ts` | `getNetIncomeInsights` via `withDemoOrAuth` |
| Period + response types | `apps/api/src/lib/insights/types.ts` | `InsightsPeriod`, `IncomeInsightsData`, `NetIncomeInsightsData` |
| OpenAPI | `packages/openapi/api-v1.yaml` | `/api/v1/insights/getIncomeInsights`, `/api/v1/insights/getNetIncomeInsights` |

Insights API request body:

```json
{ "period": "3m" }
```

Supported periods in API:

```txt
this-month | 1m | 2m | 3m | 6m | 12m
```

Web period mapping reference: `packages/features/src/insights/period-utils.ts` (`insightsPeriodToMonths`).

### iOS patterns to follow

| Pattern | Example in repo |
|---------|-----------------|
| Feature module layout | `Features/Spending/`, `Features/Budget/` — Models, Services, ViewModels, Views |
| API access | `APIClient.shared` via actor services (`SpendingService`, `BudgetService`) |
| Screen state | `@MainActor final class …ViewModel: ObservableObject` with explicit `ViewState` enum |
| Segmented controls | `RulesView`, `TransactionsView`, `ScenariosView` use `Picker(…).pickerStyle(.segmented)` |
| Cards / page chrome | `MoatCard`, `.finPageBackground()`, `.finGlass()` refresh pill |
| Currency formatting | `CurrencyFormatter.formatCompact(_:)` |
| Month labels | `DateFormatterProvider.formatYearMonth(_:)` |

### iOS navigation today

- Spending is **not** a root tab. Root tabs are Home, Profile, Transactions, More (`AppShellView`).
- Spending is reachable from **More → Spending** and from the dashboard spending widget.
- iOS has no URL-based tab state today (`DeepLinkRouter` only handles Plaid + household invite).

---

## Target Experience

### Page shell

```txt
Insights                          [refresh via pull-down]

[ Spending | Income | Net Income ]   ← segmented tab control

[ This month | 1M | 2M | 3M | 6M | 12M ]   ← shared period control

<selected tab content scroll area>
```

Layout rules:

- Large navigation title: **Insights**
- Tab control sits directly below the navigation area, full width, segmented style.
- Period control sits below tabs. Prefer a horizontally scrollable segmented picker if six segments feel cramped on iPhone SE-width devices.
- Selected tab content is a `ScrollView` with the same spacing rhythm as today's Spending page (`MoatTheme.Spacing.large`, bottom padding ~112 for tab bar clearance).
- Keep `.finPageBackground()` on the scroll content and the same refresh overlay pattern used by Spending, Transactions, and Rules.

Default state:

```txt
tab = spending
period = 3m
```

Persist tab + period in `@AppStorage` so returning users keep their last selection:

```txt
insights.selectedTab
insights.selectedPeriod
```

### Visual parity with current Spending page

New Income and Net Income sections should reuse the same building blocks already visible on Spending:

- Hero summary values inside `MoatCard` with secondary label + bold large currency text
- Section headers as `.headline` text outside cards
- Row cards with `MoatTheme.ColorToken.surface`, `MoatTheme.Radius.medium`, capsule progress bars where applicable
- Accent color bars/charts via `MoatTheme.ColorToken.accent`
- Warning/destructive accents only where Spending already uses them (e.g., anomalies)
- Empty states: secondary `.subheadline` text inside a surface card (`emptyText` pattern from `spending-view.swift`)

Do **not** introduce a new charting framework for v1. Build bar comparisons with the same `RoundedRectangle` + `HStack(alignment: .bottom)` approach used in `SpendingTrendCard`.

---

## Spending tab

### Requirement

Move the existing Spending screen into the Insights shell without redesigning it.

Implementation approach:

1. Extract the scrollable content from `SpendingView` into `SpendingInsightsTabView`.
2. Keep private subviews (`SpendingSummaryCard`, `SpendingTrendCard`, category/recurring/anomaly sections) with the same visuals.
3. Replace the toolbar calendar menu period picker with the shared Insights period control owned by the parent `InsightsView`.
4. Pass `period: InsightsPeriod` into the spending view model and map to months via `insightsPeriodToMonths(period)` before calling `SpendingService`.

Behavior to preserve:

- Summary card metrics: total spend, monthly average, top category
- Monthly trend chart
- Categories list with `% of spend`, `/mo` suffix, progress bar, navigation to filtered transactions
- Recurring expenses list with transaction drill-down
- Anomalies list with warning styling and drill-down
- Loading, refreshing, error, pull-to-refresh

Non-goal for Spending tab v1:

- Do not change spending classification rules or endpoint shapes.
- Do not remove the 24-month option globally until product confirms parity with web; if needed, keep 24m out of the shared Insights period control and accept that Spending follows the shared 1–12 month Insights periods for this release.

---

## Income tab

Backed by `POST /api/v1/insights/getIncomeInsights`.

Sections (top to bottom):

### 1. Income summary cards

Inside one `MoatCard`, mirror the Spending summary layout:

```txt
Total Income          (large currency)
Primary Source        Recurring Income      One-Time Income
Payroll               $7,800                $1,140
```

Use `CurrencyFormatter.formatCompact` for amounts. Primary source name can truncate with `lineLimit(1)`.

### 2. Income Trend

Title: **Income Trend**

Native bar chart using the same bar pattern as Spending's monthly trend. Bucket labels come from API `incomeTrend[].date`.

Empty copy: `No income found for this period.`

### 3. Income Sources

Title: **Income Sources**

Horizontal bar rows (category-style rows from Spending):

```txt
Payroll       ████████████  $7,800
Stripe        ███           $640
```

Sort descending by amount. Show top 12 sources.

### 4. Recurring vs One-Time

Title: **Recurring vs One-Time**

Two side-by-side mini cards or a single `MoatCard` split into two columns:

```txt
Recurring Income     One-Time Income
$7,800               $1,140
```

Values come from API; detection logic stays server-side.

### 5. Recent Income

Title: **Recent Income**

Simple list rows:

```txt
Mar 28   Payroll deposit          +$3,900   Chase · Checking
Mar 15   Stripe payout            +$640     Mercury
```

Optional category subtitle when present. No navigation requirement for v1 unless easy to reuse `TransactionsView` with an income filter.

States:

- Loading: `LoadingView("Loading income...")` only on first load for this tab
- Error: `ErrorStateView` with retry
- Empty: section-level empty cards, not a blocking full-page empty state unless all sections are empty

---

## Net Income tab

Backed by `POST /api/v1/insights/getNetIncomeInsights`.

Sections (top to bottom):

### 1. Net Income summary cards

```txt
Net Income            (large currency, green if positive, destructive tone if negative)
Total Income          Total Spending        Savings Rate
$8,940                $6,530                27%
```

Savings rate displays as whole-number percent (`27%`) or em dash when null.

Negative net income copy follows existing currency formatting (leading minus, no extra prose required).

### 2. Income vs Spending

Title: **Income vs Spending**

Grouped bar chart per period bucket: two adjacent bars (income accent, spending muted) with a shared x-axis label. Keep the chart simple — no legend required if bar colors are consistent across the app.

### 3. Net Income Trend

Title: **Net Income Trend**

Single-series bar chart per bucket. Color positive bars with accent; negative bars with destructive token if it reads clearly in light and dark mode.

### 4. Savings Rate

Title: **Savings Rate**

Line-like or bar representation of `savingsRateTrend`. If rate is null for a bucket, skip the bar and show a gap.

### 5. Where Your Income Went

Title: **Where Your Income Went**

Category breakdown list using Spending-style rows:

```txt
Housing        $2,100
Food           $980
Transportation $640
…
```

Optional footer row showing net income total. Waterfall chart is out of scope for v1.

States match Income tab patterns.

---

## Data classification rules

Follow the same conservative rules documented in [insights.spec.md](./insights.spec.md):

- Spending excludes transfers, credit card payments, investment moves, and similar non-spend flows (existing spending endpoints already encode this).
- Income excludes internal transfers and account movement; includes payroll, interest, dividends, etc.
- Net income uses `income - spending` with the same exclusions on both sides.

Do not reimplement classification on iOS. Trust the Insights API for Income and Net Income tabs.

---

## Architecture

### New feature module

```txt
apps/ios/Moat/Features/Insights/
├── Models/
│   ├── insights-period.swift
│   ├── income-insights-models.swift
│   └── net-income-insights-models.swift
├── Services/
│   └── insights-service.swift
├── ViewModels/
│   ├── insights-view-model.swift
│   ├── income-insights-view-model.swift
│   └── net-income-insights-view-model.swift
└── Views/
    ├── insights-view.swift
    ├── insights-tab-picker.swift
    ├── insights-period-picker.swift
    ├── spending/
    │   └── spending-insights-tab-view.swift
    ├── income/
    │   ├── income-insights-tab-view.swift
    │   └── income-tab-sections.swift
    └── net-income/
        ├── net-income-insights-tab-view.swift
        └── net-income-tab-sections.swift
```

Adjust file names to match existing iOS kebab-case convention.

### Shared types

```swift
enum InsightsTab: String, CaseIterable, Identifiable {
    case spending
    case income
    case netIncome
}

enum InsightsPeriod: String, CaseIterable, Identifiable {
    case thisMonth = "this-month"
    case oneMonth = "1m"
    case twoMonths = "2m"
    case threeMonths = "3m"
    case sixMonths = "6m"
    case twelveMonths = "12m"
}

func insightsPeriodToMonths(_ period: InsightsPeriod) -> Int
```

Decode API `{ data: … }` envelopes the same way other iOS services unwrap typed responses.

Suggested Swift models mirror API types in `apps/api/src/lib/insights/types.ts`:

- `IncomeInsightsData`
- `NetIncomeInsightsData`

### View model responsibilities

`InsightsViewModel` (parent):

- Owns `selectedTab` and `selectedPeriod`
- Persists selections to `@AppStorage`
- Coordinates refresh: when user pull-refreshes, refresh the active tab's view model only

`SpendingInsightsViewModel`:

- Refactor from current `SpendingViewModel`
- Accept period from parent instead of owning a toolbar menu
- Keep existing spending service calls

`IncomeInsightsViewModel` / `NetIncomeInsightsViewModel`:

- Load on first visit to tab and when period changes
- Cache last loaded period to avoid redundant fetches when switching back to a tab unless stale from pull-to-refresh

`InsightsService`:

```swift
actor InsightsService {
    func getIncomeInsights(period: InsightsPeriod) async throws -> IncomeInsightsData
    func getNetIncomeInsights(period: InsightsPeriod) async throws -> NetIncomeInsightsData
}
```

Use `APIClient.post(path:body:)` with `{ "period": period.rawValue }`.

### Navigation updates

| Location | Change |
|----------|--------|
| `AppDestination` | Replace `.spending` with `.insights` (title **Insights**, keep icon `chart.bar.xaxis` or switch to `chart.bar.doc.horizontal` if design prefers) |
| `more-menu-view.swift` | Route `.insights` → `InsightsView()` |
| `DashboardView` | `spending-by-category` widget links to `.insights` |
| `remote-feature-model.swift` | Update debug/remote feature config if it still references Spending-only endpoints |

Compatibility:

- If any code still references `.spending`, migrate call sites in the same PR.
- Optional: keep a package-private typealias or deprecated `AppDestination` case that maps to `.insights` if needed for minimal churn — prefer a clean rename.

`SpendingView` after migration:

- Either delete and update previews/tests, or reduce to a thin wrapper around `InsightsView(initialTab: .spending)` for preview convenience only. Do not keep two user-facing Spending entry points.

---

## Implementation Plan

### Phase 1 — Insights shell + Spending tab migration

1. Add `InsightsPeriod`, `InsightsTab`, and period-to-months helper.
2. Create `InsightsView` with tab picker, period picker, navigation title, refresh plumbing.
3. Extract Spending content into `SpendingInsightsTabView` and wire period from parent.
4. Replace More menu destination and dashboard widget link.
5. Remove standalone Spending toolbar period menu.

**Acceptance criteria:**

- More → Insights opens Spending tab with 3M default period.
- Spending tab matches current visuals and drill-down behavior.
- Period changes refetch spending data.

### Phase 2 — Income tab

1. Add models + `InsightsService.getIncomeInsights`.
2. Build `IncomeInsightsViewModel` and tab sections using Spending visual patterns.
3. Hook tab into parent refresh + period changes.

**Acceptance criteria:**

- All five Income sections render with real API data, loading, empty, and error states.

### Phase 3 — Net Income tab

1. Add models + `InsightsService.getNetIncomeInsights`.
2. Build `NetIncomeInsightsViewModel` and tab sections.
3. Implement grouped/compare bar charts with native SwiftUI primitives.

**Acceptance criteria:**

- All five Net Income sections render with correct positive/negative formatting.

### Phase 4 — Polish + project wiring

1. Add new files to `Moat.xcodeproj`.
2. Update previews.
3. Verify demo mode works (`withDemoOrAuth` endpoints).
4. Manual QA on iPhone simulator: tab switching, period switching, pull-to-refresh, dark mode.

**Acceptance criteria:**

- No regressions in dashboard widget navigation.
- Typecheck/build succeeds in Xcode.

---

## Acceptance Criteria

- [ ] More menu shows **Insights** instead of **Spending**.
- [ ] Insights page has three tabs: **Spending**, **Income**, **Net Income**.
- [ ] Default tab is **Spending**; default period is **3M**.
- [ ] Shared period control offers: **This month**, **1M**, **2M**, **3M**, **6M**, **12M**.
- [ ] Changing period refetches data for the active tab.
- [ ] Switching tabs preserves the selected period.
- [ ] Spending tab preserves existing sections, styling, loading/error/refresh behavior, and transaction drill-downs.
- [ ] Income tab shows summary cards, income trend, income sources, recurring vs one-time, and recent income list.
- [ ] Net Income tab shows summary cards, income vs spending, net income trend, savings rate trend, and spending breakdown.
- [ ] Income and Net Income tabs call `/api/v1/insights/getIncomeInsights` and `/api/v1/insights/getNetIncomeInsights`.
- [ ] Dashboard spending widget opens Insights on the Spending tab.
- [ ] Tab + period selections persist across app launches via `@AppStorage`.
- [ ] Implementation follows iOS feature module conventions (Models / Services / ViewModels / Views, `APIClient`, `@MainActor` view models).
- [ ] No PII logged; use `AppLogger` on failures only.

---

## Non-Goals

- Promoting Insights to a root tab bar item (stays in More menu for v1).
- Universal Links / deep links to `/insights?tab=…` on iOS.
- Shared SwiftUI code in `packages/`.
- Waterfall chart for "Where Your Income Went".
- Rebuilding spending analytics logic on-device.
- Changing spending API endpoints or classification rules.
- PostHog analytics events (add later if iOS analytics conventions exist for page views).

---

## Open Questions

- **Default period alignment:** Web currently defaults to `this-month` (`packages/features/src/insights/period-utils.ts`) while the original Insights spec called for `3m`. Confirm whether iOS should default to `3m` or `this-month`.
- **24-month spending range:** Today's iOS Spending menu includes 24 months. The Insights period control does not. Confirm dropping 24M for parity, or keep a Spending-only escape hatch.
- **Recent income drill-down:** Should income rows navigate to `TransactionsView` with an income filter in v1, or stay read-only?
- **AppDestination icon:** Keep `chart.bar.xaxis` or adopt a distinct Insights symbol?
- **Income/Net Income lazy loading:** Load only when tab first selected (recommended) vs prefetch all three tabs on page open?

---

## Suggested Commit Message

```text
docs (ios): add insights page implementation spec
```
