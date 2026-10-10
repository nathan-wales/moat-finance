# Prompt: Retirement planner calculation audit + fix plan

Your job is to audit every retirement-planner calculation in this repo and write a plan of what to fix. You are not shipping a rewrite in this pass.

Note that I am just as interested in your thoughts on how to architect this in a way that we can add more scenarios as I am in getting the calculations right. Although getting the calculations right is very very important.

## Hard rules

- Repo (local, already on disk): `/Users/tylersmith/Documents/personal/moat-finance`
- **Do not clone.** Do not create a second checkout. Do not commit. Do not push.
- **Do not implement the fixes in this pass.** Read, trace, run tests, do napkin math against the year ledger. Then write **one plan file**.
- Plan output path (create/overwrite): `specs/features/retirement-calculation-audit/plan.md`
- Work on Tyler's Mac. Code lives only there, not on GitHub.
- Insights page is **read-only hydration** for the planner. What-If levers are **scenario-local**. Edit plan **cascades** to Financial Profile + active ForecastScenario. Do not recommend writing Insights from levers.

If you need to run tests: domain package `tsx --test` (see `packages/domain/package.json`). Do not "fix" unrelated failures by weakening assertions.

---

## What I want from you

I has been iterating the retirement forecast all day. Several identities were wrong, then patched, then replaced. He does **not** trust the numbers yet.

I want you to:

1. Get fully caught up on **baseline** and **scenario builder** code (map below).
2. Review the architecture in the backend and suggestion improvements to allow us to scale and mix well all the many factors going into these calculations.
2. Double-check **all** calculations that feed the planner: leftover, spend, wages, mortgage/debt, taxes, contributions, cash vs stocks, SS, RMD, withdrawals, Monte Carlo, earliest-retirement, Goal Seek, stress, compare, charts/inspector units (annual vs monthly).
3. Write `specs/features/retirement-calculation-audit/plan.md`: what is wrong, why, file:line, the correct formula, severity, and a sequenced fix plan. Include "correct, leave it" items so he can see you actually checked.

He will review the plan before anyone implements.

---

## Product rules (lock these)

These are decisions Tyler already made. Audit whether the **code matches them**. If code disagrees, that is a finding. If a rule itself is internally inconsistent, call it out as an open question — do not silently pick a third identity.

1. **Working-year leftover (current intended identity)**  
   Every year, accumulation **and** retired:
   ```
   leftover = cashIn − cashOut − cashFlowTax    // signed
   ```
   This is `cashFlowLeftover` on the year row (`project.ts`). Insights net is **not** the savings driver. `preRetirementAnnualNetIncome` is hydrated for debug; `projectRetirement` must not read it as leftover.

2. **Insights hydrates, does not write.** Trailing 12-month Insights spend (`SPENDING_BASELINE_MONTHS = 12`) and employment pie are defaults. Planner does not write the Insights page.

3. **Income and spend are independent.** Editing My income / spouse income does not change spend. Spouse/primary stop-working gates **wages only**. Household spend stays put.

4. **My income $10,000 is annual take-home, not monthly.** `10_000/12 − 13_024 ≈ −$12,191/month`. Treating $10k as monthly (leftover ≈ −$3,024/mo) is a fail.

5. **Do not double-count mortgage.** Trailing Insights spend includes P&I. Engine carves housing/healthcare/insurance/other-debt out of living, then models those lines itself. When `loanBalance` hits 0, leftover improves by **P&I only**, not 2× P&I. P&I does not inflate; living inflates with expense growth.

6. **Negative leftover is allowed.** Draw cash, then taxable stocks, then deferred, then Roth (`DEFAULT_WITHDRAWAL_ORDER` + `splitTaxableWithdrawal` cash-first). Do not clamp leftover to 0. Do not 401(k) in a year leftover < 0. If `0 ≤ leftover < planned`, clip planned to leftover (deferred, then tax-free, then taxable). If leftover > planned: planned in full, residual to **cash** at cash yield, **not** stocks.

7. **What-If / scenario builder is local.** A saved scenario is `live baseline + ordered typed levers`. `applyLevers` clones inputs and never mutates baseline. Persist path is the lever list only. `spouse_stops_working` / `stop_working_at_age` must not write Financial Profile, Insights, or Plaid.

8. **Edit plan cascades.** `PlanSettingsPanel.handleSave` → `updateRetirementPlan` + `writeOverlappingRatesToBothStores` (profile + active ForecastScenario) + real estate / investments. That **should** affect the whole app's overlapping rates. Do not break it. Do not route What-If through that path.

9. **Superseded (do not reopen):** scaling Insights net by remaining/baseline wages (`employmentShareOfSavingsNet`). Helper is deleted. Spec `retirement-employment-share-savings` is historical. If you find it still driving leftover, that is a P0 bug.

10. **Units in the UI.** Inspector "Added to savings" is annual. "Monthly cash flow" is `cashFlowLeftover / 12`, signed, labeled monthly. Do not make Tyler divide by 12.

---

## How the pipeline actually works

```
buildRetirementBaseline()          // every request, live twin
  → (applyLevers(baseline, stack) if scenario/what-if)
  → projectRetirement(inputs)      // deterministic year ledger
  → buildRetirementProjection()    // wire shape, today-dollars, earliest age
```

Overview first paint: `getRetirementPlanOverview` = baseline + `levers: []` + deterministic only. Monte Carlo is a second query wrapping the **same** `projectRetirement`.

A scenario is **not** a snapshot of balances. Reopen = **today's** baseline + saved lever stack.

---

## File map (read these; this is the whole surface)

Repo root: `/Users/tylersmith/Documents/personal/moat-finance`

### Specs (read first, in this order)

- `specs/features/retirement/spec.md` — canonical product: live twin + stackable what-if
- `specs/features/retirement-accumulation-income-spend/spec.md` — **current leftover identity** (income − spend − tax; 12mo spend; mortgage carve; clip planned)
- `specs/features/retirement-surplus-to-savings/spec.md` — residual → cash, not stocks
- `specs/features/retirement-edit-plan-assumptions/spec.md` — Edit plan dual-write
- `specs/features/retirement-employment-share-savings/spec.md` — **superseded**, do not implement
- `specs/features/retirement-impact-suggestions/spec.md`
- `specs/features/retirement-catalog-draft-creator/spec.md`
- `specs/features/retirement/forecast-audit.md` — prior assumption notes; do not treat as current identity

### Engine — `packages/domain/src/retirement/`

**Must read line-by-line for the audit:**

| File | Why |
|------|-----|
| `project.ts` | Year ledger. Leftover, cashIn/cashOut, tax skip, clip planned, residual to cash, housing P&I, other-debt, withdrawals, RMD, growth. **This is the math.** |
| `build-baseline.ts` | Live baseline. Insights 12mo, carve-outs (`toEngineMonthlySpend`), employment pie, `preRetirementAnnualNetIncome` (debug only), cash yield, rates from ForecastScenario |
| `apply-levers.ts` | Pure lever fold. Confirm wage levers do not write spend or Insights net |
| `build-projection.ts` | applyLevers + projectRetirement → wire projection |
| `projectRetirementScenario.ts` | Ad-hoc/saved stack |
| `getRetirementPlanOverview.ts` | Empty-lever first paint |
| `types.ts` | `RetirementPlanInputs` field meanings |
| `retirement-savings-net.ts` | Strips investment yield from Insights net (must not drive leftover) |
| `constants.ts` | Withdrawal order, contribution limits, `SPENDING_BASELINE_MONTHS` |
| `amortize.ts` / `assemble-liabilities.ts` | Loan payoff; other-debt payments |
| `withdrawal-order.ts` | resolveWithdrawals |
| `taxes.ts` | Brackets; accumulation vs retired cash-flow tax |
| `rmd.ts` / `social-security.ts` | RMD / FRA |
| `spending-translation.ts` | Trailing spend → retirement lifestyle (retired living, not accumulation living) |
| `monte-carlo.ts` / `runRetirementMonteCarlo.ts` | Same ledger, seeded returns |
| `earliest-retirement.ts` / `safe-spending.ts` / `goal-seek.ts` / `solveRetirementGoal.ts` | Solvers on the same leftover |
| `stress-test.ts` / `runRetirementStressTests.ts` | Adverse stacks |
| `compareRetirementScenarios.ts` | Baseline vs ≤3 saved |
| `headline.ts` / `plan-confidence.ts` | Verdicts derived from the ledger |
| `suggest-levers.ts` / `improve-plan.ts` / `default-lever.ts` / `describe-lever.ts` | Copy + ranking; ranking must not assume old Insights-net identity |
| `liquid-type-mix.ts` | Chart buckets (cash vs stocks) |
| `weighted-bucket-returns.test.ts` + `weightedCashYield` in build-baseline | Cash yield vs portfolio return |
| `retirement-engine.test.ts` | Current identity tests; **also** hunt tests that still encode Insights-net leftover or wage-share leftover |
| `retirementPlanSettings.ts` / `retirementScenarios.ts` / `retirementSpendingPlan.ts` | Persistence facades. Scenarios = levers only |

`employment-share.ts` should be **gone**. If it is back, that is a finding.

### UI — `packages/features/src/retirement/`

Entry: `retirement-page.tsx`, `retirement-store.ts`, `use-retirement-queries.ts`.

- **Edit plan:** `plan/plan-settings-panel.tsx` (cascade), `plan-settings-form.ts` (`applyLinkedIncomeSplit`, annual wages), `plan-settings-assumptions.tsx`
- **Inspector / savings path:** `plan/year-inspector.tsx` (`cashFlowLeftover / 12`), `plan/savings-path-table.tsx`
- **Overview chart:** `plan/overview-section.tsx` → `packages/charts/src/projected-net-worth-chart.tsx` (Cash series, Retirement dotted line, milestones)
- **Scenario builder:** `scenarios/scenario-bar.tsx`, `what-if/*` (stack, catalog, custom-builder, `compile-custom-lever.ts`, suggested, impact-table)
- **Spending tab:** `spending/spending-tab.tsx` — retirement treatment, **not** accumulation spend editor
- Adjacent: `packages/features/src/forecast-rate-cascade.ts` (`writeOverlappingRatesToBothStores`)

### Contracts / hosts

- `packages/contracts/src/retirement.ts` — `cashFlowLeftover` on the year schema, lever union
- `packages/contracts/src/ipc/retirement.ts`
- `apps/api/src/server/handlers/retirement.ts` + `services/retirement.service.ts`
- `apps/desktop/src/main/ipc/retirement.ts`
- `apps/web/src/app/(dashboard)/retirement/page.tsx`
- `apps/desktop/src/renderer/src/pages/retirement.tsx`

Insights (hydrate only, do not treat as a second engine):

- `packages/domain/src/dashboard/get-net-income.ts`
- `apps/api/src/lib/insights/net-income-service.ts`
- `packages/features/src/insights/`

---

## Recent history (so you do not re-litigate)

On 2026-08-28 Tyler and Cody (this session) found and changed:

1. **Surplus leftover was auto-invested into taxable stocks.** Spec + impl: residual → `cashBalance` at `cashYield`. Planned 401(k)/Roth/brokerage still go to those buckets. Keep this.
2. **Chart "Other" relabeled Cash.** Series key still `other`.
3. **Cash-yield save rewrote inflation / salary / investment return** onto the ForecastScenario. Fix: skip-if-unchanged in `forecast-rate-cascade.ts`. Keep this. Do not `ratePercentToDecimal` on cash yield (3 means 3%).
4. **Spouse-out at 30 barely moved $21M.** Root cause: accumulation saved Insights net; wage columns were display; spend was display-only until `isRetired`. A wage-share-of-net patch shipped, then Tyler rejected it because spend does not scale with who works. **Deleted.** Current identity is income − composed spend.
5. **Worked example that must still hold:** primary **$10,000/year**, spouse **$246,025** out at 30, headline Insights spend **$13,024/month** (includes mortgage) → leftover **−$146,288/year ≈ −$12,191/month**, `contributionsCash === 0`, taxable withdrawals > 0, spend does not shrink. After mortgage payoff, leftover improves by P&I, living unchanged, **not** 2× P&I.
6. Domain tests were **236 pass** after that identity change. Re-run. If they still pass, that does **not** mean the live plan is right — fixtures are not Tyler's live Insights.

Do not "fix" by returning to Insights-net leftover or wage-share leftover.

---

## Audit method (be exhaustive)

For each calculation below: (a) write the formula the code actually implements, with file:line; (b) write the formula it **should** implement given the locked product rules; (c) worked numeric example if it disagrees; (d) severity P0/P1/P2; (e) which tests encode the wrong identity.

**Trace at least:**

### A. Leftover / cash flow
- `cashIn` composition (wages gated, SS, rental, other, insurance, one-times). Missing Insights income that is not in the wage pie?
- `cashOut` composition (living, housing, healthcare, insurance, recurring, one-times, **other-debt**). Is other-debt double-counted with living? Are mortgages excluded from `liabilities` when a property already models them?
- `cashFlowTax` during accumulation (should skip wages/rental) vs retired (should tax remaining wages). Does withdrawal tax make leftover more negative than 10k − 13,024 in live data?
- `clipPlannedFromLeftover` vs still contributing while draining
- Residual vs `cashBalance += leftover + withdrawal.total − plannedApplied` (RMD parking). Does this double-add on draw years?
- `availableNet = max(0, …)` / `grownObservedNet` / `employmentShareOfSavingsNet` must be **absent** from `project.ts`

### B. Baseline hydration
- Trailing 12mo window vs a second averaging window
- Carve-outs: healthcare, housing P&I, property opex, insurance, other-debt. Does `preRetirementAnnualSpending` + engine housing + healthcare + insurance reconstruct headline spend while the loan is alive?
- `resolveEmploymentIncome`: share of Insights employment pie, annual. What if no split stored (100% primary)?
- Cash yield: user-set checking/savings only; Plaid schema default `0.07` is **not** a cash rate
- Rates: ForecastScenario vs profile vs portfolio posture. Confirm extras-only save still does not rewrite other rates

### C. Mortgage / debt
- `stepProperty` / `amortize` payoff year vs housing cashOut drop
- Extra monthly payment levers
- Other installment debts with `monthlyPayment > 0` vs Plaid `$0` payment (balance-only)
- Double-count: Insights blob **plus** engine P&I

### D. Scenario builder
- Every lever type that changes wages, spend, housing, contribs, returns. Confirm each writes the field `projectRetirement` actually reads
- Custom builder `compile-custom-lever.ts` vs catalog
- Suggested cards still claiming old math (Removes $X/year, wage share of Insights net, hardcoded scores)
- Compare / impact table using the same leftover
- Goal Seek / earliest age / opportunities solving on leftover, not Insights net
- Saved scenario reopen uses **live** baseline (balances/spend will have moved) — is that intended and is copy honest?

### E. Retired years / switch at `retirementAge`
- Identity should not cliff; living **source** switches to `retirementMonthlySpending` (intentional)
- Wage tax begins. Spouse still working after primary retires
- SS claim age vs retirement age
- Post-retirement surplus still → cash

### F. Monte Carlo / stress / charts
- MC only shocks returns; leftover identity must match deterministic
- Chart Cash series = leftover cash, not a mystery "other"
- Inspector Monthly cash flow vs annual rows; formatMoney collapsing $9,764 vs $10k
- Timeline cash-flow lens sign / annual vs monthly

### G. Scope leaks
- Levers writing profile / Insights / Plaid
- Edit plan **not** cascading a field it should (income split lives on retirement plan, not ForecastScenario — confirm that is enough)
- Overview tab showing levered projection when a What-If is selected (scenario-local UI, not a write) — confirm it is not also mutating baseline

Use Tyler's motivating numbers as a fixture **and** invent a second fixture with inflation, planned 401(k), RMD-age, extra mortgage, and other-debt so you catch interactions tests missed.

Run `packages/domain` retirement tests. Quote pass/fail. Read `retirement-engine.test.ts` describe `"accumulation cash-flow leftover"` and anything still named Insights net / wage share.

---

## Plan file format

Write `specs/features/retirement-calculation-audit/plan.md` as:

```
# Retirement calculation audit

## Status
Date, tests run, whether you traced live code (uncommitted) vs an older spec.

## Executive verdict
One paragraph: is the leftover identity actually implemented? What is still wrong for Tyler's 10k/year vs $13,024/mo case? What would he see in Monthly cash flow after reload?

## Current formulas (as coded)
Bullet the real identities with file:line. No wishful formulas.

## Findings
A table: ID | severity | symptom | coded formula | correct formula | files | tests that lock the bug.

P0 = wrong leftover / double-count spend / stocks getting residual / 10k treated as monthly / Insights-net still driving savings.
P1 = mortgage payoff 2×, contribs while draining, inspector units, suggested copy lying.
P2 = copy, ranking placeholders, solver using stale field.

## Correct, leave it
List what you verified is right (surplus-to-cash, tax skip, scenario-local levers, 12mo window, cascade). This section is mandatory.

## Sequenced fix plan
Numbered implementation order. Smallest honest patches first. Do not reopen wage-share-of-net. Do not switch leftover back to Insights net. Do not implement in this pass.

## Open questions for Tyler
Only true product forks (e.g. clip vs floor 401(k); tax on withdrawals during accumulation changing the −$12,191 identity).
```

Cite real paths. If you are unsure, say so — do not invent a menu, a field, or a formula.

## Functional Core, Imperative Shell
I would suggest that we use this architecture but if you feel otherwise then please say so and why. 

                     IMPERATIVE SHELL
       DB / Insights / Plaid / API / UI / Persistence
                         │
                         ▼
                buildRetirementBaseline()
                         │
                         ▼
                    PURE CORE
                         
                 applyLevers()
                         │
                         ▼
                projectRetirement()
                         │
               ┌─────────┼─────────┐
               ▼         ▼         ▼
            Year 1     Year 2     Year N
               │
               ▼
        small pure functions

Inside projectRetirement, I would not want a giant 500-line financial equation.

I’d want something conceptually closer to:

const wages = calculateWages(...)
const socialSecurity = calculateSocialSecurity(...)
const housing = calculateHousing(...)
const livingExpenses = calculateLivingExpenses(...)
const debtPayments = calculateDebtPayments(...)

const cashIn = calculateCashIn(...)
const cashOut = calculateCashOut(...)

const tax = calculateCashFlowTax(...)

const leftover = calculateLeftover({
  cashIn,
  cashOut,
  tax,
})

const contributions = calculateContributions({
  leftover,
  plannedContributions,
})

const withdrawals = calculateWithdrawals({
  leftover,
  balances,
})

const balances = applyYearEndBalances(...)

Each one should ideally be:

(input) => output

No DB calls.

No Prisma.

No React state.

No mutation of the baseline.

No reading global state.

No hidden dependence on Insights.

No persistence.

That would make your central identity literally something like:

export function calculateCashFlowLeftover({
  cashIn,
  cashOut,
  cashFlowTax,
}: CashFlowInputs): number {
  return cashIn - cashOut - cashFlowTax
}

## Done when

- `specs/features/retirement-calculation-audit/plan.md` exists and is specific enough that a later agent can implement without re-tracing the planner.
- You have run the domain retirement tests and recorded counts.
- You have **not** committed, cloned, or "helpfully" reimplemented leftover.

Start by reading the accumulation-income-spend spec and `project.ts` leftover block, then fan out.
