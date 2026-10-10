# Retirement Edit Plan Assumptions

## Status

Draft. Created 2026-08-27 after reviewing the live Edit plan panel, Financial Profile Assumptions, the retirement baseline builder, and related forecast specs. Updated the same day after a second engine pass (expense growth unwired, `contributionChange` is used, profile save does not invalidate retirement). **Decision 2026-08-27:** dual-write. Update rates in one place, they cascade to Edit plan, Financial Profile Assumptions, and the active Forecast Scenario.

## Goal

Make **Edit plan** the place a user adjusts the numbers that actually drive retirement confidence, net worth, taxes, risk, and the stacked projection, without leaving for Financial Profile.

The 3% → 4% real-estate example is the job-to-be-done: the user is already staring at the planner, they tap Edit plan, they change the assumption, the charts move.

Success means:

- Edit plan shows the **effective** rates the engine is using (not a stale copy that Forecast Scenario silently overrides)
- Changing inflation, returns, real-estate appreciation, cash yield, or forecast style from the panel updates the planner on save, and overlapping rates also write the active Forecast Scenario and Financial Profile Assumptions
- The Scenarios page and Assumptions card copy say this cascade out loud (they currently imply scenario overrides stay local)
- Each property and each non-housing debt is a collapsible card with loan terms (rate, term, start, payment) editable in place
- We do **not** extract Financial Profile into a shared component library. The panel stays in `plan-settings-panel.tsx` and calls the mutations that already exist

## Product Context

Retirement is supposed to be "interrogate my own future" ([retirement spec](../retirement/spec.md)). Today the interrogation UI is rich, but the knobs that change the math are scattered:

| User intent | Where they have to go today |
|-------------|------------------------------|
| Retire at 60, claim SS at 67 | Edit plan (works) |
| Real estate grows 4% not 3% | Financial Profile → Assumptions (bottom of a long page) |
| Inflation / salary / portfolio return | Financial Profile Assumptions **or** `/scenarios` active Forecast Scenario, and the engine prefers the scenario |
| Mortgage term / rate | Property editor or liability side panel |
| Filing status / state tax | Financial Profile tax section |
| Forecast style (volatility) | Financial Profile Assumptions |

That scatter is why the planner feels like a black box. The What-If stack is for **hypotheticals**. Edit plan should be for **"this is my real life, and these are the assumptions baked into it."**

## Current Repo Context

### What Edit plan already edits

`packages/features/src/retirement/plan/plan-settings-panel.tsx` + `plan-settings-form.ts`, saved via `updatePlan` (`UpdateRetirementPlanInput` in `packages/contracts/src/retirement.ts`).

Always visible:

- Birth year, target retirement age, planning horizon, SS claim age, SS at FRA ($/mo)
- Insights employment income (read-only, link out)
- Include spouse + spouse timeline / SS / income split

Already on the **plan record** but **not in the panel**: `confidenceTarget`, `monteCarloTrials`, `spendingStages`, `withdrawalOrder`. Withdrawal order is shown read-only on the Withdrawals tab (`withdrawal-order-card.tsx`).

### Three overlapping rate stores (this is the bug)

Retirement baseline (`packages/domain/src/retirement/build-baseline.ts`) resolves rates like this:

```text
returnRate     = active ForecastScenario.investmentReturn
                 ?? ForecastAssumptions.investmentReturnRate
                 ?? PORTFOLIO_PROFILES[forecastStyle].returnRate

inflationRate  = active ForecastScenario.inflationRate
                 ?? ForecastAssumptions.inflationRate

incomeGrowth   = active ForecastScenario.salaryGrowth
                 ?? ForecastAssumptions.incomeGrowthRate

expenseGrowth  = active ForecastScenario.expenseGrowth
                 ?? inflationRate

RE appreciation = ForecastAssumptions.realEstateAppreciationRate
                  (then per-property appreciationRate if set)

cashYield      = ForecastAssumptions.defaultCashYield
volatility     = PORTFOLIO_PROFILES[forecastStyle]
```

`ForecastScenario.contributionChange` **is** used: it grows 401(k) / Roth / taxable contribution *targets* (`contributionGrowthRate = scenario.contributionChange ?? incomeGrowthRate`). It is not a profile field. Keep it on `/scenarios`, not Edit plan.

**Profile `expenseGrowthRate` is a trap.** `toRetirementPlanningContext` does not pass it through. Engine expense growth is `activeScenario.expenseGrowth ?? inflationRate`. Property `expenseGrowthRate` falls back to **inflation**, not the profile expense field. Do not put a profile expense-growth input in Edit plan until that is wired (or only show the effective engine value, which today is inflation unless a scenario supplies `expenseGrowth`).

So: changing real estate 3% → 4% on Financial Profile **does** hit the planner (cache caveat below). Changing inflation on Financial Profile **does not**, if an active Forecast Scenario exists (seeded Standard is 7% return / 3% inflation / 3% salary / 2% contribution change / 3% expenses).

Profile percents are stored as `3.0` meaning 3% and converted to `0.03` in `toRetirementPlanningContext` (`onboarding-seeds` tests). Scenario rows are already decimals.

### Complete assumption inventory

How to read **Affects**: C = chance of success (Monte Carlo), NW = projected net worth / Overview stacked chart, T = taxes tab, R = risk tab, CF = cash flow / income / withdrawals tabs.

#### A. Timeline & household (Edit plan today)

| Field | Default | Store | Affects |
|-------|---------|-------|---------|
| Birth year | empty (age hint 40) | `RetirementPlan` | C NW T R CF — ages every year of the ledger |
| Target retirement age | 65 | `RetirementPlan` (profile also has `forecastAssumptions.retirementAge`) | C NW T R CF |
| Planning horizon | 95 | `RetirementPlan` | C NW T R CF |
| SS claim age | 67 | `RetirementPlan` | C NW T CF |
| SS at FRA $/mo | estimated if empty | `RetirementPlan` | C NW T CF |
| Has spouse + spouse ages / SS / income split | off | `RetirementPlan` | C NW T R CF |
| Employment income | Insights trailing | Insights; split stored on plan | C NW T CF |

#### B. Global growth rates (Financial Profile Assumptions)

UI: `packages/features/src/financial-profile/section-components/assumptions-section.tsx`, fields in `field-options.ts` `assumptionFields`. Copy: "Global forecast behavior that affects projections throughout Moat."

Typical seeded values (profile stores percents; engine uses decimals): inflation 3, income growth 3, expense growth 3 (unwired), investment return 7, real estate 3, cash yield **4.5** (mapping fallback **4%** if missing), style Balanced.

| Field | Engine use | Affects | In Edit plan? |
|-------|------------|---------|---------------|
| Inflation rate | Grows retirement spending, SS COLA path, healthcare via `HEALTHCARE_INFLATION_PREMIUM` | C NW T R CF | No |
| Income growth rate | Grows employment income / Insights net during accumulation. **Overridden by scenario `salaryGrowth`.** | C NW T R CF | No |
| Expense growth rate | **Unwired.** Profile field is not in `toRetirementPlanningContext`. Engine uses scenario `expenseGrowth` else inflation. Property opex growth also falls back to inflation. | — until wired | Skip |
| Investment return rate | Fallback when no active scenario and no per-account rate | C NW R | No |
| Real estate appreciation | Fallback for every property without its own `appreciationRate` | C NW (RE slice of the stack) | No |
| Default cash yield | Cash bucket grows at this rate (`project.ts`), not at portfolio return | C NW R | No |
| Forecast style | Conservative / Balanced / Aggressive → volatility 8% / 13% / 18% and fallback return 5% / 7% / 8.5% (`PORTFOLIO_PROFILES`) | C R (and NW if no scenario return) | No |
| Retirement age | Duplicate of plan target; planner uses the plan | — | Skip (already have target age) |

#### C. Active Forecast Scenario (`/scenarios`)

`ForecastScenario`: Conservative 4/4/1, Standard 7/3/3, Aggressive 10/2/6 (return / inflation / salary). Seeded in `apps/api/src/server/handlers/scenario.ts`.

Wins over profile for return, inflation, salary, contribution change, and expense. Recorded on the projection as `assumptions.scenarioRatesSource` (`ForecastScenario:{name}` or `"ForecastAssumptions"`). This is why Edit plan must show **effective** rates.

`ForecastScenario.updatedAt` is **not** in `getBaselineVersion`. Editing the active scenario can theoretically serve a stale 5-minute projection until something else bumps the version. Profile assumption edits *do* bump `financialProfileData.updatedAt`.

Financial Profile save currently **does not** `invalidateQueries(["retirement"])`. A user already on `/retirement` may not see a profile-only change until remount or refetch. Edit plan save **must** invalidate `["retirement"]` and `["financialProfileData","get"]`.

#### D. Per-account investment assumptions

`monthlyContribution`, `annualReturnRate` / `expectedReturn` on Plaid + manual investments. Weighted into `bucketReturns`. Spec: [synced-account-forecast-assumptions](../synced-account-forecast-assumptions/spec.md). Live in account details, not Edit plan.

Retirement still dumps Insights net into tax buckets; contributions are a floor/reallocation, not extra cash on top (see [forecast-audit](../retirement/forecast-audit.md)).

#### E. Real estate & mortgages

`RealEstateInvestment` (`packages/data-access/src/types.ts`): value, loan balance, rate, term years, remaining months, payment, rent, vacancy, expenses, per-property `appreciationRate` / `expenseGrowthRate`, linked Plaid loan. Property `forecastScenario` (MODERATE / STANDARD / AGGRESSIVE) drives the **real-estate chart only**, not the retirement ledger (retirement uses the explicit rates). Extra principal is **not** a profile field; `ProjectedProperty.extraMonthlyPayment` defaults to 0 and is only set by What-If `mortgage_extra_payment` / `mortgage_payoff_early`.

Projected in `toProjectedProperty` (`build-baseline.ts`). Remaining term prefers `remainingTermMonths`, else solves from payment/rate.

Housing debt that is a profile liability generated from the property, or a Plaid mortgage linked (or guessed by kind + outstanding property loan), is **not** double-counted in `assembleProjectedLiabilities`.

#### F. Other debts (profile liabilities + leftover synced loans)

`ProfileLiability`: balance, interest rate, monthly payment, `loanStartDate`, `loanTermYears`, legacy `payoffDate`, `autoUpdateBalance`, `includeInForecast`. Remaining term via `resolveRemainingTermMonths` (start + term preferred). Spec: [manual-liability-balance-amortization](../manual-liability-balance-amortization/spec.md).

Synced debt accounts that are **not** covered by a property currently project as balance-only (`annualInterestRate: 0`, `monthlyPayment: 0`) in `toProjectedLiabilityFromAccount`. That is the "synced mortgage with no terms" hole. Edit plan should let the user attach terms (on the profile liability / property), not invent a second debt model.

#### G. Taxes

`TaxProfile`: filing status, estimated federal bracket, estimated state tax rate, deduction strategy, self-employed / rental flags.

Engine uses `normalizeFilingStatus(filingStatus)` + `stateTaxRate`. Federal brackets, standard deduction, senior extra, RMD table, SS taxability are **hardcoded 2026 constants** in `packages/domain/src/retirement/constants.ts` (`RETIREMENT_TAX_YEAR = 2026`). Estimated federal bracket on the profile is not the engine's bracket table.

#### H. Spending, healthcare, withdrawals

| Input | Source | Affects |
|-------|--------|---------|
| Trailing spend / net | Insights, 12 months (`SPENDING_BASELINE_MONTHS`) | C NW CF |
| Essential share | Classified categories, else 65% | C R |
| `spendingStages` | Plan record, not in Edit plan | C NW CF |
| Healthcare | Trailing healthcare categories; pre-Medicare $950/adult/mo; healthcare inflation = inflation + 2% | C NW T CF |
| Withdrawal order | Plan record, default taxable → deferred → tax-free | T CF |
| RMDs | Birth year → 73 or 75 | T CF NW |

#### I. Simulation (mostly constants)

| Input | Default | User-editable today? |
|-------|---------|----------------------|
| Monte Carlo trials | 1000 (max 2000) | On plan record, not in UI |
| Confidence target | 85% | On plan record, not in UI |
| Return volatility | From forecast style | Only via profile style |
| Employer match (unmodeled flag) | 50% up to 6% of salary | No |
| Home sale cost | 6% | No (housing levers) |
| Assumed mortgage for a *new* buy lever | 6.5%, 30yr, 20% down | No |
| Property expense / rent / vacancy fallbacks for new properties | 2% / 0.6%/mo / 5% | No |

### What each planner surface actually reads

All of these are views of the same `RetirementProjection` / Monte Carlo result. There is no separate assumptions pipeline per tab.

| Surface | Driven by |
|---------|-----------|
| Chance of success | Monte Carlo: return + volatility (style) + spending + SS + taxes + RE floor + debts |
| Overview stacked net worth | Liquid mix + tax buckets + RE equity − debts; RE uses appreciation + amortization |
| Taxes tab | Year ledger: ordinary / SS taxable / gains / RMDs / state; filing status + state rate + hardcoded federal |
| Risk tab | Same MC; sequence / percentile bands. RE is not shocked (audit: P10 can sit on the property floor) |
| Cash flow / income / withdrawals | Same year ledger: Insights net, SS, rent, withdrawal order, RMDs |

### Existing building blocks to reuse (and what not to extract)

| Asset | Location | Use it how |
|-------|----------|------------|
| Local `NumberField` | `plan-settings-panel.tsx` | Same money / percent / age inputs already in the panel |
| `Accordion` | `@moat/ui` (already used in `what-if-tab.tsx`) | Section and per-property / per-debt collapse |
| `assumptionFields` labels + help | `packages/features/src/financial-profile/field-options.ts` | Import the **config**, not `AssumptionsSection` |
| `updatePlan` | existing retirement mutation | Timeline, trials, withdrawal order, spending stages |
| Financial profile save | existing `onChange` / `updateFinancialProfileData` path | `forecastAssumptions`, `taxProfile`, `liabilities` |
| Real estate update | existing real-estate mutation | Per-property loan + appreciation |
| `mergeMortgageLiabilities` | financial profile GET | Keep generated mortgage rows in sync; loan term fields must keep surviving GET |

**Do not import** `AssumptionsSection`, `SectionCard`, `EditFieldsDialog`, or the real-estate wizard into the side panel. Those are page-scale profile chrome. Copy the field list and the save calls.

## Target Experience

Keep the current `SidePanel` `size="lg"`. Rename the subtitle from "Birth year, retirement age, and Social Security" to something like **"Ages, rates, and debts used in this projection."**

One save still at the footer. Sections are `Accordion` `type="multiple"` with Timeline + Growth open by default.

```text
┌ Edit plan ─────────────────────────────────────┐
│ Ages, rates, and debts used in this projection │
│                                                │
│ ▼ Timeline                                     │
│   (existing birth / retire / SS / spouse)      │
│                                                │
│ ▼ Growth rates                                 │
│   Inflation              [ 3.0 ] %             │
│   Income growth          [ 3.0 ] %             │
│   Investment return      [ 7.0 ] %             │
│   Real estate growth     [ 3.0 ] %             │
│   Cash yield             [ 4.5 ] %             │
│   Forecast style         Balanced ▾            │
│   Using Standard scenario rates                │
│   (if scenario is the source)                  │
│                                                │
│ ▶ Properties & mortgages (2)                   │
│     ▼ Primary home                             │
│       Value / equity                           │
│       Appreciation override  [ 4.0 ] %         │
│       ▶ Loan terms                             │
│         Balance  Rate  Term  Start  Payment    │
│     ▶ Cabin                                    │
│                                                │
│ ▶ Other debts (1)                              │
│     ▶ Auto loan   balance · rate · term        │
│                                                │
│ ▶ Taxes                                        │
│     Filing status    State tax rate            │
│                                                │
│ ▶ Simulation                                   │
│     Confidence target  Monte Carlo trials      │
│                                                │
│                        Cancel    Save plan     │
└────────────────────────────────────────────────┘
```

### Growth rates

- Show **effective** engine values (after scenario override), as percents matching profile (`3` not `0.03`)
- Help text can come from `assumptionFields`
- If an active Forecast Scenario is supplying return/inflation/salary/expense, show a one-line caption: `Using {name} scenario rates` so the 7%/3% Standard default is not a mystery
- Forecast style still matters when a scenario owns return: it changes Monte Carlo **volatility** (Balanced = 13%) even if return stays 7%
- Changing a rate the user can edit must change the planner. See Architecture (dual-write vs caption-and-link)
- Do **not** show profile expense growth until it is wired. If we show an expense row at all, bind it to the effective engine value (`scenario.expenseGrowth ?? inflation`)
- Do not show `contributionChange` here (used by the engine, lives on `/scenarios`)
- Do not show a second retirement age, and do **not** silently copy `targetRetirementAge` onto `forecastAssumptions.retirementAge` (seed logic only runs on a virgin plan)

### Properties & mortgages

One card per `RealEstateInvestment`. Collapsed row: name, current value, loan balance. Expanded:

- Always: estimated value, appreciation (blank = household default)
- Nested **Loan terms** (collapsed if balance is 0): current balance, interest rate, loan term years, remaining months or start date, monthly payment
- Optional second nest for rental: rent, vacancy, monthly expenses (only if usage is rental / mixed)
- Extra principal stays a What-If lever, not a field on this card

Synced vs manual:

- Linked Plaid loan: caption `Balance from {account}`. Terms are still planning inputs; we persist them on the property (and the mirrored profile liability via existing merge)
- Manual: all fields writable; `autoUpdateBalance` stays on the Financial Profile liability form, not duplicated here in v1

Empty: hide the section, or one line "No properties yet" with a link to Financial Profile. Do not embed the add-property wizard.

### Other debts

Profile liabilities with `includeInForecast` that are not generated mortgage rows, plus leftover synced debts that currently project as balance-only.

Collapsed: name, balance. Expanded: rate, monthly payment, loan start, term years. This is how a synced mortgage that *isn't* attached to a property gets terms.

### Taxes

Filing status + state income tax rate. Those are the two tax-profile fields the engine reads. Federal bracket / deduction strategy stay on Financial Profile (they do not drive the year ledger today).

### Simulation

Forecast style already lives in Growth. This section is `confidenceTarget` and `monteCarloTrials` (already on the plan, never exposed). Optional in phase 1.

Withdrawal order stays on the Withdrawals tab (already visible). Spending stages stay a What-If / spending-tab concern until we have a simpler control.

### After save

Close the panel. Invalidate `["retirement"]`, `["financialProfileData","get"]`, and `["scenarios"]`. Profile-only saves today skip retirement invalidation; Edit plan must not. No navigation to Financial Profile.

### Scenarios page copy (cascade)

Today the page implies scenarios are a sandbox. Under dual-write they are the shared rate bundle. Update copy in `packages/features/src/scenarios/`:

**Page subtitle** (`scenarios-page.tsx`, currently *Compare forecast assumptions for future planning.*):

> The active scenario’s rates apply everywhere: net worth forecasts, Financial Profile, and the retirement planner. Change them here or in Edit plan — they stay in sync.

**Active card** (`scenario-card.tsx`): under the Active badge, one muted line:

> Used for forecasts, profile assumptions, and retirement.

**Edit/create dialog** (`scenario-form-dialog.tsx`, currently *Set forecast assumptions for a planning case.*):

> These rates apply to forecasts, Financial Profile, and the retirement planner while this scenario is active.

Also rewrite the Financial Profile Assumptions callout (`assumptions-section.tsx`), which currently says scenario overrides can adjust rates *without changing your profile*:

> These rates are shared with your active forecast scenario and the retirement planner. Changing them here updates all three.

Edit plan Growth caption can stay `Using {name} scenario rates` as an orientation line, not as a warning that edits will no-op.

## Architecture / Data Model

No new tables. Edit plan becomes a **multi-store save** from one form.

| Widget | Writes |
|--------|--------|
| Timeline / spouse / SS | `updatePlan` (existing). Do **not** stuff rates into `UpdateRetirementPlanInput`. |
| Confidence / trials | `updatePlan` (fields already on the input) |
| Real estate growth, cash yield, forecast style | `updateFinancialProfileData` → `forecastAssumptions` (scenario has no RE / cash / style fields) |
| Inflation, income growth, investment return | Dual-write the active `ForecastScenario` **and** `ForecastAssumptions` (decided 2026-08-27) |
| Per-property value / loan / appreciation | existing real-estate mutation (`RealEstateInvestment` is the engine source for housing debt) |
| Other debts | `FinancialProfileData.liabilities` (same JSON the amortizer and `assembleProjectedLiabilities` already use) |
| Filing status / state rate | `TaxProfile` via `updateFinancialProfileData` |

One Save, **two mutations** (`updatePlan` + `updateFinancialProfileData`, plus real-estate updates when property cards changed, plus `updateScenario` when overlapping rates changed). Do not fork a third store. Do not silently copy `targetRetirementAge` onto `forecastAssumptions.retirementAge`.

### Dual-write (decided)

Update in one place, it cascades to all. Overlapping rates are:

| Rate | Forecast Scenario field | ForecastAssumptions field |
|------|-------------------------|---------------------------|
| Investment return | `investmentReturn` | `investmentReturnRate` |
| Inflation | `inflationRate` | `inflationRate` |
| Income / salary growth | `salaryGrowth` | `incomeGrowthRate` |
| Expense growth | `expenseGrowth` | `expenseGrowthRate` (write it even though retirement does not read the profile field yet) |

**Both directions:**

- Edit plan save of those four → active scenario + profile assumptions
- Financial Profile Assumptions save of those four → active scenario
- Scenarios page edit of the **active** scenario → profile assumptions
- **Set Active** on a scenario → copy that scenario's four rates onto profile assumptions so the profile card matches what the engine will use

Profile-only (no scenario column): real estate appreciation, cash yield, forecast style. Those still write `ForecastAssumptions` only.

`contributionChange` stays on the scenario (and `/scenarios` editor). Do not add it to Edit plan or the Assumptions card.

Percent vs decimal: profile stores `3`, scenario stores `0.03`. Convert at the boundary. Same `parseRateString` / `value > 1 ? /100` rule.

Invalidation after any of these writes: `["retirement"]`, `["financialProfileData","get"]`, `["scenarios"]`, plus the existing forecast consumers (`["investment"]`, `["balanceSnapshot"]`). Today `invalidateForecastConsumers` in `scenarios-page.tsx` does **not** invalidate retirement. That is part of this work.

Do not invent retirement-only overrides.

### Percent vs decimal

Write profile assumptions in the same unit the profile UI already stores (3 = 3%). Write Forecast Scenario in decimals (0.03), matching `seedDefaults`. Reuse `toRetirementPlanningContext` conversion on the read path; do not add a third convention.

## Implementation Plan

Stay inside `plan-settings-panel.tsx` / a sibling `plan-settings-assumptions.tsx` if the file gets long. No shared "assumption atom" package.

### Phase 1 — Growth rates (the 3% → 4% case)

1. Load `forecastAssumptions`, active `ForecastScenario`, and `forecastStyle` next to the existing plan query (or from the overview payload if already present).
2. Render the Growth accordion with effective rates.
3. Save: `updateFinancialProfileData` for profile rates. Dual-write overlapping rates onto the active Forecast Scenario. Same cascade from Scenarios edit / Set Active and from the Assumptions card.
4. Update Scenarios page + Assumptions callout copy as specified. Invalidate retirement + profile + scenarios queries.
5. Target retirement age remains the plan field only.

**Acceptance:** Changing real estate 3 → 4 in Edit plan moves the Overview RE slice. Changing inflation in Edit plan, on the Assumptions card, or on the active scenario all move spending / SS / confidence and show the same number in the other two places. Retirement queries invalidate on save.

### Phase 2 — Properties & mortgages

1. List properties from the same sources the baseline uses.
2. Collapsible card + nested loan terms. Persist through the existing real-estate mutation.
3. Caption synced balances. Do not build a new mortgage entity.

**Acceptance:** Editing term / rate / payment on a manual or linked mortgage changes remaining term and the NW stack. Generated profile mortgage rows still survive `financialProfile/get` (loanTermYears, loanStartDate, auto-update).

### Phase 3 — Other debts + taxes

1. Other-debt cards writing `ProfileLiability`.
2. Filing status + state rate writing `TaxProfile`.
3. Synced leftover loans can gain terms here so they stop projecting as zero-rate balloons.

### Phase 4 — Simulation (optional)

Expose `confidenceTarget` and `monteCarloTrials`. Leave withdrawal order and spending stages where they are.

## Acceptance Criteria

- [ ] Edit plan Growth section shows the effective inflation, income growth, investment return, real estate appreciation, cash yield, and forecast style (not unwired profile expense growth)
- [ ] Saving profile-owned rates (RE, cash, style) updates the retirement projection without visiting Financial Profile, including `["retirement"]` invalidation
- [ ] Overlapping rates dual-write: Edit plan, Assumptions card, and the active scenario stay in sync (both directions, including Set Active)
- [ ] Scenarios page subtitle, active-card line, and edit-dialog description state the cascade; Assumptions callout no longer says overrides stay local
- [ ] Real estate 3% → 4% from Edit plan changes property paths on Overview / confidence
- [ ] Forecast style help text says it drives Monte Carlo volatility even when return comes from a scenario
- [ ] Properties & mortgages is a collapsed accordion of per-property cards; loan terms are a nested collapse (balance, rate, term years, start or remaining months, payment)
- [ ] Other non-housing debts are the same card pattern
- [ ] Taxes section edits filing status and state rate only
- [ ] One Save still commits the whole panel
- [ ] No new shared component extraction of AssumptionsSection / SectionCard / EditFieldsDialog
- [ ] Statutory constants (brackets, RMD table, $950 pre-Medicare, 6% sale cost) are not editable here

## Non-Goals

- Rebuilding Financial Profile inside the drawer
- Per-account contribution / return editors (stay on account details; see synced-account-forecast-assumptions)
- Add-property / add-liability wizards in the panel
- Retirement-only rate overrides that diverge from `/scenarios` (unless we reopen that question)
- Shocking real estate in Monte Carlo (known audit gap; not this spec)
- iOS Edit plan parity
- Surfacing `contributionChange` in Edit plan (it already drives contribution target growth; leave it on `/scenarios`)
- Making estimated federal bracket or deduction strategy drive the engine
- Showing profile expense growth before it is wired into `toRetirementPlanningContext`
- Extra-principal editors (What-If levers already exist)
- Extracting a design-system "AssumptionRow"
- Silently syncing plan target retirement age with `forecastAssumptions.retirementAge`

## Open Questions

1. **Dual-write vs caption-and-link.** **Decided: dual-write, both directions.** Edit plan, Financial Profile Assumptions, and the active scenario stay in sync. Scenarios + Assumptions copy must say so.
2. **Should Growth be open by default?** Recommendation: yes, next to Timeline. That is the 3% → 4% path.
3. **Simulation in v1?** Trials and confidence target are already on the plan. Easy to add; easy to skip so the panel does not look like a quant console.
4. **Spending stages in this panel or only What-If?** They change the planner a lot but are a different job ("my retirement lifestyle") than rates and debts.
5. **Caption vs dropdown for Forecast Scenario.** Caption in phase 1; a Conservative / Standard / Aggressive `setActive` switch is a one-line add if the caption is not enough.
6. **Wire profile expense growth?** Only if we want a household expense rate distinct from inflation. Until then, omit the field.

## Related Specs

- [retirement/spec.md](../retirement/spec.md) — baseline + levers model; ForecastScenario is an input, not the retirement scenario
- [retirement/forecast-audit.md](../retirement/forecast-audit.md) — which rates actually bind, cash vs 7%, RE floor in Monte Carlo
- [synced-account-forecast-assumptions/spec.md](../synced-account-forecast-assumptions/spec.md) — per-account contribution / return
- [manual-liability-balance-amortization/spec.md](../manual-liability-balance-amortization/spec.md) — loan start + term, auto-update
- [profile-net-worth-rollup/spec.md](../profile-net-worth-rollup/spec.md) — what shows up in net worth vs forecast

## Suggested Commit Message

```text
docs (retirement): adds edit-plan assumptions spec
```
