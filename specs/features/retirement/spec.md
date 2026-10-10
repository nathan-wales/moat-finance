# Retirement — Live Financial Twin with a Stackable What-If Engine

## Status

Draft. Created August 24, 2026 after reviewing the existing forecasting surface (`apps/api/src/lib/forecasting.ts`, `packages/domain/src/forecasts/`, `packages/domain/src/dashboard/getBalanceSnapshotHistory.ts`), the two things already called "scenario" in this repo (`ForecastScenario` in `apps/api/prisma/schema.prisma` and `WhatIfScenario` in `packages/features/src/what-if/calculator.ts`), the shared-package boundary established by [complete/shared-onboarding/spec.md](../../complete/shared-onboarding/spec.md), the insurance data model in `packages/contracts/src/financial-profile-data.ts`, the MCP tool contract pattern in `packages/mcp-contracts/src/tools.ts`, and the iOS module conventions in [apps/ios/AGENTS.md](../../../apps/ios/AGENTS.md).

---

## Goal

Build a single `/retirement` page whose core interaction model is **branching your real financial life**, not filling out a retirement questionnaire. Moat already knows the user's accounts, transactions, investments, real estate, liabilities, insurance policies, and budgets, so the baseline retirement plan builds itself. On top of that live baseline, the user stacks typed hypothetical changes ("retire at 57", "max both Roth IRAs", "sell the house at 70") and every projection, chart, table and number on the page re-renders against the stack.

The architectural commitment that everything else follows from:

> A scenario is **not** a copy of the user's financial plan. A scenario is `baseline + an ordered list of typed levers`. The baseline keeps tracking reality — when a Robinhood balance moves from $180k to $220k, or the mortgage amortizes, or trailing spending shifts, every saved scenario silently re-derives from the new truth.

Success means:

- A user who has connected accounts and never opened Retirement sees a complete, believable, deterministic baseline plan on first load with **zero required input** — retirement age, earliest sustainable retirement age, safe retirement spending, projected assets at retirement, and legacy at longevity age.
- A user can stack at least four independent levers into one scenario and see a baseline-vs-scenario delta table plus an overlaid projection chart in under one second of perceived latency.
- Saved scenarios re-derive from live data: re-opening a scenario saved 60 days ago reflects today's balances and today's trailing spending without any user action, and the page can prove it (`Baseline refreshed <relative time>`).
- Web and desktop render the **same** React tree from `@moat/features/retirement`; the only per-platform code is the data transport (`httpApiClient` vs `ipcApiClient`), navigation adapter, and slot injection.
- An AI agent can create, project, compare and deep-link a retirement scenario through MCP without Moat's numbers ever being computed by the model.

---

## Product Context

[specs/mission.md](../../mission.md) positions Moat as "the financial data layer and operating system for personal AI agents… deep, long-term financial context to model scenarios, surface insights, automate workflows." Retirement is the highest-stakes expression of that thesis: it is the one financial question where a complete, continuously updated graph beats a spreadsheet by an order of magnitude.

Traditional retirement tools (Boldin, NewRetirement, Empower) all suffer the same failure mode: the user spends 30–60 minutes hand-entering a plan, the plan immediately goes stale, and the "What If" feature is one tab buried three levels deep. Because Moat already has the underlying graph, we can invert both of those:

| Their model | Moat's model |
|-------------|--------------|
| Enter a plan, then maintain it | Plan is derived; it maintains itself |
| What-If is a feature inside the plan | What-If **is** the page |
| Scenario = a forked copy of your plan | Scenario = your real life + typed deltas |
| Insurance is an afterthought | Insurance policies are first-class projection inputs |
| Retirement spending is a number you guess | Retirement spending is derived from trailing actual spending, then adjusted |
| "Your success probability is 73%" | "Your essential spending stays fully funded; cutting flexible spending ~$730/mo for two years restores target confidence" |

The user's job-to-be-done is not "produce a retirement plan." It is **"let me interrogate my own future."** Could I retire at 55? What if my wife stops working? What if the market returns 5%? What combination gets me out five years sooner? The page has to answer those in the same number of clicks it takes to ask them.

This spec is also the forcing function for a capability the roadmap already wants. [specs/roadmap.md](../../roadmap.md) lists the Goals feature with "forecast integration" and MCP gateway expansion. The retirement engine built here is the long-horizon projection substrate both of those depend on.

### The four capabilities, in order

```text
Baseline  →  Explore  →  Compare  →  Improve
```

Everything in this spec lives underneath one of those four words.

---

## Current Repo Context

### The naming collision (read this first)

Three things in this repo are already called some variant of "scenario." A new implementer will get this wrong unless it is stated explicitly.

| Existing name | Where | What it actually is | Does Retirement reuse it? |
|---------------|-------|---------------------|---------------------------|
| `ForecastScenario` | `apps/api/prisma/schema.prisma`, `packages/data-access/src/types.ts`, `/scenarios` page | A named bundle of **macro rate assumptions** (`investmentReturn`, `inflationRate`, `salaryGrowth`, `contributionChange`, `expenseGrowth`) with one row marked `isActive` | **Yes — as an input.** The user's active `ForecastScenario` supplies default return/inflation/growth rates to the retirement baseline. It is not the retirement scenario. |
| `WhatIfScenario` | `packages/features/src/what-if/calculator.ts` | A **single-month cash-flow** sandbox: take a 1/2/3/6/12-month average of income and expenses, add/remove/edit monthly line items, see the new monthly net | **No.** Different time horizon, different mental model. `/what-if` stays exactly as it is. See Non-Goals. |
| `RetirementScenario` (new) | This spec | Baseline + ordered list of typed `RetirementLever` rows, projected over the full lifetime | This is the new entity. |

**Rule for implementers:** never widen `ForecastScenario` to carry retirement levers, and never merge the monthly `/what-if` calculator into the retirement page. They are three distinct concepts that happen to share a word.

### What exists today

| Area | File | Role | Retirement's relationship |
|------|------|------|---------------------------|
| Macro projection math | `apps/api/src/lib/forecasting.ts` | `SCENARIO_PRESETS`, `forecastNetGains()`, `buildNetWorthSeries()`, `forecastInvestmentGrowth()`, `projectNetWorth()` | Too shallow for retirement (no withdrawals, taxes, mortality, account-type awareness). Retirement gets a new engine; these stay for the overview widgets. |
| Duplicate macro math | `apps/web/src/lib/forecasting.ts`, `packages/charts/src/utils.ts` | Same surface, duplicated client-side | Do not extend. New engine lives in `@moat/domain` only. |
| Investment compounding | `packages/domain/src/forecasts/project-growth.ts` | `forecastInvestmentGrowth()`, `projectRealEstateEquity()` | **Reuse** for the accumulation-phase account growth step. |
| Real estate projection | `packages/domain/src/forecasts/real-estate-projection.ts` | `calculateRealEstateProjection()`, `calcMonthlyPayment()`, `SCENARIO_ASSUMPTIONS` | **Reuse** for property equity, mortgage amortization, rental cash flow, and every Housing lever. |
| Net worth history + forecast | `packages/domain/src/dashboard/getBalanceSnapshotHistory.ts`, `apps/api/src/server/handlers/balance-snapshot.ts` | Historical `BalanceSnapshot` rollup + forward projection | **Reuse** historical half as the anchor point (`startingNetWorth`) and for Plan Confidence history-depth signals. |
| Trailing cash flow | `packages/domain/src/dashboard/getSummaryMetrics.ts` | `{ avgIncome, avgExpenses, avgNetGain, monthCount }` | **Reuse** as the accumulation-phase savings rate input. |
| Spending baseline classifier | `apps/api/src/server/handlers/budget.ts` → `budget.getWhatIfBaseline` | Averages N months of transactions into `WhatIfMonthlyLineItem[]`, keyword-classifies `401k` / `ira` / `retirement` / `mortgage` into savings vs debt vs expense | **Reuse the pattern, not the function.** Retirement needs category-level, not line-item-level, and needs a `treatment` axis. See the Spending tab. |
| Rate assumptions | `ForecastScenario` model + `apps/api/src/server/handlers/scenario.ts` | CRUD + `setActive` + `seedDefaults`, all `withDemoOrAuth` | **Reuse** — active row seeds baseline rates. |
| Per-user planning assumptions | `packages/contracts/src/financial-profile-data.ts` → `ForecastAssumptions` | `{ inflationRate, incomeGrowthRate, expenseGrowthRate, investmentReturnRate, realEstateAppreciationRate, defaultCashYield, retirementAge?, forecastStyle, lastUpdated }` | **Reuse and extend.** `retirementAge` already lives here. Retirement-only fields (longevity age, SS claim age, spouse) go in the new `RetirementPlan` model, not this JSON blob. |
| Onboarding age capture | `UserSettings.currentAge`, `UserSettings.retirementAge`, `onboardingGoals` (includes `"retirement"`) | Captured in `packages/features/src/onboarding/profile-inputs.tsx` | **Reuse** as the seed for `RetirementPlan.primaryCurrentAge` / `targetRetirementAge`. |
| Accounts & holdings | `Investment` (with `InvestmentType` = `STOCKS \| REAL_ESTATE \| ROTH_IRA \| FOUR01K \| HSA \| OTHER`), `PlaidAccount` (`monthlyContribution`, `annualReturnRate`, `forecastInputsUserEdited`) | Manual + synced balances and contribution rates | **Reuse.** `InvestmentType` is the seed for tax-treatment bucketing. Note it is missing `TRADITIONAL_IRA`, `FOUR03B`, `TAXABLE`, `FIVE29` — see Open Questions. |
| Real estate | `RealEstateInvestment` (purchase price, loan balance, rate, term, rent, expenses, `forecastScenario`) | Full property model | **Reuse.** Every Housing lever mutates a projection of these rows. |
| Insurance | `InsurancePolicyV2` in `packages/contracts/src/financial-profile-data.ts` — `coverages[]`, `parties[]`, typed `details`, includes `longTermCare`, `life`, `disability` | Rich policy model already shipped ([complete/insurance-profile/spec.md](../../complete/insurance-profile/spec.md), [complete/insurance-overhaul/](../../complete/insurance-overhaul/)) | **Reuse.** This is Moat's differentiator — LTC and death levers must consume real coverage limits and elimination periods, not generic assumptions. |
| Tax profile | `TaxProfile` in `packages/contracts/src/financial-profile-data.ts` — `filingStatus`, `estimatedFederalTaxBracket`, `estimatedStateTaxRate`, `deductionStrategy` | Per-user tax context | **Reuse** as the tax engine's starting parameters. |
| Categories & budgets | `Category`, `CategoryBudget.monthlyGoal` | Category taxonomy + monthly targets | **Reuse.** Essential/flexible classification and retirement spending treatment attach per `categoryId`. |
| Shared feature shell | `packages/features/src/api-client-context.tsx`, `navigation-context.tsx`, `forecast-context.tsx` | `useApiClient()`, `useMoatNavigation()`, `useForecast()` | **Reuse** — this is how the shared page gets data and routing on both web and desktop. |
| Chart primitives | `packages/charts/src/` — `NetWorthChart`, `InvestmentGrowthChart`, `CashFlowSankey`, `chart-click.ts`, `chart-theme.ts` | Recharts wrappers | **Reuse** `chart-click` helpers and `chart-theme`; add new retirement charts to `@moat/charts`. |
| Design system | `@moat/ui` — `Tabs`, `Card`, `Dialog`, `Select`, `Button`, `NumericInput`, `Progress`, `Table`, `SidePanel`, `EmptyState`, `SectionTableOfContents`, `InlineRule*` | Shared primitives | **Reuse.** `InlineRuleSentence` / `InlineRuleDropdown` / `InlineRuleSuggestInput` are the basis for the custom lever builder. |
| MCP surface | `packages/mcp-contracts/src/{tools,schemas,scopes}.ts`, `apps/mcp/src/tools/forecast.ts`, `apps/desktop/src/main/agent-gateway/tools/registry.ts` | `moat.getForecast`, `moat.explainForecast` under `mcp:forecast:read` | **Extend** with a `mcp:retirement:*` scope family mirrored in both cloud and desktop registries. |
| Dead widget entries | `apps/web/src/lib/widgets/widget-registry.ts` | `"retirement-projection"`, `"goal-progress"`, `"scenario-comparison"` registered but not rendered by `widget-renderer.tsx` | Implement `"retirement-projection"` as a dashboard entry point into this page. |

### What does not exist today

Monte Carlo, Social Security modeling, RMD schedules, safe-withdrawal solving, longevity/mortality assumptions, withdrawal sequencing, per-account tax treatment, lifetime tax projection, goal seeking, stress testing, and a `Goal` entity are **all absent from the codebase**. `packages/ai-prompts/src/prompts/investing.ts` mentions the 4% rule in prompt copy only. This spec introduces all of them.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `calculateRealEstateProjection()` | `packages/domain/src/forecasts/real-estate-projection.ts` | Amortization + appreciation + rent growth + vacancy; drives all Housing levers |
| `forecastInvestmentGrowth()` | `packages/domain/src/forecasts/project-growth.ts` | Monthly compounding for accumulation phase |
| `getSummaryMetrics()` | `packages/domain/src/dashboard/getSummaryMetrics.ts` | Trailing income/expense/net-gain averages |
| `getBalanceSnapshotHistory()` | `packages/domain/src/dashboard/getBalanceSnapshotHistory.ts` | Anchors starting net worth; history depth feeds Plan Confidence |
| `getForecast(ctx, { activeOnly })` | `packages/domain/src/forecasts/getForecast.ts` | Loads the active `ForecastScenario` rate bundle |
| `withAuth` / `withDemoOrAuth` | `apps/api/src/server/handler-wrappers.ts` | Guarantees non-null `ctx.userId`; reads use `withDemoOrAuth`, writes use `withAuth` |
| `createApiAppContext(userId, db)` | used throughout `apps/api/src/server/handlers/budget.ts` | Bridges API handlers into `@moat/domain` |
| `createSqliteAppContext(db, userId)` | `packages/db-sqlite/src/createSqliteAppContext.ts` | Same bridge for desktop main process |
| `useApiClient()` / `useMoatNavigation()` | `packages/features/src/api-client-context.tsx`, `navigation-context.tsx` | Platform-agnostic data + routing inside shared UI |
| `InlineRuleSentence`, `InlineRuleDropdown`, `InlineRuleSuggestInput` | `@moat/ui` | Sentence-style builder, already used by the rule builder ([features/inline-rule-sentence-builder/](../inline-rule-sentence-builder/)) |
| `useChartActiveIndex`, `resolveChartDataKey` | `packages/charts/src/chart-click.ts` | Click-a-year interaction on the timeline |
| `FinancialChartContainer`, `FinancialLineChart` | `apps/ios/Moat/Core/DesignSystem/FinancialCharts/` | iOS chart shells |
| `MoatGlassSheet`, `.moatKeyboardDismissToolbar()` | `apps/ios/Moat/Core/DesignSystem/{Sheets,Components}/` | iOS lever editors and numeric inputs |
| `normalizeInsurancePolicy()`, `InsurancePolicyV2` | `packages/contracts/src/financial-profile-data.ts` | Legacy→V2 normalization before feeding the insurance levers |

---

## Target Experience

### Page shape

One route. One page. Seven tabs. The scenario control is **page-level chrome above the tabs**, because every tab renders against the active scenario — switching tabs must never lose the user's lever stack.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Retirement                                                                  │
│  See where you're headed. Change anything.                                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Exploring:  [ Baseline ▾ ]   Retire at 57 ×   Max Roth IRAs ×          │  │
│  │             Sell home at 70 ×   + Add a change                          │  │
│  │                                          [ Reset ]  [ Save scenario ]   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  You're on track to retire at 60                                             │
│                                                                              │
│   89%          Age 57         $9,240/mo        $3.84M         $2.17M         │
│   Confidence   Earliest       Safe spending    At retirement  Legacy at 95   │
│                                                                              │
│  [ Plan ] [ What If ] [ Scenarios ] [ Spending ] [ Income & Taxes ]           │
│  [ Risk ] [ Improve ]                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

When one or more levers are active, the metric strip shows both numbers with the delta:

```text
   93%  ▲4       Age 55  ▲2      $8,810/mo ▼430    $4.12M ▲280k   $2.34M ▲170k
   Confidence    Earliest        Safe spending     At retirement  Legacy at 95
   was 89%       was 57          was $9,240        was $3.84M     was $2.17M
```

**Tabs** (`Tabs` from `@moat/ui`, horizontally scrollable below `md`):

| Tab | Answers | Key sections |
|-----|---------|--------------|
| **Plan** | "Where am I headed?" | Headline verdict, lifetime timeline with lens switcher, milestone rail, year inspector, plan confidence summary |
| **What If** | "What if I changed something?" | Suggested levers, active lever stack, impact delta table, overlay chart, custom lever builder |
| **Scenarios** | "Which future do I want?" | Saved scenarios, 3-way + baseline comparison table, multi-line overlay chart |
| **Spending** | "What will I actually spend?" | Trailing-actual → retirement lifestyle translation, essential vs flexible, spending stages |
| **Income & Taxes** | "Where does the money come from?" | Retirement paycheck by year, income source chart, lifetime tax timeline, conversion window |
| **Risk** | "What could break this?" | Monte Carlo cone + plain-language readout, stress test grid, biggest vulnerability, plan confidence detail |
| **Improve** | "What should I do?" | Improve My Plan opportunity list, Goal Seek, Explore with your AI |

### 1. Plan tab

**Headline verdict.** Deterministic sentence, no LLM, one of exactly four shapes:

| Condition | Copy |
|-----------|------|
| `earliestSustainableAge <= targetAge` and `confidence >= 80` | `You're on track to retire at {targetAge}.` |
| `earliestSustainableAge <= targetAge` and `confidence < 80` | `You can likely retire at {targetAge}, but the plan is sensitive to market conditions.` |
| `earliestSustainableAge > targetAge` | `You're currently projected to fall about ${gap}/month short of your desired retirement lifestyle at age {targetAge}.` |
| Insufficient data (`monthCount < 3` or no investment accounts) | `We need a bit more history to project your retirement. Connect your investment accounts to get started.` |

Supporting line, always shown:

```text
Based on your current savings, investments, spending, debts and expected income.
Baseline refreshed 4 minutes ago · Plan confidence 82%
```

**Metric definitions** — these must be documented in code because users will ask:

| Metric | Definition |
|--------|------------|
| Retirement target | `RetirementPlan.targetRetirementAge` + the calendar month it lands on |
| Earliest sustainable retirement | Lowest integer age at which the deterministic projection funds `expectedRetirementSpending` through `longevityAge` without liquid assets going negative |
| Retirement readiness / confidence | Share of Monte Carlo trials that fund the complete plan through `longevityAge` |
| Safe retirement spending | Highest flat real monthly spend fundable at ≥ `confidenceTarget` (default 85%) from `targetRetirementAge` through `longevityAge` |
| Expected retirement spending | Output of the Spending tab translation (trailing actual, adjusted) |
| Projected assets at retirement | Total liquid + tax-advantaged balances at `targetRetirementAge` (nominal) |
| Projected legacy | Net worth at `longevityAge`, including illiquid real estate equity |

**The timeline** is the dominant visualization on the page — full width, ~420px tall on desktop.

```text
TODAY                                                                     AGE 95
  │                                                                          │
  ▼                                                                          ▼
$6M ┤                                                        ╭────────────────
    │                                                   ╭────╯
$4M ┤                                          ╭────────╯
    │                                    ╭─────╯
$2M ┤                      ╭─────────────╯
    │            ╭─────────╯
$0  ┼────────────┴─────────────────────────────────────────────────────────────
    35    45     55    60    65    70    73    80    85    90    95
                        │     │     │     │
                        │     │     │     └ RMDs begin
                        │     │     └ Medicare
                        │     └ Social Security
                        └ RETIRE
     Mortgage paid ──────────●
     Child college ──●
     Home sale ──────────────────────●
```

Lens switcher above the chart (a segmented `Tabs` control), each lens re-keying the same year-indexed ledger:

| Lens | Series |
|------|--------|
| Net worth | Total net worth including real estate equity |
| Investments | Liquid + tax-advantaged balances only |
| Income vs expenses | Two series: all income sources vs all outflows |
| Retirement paycheck | Stacked area by income source, post-retirement years only |
| Taxes | Annual tax paid, with marginal rate as a secondary axis |
| Withdrawals | Stacked withdrawals by account tax treatment |

**Milestone rail** below the axis, derived — never hand-entered:

| Milestone | Source |
|-----------|--------|
| Retirement | `targetRetirementAge` |
| Social Security | `RetirementPlan.socialSecurityClaimAge` (and spouse's, if present) |
| Medicare | Age 65 |
| RMDs begin | Current statutory RMD age (`RMD_START_AGE` constant, versioned) |
| Mortgage paid off | Amortization end from `RealEstateInvestment.remainingTermMonths` |
| Home sale | Only if a `sell_primary_home` / `downsize_home` lever is active |
| College funding | Only if a `fund_college` lever is active |
| Policy expiry | `InsurancePolicyV2.effectiveEndDate` for term life / LTC |

**Year inspector.** Clicking any year opens a `SidePanel` (from `@moat/ui`) with that year's full ledger: age(s), income by source, withdrawals by account, taxes, marginal rate, spending, ending balances by tax treatment, and any milestone landing that year. Uses `useChartActiveIndex` from `packages/charts/src/chart-click.ts`.

**States:**

| State | Condition | UI |
|-------|-----------|-----|
| Loading | First projection in flight | Skeleton metric strip + chart skeleton (`Skeleton` from `@moat/ui`); never a spinner over an existing chart |
| Recomputing | Lever added/removed with a prior projection cached | Keep the old chart visible at 60% opacity with a thin top progress bar; do not unmount |
| Populated | Projection returned | Full render |
| Insufficient data | `<3` months of transactions or no investment/retirement accounts | `EmptyState` with headline `We need a bit more to project your retirement`, listing exactly which inputs are missing, each with a deep link (Connect accounts → `/accounts`, Add retirement age → Plan settings) |
| Error | Projection failed | `EmptyState` variant: `We couldn't build your retirement projection.` + `Try again`. Log at `error` with `{ userId, feature: "retirement", operation: "projectScenario" }` |

### 2. What If tab

Header copy:

```text
What if?
Explore how different decisions could change your retirement.
```

**Suggested levers** — six cards, generated from the user's own finances by `suggestLevers()`. Suggestions are ranked by projected absolute impact on confidence, and each card must state a concrete number pulled from real data. Generic suggestions only fill remaining slots when personalized ones run out.

```text
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ Retire 3 years earlier        │  │ Max both Roth IRAs            │
│                               │  │                               │
│ Age 60 → 57                   │  │ +$9,400/year of contributions │
│                               │  │ You're currently at $4,100    │
│ Try it                     +  │  │ Try it                     +  │
└───────────────────────────────┘  └───────────────────────────────┘
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ Pay off your mortgage early   │  │ Spend $1,000 more a month     │
│                               │  │ in retirement                 │
│ Current payoff: March 2054    │  │                               │
│ Try it                     +  │  │ Try it                     +  │
└───────────────────────────────┘  └───────────────────────────────┘
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ Delay Social Security         │  │ Market returns 1% lower       │
│ 67 → 70                       │  │ than expected                 │
│                               │  │ 7.0% → 6.0%                   │
│ Try it                     +  │  │ Try it                     +  │
└───────────────────────────────┘  └───────────────────────────────┘
```

Suggestion rules (all deterministic, all suppressed when not applicable):

| Suggestion | Emitted when | Prefilled from |
|------------|--------------|----------------|
| Retire N years earlier | `earliestSustainableAge < targetRetirementAge` | The actual gap, capped at 5 years |
| Max Roth IRA(s) | Detected Roth contributions < annual limit | Current contribution rate from `Investment.monthlyContribution` / detected transactions |
| Max 401(k) | Detected 401(k) contributions < annual limit | Same |
| Capture full employer match | `PlaidAccount` 401(k) exists and no match modeled | Match unknown → default 50% up to 6%, flagged as an assumption |
| Pay off mortgage early | An active `RealEstateInvestment` with `currentLoanBalance > 0` | Real payoff date from amortization |
| Delay Social Security | `socialSecurityClaimAge < 70` | Current claim age |
| Returns 1% lower | Always (stress framing) | Active `ForecastScenario.investmentReturn` |
| Spend $1k more per month | Always | Expected retirement spending |
| Downsize at 70 | Primary residence with equity > $200k | Current estimated value and equity |
| Spouse retires later | `RetirementPlan.hasSpouse` and spouse still working | Spouse retirement age |

**The lever stack** is the heart of the interaction. Levers stack, reorder, and toggle without being destroyed.

```text
Exploring: Retire Early                                    [unsaved changes]

  Baseline
  ├─ + Retire at 57 instead of 60                                 ⋮  ×
  ├─ + Max Roth IRA contributions ($9,400/yr)                     ⋮  ×
  ├─ + Sell primary home at age 70                                ⋮  ×
  └─ + Increase retirement travel by $12,000/yr from 60 to 75     ⋮  ×

                                                     + Add another change
```

Behavior:

- **Order matters and is preserved.** Levers apply in `sortOrder`; two levers touching the same variable resolve last-write-wins with a conflict badge (see below).
- Each row's `⋮` menu offers `Edit`, `Duplicate`, `Disable` (keeps the row, removes the effect), `Move up`, `Move down`, `Remove`.
- **Conflict detection**: if two enabled levers target the same field (e.g. `retire_earlier` and `retire_at_age`), the later one wins and both rows show `Overridden by "…"` / `Overrides "…"` badges. Never silently drop a lever.
- Adding, removing, reordering, or toggling a lever triggers exactly one debounced (200ms) projection request.
- The stack persists in the URL as `?scenario=<id>` for saved scenarios or `?levers=<compact-encoding>` for unsaved exploration, so a user can share or reload without losing work. Read/write via `useMoatNavigation().getSearchParam` / `setSearchParam` — never `next/navigation` directly.

**Impact delta table** — always visible below the stack. This is non-negotiable: never make the user infer improvement from a chart.

```text
                              BASELINE       WHAT IF        CHANGE
Retirement age                    60             59          −1 yr
Retirement confidence            89%            93%          +4 pts
Safe monthly spending         $9,240         $9,610          +$370
Assets at retirement           $3.84M         $4.12M         +$280k
Legacy at age 95               $2.17M         $2.51M         +$340k
Lifetime taxes                 $1.08M         $1.14M          +$61k
```

Followed by a deterministic explanation. Template-driven, selected by the dominant lever category; no LLM in the render path.

```text
This improves your retirement outlook.

The biggest driver is roughly $9,400 a year of additional tax-advantaged
contributions compounding for 23 years before you retire. Lifetime taxes rise
because more of your withdrawals land in higher-income years after 73.
```

Explanation templates live in `packages/features/src/retirement/retirement-copy.ts` and are pure functions of the projection delta.

**Custom lever builder.** Sentence-style, built on `InlineRuleSentence` / `InlineRuleDropdown` / `InlineRuleSuggestInput` from `@moat/ui` — the same UI language as the rule builder, per the "prefer existing patterns" rule.

```text
What if I  [ receive income ▾ ]  of  [ $50,000 ]
[ every year ▾ ]  from age  [ 55 ]  until age  [ 60 ]  ?

What if we  [ spend ▾ ]  [ $100,000 ]
[ one time ▾ ]  at age  [ 65 ]  ?

What if  [ my spouse stops working ▾ ]  at age  [ 52 ]  ?
```

Every custom sentence compiles to one of the three custom lever types (`custom_income`, `custom_expense`, `custom_one_time`) — the same typed shapes the projection engine consumes for library levers. There is no second code path.

### 3. Scenarios tab

Saved scenarios are first-class entities, not plan copies.

```text
My retirement plans

┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ Baseline             │ │ Retire Early         │ │ Comfortable          │
│                      │ │                      │ │                      │
│ Retire at 60         │ │ Age 55               │ │ Age 60               │
│                      │ │ Smaller house at 60  │ │ Travel $20k/year     │
│ 89% confidence       │ │ Max retirement accts │ │ Delay Social Security│
│                      │ │ Spend $7,500/mo      │ │ Spend $10,000/mo     │
│                      │ │                      │ │                      │
│                      │ │ 82% confidence       │ │ 91% confidence       │
│ [ Open ]             │ │ [ Open ]      ⋮      │ │ [ Open ]      ⋮      │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘

                                          [ Compare ]  [ + New scenario ]
```

`⋮` → `Rename`, `Duplicate`, `Set color`, `Pin to comparison`, `Delete` (via `ConfirmDestructiveDialog` from `@moat/ui`).

**Comparison view** — baseline plus up to three scenarios (a hard cap, for chart legibility):

```text
                        Baseline    Retire Early    Comfortable    Work Optional
Retirement age              60             55            60              52
Confidence                 89%            82%           91%             74%
Expected spending        $8,400         $7,500       $10,000          $8,900
Safe spending            $9,240         $7,800       $10,300          $7,100
Assets at retirement     $3.84M         $2.91M        $4.01M          $2.34M
Legacy at 95             $2.17M         $1.41M        $1.88M          $0.62M
Lifetime taxes           $1.08M         $0.87M        $1.31M          $0.79M
Worst 10% outcome        $0.41M         $0.00M        $0.55M          $0.00M
```

Best value per row is bolded. Any scenario whose worst-decile outcome is `$0` gets a `Runs out` warning chip in the header cell.

**Overlay chart** — baseline as a dotted line, each scenario as a solid line in its assigned color:

```text
$6M ┤                                        ╭──────── Retire Early
    │                                    ╭───╯
$5M ┤                                ╭───╯
    │                            ╭───╯
$4M ┤                        ╭───╯
    │                    ╭───╯
$3M ┤                ╭───╯   ·················· Baseline
    │            ╭───╯ ······
$2M ┼────────────╯·····
```

### 4. Spending tab

This is the most differentiated part of the page: Moat starts from what the user actually spends, not what they guess.

```text
Your current lifestyle
Trailing 12-month spending                                     $7,480/month

  Likely remains                                                    $4,820
  Likely disappears                                                 $1,930
  Likely changes                                                      $730

Adjustments at retirement
  Mortgage (paid off at 68)                                        −$2,340
  Retirement contributions stop                                    −$1,200
  Healthcare before Medicare                                         +$950
  Travel                                                             +$600

Estimated retirement lifestyle                                 $6,490/month
                                                        [ Adjust anything ]
```

Each category row is editable and shows two independent axes:

| Axis | Values | Purpose |
|------|--------|---------|
| **Treatment** | `Remains`, `Disappears`, `Changes` | Drives the retirement spending estimate |
| **Essentiality** | `Essential`, `Flexible` | Drives guardrails and stress-test messaging |

Default classification is derived (commute, work lunches, childcare → `Disappears`; healthcare, travel → `Changes`; housing, groceries, utilities, insurance → `Remains` + `Essential`; dining, entertainment, travel, subscriptions, gifts → `Flexible`). Every default is user-overridable and the override persists per `categoryId`.

**Spending stages** — retirement spending is rarely flat:

```text
Retirement spending stages                              [ + Add a stage ]

  60 – 69        $10,000/mo        Go-go years
  70 – 79         $8,500/mo        Slow-go years
  80 +            $7,000/mo        No-go years
```

**Why essentiality matters** — this is the payoff, shown on the Risk tab but defined here:

> Your essential spending remains fully funded. Reducing flexible spending by about $730/month for two years would restore the plan to its target confidence range.

That sentence is worth more than "your chance of success dropped to 73%," and it is only possible because every dollar carries an essentiality flag.

### 5. Income & Taxes tab

**Retirement paycheck**, per year, with a year selector defaulting to the first full retirement year:

```text
AGE 68
  Social Security                                                  $52,300
  Rental income                                                    $18,600
  Taxable withdrawals                                              $24,200
  Traditional IRA                                                  $31,100
  Roth                                                             $12,000
  ──────────────────────────────────────────────────────────────────────
  Gross retirement income                                         $138,200
  Taxes                                                           −$18,900
  ──────────────────────────────────────────────────────────────────────
  Spendable income                                                $119,300
                                                             $9,942/month
```

Alongside it, a stacked area chart of income sources across all retirement years (new `RetirementPaycheckChart` in `@moat/charts`), so the shift from portfolio withdrawals to Social Security to RMDs is visible at a glance.

**Lifetime tax timeline:**

```text
Age    Income      Tax     Marginal    Major event
58      $92k       $11k       22%      Retires
59      $51k        $4k       12%      Low-income window
60      $49k        $4k       12%
61      $53k        $5k       12%
…
67      $98k       $12k       22%      Social Security begins
…
75     $142k       $21k       24%      RMDs
```

With a derived callout:

```text
Potential Roth conversion window
Ages 59 – 66

You're projected to be in the 12% bracket for eight years between retirement
and RMDs. Converting up to the top of that bracket could reduce lifetime taxes.
```

The window is identified deterministically: contiguous years where marginal rate is at least one bracket below the projected post-RMD marginal rate. V1 identifies and sizes the window; it does not optimize a multi-year conversion ladder (see Non-Goals).

### 6. Risk tab

**Monte Carlo, made legible.** Never lead with a single number pretending to be certain.

```text
Retirement confidence
91%

Out of 1,000 simulated market futures:
  910 funded your complete plan
   90 exhausted your liquid retirement assets (earliest at age 84)
```

Rendered as a probability cone (10th / 25th / 50th / 75th / 90th percentile bands) — new `RetirementConeChart` in `@moat/charts` using Recharts `Area` bands — not a single line.

**Stress test.** Separate from user-controlled What Ifs, because these are things the user does not choose:

```text
Stress test my retirement

  Baseline                                                            91%
  Market crash next year                                              84%
  2008-style crash                                                    82%
  Five years of weak returns                                          79%
  High inflation                                                      81%
  Live to 100                                                         87%
  Healthcare costs +50%                                               83%
  Social Security reduced 20%                                         86%
  Long-term care event                                                76%
  Early spouse death                                                  88%

  Biggest vulnerability: Long-term care
```

The vulnerability callout must connect to Moat's insurance data:

> A long-term care event is the largest single risk to your plan. You don't currently have a long-term care policy on file. [ Review your insurance → ]

or, if a policy exists:

> Your long-term care policy covers $6,000/month for 3 years after a 90-day
> elimination period, which absorbs most of a typical event. A 5-year event
> would still cost about $310,000 out of pocket.

**Plan confidence** — deliberately separate from retirement confidence, because conflating "how good are our inputs" with "how likely is this to work" is the single most common way these tools mislead people.

```text
Retirement projection confidence
82%

  ✓  4 years of transaction history
  ✓  Investment accounts connected
  ✓  Mortgage current
  ✓  Income verified
  ✓  Retirement contributions detected
  ✓  Insurance policies on file

  ⚠  Social Security estimate not entered
  ⚠  Spouse longevity assumption not reviewed
```

Each `⚠` row is actionable and deep-links to the input that would resolve it.

### 7. Improve tab

**Improve My Plan.** The distinction from What If, stated in the UI:

> **What If** answers questions you ask. **Improve My Plan** asks hundreds of questions for you and surfaces the best answers.

Moat deterministically evaluates a fixed catalog of candidate levers across a parameter sweep, ranks by impact, and shows the top five:

```text
Opportunities

1  Max your Roth IRA
   Retirement confidence            89% → 92%
   Legacy at 95                            +$241k                    [ Try it ]

2  Retire one year later
   Retirement confidence            89% → 96%
   Safe spending                        +$810/mo                     [ Try it ]

3  Delay Social Security to 70
   Estimated lifetime benefit               +$74k                    [ Try it ]

4  Increase savings by $500/month
   Earliest retirement             57.8 → 57.1                       [ Try it ]

5  Downsize at age 70
   Retirement flexibility                  +$381k                    [ Try it ]
```

`Try it` pushes that lever onto the active stack and switches to the What If tab.

**Goal Seek.** Instead of changing inputs and observing outputs, the user names the output.

```text
I want to…

  [ Retire by age 55            ]
  [ Spend $10,000/month in retirement ]
  [ Leave $2M to my children    ]
  [ Reach 95% retirement confidence   ]
  [ Never run out of liquid assets    ]
```

Result:

```text
Retire at 55

You're currently projected to retire comfortably at 59.

Ways to close the gap

  Option A    Save an additional $1,480/month                        [ Try it ]
  Option B    Reduce retirement spending by $940/month               [ Try it ]
  Option C    Earn about $35,000/year from 55 to 58                  [ Try it ]
  Option D    Downsize your home at 60                               [ Try it ]
  Option E    Combination                                            [ Try it ]
              +$650/month savings
              −$300/month retirement spending
              $15,000/year consulting income

              Result: retirement at 55 becomes ~91% funded
```

Each option is a real lever stack. `Try it` loads it into the What If tab, where the user can keep editing.

**Explore with your AI.** Moat does not pretend to have its own chat. It hands off, with instructions to call Moat's deterministic tools.

```text
Explore with your AI

  [ Find the best way to retire by 55 ]     [ Audit my entire retirement plan ]
  [ Build my Roth conversion strategy ]     [ Find my biggest retirement risks ]
  [ Optimize Social Security          ]     [ Compare retiring at 55, 58 and 60 ]
```

Tapping a card opens the connected agent (ChatGPT / Claude / Cursor) with a prebuilt prompt from `packages/ai-prompts`, following the existing `PromptMenu` pattern used on the budget and overview pages. The prompt explicitly instructs the agent to call `moat.projectRetirementScenario` rather than doing arithmetic itself.

### Copy guidelines

| Surface | Copy |
|---------|------|
| Page title | `Retirement` |
| Page subtitle | `See where you're headed. Change anything.` |
| Scenario bar, no levers | `Exploring: Baseline` |
| Scenario bar, unsaved | `Exploring: Unsaved changes` + `Save scenario` |
| Add lever button | `+ Add a change` |
| Suggested lever CTA | `Try it` |
| Custom builder entry | `+ Create custom What If` |
| Reset | `Reset to baseline` |
| Improve entry | `Try it` |
| Empty saved scenarios | `You haven't saved any retirement plans yet. Stack a few changes in What If, then save them here.` |
| Stale baseline banner | `Your accounts updated. Refreshing your baseline…` |

**Avoid:** "projection may vary," "consult a financial advisor," "estimates only," or any other disclaimer noise inside the numbers. Legal disclaimers belong once in the page footer. Never say "success probability" without immediately restating it in trial counts. Never round a confidence number to a precision the model doesn't support — always whole percentage points.

---

## Architecture / Data Model

### Layer plan

Per [AGENTS.md](../../../AGENTS.md) and the boundary proven by [complete/shared-onboarding/spec.md](../../complete/shared-onboarding/spec.md):

```text
packages/contracts      →  DTOs, Zod schemas, MoatApiClient methods, IPC channels
packages/data-access    →  RetirementRepository interface + persistence types
packages/domain         →  the engine (pure, AppContext-based, no HTTP/React/Prisma)
packages/db-postgres    →  PostgresRetirementRepository
packages/db-sqlite      →  SqliteRetirementRepository
apps/api                →  handlers/retirement.ts + services/retirement.service.ts
apps/desktop (main)     →  ipc/retirement.ts + preload bridge
packages/features       →  @moat/features/retirement  ← ALL web + desktop UI
packages/charts         →  RetirementTimelineChart, RetirementConeChart, RetirementPaycheckChart
apps/web                →  app/(dashboard)/retirement/page.tsx  (thin)
apps/desktop (renderer) →  pages/retirement.tsx                 (thin)
apps/ios                →  Features/Retirement/                 (native, own bucket)
apps/mcp + desktop gw   →  retirement tool family
```

**Non-negotiable:** no retirement UI component may live in `apps/web` or `apps/desktop`. If a component is needed by the page, it belongs in `@moat/features/retirement`. Platform differences go through props (slots, capabilities, notifications), exactly like `TransactionsPage` and `BudgetPage` do today.

### The scenario model

```text
RetirementProjection = project( applyLevers( buildBaseline(userData), levers ) )
```

- `buildBaseline` reads live data every time. There is no snapshot of the user's finances inside a scenario.
- `applyLevers` folds an ordered lever list into a mutated copy of the baseline inputs.
- `project` is deterministic and pure: same inputs → same outputs, always.
- Monte Carlo wraps `project` with seeded return sequences. The seed is derived from `userId + scenarioId` so a given scenario's confidence number is stable between page loads until the baseline actually changes.

### Prisma models

Added to `apps/api/prisma/schema.prisma` and mirrored in `packages/db-sqlite/prisma/schema.prisma` (JSON columns become `String` on SQLite, matching the existing `FinancialProfileData` treatment).

```prisma
enum RetirementScenarioSource {
  USER
  SUGGESTED
  AI
  GOAL_SEEK
}

enum RetirementSpendingTreatment {
  REMAINS
  DISAPPEARS
  CHANGES
}

enum RetirementSpendingEssentiality {
  ESSENTIAL
  FLEXIBLE
}

/// Per-user retirement inputs that cannot be derived from transactions,
/// accounts, or the financial profile. Everything derivable stays derived.
model RetirementPlan {
  id                          String   @id @default(cuid())
  userId                      String   @unique

  primaryBirthYear            Int?
  targetRetirementAge         Int      @default(65)
  longevityAge                Int      @default(95)
  socialSecurityClaimAge      Int      @default(67)
  socialSecurityMonthlyAtFra  Decimal? @db.Decimal(14, 2)

  hasSpouse                   Boolean  @default(false)
  spouseBirthYear             Int?
  spouseRetirementAge         Int?
  spouseLongevityAge          Int?
  spouseSocialSecurityClaimAge Int?
  spouseSocialSecurityMonthlyAtFra Decimal? @db.Decimal(14, 2)

  confidenceTarget            Float    @default(0.85)
  monteCarloTrials            Int      @default(1000)

  /// RetirementSpendingStage[] — ageFrom, ageTo, monthlyAmount, label
  spendingStages              Json     @default("[]")
  /// Nullable per-field overrides of the derived retirement spending estimate
  spendingOverrides           Json     @default("{}")
  /// Which milestones the user has dismissed or pinned on the timeline
  timelinePreferences         Json     @default("{}")

  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt

  scenarios                   RetirementScenario[]

  @@index([userId])
}

model RetirementScenario {
  id          String                   @id @default(cuid())
  userId      String
  planId      String
  name        String
  description String?
  color       String?
  source      RetirementScenarioSource @default(USER)
  isPinned    Boolean                  @default(false)
  sortOrder   Int                      @default(0)

  createdAt   DateTime                 @default(now())
  updatedAt   DateTime                 @updatedAt

  plan        RetirementPlan           @relation(fields: [planId], references: [id], onDelete: Cascade)
  levers      RetirementScenarioLever[]

  @@index([userId])
  @@index([planId, sortOrder])
}

model RetirementScenarioLever {
  id         String             @id @default(cuid())
  scenarioId String
  /// RetirementLeverType discriminant, e.g. "retire_at_age", "max_roth_ira"
  type       String
  /// Zod-validated params for that discriminant
  params     Json
  enabled    Boolean            @default(true)
  sortOrder  Int                @default(0)

  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt

  scenario   RetirementScenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)

  @@index([scenarioId, sortOrder])
}

/// Per-category retirement spending classification. Reuses the existing
/// Category taxonomy rather than introducing a parallel one.
model RetirementSpendingCategoryPlan {
  id                     String                         @id @default(cuid())
  userId                 String
  categoryId             String
  treatment              RetirementSpendingTreatment
  essentiality           RetirementSpendingEssentiality
  /// Overrides the derived retirement monthly amount when the user disagrees
  retirementMonthlyAmount Decimal?                      @db.Decimal(14, 2)
  isUserEdited           Boolean                        @default(false)

  createdAt              DateTime                       @default(now())
  updatedAt              DateTime                       @updatedAt

  @@unique([userId, categoryId])
  @@index([userId])
}
```

Migration workflow per [apps/api/docs/patterns/prisma-and-migrations.md](../../../apps/api/docs/patterns/prisma-and-migrations.md): `pnpm db:migrate:dev --name add_retirement_models`, then `pnpm db:generate`, then `pnpm db:validate`. Commit `schema.prisma` and the migration folder together. Never `db push` on Neon.

### Lever type system

Defined once in `packages/contracts/src/retirement.ts` as a discriminated union with a Zod schema per member, exported as `RetirementLeverSchema` / `RetirementLever`. Every consumer — API validation, engine, UI builder, MCP contract, iOS decoder — derives from this one definition.

```ts
export const RetirementLeverSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("retire_at_age"),
    params: z.object({ age: z.number().int().min(30).max(90) }),
  }),
  z.object({
    type: z.literal("custom_one_time"),
    params: z.object({
      direction: z.enum(["inflow", "outflow"]),
      amount: z.number().positive(),
      atAge: z.number().int().min(18).max(110),
      label: z.string().max(80),
      taxTreatment: z.enum(["taxable", "taxFree", "ordinaryIncome"]).default("taxable"),
    }),
  }),
  // … one member per lever in the library below
]);

export type RetirementLever = z.infer<typeof RetirementLeverSchema>;
export type RetirementLeverType = RetirementLever["type"];
```

Each lever also carries display metadata in a parallel, UI-only catalog (`packages/features/src/retirement/lever-catalog.ts`): category, label, icon, param editor descriptor, and a `describe(params, baseline)` function that produces the row text (`Retire at 57 instead of 60`).

### The What-If library (V1 scope)

Every lever below ships in V1. `Prefilled from` names the real Moat data used to populate the default value, which is what makes this less tedious than every competitor.

**Work & Income**

| Lever | `type` | Params | Prefilled from |
|-------|--------|--------|----------------|
| Retire earlier | `retire_earlier` | `years` | `targetRetirementAge` |
| Retire later | `retire_later` | `years` | `targetRetirementAge` |
| Retire at age | `retire_at_age` | `age` | `targetRetirementAge` |
| Stop working at age | `stop_working_at_age` | `age` | `targetRetirementAge` |
| Work part-time before retirement | `part_time_before_retirement` | `annualIncome, fromAge, toAge` | Trailing income from `getSummaryMetrics()` |
| Spouse retires earlier/later | `spouse_retire_at_age` | `age` | `spouseRetirementAge` |
| Spouse stops working | `spouse_stops_working` | `atAge` | `spouseRetirementAge` |
| Income increases | `income_change` | `annualDelta \| percentDelta, fromAge` | Trailing income |
| Income decreases | `income_change` | (negative delta) | Trailing income |
| Lose job | `job_loss` | `atAge, monthsOut, severanceAmount?` | Trailing income |
| Career break | `career_break` | `fromAge, toAge` | Trailing income |
| Annual bonus | `annual_bonus` | `amount, fromAge, toAge` | Detected bonus transactions |
| Side-business income | `side_business_income` | `annualAmount, fromAge, toAge` | — |
| Rental income starts/stops | `rental_income_change` | `propertyId?, monthlyAmount, fromAge, toAge?` | `RealEstateInvestment.monthlyRent` |

**Savings**

| Lever | `type` | Params | Prefilled from |
|-------|--------|--------|----------------|
| Increase/decrease contributions | `contribution_change` | `accountId?, monthlyDelta` | `Investment.monthlyContribution`, `PlaidAccount.monthlyContribution` |
| Max 401(k) | `max_401k` | `includeCatchUp` | Detected 401(k) contributions vs statutory limit |
| Max Roth IRA | `max_roth_ira` | `includeCatchUp` | Detected Roth contributions vs limit |
| Max both spouses' IRAs | `max_spousal_iras` | `includeCatchUp` | Both detected contribution rates |
| Add employer match | `employer_match` | `matchPercent, upToPercentOfSalary` | 401(k) account presence |
| Max HSA | `max_hsa` | `coverageType` | `InvestmentType.HSA` accounts |
| Add taxable investing | `taxable_investing` | `monthlyAmount` | Surplus from `avgNetGain` |
| Stop contributions at age | `stop_contributions_at_age` | `age` | `targetRetirementAge` |

**Retirement spending**

| Lever | `type` | Params | Prefilled from |
|-------|--------|--------|----------------|
| Spend more in retirement | `retirement_spending_change` | `monthlyDelta` | Expected retirement spending |
| Spend less in retirement | `retirement_spending_change` | (negative) | Expected retirement spending |
| Set retirement spending | `retirement_spending_set` | `monthlyAmount` | Expected retirement spending |
| Staged spending | `retirement_spending_stages` | `stages[{ ageFrom, ageTo, monthlyAmount }]` | `RetirementPlan.spendingStages` |
| Add a recurring retirement expense | `custom_expense` | `amount, cadence, fromAge, toAge, label, essentiality` | — |

**Investments**

| Lever | `type` | Params | Prefilled from |
|-------|--------|--------|----------------|
| Returns ±1% | `return_rate_delta` | `delta` | Active `ForecastScenario.investmentReturn` |
| Custom expected return | `return_rate_set` | `rate` | Same |
| Higher/lower inflation | `inflation_delta` | `delta` | `ForecastAssumptions.inflationRate` |
| More conservative portfolio | `portfolio_shift` | `target: "conservative"` | `riskTolerance` |
| More aggressive portfolio | `portfolio_shift` | `target: "aggressive"` | `riskTolerance` |
| Major market crash | `market_crash` | `atAge, dropPercent, recoveryYears` | — |
| Poor early retirement returns | `sequence_risk` | `years, annualReturn` | Models sequence-of-returns risk in the first N retirement years |

**Social Security**

| Lever | `type` | Params | Prefilled from |
|-------|--------|--------|----------------|
| Claim at 62 / 65 / FRA / 70 | `social_security_claim_age` | `age` | `socialSecurityClaimAge` |
| Spouse claims at different age | `spouse_social_security_claim_age` | `age` | `spouseSocialSecurityClaimAge` |
| Benefits reduced | `social_security_haircut` | `percent` | Default 20% |

When a Social Security lever is active, the impact panel adds a dedicated sentence, because the tradeoff is not obvious from confidence alone:

> Delaying from 67 to 70 increases portfolio withdrawals during ages 67–69 by about $94,000 but raises lifetime household benefits by roughly $148,000.

**Housing**

| Lever | `type` | Params | Prefilled from |
|-------|--------|--------|----------------|
| Pay mortgage off early | `mortgage_payoff_early` | `propertyId, atAge \| extraMonthlyPayment` | `RealEstateInvestment.currentLoanBalance` |
| Extra mortgage payments | `mortgage_extra_payment` | `propertyId, monthlyAmount` | Same |
| Don't pay mortgage early | `mortgage_payoff_cancel` | `propertyId` | Same |
| Buy another home | `buy_home` | `atAge, price, downPayment, rate, termYears` | `TaxProfile`, current rates |
| Buy a more expensive home | `upsize_home` | `atAge, priceDelta` | Current home value |
| Downsize | `downsize_home` | `atAge, newHomePrice` | Current home value + equity |
| Sell primary residence | `sell_primary_home` | `atAge, thenRent?` | Current home value + loan balance |
| Rent instead | `rent_instead` | `fromAge, monthlyRent` | Local rent estimate or user input |
| Add rental property | `add_rental_property` | `atAge, price, downPayment, monthlyRent, expenses` | — |
| Sell rental property | `sell_rental_property` | `propertyId, atAge` | `RealEstateInvestment` |
| Move states | `move_state` | `atAge, stateCode` | `TaxProfile.estimatedStateTaxRate` |

**Big life events**

| Lever | `type` | Params |
|-------|--------|--------|
| Have another child | `add_dependent` | `atAge, annualCost, years` |
| Fund child's college | `fund_college` | `startAge, years, annualCost` |
| Wedding expense | `custom_one_time` | `amount, atAge, label` |
| Buy car | `custom_one_time` / `recurring_purchase` | `amount, atAge, everyNYears?` |
| Vacation home | `buy_home` | (usage `VACATION_HOME`) |
| Major remodel | `custom_one_time` | `amount, atAge` |
| Receive inheritance | `custom_one_time` | `direction: "inflow"` |
| Give inheritance early | `custom_one_time` | `direction: "outflow"` |
| Large charitable gift | `charitable_gift` | `amount, atAge, recurring?` |
| Help children buy homes | `custom_one_time` | `direction: "outflow"` |
| One-time medical expense | `custom_one_time` | `direction: "outflow"` |

The point of `custom_one_time` is that a user can express `Spend $150,000 at age 62` in one sentence, without inventing an obscure recurring expense record.

**Healthcare**

| Lever | `type` | Params | Prefilled from |
|-------|--------|--------|----------------|
| Higher/lower healthcare costs | `healthcare_cost_delta` | `percentDelta \| monthlyDelta` | Detected healthcare spending |
| Pre-Medicare coverage gap | `pre_medicare_coverage` | `monthlyPremium, fromAge, toAge` | `targetRetirementAge` → 65 |
| LTC event (2 years) | `long_term_care_event` | `atAge, years: 2, monthlyCost, whom` | Regional LTC cost + `InsurancePolicyV2` LTC coverage |
| LTC event (5 years) | `long_term_care_event` | `years: 5` | Same |
| One spouse needs LTC | `long_term_care_event` | `whom: "primary" \| "spouse"` | Same |
| Both spouses need LTC | `long_term_care_event` | `whom: "both"` | Same |

**Insurance** — Moat's differentiator. These consume real `InsurancePolicyV2` coverage limits, elimination periods and benefit periods, not generic assumptions.

| Lever | `type` | Params | Prefilled from |
|-------|--------|--------|----------------|
| Add/remove life insurance | `life_insurance_change` | `policyId? \| deathBenefit, annualPremium, termYears` | `InsurancePolicyV2` type `life` |
| Policy expires | `policy_expires` | `policyId, atAge` | `effectiveEndDate` |
| Long-term care policy | `ltc_policy_change` | `policyId? \| monthlyBenefit, benefitYears, eliminationDays, inflationProtection` | `InsurancePolicyV2` type `longTermCare` |
| Annuity begins | `annuity_begins` | `atAge, monthlyPayout, premium, hasCola` | — |
| Disability before retirement | `disability_event` | `atAge, durationYears` | `InsurancePolicyV2` type `disability` → `monthlyBenefit` |
| Spouse dies | `spouse_death` | `atAge` | Life policy death benefit + Social Security survivor rules |

`spouse_death` must model all three effects together: the life insurance payout, the loss of the spouse's income and Social Security benefit (survivor takes the higher of the two), and the change in filing status to single. Modeling only the payout would be misleading in exactly the direction that hurts users.

**Taxes**

| Lever | `type` | Params | Prefilled from |
|-------|--------|--------|----------------|
| Move to another state | `move_state` | `atAge, stateCode` | `TaxProfile.estimatedStateTaxRate` |
| Roth conversion | `roth_conversion` | `fromAge, toAge, annualAmount \| fillToBracket` | Projected marginal rates |
| Retire before RMDs | (derived) | — | Highlighted, not a lever |
| Different withdrawal order | `withdrawal_order` | `order: ("taxable" \| "taxDeferred" \| "taxFree")[]` | Default: taxable → tax-deferred → tax-free |

**Custom**

| Lever | `type` | Params |
|-------|--------|--------|
| Custom income | `custom_income` | `amount, cadence, fromAge, toAge, taxTreatment, label` |
| Custom expense | `custom_expense` | `amount, cadence, fromAge, toAge, essentiality, label` |
| Custom one-time event | `custom_one_time` | `direction, amount, atAge, taxTreatment, label` |

### The engine

`packages/domain/src/retirement/`, pure, no HTTP, no React, no Prisma:

| File | Export | Responsibility |
|------|--------|----------------|
| `build-baseline.ts` | `buildRetirementBaseline(ctx, input): RetirementBaseline` | Assembles live inputs: accounts by tax treatment, contribution rates, trailing income/spending, properties, liabilities, insurance, tax profile, plan settings |
| `apply-levers.ts` | `applyLevers(baseline, levers): RetirementPlanInputs` | Folds ordered levers into mutated inputs; returns applied/overridden metadata for conflict badges |
| `project.ts` | `projectRetirement(inputs): RetirementProjection` | Year-by-year deterministic ledger: income, contributions, growth, withdrawals, taxes, RMDs, balances by tax treatment, net worth |
| `withdrawal-order.ts` | `resolveWithdrawals(year, need, balances, order)` | Withdrawal sequencing across taxable / tax-deferred / tax-free |
| `taxes.ts` | `estimateAnnualTax(year, income, filingStatus, stateCode)` | Bracket-based federal + flat state estimate; brackets in a versioned constants file |
| `social-security.ts` | `estimateBenefit(plan, claimAge)` | FRA benefit with early-claim reduction and delayed-retirement credits; survivor rules |
| `rmd.ts` | `requiredMinimumDistribution(age, balance)` | Uniform Lifetime Table divisors, versioned |
| `safe-spending.ts` | `solveSafeSpending(inputs, confidenceTarget)` | Binary search over flat real spend against Monte Carlo |
| `earliest-retirement.ts` | `solveEarliestRetirementAge(inputs)` | Binary search over retirement age |
| `monte-carlo.ts` | `runMonteCarlo(inputs, { trials, seed })` | Seeded return sequences → percentile bands + funded-trial counts |
| `stress-test.ts` | `runStressTests(inputs)` | Fixed catalog of adverse scenarios, each expressed as a lever stack |
| `goal-seek.ts` | `solveRetirementGoal(inputs, objective)` | Returns 3–5 lever-stack options that reach the objective |
| `improve-plan.ts` | `findOpportunities(inputs)` | Sweeps a candidate lever catalog, ranks by impact |
| `suggest-levers.ts` | `suggestLevers(baseline): SuggestedLever[]` | Personalized What If cards |
| `plan-confidence.ts` | `scorePlanConfidence(baseline): PlanConfidence` | Input-quality score with satisfied/missing signal list |
| `spending-translation.ts` | `translateSpending(ctx, input)` | Trailing actual → retirement estimate with treatment + essentiality |
| `constants.ts` | `RMD_START_AGE`, `FEDERAL_BRACKETS_2026`, `CONTRIBUTION_LIMITS_2026`, `SOCIAL_SECURITY_FRA` | Every statutory number, versioned and dated in one file |

**`constants.ts` is load-bearing.** Contribution limits, RMD ages, and tax brackets change annually. They must never be inlined at a call site. Each constant carries the tax year it applies to, and the projection records which year's constants it used so the UI can say so.

### Performance contract

| Operation | Budget | Strategy |
|-----------|--------|----------|
| Deterministic projection (60 years × 12 months) | < 60 ms server | Plain loop, no allocation in the inner loop |
| Monte Carlo, 1,000 trials | < 700 ms server | Annual (not monthly) resolution for trials; reuse the deterministic ledger for non-market variables |
| Safe spending solve | < 400 ms | Binary search, ~12 iterations, reduced-trial Monte Carlo (250) then one confirming full run |
| Earliest retirement solve | < 300 ms | Binary search over integer ages, deterministic only |
| Full page load | < 1.2 s to populated | `retirement.getPlanOverview` returns baseline + deterministic metrics; Monte Carlo streams in as a second query |

**Caching.** Every projection request carries a `projectionKey` — a stable hash of `(baselineVersion, orderedEnabledLevers)`. `baselineVersion` is derived from the latest `BalanceSnapshot` timestamp, the financial profile `updatedAt`, and the active `ForecastScenario.updatedAt`. Server caches projections by `projectionKey` for 5 minutes; the client uses it as the React Query key. When `baselineVersion` changes, every cached projection for that user invalidates and the UI shows `Your accounts updated. Refreshing your baseline…`.

### API surface

New handler object `retirement` in `apps/api/src/server/handlers/retirement.ts`, exported through `handlers/index.ts` into `handlers.ts`. The catch-all route `apps/api/pages/api/v1/[router]/[action].ts` then resolves `/api/v1/retirement/<action>` automatically.

| Endpoint | Wrapper | Purpose |
|----------|---------|---------|
| `GET /api/v1/retirement/getPlanOverview` | `withDemoOrAuth` | Baseline + deterministic headline metrics + plan confidence + suggested levers |
| `POST /api/v1/retirement/projectScenario` | `withDemoOrAuth` | Project an ad-hoc or saved lever stack; returns the full year ledger + summary |
| `POST /api/v1/retirement/runMonteCarlo` | `withDemoOrAuth` | Confidence + percentile cone for a lever stack |
| `POST /api/v1/retirement/compareScenarios` | `withDemoOrAuth` | Baseline + up to 3 scenarios, aligned summary rows |
| `POST /api/v1/retirement/runStressTests` | `withDemoOrAuth` | Fixed adverse catalog + biggest vulnerability |
| `POST /api/v1/retirement/solveGoal` | `withDemoOrAuth` | Goal Seek options |
| `GET /api/v1/retirement/getOpportunities` | `withDemoOrAuth` | Improve My Plan ranked list |
| `GET /api/v1/retirement/getSpendingPlan` | `withDemoOrAuth` | Trailing actual → retirement translation, per category |
| `POST /api/v1/retirement/updateSpendingPlan` | `withAuth` | Persist treatment / essentiality / amount overrides |
| `GET /api/v1/retirement/getPlan` | `withDemoOrAuth` | `RetirementPlan` settings |
| `POST /api/v1/retirement/updatePlan` | `withAuth` | Update plan settings |
| `GET /api/v1/retirement/listScenarios` | `withDemoOrAuth` | Saved scenarios with lever summaries |
| `POST /api/v1/retirement/createScenario` | `withAuth` | Create with levers |
| `POST /api/v1/retirement/updateScenario` | `withAuth` | Rename, recolor, replace lever list, reorder |
| `POST /api/v1/retirement/duplicateScenario` | `withAuth` | Copy |
| `POST /api/v1/retirement/deleteScenario` | `withAuth` | Delete |

All reads use `withDemoOrAuth` so demo mode works end to end. All writes use `withAuth`. Never call `requireDemoOrAuthenticated()` manually. Business logic lives in `apps/api/src/server/services/retirement.service.ts`, which delegates math to `@moat/domain`; handlers stay thin.

Then: add every path to `packages/openapi/api-v1.yaml` and run `pnpm --filter @moat/openapi run generate` to regenerate `packages/client-ts`. Extend `MoatApiClient` in `packages/contracts/src/api-client.ts` with matching methods, and implement them in both `apps/web/src/lib/http-api-client.ts` and `apps/desktop/src/renderer/src/lib/ipc-api-client.ts`.

### Desktop IPC

`packages/contracts/src/ipc/retirement.ts`:

```ts
export const RETIREMENT_CHANNELS = {
  getPlanOverview: "retirement:getPlanOverview",
  projectScenario: "retirement:projectScenario",
  runMonteCarlo: "retirement:runMonteCarlo",
  compareScenarios: "retirement:compareScenarios",
  runStressTests: "retirement:runStressTests",
  solveGoal: "retirement:solveGoal",
  getOpportunities: "retirement:getOpportunities",
  getSpendingPlan: "retirement:getSpendingPlan",
  updateSpendingPlan: "retirement:updateSpendingPlan",
  getPlan: "retirement:getPlan",
  updatePlan: "retirement:updatePlan",
  listScenarios: "retirement:listScenarios",
  createScenario: "retirement:createScenario",
  updateScenario: "retirement:updateScenario",
  duplicateScenario: "retirement:duplicateScenario",
  deleteScenario: "retirement:deleteScenario",
} as const;
```

Handlers in `apps/desktop/src/main/ipc/retirement.ts` resolve `getUnlockedDesktopDb().appCtx` and call the same `@moat/domain` functions the API calls. Expose typed, scoped channels through the preload bridge only — never raw Prisma or Node modules.

Monte Carlo in the desktop main process must not block the UI. Run `runMonteCarlo` in a `worker_threads` worker; the IPC handler awaits the worker result. This is the one place the desktop implementation intentionally differs from the API.

### Shared UI file layout

```text
packages/features/src/retirement/
├── index.ts                          # exports RetirementPage + prop types
├── retirement-page.tsx               # tab shell, header, scenario bar mount
├── retirement-store.ts               # zustand: activeTab, working lever stack, editor state
├── retirement-copy.ts                # deterministic headline + explanation templates
├── lever-catalog.ts                  # UI metadata per lever type
├── format.ts                         # currency/age/percent/delta formatters
├── use-retirement-queries.ts         # react-query hooks over useApiClient()
├── use-projection-key.ts             # stable client-side projection cache key
├── scenario-bar/
│   ├── scenario-bar.tsx
│   ├── scenario-picker.tsx
│   └── save-scenario-dialog.tsx
├── header/
│   ├── plan-headline.tsx
│   ├── metric-strip.tsx
│   └── metric-tile.tsx
├── plan/
│   ├── plan-tab.tsx
│   ├── timeline-lens-tabs.tsx
│   ├── milestone-rail.tsx
│   └── year-inspector-panel.tsx
├── what-if/
│   ├── what-if-tab.tsx
│   ├── suggested-lever-grid.tsx
│   ├── suggested-lever-card.tsx
│   ├── lever-stack.tsx
│   ├── lever-row.tsx
│   ├── lever-picker-dialog.tsx
│   ├── impact-delta-table.tsx
│   ├── impact-explanation.tsx
│   └── custom-lever-builder/
│       ├── index.tsx
│       ├── lever-sentence.tsx
│       └── lever-param-slots.tsx
├── scenarios/
│   ├── scenarios-tab.tsx
│   ├── saved-scenario-card.tsx
│   ├── scenario-compare-table.tsx
│   └── scenario-overlay-panel.tsx
├── spending/
│   ├── spending-tab.tsx
│   ├── lifestyle-translation-table.tsx
│   ├── spending-category-row.tsx
│   ├── treatment-select.tsx
│   └── spending-stages-editor.tsx
├── income-taxes/
│   ├── income-taxes-tab.tsx
│   ├── paycheck-year-panel.tsx
│   ├── paycheck-year-selector.tsx
│   ├── tax-timeline-table.tsx
│   └── conversion-window-callout.tsx
├── risk/
│   ├── risk-tab.tsx
│   ├── monte-carlo-readout.tsx
│   ├── stress-test-list.tsx
│   ├── vulnerability-callout.tsx
│   └── plan-confidence-panel.tsx
└── improve/
    ├── improve-tab.tsx
    ├── opportunity-row.tsx
    ├── goal-seek-panel.tsx
    ├── goal-seek-option-row.tsx
    └── ai-explore-section.tsx
```

New charts in `packages/charts/src/`: `retirement-timeline-chart.tsx`, `retirement-cone-chart.tsx`, `retirement-paycheck-chart.tsx`, `retirement-overlay-chart.tsx` — each exported from `packages/charts/src/index.ts`.

Register the subpath export in `packages/features/package.json`:

```json
"./retirement": "./src/retirement/index.ts"
```

and add the matching Vite alias in `apps/desktop/electron.vite.config.ts` alongside the existing `@moat/features/*` aliases. **The desktop build fails silently-ish without this** — TypeScript paths alone are not enough.

### Host integration

**Web** — `apps/web/src/app/(dashboard)/retirement/page.tsx`:

```tsx
import { RetirementPage } from "@moat/features/retirement";
import { PromptMenu } from "~/components/common/prompts-button";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function Page() {
  return (
    <RetirementPage
      aiExploreSlot={<PromptMenu promptId="retirement-explore" surface="retirement.improve" />}
      onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
    />
  );
}
```

Add `{ href: "/retirement", label: "Retirement", icon: PiggyBank }` to the nav array in `apps/web/src/components/layout/sidebar.tsx`.

**Desktop** — `apps/desktop/src/renderer/src/pages/retirement.tsx` renders the same component with desktop adapters; add `"retirement"` to the page union and `"/retirement": "retirement"` to the path map in `apps/desktop/src/renderer/src/App.tsx`.

**Dashboard widget** — implement the already-registered `"retirement-projection"` type in `apps/web/src/components/dashboard/widget-renderer.tsx` as a compact confidence + earliest-age tile that deep-links to `/retirement`.

### iOS (its own bucket)

iOS is native SwiftUI and does not consume `@moat/features`. It gets its own module under `apps/ios/Moat/Features/Retirement/`, following the conventions in [apps/ios/AGENTS.md](../../../apps/ios/AGENTS.md) and the existing Scenarios/Dashboard modules.

```text
apps/ios/Moat/Features/Retirement/
├── Models/
│   ├── retirement-models.swift            # RetirementPlanOverview, RetirementProjection, ProjectionYear
│   ├── retirement-lever.swift             # Codable mirror of RetirementLever discriminated union
│   └── retirement-scenario.swift
├── Services/
│   └── retirement-service.swift           # actor, APIClient.shared, /api/v1/retirement/*
├── ViewModels/
│   ├── retirement-view-model.swift        # @MainActor ObservableObject, ViewState enum
│   ├── retirement-what-if-view-model.swift
│   └── retirement-scenarios-view-model.swift
└── Views/
    ├── retirement-view.swift              # root, in-page tab picker
    ├── retirement-metric-strip.swift
    ├── retirement-timeline-chart-view.swift
    ├── retirement-what-if-section.swift
    ├── retirement-lever-stack-view.swift
    ├── retirement-lever-editor-sheet.swift
    ├── retirement-scenario-compare-view.swift
    ├── retirement-paycheck-view.swift
    ├── retirement-risk-view.swift
    └── retirement-improve-view.swift
```

iOS conventions to follow exactly:

| Concern | Rule |
|---------|------|
| File names | kebab-case (`retirement-view-model.swift`), matching the Scenarios/Insights majority — not the `DashboardView.swift` exception |
| ViewModel | `@MainActor final class RetirementViewModel: ObservableObject` with `@Published private(set)` and a `ViewState` enum (`idle`, `loading`, `loaded`, `refreshing`, `error`). No `@Observable` macro — the codebase is uniformly `ObservableObject`. |
| Service | `actor RetirementService` wrapping `APIClient.shared`, path strings like `"/api/v1/retirement/projectScenario"` |
| Tabs | In-page picker (the `InsightsTab` pattern in `apps/ios/Moat/Features/Insights/Views/insights-view.swift`), not a nested `TabView` |
| Charts | `FinancialChartContainer` + `FinancialLineChart` from `Core/DesignSystem/FinancialCharts/` |
| Lever editors | `MoatGlassSheet`; every numeric field gets `.moatKeyboardDismissToolbar()`; every `Toggle` gets `.moatToggleStyle()` |
| Layout | `ScrollView` + `.moatPageBackground()` + `.refreshable { await viewModel.refresh() }` (awaited directly, never wrapped in `Task { }`), bottom padding `112` |
| Navigation | New entry in `MoreMenuSection.wealthManagement` in `apps/ios/Moat/App/app-destination.swift`, alongside Investments and Scenarios. Whether Retirement earns a root tab is an open question. |
| Analytics | `Analytics.capture(...)` only — never the PostHog SDK directly |

**iOS V1 scope is deliberately narrower than web/desktop.** iOS ships: Plan tab (metrics + timeline), What If (suggested levers, stack, delta table), Scenarios (list + compare), and Risk (confidence + stress tests). The custom sentence builder, Goal Seek, and the Taxes timeline are web/desktop-first and land on iOS after the web surface stabilizes. This is called out here so nobody treats iOS parity as a V1 blocker.

### MCP surface

New scopes in `packages/mcp-contracts/src/scopes.ts`: `mcp:retirement:read`, `mcp:retirement:write`. `mcp:read` continues to satisfy the read scope via existing `hasRequiredScopes` behavior.

| Tool | Scopes | Safety class | Purpose |
|------|--------|--------------|---------|
| `moat.getRetirementPlan` | `mcp:retirement:read` | `read_only_app_data` | Baseline overview + headline metrics + plan confidence |
| `moat.listRetirementScenarios` | `mcp:retirement:read` | `read_only_app_data` | Saved scenarios with lever summaries |
| `moat.projectRetirementScenario` | `mcp:retirement:read` | `read_only_app_data` | Project an ad-hoc lever stack without saving |
| `moat.compareRetirementScenarios` | `mcp:retirement:read` | `read_only_app_data` | Aligned comparison rows |
| `moat.runRetirementStressTest` | `mcp:retirement:read` | `read_only_app_data` | Adverse catalog + biggest vulnerability |
| `moat.solveRetirementGoal` | `mcp:retirement:read` | `read_only_app_data` | Goal Seek options |
| `moat.createRetirementScenario` | `mcp:retirement:write` | `mutates_app_data` | Persist a scenario, return a deep link |
| `moat.updateRetirementScenario` | `mcp:retirement:write` | `mutates_app_data` | Update levers/name |
| `moat.deleteRetirementScenario` | `mcp:retirement:write` | `mutates_app_data` | Delete, `requiresConfirmation: true` |

All nine register in both `apps/mcp/src/tools/registry.ts` and `apps/desktop/src/main/agent-gateway/tools/registry.ts`, with input schemas in `packages/mcp-contracts/src/schemas.ts` reusing `RetirementLeverSchema` from `@moat/contracts` so there is exactly one lever definition in the codebase.

**The workflow this unlocks.** A user asks ChatGPT:

> Could I retire at 52 if my wife keeps working until 60 and we sell our home when I'm 65?

The agent calls `moat.createRetirementScenario` with:

```json
{
  "name": "Retire at 52",
  "levers": [
    { "type": "retire_at_age", "params": { "age": 52 } },
    { "type": "spouse_retire_at_age", "params": { "age": 60 } },
    { "type": "sell_primary_home", "params": { "atAge": 65 } }
  ]
}
```

and gets back both the numbers and a deep link:

```json
{
  "scenarioId": "clx…",
  "confidence": 0.71,
  "safeMonthlySpending": 6950,
  "baselineSafeMonthlySpending": 9240,
  "url": "https://app.moatfinance.com/retirement?scenario=clx…"
}
```

The agent can then say: *"Moat calculates a 71% chance of fully funding this. Your safe retirement spending falls from $9,240 to about $6,950/month. [View scenario in Moat →]"* — and the visual model and the conversation reinforce each other.

**All arithmetic stays in Moat.** Tool descriptions must instruct the model to call `moat.projectRetirementScenario` rather than estimating. Prebuilt prompts land in `packages/ai-prompts/src/prompts/retirement.ts` and surface through the existing `PromptMenu`.

### Analytics (PostHog)

Naming per [AGENTS.md](../../../AGENTS.md): `<domain>_<object>_<action>`, snake_case. Identity is `{ userId }` **or** `{ demoUser: true }`, never both. Only counts, booleans and enums — never lever amounts, balances, ages, or category names.

| Event | When | Properties |
|-------|------|------------|
| `retirement_page_viewed` | Page mount | `{ tab, hasBaseline }` |
| `retirement_tab_changed` | Tab switch | `{ tab }` |
| `retirement_lever_added` | Lever pushed onto the stack | `{ leverType, source: "suggested" \| "library" \| "custom" \| "improve" \| "goal_seek", stackSize }` |
| `retirement_lever_removed` | Lever removed | `{ leverType, stackSize }` |
| `retirement_scenario_saved` | Scenario persisted | `{ leverCount, isNew }` |
| `retirement_scenario_compared` | Compare view opened | `{ scenarioCount }` |
| `retirement_monte_carlo_run` | Confidence computed | `{ trials, leverCount }` |
| `retirement_stress_test_run` | Stress tab opened | `{ testCount }` |
| `retirement_goal_seek_run` | Goal Seek submitted | `{ objective, optionCount }` |
| `retirement_opportunity_applied` | Improve → Try it | `{ opportunityType }` |
| `retirement_spending_plan_edited` | Category treatment/essentiality changed | `{ field }` |
| `retirement_ai_prompt_opened` | AI card tapped | `{ promptId }` |

Capture only through the wrappers (`apps/web/src/lib/analytics.ts`, `apps/desktop/src/renderer/src/lib/analytics.ts`, `Analytics.swift`). `pnpm run ci:analytics` fails the build on direct PostHog calls.

### Data and security requirements

- Reads use `withDemoOrAuth`; writes use `withAuth`. UI visibility is never the permission check.
- Every query scopes by `userId`; every scenario/lever mutation verifies ownership before writing, per `apps/api/src/server/lib/ownership`.
- **Never log** balances, projected net worth, lever `params`, category names, ages, birth years, Social Security amounts, or insurance coverage limits. Log only `{ userId, feature: "retirement", operation, leverCount, durationMs }`.
- Insurance-derived inputs inherit the storage scope already set on the policy. On desktop, policies stored `localPrivate` must never leave the device — the desktop engine reads them locally and the cloud engine simply projects without them, flagged in Plan Confidence as `⚠ Some policies are stored locally and aren't included in this projection`.
- MCP write tools are unavailable to OAuth DCR clients (read scopes only), matching [complete/mcp-financial-writes/spec.md](../../complete/mcp-financial-writes/spec.md).
- Every projection response carries the `constants.ts` tax year it used, so a stale-constants bug is visible rather than silent.

---

## Implementation Plan

### Phase 0 — Contracts and data model

1. `packages/contracts/src/retirement.ts` — all DTOs, `RetirementLeverSchema` discriminated union, projection/summary/comparison shapes. Export from `src/index.ts`.
2. `packages/contracts/src/ipc/retirement.ts` — `RETIREMENT_CHANNELS` + per-channel Zod schemas.
3. Extend `MoatApiClient` with the 16 retirement methods.
4. Prisma models in `apps/api/prisma/schema.prisma`; mirror in `packages/db-sqlite/prisma/schema.prisma`. `pnpm db:migrate:dev --name add_retirement_models`.
5. `RetirementRepository` interface in `packages/data-access`; implementations in `packages/db-postgres` and `packages/db-sqlite`; wire into `createSqliteAppContext`.

**Acceptance criteria:** `pnpm typecheck` passes across the workspace; `pnpm db:validate` passes; the lever union round-trips through Zod for at least one fixture of every lever type.

### Phase 1 — Baseline engine and Plan tab

1. `packages/domain/src/retirement/`: `constants.ts`, `build-baseline.ts`, `project.ts`, `withdrawal-order.ts`, `taxes.ts`, `social-security.ts`, `rmd.ts`, `earliest-retirement.ts`, `plan-confidence.ts`.
2. `retirement.getPlanOverview` + `retirement.projectScenario` handlers and service; OpenAPI paths; Orval regen.
3. `@moat/features/retirement` skeleton: `retirement-page.tsx`, tab shell, `header/`, `plan/`; `RetirementTimelineChart` in `@moat/charts`.
4. Web route + sidebar entry; desktop page + IPC + Vite alias.

**Acceptance criteria:** A seeded demo user with connected accounts loads `/retirement` on both web and desktop and sees a populated headline, metric strip, and timeline with all six lenses and a working year inspector. Deterministic projection returns in under 60ms for a 60-year horizon. All five Plan-tab states render correctly.

### Phase 2 — What If engine and the lever library

1. `apply-levers.ts` with conflict/override metadata; `suggest-levers.ts`.
2. Every lever in the library table, each with an engine implementation and a `lever-catalog.ts` entry.
3. `what-if/` UI: suggested grid, lever stack with reorder/disable/duplicate, lever picker dialog, impact delta table, `retirement-copy.ts` explanation templates.
4. Custom lever builder on `InlineRuleSentence` / `InlineRuleDropdown` / `InlineRuleSuggestInput`.
5. URL persistence of the unsaved stack via `useMoatNavigation`.

**Acceptance criteria:** Every lever in the library can be added, edited, reordered, disabled, and removed, and each measurably changes the projection. Four stacked levers produce a correct delta table. Conflicting levers show override badges rather than silently dropping. Reloading the page restores the unsaved stack from the URL.

### Phase 3 — Scenarios

1. Scenario CRUD handlers + service + repository methods; `compareScenarios`.
2. `scenarios/` UI: cards, save dialog, rename/duplicate/delete, color assignment, pinning.
3. `RetirementOverlayChart`; comparison table with best-value bolding and `Runs out` chips.

**Acceptance criteria:** A scenario saved, then re-opened after the user's balances change, reflects the new balances without edits. Baseline plus three scenarios overlay correctly and the comparison table matches each scenario's own projection exactly.

### Phase 4 — Spending translation and essentiality

1. `spending-translation.ts`; `RetirementSpendingCategoryPlan` CRUD; default classification rules.
2. `spending/` UI: translation table, treatment and essentiality controls, stage editor.
3. Feed the derived retirement spending into the baseline so every projection uses it.

**Acceptance criteria:** Trailing 12-month spending resolves into remains/disappears/changes buckets with sensible defaults; overrides persist per category and immediately move the projection; spending stages produce a stepped spending series in the timeline.

### Phase 5 — Retirement paycheck and lifetime taxes

1. Per-year income/withdrawal/tax ledger already produced by `project.ts` surfaced through `getPlanOverview`.
2. `income-taxes/` UI: paycheck panel, `RetirementPaycheckChart`, tax timeline table, conversion window callout.

**Acceptance criteria:** Gross income minus taxes equals spendable income for every year; the monthly figure matches the annual figure divided by 12; the conversion window is identified only when a genuine multi-year bracket gap exists.

### Phase 6 — Monte Carlo, stress tests, plan confidence

1. `monte-carlo.ts` (seeded), `safe-spending.ts`, `stress-test.ts`; `runMonteCarlo` and `runStressTests` handlers; desktop worker thread.
2. `RetirementConeChart`; `risk/` UI: readout, cone, stress grid, vulnerability callout wired to real `InsurancePolicyV2` coverage, plan confidence panel with actionable warnings.

**Acceptance criteria:** Confidence is stable across reloads for an unchanged baseline; 1,000 trials complete inside the budget on both platforms without blocking the UI; the biggest vulnerability callout reflects the user's actual LTC coverage or its absence; plan confidence never displays the same number as retirement confidence by construction.

### Phase 7 — Improve My Plan and Goal Seek

1. `improve-plan.ts` sweep + ranking; `goal-seek.ts` solver for all five objectives.
2. `improve/` UI: opportunity rows with `Try it`, Goal Seek panel with option rows including the combination option.

**Acceptance criteria:** Every opportunity's claimed impact matches the projection produced when its lever is actually applied — no drift between the promise and the result. Goal Seek returns at least three viable options for a reachable goal and an explicit `This goal isn't reachable with the levers we model` message when it is not.

### Phase 8 — MCP and AI

1. Scopes, schemas, contracts, cloud handlers, desktop gateway handlers, both registries.
2. `packages/ai-prompts/src/prompts/retirement.ts`; `ai-explore-section.tsx`; deep-link handling for `?scenario=<id>` on web and desktop.

**Acceptance criteria:** An agent can create a scenario, project it, and return a working deep link; opening that link lands on `/retirement` with the scenario active. Write tools are rejected for read-only client profiles. Tool descriptions instruct the model to call Moat rather than compute.

### Phase 9 — iOS

1. `apps/ios/Moat/Features/Retirement/` per the layout above; `MoreMenuSection.wealthManagement` entry.
2. Plan, What If, Scenarios and Risk surfaces.

**Acceptance criteria:** iOS renders the same numbers as web for the same user and scenario; pull-to-refresh follows the AGENTS.md rule; every numeric field has the dismiss toolbar; no direct PostHog calls.

---

## Acceptance Criteria

- [ ] `/retirement` exists on web and desktop, rendering `RetirementPage` from `@moat/features/retirement` with zero retirement UI components in either app directory.
- [ ] A user with connected accounts and no retirement input sees a complete baseline on first load, with every headline metric populated.
- [ ] All seven tabs render, and switching tabs preserves the active lever stack.
- [ ] Levers stack, reorder, disable, duplicate, and remove; conflicts surface override badges instead of silently dropping a lever.
- [ ] Every lever in the What-If library table is implemented in the engine and reachable from the UI.
- [ ] The impact delta table shows baseline, scenario, and change for all six summary metrics, with a deterministic explanation sentence.
- [ ] The custom lever builder compiles sentences into the same typed lever shapes the library uses — one code path, not two.
- [ ] Saved scenarios store only levers; re-opening one after balances change reflects the new balances with no user action.
- [ ] Baseline plus up to three scenarios overlay on one chart and align exactly with the comparison table.
- [ ] Retirement spending derives from trailing actual spending, split by treatment and essentiality, with persistable per-category overrides and spending stages.
- [ ] The retirement paycheck reconciles: gross − taxes = spendable, and monthly = annual ÷ 12, for every year.
- [ ] Monte Carlo reports trial counts alongside the percentage and renders a percentile cone, never a single deterministic line.
- [ ] Plan confidence is computed and displayed separately from retirement confidence, with each missing input actionable and deep-linked.
- [ ] Stress tests run the full adverse catalog and name a single biggest vulnerability, wired to the user's real insurance coverage.
- [ ] Improve My Plan opportunities, when applied, reproduce exactly the impact they claimed.
- [ ] Goal Seek returns actionable lever stacks for all five objectives, or explicitly reports unreachability.
- [ ] All nine MCP tools are registered in both the cloud and desktop gateway registries, sharing `RetirementLeverSchema` with the API.
- [ ] An MCP-created scenario returns a deep link that opens the scenario in the app.
- [ ] iOS ships Plan, What If, Scenarios and Risk, matching web's numbers for the same user and scenario.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm run ci:analytics` all pass.
- [ ] No balance, projection, lever param, age, or coverage value appears in any log line.

---

## Non-Goals

- **Advanced Roth conversion optimization** across thousands of multi-year ladder combinations. V1 identifies and sizes the window; it does not solve the ladder.
- **ACA subsidy optimization**, **IRMAA optimization**, **capital-gains harvesting**, **QCD strategy**, **NUA analysis**, **inherited-IRA strategy**, **estate-tax optimization**, **advanced annuity optimization**, and **tax-lot-level optimization**. All V1.5/V2. The lever architecture must accommodate them without redesign, but none ship here.
- **Merging or replacing the existing `/what-if` page.** That is a monthly cash-flow sandbox with a different job. It stays.
- **Replacing `ForecastScenario`.** The rate-preset entity and the `/scenarios` page remain as they are, feeding retirement as an input.
- **A `Goal` entity.** [backlog/goals/spec.md](../../backlog/goals/spec.md) and [docs/goals-feature.md](../../../docs/goals-feature.md) remain separate work. Retirement's Goal Seek is a solver, not a persisted goal tracker.
- **Moat-native chat.** AI integration is handoff to the user's connected agent plus MCP tools. No chat UI in this page.
- **Full iOS parity in V1.** Custom sentence builder, Goal Seek, and the tax timeline are web/desktop-first.
- **Advisor/CFP-grade tax filing accuracy.** Tax estimates are bracket-based projections for planning, not tax preparation, and the UI never implies otherwise.
- **Manual plan entry as a primary path.** Users may override any derived input, but nothing is required before seeing a plan.

---

## Open Questions

1. **`InvestmentType` is incomplete for retirement.** It has `STOCKS \| REAL_ESTATE \| ROTH_IRA \| FOUR01K \| HSA \| OTHER` but no `TRADITIONAL_IRA`, `FOUR03B`, `FOUR57B`, `TAXABLE`, or `FIVE29`. Tax treatment is the single most important account attribute in this engine. Do we extend the enum (a migration touching existing rows) or add a separate `taxTreatment` field that defaults from `InvestmentType`? Recommendation: add `taxTreatment`, because it decouples "what kind of account" from "how is it taxed" and avoids re-litigating the enum every time a new account type appears.
2. **Where do Social Security estimates come from?** V1 assumes manual entry of the FRA benefit. Should we estimate it from earnings history inferred from payroll transactions, clearly labeled as an estimate? That would materially raise first-load quality but risks anchoring users on a wrong number.
3. **Does Retirement earn a root iOS tab,** or does it live under More → Wealth Management alongside Investments and Scenarios? The five existing tabs are all full; promoting Retirement means demoting something.
4. **Household modeling depth.** `RetirementPlan` models one spouse. Moat has a household/profile rollup ([features/profile-net-worth-rollup/](../profile-net-worth-rollup/)). Should retirement project per-profile and roll up, or model the household as one unit with a spouse? V1 assumes one unit with a spouse.
5. **Cloud vs local projection on desktop when policies are `localPrivate`.** The proposal is that the desktop engine reads local policies and the cloud engine flags their absence. Is that acceptable, or should desktop always project locally to guarantee one consistent number?
6. **Monte Carlo return model.** Log-normal with a single mean/volatility, historical bootstrap, or regime-switching? Bootstrap is more defensible but requires shipping a return dataset. V1 assumes log-normal with volatility derived from `riskTolerance`.
7. **How long do we cache projections server-side,** and do we precompute the baseline on balance-sync completion so the page is warm on open?
8. **Should saved scenarios notify on material drift** — e.g. "Your 'Retire Early' plan dropped from 82% to 71% confidence since you saved it"? This connects naturally to [features/alerts-summaries-monitoring/](../alerts-summaries-monitoring/) but expands scope.

---

## Related Specs

- [forecast-audit.md](./forecast-audit.md) — Code-level audit of the live engine vs a Standard-scenario run ($562k → $15.2M, P10=P25 floor, $13.5M vs $15.18M, 71%/age 60/age 52)
- [specs/backlog/goals/spec.md](../../backlog/goals/spec.md) — Goals feature; shares the projection substrate built here
- [docs/goals-feature.md](../../../docs/goals-feature.md) — Goals PRD with proposed `Goal` / `GoalAccountAllocation` models
- [specs/complete/shared-onboarding/spec.md](../../complete/shared-onboarding/spec.md) — the shared-package boundary pattern this spec follows
- [specs/complete/insurance-profile/spec.md](../../complete/insurance-profile/spec.md) and [specs/complete/insurance-overhaul/](../../complete/insurance-overhaul/) — the `InsurancePolicyV2` model the insurance and LTC levers consume
- [specs/features/inline-rule-sentence-builder/spec.md](../inline-rule-sentence-builder/spec.md) — the sentence-builder UI language reused by the custom lever builder
- [specs/features/profile-net-worth-rollup/spec.md](../profile-net-worth-rollup/spec.md) — household rollup, relevant to Open Question 4
- [specs/complete/mcp-financial-writes/spec.md](../../complete/mcp-financial-writes/spec.md) — confirmation and scope rules the retirement write tools follow
- [specs/features/alerts-summaries-monitoring/spec.md](../alerts-summaries-monitoring/spec.md) — relevant to Open Question 8
- [apps/api/docs/patterns/prisma-and-migrations.md](../../../apps/api/docs/patterns/prisma-and-migrations.md) — migration workflow for the new models

---

## Suggested Commit Message

```text
docs: adds retirement v1 spec
```
