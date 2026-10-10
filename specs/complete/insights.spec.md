# Task: Create new Insights page with Spending, Income, and Net Income tabs

## Goal

Create a new top-level **Insights** page that replaces the current standalone **Spending** page structure.

The Insights page should have three tabs:

1. **Spending**
2. **Income**
3. **Net Income**

The current Spending page should be carried over into the new **Spending** tab. Do not rebuild the Spending section from scratch. Reuse the existing Spending page implementation as much as possible and adapt it into the new tabbed Insights layout.

The new work is primarily to:

* Create the new Insights page/shell
* Move or wrap the current Spending page into the Spending tab
* Create the new Income tab
* Create the new Net Income tab
* Add shared time range controls for all tabs

---

## Naming

Use **Insights** as the page name, not Analysis or Charts.

The route should ideally be:

```txt
/insights
```

If the app currently has a `/spending` route, update navigation so users go to `/insights` instead. If needed, preserve `/spending` as a redirect to `/insights?tab=spending`.

---

## Page structure

Create an Insights page with this structure:

```txt
Insights

Tabs:
[Spending] [Income] [Net Income]

Time range:
[1M] [2M] [3M] [6M] [12M]

Selected tab content
```

The tab state should be URL-friendly if our app already uses query params for UI state.

Preferred URL behavior:

```txt
/insights?tab=spending&period=3m
/insights?tab=income&period=6m
/insights?tab=net-income&period=12m
```

If the app has an existing pattern for tabs/search params, follow that existing pattern.

Default state:

```txt
tab=spending
period=3m
```

---

## Shared time range control

Add a shared segmented control used by all three tabs:

```txt
1M | 2M | 3M | 6M | 12M
```

The selected period should affect the data shown in the active tab.

Define the range as the last N months from today unless the existing Spending page already has a better date-range abstraction. If the current Spending page already has date filtering, reuse that logic and extend it to Income and Net Income.

Create a reusable type if one does not already exist:

```ts
type InsightsPeriod = "1m" | "2m" | "3m" | "6m" | "12m";
type InsightsTab = "spending" | "income" | "net-income";
```

---

# Spending tab

## Important

For the Spending tab, use our **current Spending page** and carry it over into this new Insights format.

Do not redesign the Spending tab in this task unless small adjustments are necessary to make it fit inside the new Insights shell.

The goal is:

```txt
Existing Spending page functionality
→ now rendered inside
Insights > Spending tab
```

Preserve existing charts, cards, data fetching, loading states, empty states, and styling as much as possible.

Expected implementation:

* Extract the current Spending page content into a reusable component if needed.
* Example component name:

```tsx
<SpendingInsightsTab period={period} />
```

* The old Spending page route can either:

  * redirect to `/insights?tab=spending`, or
  * render the same component temporarily if redirects are not currently used.

---

# Income tab

Create a new **Income** tab focused on money coming in.

This tab should answer:

```txt
How much income came in?
Where did it come from?
Is it recurring or one-time?
Is income stable over time?
```

## Income tab sections

### 1. Income summary cards

At the top of the Income tab, add summary cards:

```txt
Total Income
Primary Source
Recurring Income
One-Time Income
```

Example:

```txt
Total Income: $8,940
Primary Source: Payroll
Recurring Income: $7,800
One-Time Income: $1,140
```

Use real data where available. If a metric cannot be reliably calculated yet, implement the UI with clean fallback/empty states.

### 2. Income Trend chart

Create an income-over-time chart.

Recommended behavior:

* For 1M: daily or weekly income
* For 2M/3M: weekly or monthly income
* For 6M/12M: monthly income

Use whichever granularity is already consistent with the existing Spending page chart logic.

Title:

```txt
Income Trend
```

Chart type:

```txt
Bar chart
```

Income is usually made of discrete deposits, so bars are better than a line chart.

### 3. Income Sources chart

Create a chart showing income grouped by source.

Title:

```txt
Income Sources
```

Preferred chart:

```txt
Horizontal bar chart
```

Example rows:

```txt
Payroll       $7,800
Stripe        $640
Interest      $220
Venmo         $180
Other         $100
```

Source grouping logic should use the best available transaction field, likely merchant/counterparty/name/category depending on our schema.

### 4. Recurring vs One-Time Income

Create a section that separates recurring income from one-time income.

Title:

```txt
Recurring vs One-Time
```

Preferred visual:

```txt
Two-card split or stacked bar
```

Example:

```txt
Recurring Income: $7,800
One-Time Income: $1,140
```

If we already have recurring transaction detection, use it. If not, implement a reasonable placeholder utility that can later be improved.

A simple first-pass recurring income detection could be:

* same merchant/source
* similar amount
* appears at least twice
* roughly monthly, twice-monthly, biweekly, or weekly cadence

Keep this logic isolated in a utility function so it can be improved later.

### 5. Income transactions list

Add a simple income transaction list below the charts.

Title:

```txt
Recent Income
```

Include:

```txt
Date
Source/name
Amount
Account
Category if available
```

This helps users trust the chart data.

---

# Net Income tab

Create a new **Net Income** tab focused on whether the user is getting ahead or falling behind.

This tab should answer:

```txt
How much money was left over?
Was income higher than spending?
Is the user improving or getting worse over time?
What is the savings rate?
```

## Important formula

Use:

```txt
Net Income = Income - Spending
```

Make sure internal transfers do not inflate income or spending.

Use existing app conventions for excluding transfers, credit card payments, and account movement. If we do not have a perfect classification system yet, follow the current Spending page’s exclusion rules for spending and create similarly conservative rules for income.

---

## Net Income tab sections

### 1. Net Income summary cards

At the top of the Net Income tab, add summary cards:

```txt
Net Income
Total Income
Total Spending
Savings Rate
```

Example:

```txt
Net Income: +$2,410
Total Income: $8,940
Total Spending: $6,530
Savings Rate: 27%
```

Savings rate formula:

```ts
savingsRate = income > 0 ? netIncome / income : null;
```

Display as a percentage.

Handle negative net income clearly.

Example:

```txt
-$420
```

or

```txt
Negative $420
```

Use the app’s existing money formatting conventions.

---

### 2. Income vs Spending chart

Create a grouped bar chart comparing income and spending over time.

Title:

```txt
Income vs Spending
```

For each time bucket, show:

```txt
Income
Spending
```

This should be the primary chart on the Net Income tab.

---

### 3. Net Income Trend chart

Create a chart showing net income by period.

Title:

```txt
Net Income Trend
```

Preferred chart:

```txt
Bar chart
```

Each bar should represent:

```txt
income - spending
```

Positive months should be visually distinct from negative months if our chart system supports that. If not, keep the chart simple and rely on labels/tooltips.

---

### 4. Savings Rate chart

Create a savings rate trend chart.

Title:

```txt
Savings Rate
```

Formula:

```ts
savingsRate = income > 0 ? netIncome / income : null;
```

Chart type:

```txt
Line chart or bar chart
```

For each time bucket, show savings rate percentage.

If income is zero for a period, show null/no data instead of dividing by zero.

---

### 5. Where Your Income Went

Create a breakdown showing how income was reduced by spending categories.

Title:

```txt
Where Your Income Went
```

Preferred first version:

```txt
Horizontal category bars
```

Future ideal version:

```txt
Waterfall chart
```

Do not block this task on building a complex waterfall chart if our chart library does not already support it.

First version should show:

```txt
Income
- Housing
- Food
- Transportation
- Shopping
- Subscriptions
- Other
= Net Income
```

This can be a simple breakdown card/list if needed.

---

# Data classification rules

Be careful with transaction classification.

## Spending should exclude

Use existing Spending page logic, but make sure it excludes things like:

```txt
Credit card payments
Transfers between user accounts
Investment buys/transfers
Savings transfers
Loan transfers where appropriate
```

## Income should exclude

Income should not include internal account movement.

Exclude:

```txt
Transfers from savings
Transfers between user accounts
Credit card payments/refunds unless intentionally classified as income
Investment transfers
Balance adjustments
```

Income should include true inflows like:

```txt
Payroll
Contractor payments
Business income
Interest
Dividends if our product treats them as income
Cashback/rewards if categorized as income
Refunds only if our existing categorization treats them that way
```

If classification confidence is unclear, keep the logic conservative and document assumptions in code comments.

---

# Component architecture

Prefer clean reusable components.

Suggested structure:

```txt
app/insights/page.tsx
components/insights/InsightsPage.tsx
components/insights/InsightsTabs.tsx
components/insights/InsightsPeriodSelector.tsx
components/insights/spending/SpendingInsightsTab.tsx
components/insights/income/IncomeInsightsTab.tsx
components/insights/net-income/NetIncomeInsightsTab.tsx
```

Adjust paths to match the existing project structure.

Suggested utility/data files:

```txt
lib/insights/dateRanges.ts
lib/insights/transactionFilters.ts
lib/insights/income.ts
lib/insights/netIncome.ts
lib/insights/chartBuckets.ts
```

Use existing utilities where possible. Do not duplicate money formatting, date formatting, chart wrappers, loading skeletons, or empty-state components.

---

# Data fetching

Use the project’s existing data fetching conventions.

If the existing Spending page uses server components, tRPC, React Query, server actions, or API routes, follow the same pattern.

Create data queries/functions for:

```txt
getIncomeInsights(period)
getNetIncomeInsights(period)
```

or equivalent.

Return data in chart-friendly shapes.

Example income response shape:

```ts
type IncomeInsightsData = {
  totalIncome: number;
  primarySource: {
    name: string;
    amount: number;
  } | null;
  recurringIncome: number;
  oneTimeIncome: number;
  incomeTrend: Array<{
    date: string;
    amount: number;
  }>;
  incomeSources: Array<{
    source: string;
    amount: number;
  }>;
  recentIncomeTransactions: Array<{
    id: string;
    date: string;
    name: string;
    amount: number;
    accountName?: string;
    category?: string;
  }>;
};
```

Example net income response shape:

```ts
type NetIncomeInsightsData = {
  totalIncome: number;
  totalSpending: number;
  netIncome: number;
  savingsRate: number | null;
  incomeVsSpending: Array<{
    date: string;
    income: number;
    spending: number;
  }>;
  netIncomeTrend: Array<{
    date: string;
    netIncome: number;
  }>;
  savingsRateTrend: Array<{
    date: string;
    savingsRate: number | null;
  }>;
  spendingBreakdown: Array<{
    category: string;
    amount: number;
  }>;
};
```

Adapt these to our actual schema and API style.

---

# UI/UX expectations

The page should feel polished and useful, not like a raw chart dump.

Use clear human-readable titles:

```txt
Income Trend
Income Sources
Recurring vs One-Time
Recent Income
Income vs Spending
Net Income Trend
Savings Rate
Where Your Income Went
```

Use existing card, chart, tabs, skeleton, and empty-state styles.

Each tab should have:

```txt
Loading state
Empty state
Error state if the app pattern supports it
```

Empty state examples:

```txt
No income found for this period.
No net income data available for this period.
Connect more accounts to see richer insights.
```

---

# Navigation

Update the app navigation/sidebar so the item is:

```txt
Insights
```

If there is currently a nav item called:

```txt
Spending
```

replace it with:

```txt
Insights
```

Clicking it should open:

```txt
/insights?tab=spending
```

---

# Acceptance criteria

The task is complete when:

1. There is a new top-level **Insights** page.
2. The page has three tabs: **Spending**, **Income**, and **Net Income**.
3. The current Spending page content appears inside the **Spending** tab.
4. The Spending tab preserves the existing Spending page functionality as much as possible.
5. The Income tab exists and shows:

   * income summary cards
   * income trend chart
   * income sources chart
   * recurring vs one-time income section
   * recent income list
6. The Net Income tab exists and shows:

   * net income summary cards
   * income vs spending chart
   * net income trend chart
   * savings rate chart
   * where your income went breakdown
7. All tabs support the shared period selector:

   * 1M
   * 2M
   * 3M
   * 6M
   * 12M
8. The default tab is Spending.
9. The default period is 3M.
10. Navigation is updated from Spending to Insights.
11. Internal transfers are not counted as real income or real spending.
12. The implementation follows existing project patterns for routing, data fetching, styling, charts, and formatting.
13. TypeScript types are clean and there are no avoidable `any` types.
14. Loading and empty states are handled gracefully.

---

# Implementation priority

Do this in order:

1. Create the Insights route/page shell.
2. Add tabs and shared period selector.
3. Move/wrap the existing Spending page into the Spending tab.
4. Add Income tab data utilities and UI.
5. Add Net Income tab data utilities and UI.
6. Update navigation.
7. Add redirects or compatibility behavior for the old Spending route.
8. Clean up types, loading states, and empty states.

Focus on a high-quality v1. Avoid overengineering, but structure the code so future charts like forecasting, anomaly detection, and waterfall charts can be added easily.
