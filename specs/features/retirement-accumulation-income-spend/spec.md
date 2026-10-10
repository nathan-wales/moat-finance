# Retirement Accumulation: Income and Spending as Savings Driver

## Status

Draft. Created 2026-08-28 after reviewing the accumulation loop in `packages/domain/src/retirement/project.ts` (`isRetired` ~249, wage gates ~251–293, housing cashOut ~385–409, living/healthcare ~519–544, `cashIn`/`cashOut` ~583–600, accumulation tax skip ~630–683, residual-to-cash ~797–816), trailing spend + carve-outs in `packages/domain/src/retirement/build-baseline.ts` (`SPENDING_BASELINE_MONTHS` window ~382–409, `toEngineMonthlySpend` ~163–175, `preRetirementAnnualSpending` ~610–624, `spendingExclusions` ~595–600), `retirementSavingsNet` in `packages/domain/src/retirement/retirement-savings-net.ts`, `employmentShareOfSavingsNet` in `packages/domain/src/retirement/employment-share.ts`, withdrawal cash-first split in `project.ts` `splitTaxableWithdrawal` ~51–57 plus `DEFAULT_WITHDRAWAL_ORDER` in `constants.ts` ~173–176, mortgage extra-payment levers in `apply-levers.ts` ~889–923, income-split copy in `packages/features/src/retirement/plan/plan-settings-panel.tsx` ~348–359, year inspector in `year-inspector.tsx`, Spending tab in `packages/features/src/retirement/spending/spending-tab.tsx`, and sibling specs (`retirement-surplus-to-savings`, `retirement-employment-share-savings`, `retirement-edit-plan-assumptions`, `retirement/spec.md`). No code in this change. Do not clone. Do not commit.

## Goal

Replace Insights-net × `employmentShareOfSavingsNet` as the accumulation savings **driver**. Income and spending are the defaults. Insights hydrates them. What-Ifs / plan settings overwrite them independently on the fly.

Success means:

- Accumulation leftover is `cashIn − cashOut − cashFlowTax` — the same identity the retired path already uses — not `preRetirementAnnualNetIncome * salaryFactor * employmentShareOfSavingsNet`.
- Spouse out at 30 on My income **$10,000/year** vs household Insights spend **~$13,024/month** produces **~−$12,194/month**. The engine draws cash then taxable stocks (then deferred, then Roth). It does not add leftover cash.
- Mortgage / debt service is engine-modeled. When the loan pays off (~30 years), P&I leaves housing cashOut; living spend stays; leftover jumps by the payment.
- Insights trailing 12-month spend is **not** subtracted as a blob on top of engine housing. Living is the carved remainder; housing / healthcare / insurance / other-debt are the engine lines. That is the existing retired cashOut stack. Reuse it.
- Editing income does not silently edit spend. Editing spend does not silently edit income. Spouse/primary stop-working changes gated wages only.
- `employmentShareOfSavingsNet` is no longer the savings driver. Wage columns remain for Employment / SS FRA / end-age gates.

## Background

Until the primary hits `retirementAge`, `projectRetirement` still has two worlds.

**World A — savings driver (the bug).** `grownObservedNet = preRetirementAnnualNetIncome * salaryFactor * employmentShareOfSavingsNet(remainingWages, baselineWages)` (`project.ts` ~618–628). `availableNet = max(0, grownObservedNet)` (~805). Residual `max(0, availableNet − plannedTotal)` lands in cash (~806–811). Lifestyle `cashOut` is display-only (`project.ts` ~671–674). Spend does not scale with who works; the helper scales **net**, so a 10k/246k split with spouse out still saves ~10/256 of household Insights net — leftover stays positive even when $10k/year cannot cover $13,024/month of household spend.

**World B — retired identity (the template).** `isRetired` years already do `cashIn` (gated wages + SS + rental + other) minus `cashOut` (living + housing + healthcare + recurring + insurance + one-times + retired contribs) minus tax, then withdraw the gap cash-first, then park surplus in cash (`project.ts` ~583–600, ~665–669, ~787–796). Housing P&I is in `housingExpenses` only while `loanBalance > 0` (~395–398). Inspector Housing already drops when the loan ends. Accumulation ignores that drop because it ignores `cashOut`.

This spec deletes World A. Accumulation uses World B. [retirement-employment-share-savings](../retirement-employment-share-savings/spec.md) scaled the wrong quantity; it does not reopen. [retirement-surplus-to-savings](../retirement-surplus-to-savings/spec.md) residual-to-cash and planned-as-floor (while leftover is non-negative) stay.

Live symptom Tyler hit: spouse stops at 30, My income $10,000 (**annual**, not monthly), household spend ~$13,024/month. Inspector Employment shows the $10k slice. Savings path / Added to savings still behaves like a wage-share of Insights net. Required leftover is **~$12,194/month negative**, then draw.

## Product Context

Insights hydrates defaults. The planner overwrites them independently.

| Default | Hydration | Overwrite |
|---------|-----------|-----------|
| Household spending | Trailing 12 months of Insights spend (`SPENDING_BASELINE_MONTHS = 12`, `getNetIncome` over `trailingCashFlowRange`) | Edit plan headline spend (Phase 3 if missing). What-If `retirement_spending_*` stays **retirement** lifestyle, not accumulation. |
| Wages | Insights employment pie (`annualizeInsightsEmploymentIncome` + `resolveEmploymentIncome`) shown as My income / spouse income **annual** | Plan settings income split. What-If `spouse_stops_working` / `stop_working_at_age` / `income_change` / gaps / disability gate or haircut those wages. Spend does not move. |

"My income $10,000" is **annual**. `plan-settings-panel.tsx` already prints household as `$X/year · $Y/mo` (~252–256) but the split fields are labeled "My income" / "My spouse's income" with no `/year`. Do not treat 10,000 as monthly. Inspector "Added to savings" is annual; a monthly cash delta must be labeled monthly so Tyler does not divide by 12 in his head.

Negative leftover is allowed. Clamping `availableNet` to 0 before computing the gap is the reason a $10k/year earner still "saves." After this change, a gap draws cash then stocks. Surplus-to-savings still parks any later surplus in cash.

## Current Repo Context

### Trailing spend is already 12 months

`constants.ts` ~200: `SPENDING_BASELINE_MONTHS = 12`. `build-baseline.ts` ~382–409 loads `getNetIncome` and category spend over `trailingCashFlowRange(SPENDING_BASELINE_MONTHS, now)`. `get-net-income.ts` ~14–15, ~56–64: same 12-month Insights window (`netIncome = totalIncome − totalSpending`). `trailing.avgExpenses = totalSpending / monthCount` (~430–431). `summary.monthlyExpenses` is that average (~860–861). **Do not add a second averaging window.** Tyler's ~$13,024/month is this Insights **total** (headline), not living-only.

`retirementSavingsNet` (`retirement-savings-net.ts`) is Insights net minus investments/transfer/interest/dividends/capital gains. That number is today's `preRetirementAnnualNetIncome` (~625–628). After this spec it is **not** the savings driver. Keep computing it only if a leftover reader needs a debug comparison; drop the `project.ts` read.

### Carve-outs already exist — this is the honest stack

`build-baseline.ts` ~141–175, ~538–624:

```text
spendingExclusions:
  healthcareMonthly              // health|medical|dental|vision|pharmacy|prescription, retirement amounts
  housingDebtServiceMonthly      // sum of property.monthlyPayment where loanBalance > 0
  propertyOperatingMonthly       // tax / insurance / HOA (property.monthlyExpenses)
  insurancePremiumsMonthly       // profile insurance annualPremium / 12

toEngineMonthlySpend(headline) = max(0, headline − those four)

preRetirementAnnualSpending = trailingAnnualSpending
  − healthcareMonthlyCurrent * 12
  − propertyMonthlyDebtService * 12
  − propertyOperatingMonthly * 12
  − insurancePremiumsAnnualPreview
```

`types.ts` ~240: `preRetirementAnnualSpending` is "Annual living expenses today, excluding housing debt service." Healthcare is stored separately as `preRetirementAnnualHealthcare` (~248–249, ~624).

`toEngineMonthlySpend` is already what `retirement_spending_set` / stages use (`apply-levers.ts` ~796–812) so headline $9,000 becomes engine $8,500 in the existing carve test (`retirement-engine.test.ts` ~706–714). Reuse that helper for any accumulation headline override.

### cashOut composition (retired path is the template)

`project.ts` ~385–600, each year, **already computed during accumulation**:

| Line | Binding | Inflates? | Drops when |
|------|---------|-----------|------------|
| `livingExpenses` | `!isRetired`: `preRetirementAnnualSpending * expenseFactor`. `isRetired`: `retirementMonthlySpending * 12 * expenseFactor` (stages via `monthlySpendForAge`) | Yes — `expenseGrowthRate ?? inflationRate` (~208, ~228, ~525–527) | Never by itself |
| `housingExpenses` | Property opex × `(1 + property.expenseGrowthRate) ** yearIndex` **plus**, if `loanBalance > 0`, `(monthlyPayment + extraMonthlyPayment) * 12`. Rent-after-sale if no primary | Opex yes. **P&I does not inflate** (~395–398) | P&I + extra when `loanBalance` hits 0 |
| `healthcareExpenses` | `!isRetired`: `preRetirementAnnualHealthcare * inflationFactor`. Retired: `annualHealthcareSpending * healthcareFactor * multiplier`. Plus pre-Medicare window, plus LTC | Healthcare premium 2 pts over inflation (`HEALTHCARE_INFLATION_PREMIUM`) | Pre-Medicare at Medicare age; LTC per event |
| `insurancePremiums` | Profile + life policies × `inflationFactor` until `expiresAtAge` | Yes | Policy expiry |
| `recurringExpenseTotal` | Lever recurring (college, dependent, …) | Default yes | `toAge` |
| `oneTimeOutflows` | Home down payment, annuity premium, one-time events | n/a | That year only |
| Retired-only | `totalContributions` folded into cashOut (~600) | Contrib growth | `contributing` false |

**Mortgage payoff already hits housing cashOut today.** `stepProperty` amortizes each year (`project.ts` ~104–122, ~835). Inspector Housing will already fall when the ~30-year loan ends. Accumulation ignores it because `cashOut` is display-only (~671–674). The bug is not "housing isn't modeled."

**Other installment debt is the gap in the template.** `liabilities` amortize for net-worth (`stepLiability` ~124–136, ~836) but **monthlyPayment is not in cashOut**. Profile debts have payments (`assemble-liabilities.ts` ~66–96; Edit plan Debt card `monthlyPayment` in `plan-settings-assumptions.tsx` ~515–521). Plaid debt accounts often land with `monthlyPayment: 0` (~99–111). Mortgages are excluded from `liabilities` when a property already models them (~123–134). Lock: extend the housing pattern to other debts with `monthlyPayment > 0` — carve current service out of living, add this year's payment to cashOut, drop it at payoff. Do not invent a second spend stack. Plaid rows with $0 payment stay balance-only (no cash-flow double-count).

### Double-count if we subtract Insights spend AND engine housing

Insights trailing 12-month spend **includes** historical mortgage / debt / healthcare / insurance. The engine **also** amortizes loans into `housingExpenses` and projects healthcare / premiums.

Wrong: `wages − $13,024 − engine P&I` (mortgage counted twice; payoff would jump leftover by 2× P&I).

Right (lock): reuse the carve-out already used for retired cashOut.

```text
livingSpend     = trailing 12mo Insights spend MINUS engine-modeled categories
                  (housing P&I, property opex, healthcare, insurance, other-debt service)
housing         = engine property cashOut (P&I + extra until payoff, then tax/insurance/HOA only)
otherDebt       = engine liability payments until payoff (new on cashOut; carve from living)
healthcare      = engine healthcare path (pre-retire current × inflation; retired inflated / Medicare switch)
insurance       = engine premiums until expiry
editableIncome  = gated wages + already-modeled non-wage cashIn (rental from properties, SS, recurringIncome, disability, one-time inflows)
                  — confirm these are not added a second time via Insights leftover. They are not: leftover is dropped.
capacity        = editableIncome − living − housing − otherDebt − healthcare − insurance − recurring − oneTimeOut − cashFlowTax
```

That sum reconstructs headline Insights spend while the loan is alive. When mortgage pays off, P&I hits 0, livingSpend unchanged, capacity jumps by the payment. That is "take debt/mortgage into account."

Why not a second spend stack: `preRetirementAnnualSpending` + `housingExpenses` + `healthcareExpenses` + `insurancePremiums` **is** this composition today. Accumulation ignored it. Point `availableNet` / `needFromPortfolio` at that identity.

### Accumulation still clamps leftover and skips cashOut

`project.ts` ~618–816, `else` of `isRetired`:

```text
grownObservedNet = preRetirementAnnualNetIncome * salaryFactor
                 * employmentShareOfSavingsNet(remaining, baseline)   // ~618–628

// tax skip: Insights deposits are after-tax (~630–633, ~643–646)
accumulationGap = max(0, -grownObservedNet)                           // ~675
needFromPortfolio = max(0, oneTimeOutflows + tax + gap − inflows − rmd)  // ignores lifestyle cashOut

availableNet = max(0, grownObservedNet)                               // ~805  ← forbids negative leftover
residual = max(0, availableNet − plannedTotal) → cashBalance
planned 401(k)/Roth/taxable still apply as a floor even when net is $0
```

Retired (~665–669, ~787–796):

```text
needFromPortfolio = max(0, cashOut + tax − cashIn − rmd)
surplus = cashIn + withdrawal.total − cashOut − tax
if surplus > 0: cashBalance += surplus
```

### Withdrawal order is already cash → stocks → deferred → Roth

`DEFAULT_WITHDRAWAL_ORDER` = `taxable, taxDeferred, taxFree` (`constants.ts` ~173–176). `resolveWithdrawals` is called with `taxable: cashBalance + balances.taxable` (`project.ts` ~685–690). `splitTaxableWithdrawal` takes cash first, then brokerage (~51–57, ~763–768). Do not change the order. After a draw year, a later surplus still parks in cash (surplus-to-savings).

### Tax during accumulation

`settleTaxes` (~630–646) **skips wages, spouse wages, and rental** while `!isRetired` because "trailing INCOME is after-tax bank deposits (Insights)." Display tax still includes them (`displayTaxResult` ~729–753). Inspector "Taxes paid" is display; "it is not withdrawn again from take-home" (`year-inspector.tsx` ~39–41). Working-year `spendableIncome = grossIncome − cashFlowTax` so it ≈ gross when cash-flow wage tax is 0 (`retirement-engine.test.ts` ~327–348).

Income split is hydrated from Insights deposits (after-tax). There is no gross/net toggle. **Default: keep the accumulation wage-tax skip.** Treat My income / spouse income as take-home. If we taxed $10k/year on top of $13,024 spend, leftover would be worse than Tyler's −$12,194 identity (that identity is `10,000/12 − 13,024` with **no** tax haircut). Retired path still taxes remaining wages (spouse working after primary `retirementAge`). That cliff already exists; primary `employmentEndsAtAge` tracks `retirementAge` unless a stop-working lever moved it.

### Plan settings / What-If / Spending tab

**Income (annual).** `plan-settings-form.ts` stores `annualEmploymentIncome` / `annualSpouseEmploymentIncome`. `applyLinkedIncomeSplit` (~99–124) keeps the two fields summing to the Insights employment pie (`householdIncome` in `plan-settings-panel.tsx` ~90–92, ~155–159). `resolveEmploymentIncome` (`build-baseline.ts` ~235–258) reapplies stored **shares** onto the current Insights pie. Linked split is income-to-income, not income-to-spend. Keep the linker. After this spec those wage columns **are** cashIn, so editing 10k/246k changes leftover; it must not change spend.

Caption today (~352–358) still says household savings is Insights net scaled by remaining wage share. Rewrite.

What-If work levers (`apply-levers.ts`): `spouse_stops_working` writes `spouseEmploymentEndsAtAge` (~584–587); `stop_working_at_age` writes `employmentEndsAtAge` (~551–560); `income_change` / `job_loss` / `career_break` / `part_time_before_retirement` / `disability_event` already move year wages. They do not write spend. They do not write `preRetirementAnnualNetIncome`. Keep that.

**Spend.** No accumulation spend field on Edit plan (`PlanSettingsForm` has no spend key). Spending tab (`spending-tab.tsx`) "Current monthly" is `spendingPlan.currentMonthlySpending` — Insights headline, **read-only**. Today/Retirement columns: only retirement treatment / essentiality are editable. What-If `retirement_spending_set` / `change` / `stages` write `retirementMonthlySpending` / `spendingStages` (~782–814), which feed **retired** living only (`project.ts` ~525–527). Do not reuse those levers as an accumulation spend override.

**Mortgage extra / refinance.** `mortgage_extra_payment` / `mortgage_payoff_early` / `mortgage_payoff_cancel` already write `property.extraMonthlyPayment` (`apply-levers.ts` ~889–923). Extra is inside housing cashOut while the loan lives (~397) and accelerates `stepProperty`. Once accumulation uses cashOut, extra payments automatically worsen leftover until an earlier payoff, then leftover jumps sooner. **No refinance lever exists** (no `refinance` / `mortgage_refi` in the engine). Non-goal for v1; Edit plan already edits rate / term / payment (`plan-settings-assumptions.tsx` ~403–442).

### Tests that encode the old identity

`packages/domain/src/retirement/retirement-engine.test.ts`:

- `assertScaledResidual` (~258–291) and describe `"employment share of Insights savings net"` (~754–920+) assert `contributionsCash ≈ N * remaining/total`. **Replace.** The 10k/246025 fixture (`dualEarnerHousehold` ~235–256) is the right household; leftover must be wages − cashOut, not `80_000 * 10_000/256_025`.
- `"does not double-count planned contributions on top of Insights net"` (~2327–2357) and `"adds residual Insights net to cash before applying cash yield"` (~2173–2196) assume Insights net **is** leftover. Rewrite against `cashIn − cashOut − tax`.
- `"compounds only planned taxable contributions at the stock return"` (~2359–2392) stays in spirit (residual to cash, not stocks) but leftover is no longer `preRetirementAnnualNetIncome − planned`.
- `"grows cash at cashYield instead of the portfolio return"` — keep; cash yield still applies after residual.
- Negative `preRetirementAnnualNetIncome` fixtures (~1490–1508, ~1765–1782) already exist for depletion. After this change, negative leftover comes from wages < cashOut even when the net field is unused.

`employment-share.ts` + `employment-share.test.ts`: only callers are `project.ts` and engine tests. Delete the helper once unused, or keep it unused — do not leave `project.ts` calling it.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Retired cashIn − cashOut | `project.ts` ~583–600, ~665–669 | Template. Point accumulation `needFromPortfolio` at the same formula |
| Living carve-out | `build-baseline.ts` `preRetirementAnnualSpending` ~616–623, `toEngineMonthlySpend` ~163–175 | Do not invent a second living number |
| Housing P&I until payoff | `project.ts` ~395–398, `stepProperty` ~104–122 | Already drops; accumulation must consume it |
| Extra mortgage | `extraMonthlyPayment`; levers ~889–923 | Already in housing cashOut |
| Other debts | `assemble-liabilities.ts`; Edit plan Debt card | Carve + add to cashOut (missing today even when retired) |
| Wage gates | `project.ts` ~251–293, ~440 | Stay. They become cashIn, not a net scaler |
| Residual → cash | `project.ts` ~792–815 | Keep for surplus > 0 |
| Withdrawal order | `splitTaxableWithdrawal` + `DEFAULT_WITHDRAWAL_ORDER` | Cash, taxable stocks, deferred, Roth |
| Tax skip | `settleTaxes` `!isRetired` branch ~630–646 | Keep as take-home rule |
| Income split | `plan-settings-panel.tsx` ~348–379; `applyLinkedIncomeSplit` | Copy + `/year` label. Linker stays |
| Spending tab | `spending-tab.tsx` | Current monthly is the Insights headline default. Not an accumulation editor |
| Year inspector | `year-inspector.tsx` | Caption + monthly leftover row |
| Insights net helper | `retirement-savings-net.ts` | Stop driving savings; exclusions can stay for any debug field |

## Target Experience

No new retirement chrome in Phase 1. Engine identity first. Copy tells the truth. Spend override UI only if we still cannot set accumulation spend after the engine ships — prefer Edit plan, not a new What-If widget.

### What-If: spouse stops at 30 (the motivating case)

1. Insights hydrates spend ~$13,024/month (headline) and the 10k / 246k wage split (annual).
2. Add `spouse_stops_working` at 30 (or `spouse_retire_at_age` 30). Spouse wages gate to 0. **Spend does not shrink.**
3. From age 30, leftover ≈ `$10,000/year − $13,024/month` ≈ **−$12,194/month** (see Worked example). Inspector Employment shows ~$10,000. Housing / living / healthcare still show the composed stack (they reallocate headline spend; they are not added on top of $13,024).
4. Negative leftover draws **cash, then taxable stocks, then deferred, then Roth**. Added to savings is $0 that year. Do not park a wage-share residual.
5. Planned 401(k)/Roth/brokerage clip to $0 that year (do not defer while draining stocks). See Architecture decision.
6. A later year when `loanBalance` hits 0: Housing falls by P&I (+ extra if any); living unchanged; leftover improves by that payment.

Primary `stop_working_at_age` before `retirementAge` is the same identity with spouse wages remaining (or 0). It still does not set `isRetired`.

### At primary `retirementAge`

`isRetired` flips. Savings is already `cashIn − cashOut − tax`, so the **identity** does not cliff. Living **source** switches from `preRetirementAnnualSpending` to `retirementMonthlySpending` (Spending tab translation: disappears / changes / optional mortgage-payoff adjustment). That lifestyle step is intentional and out of scope to flatten here. Housing / healthcare / insurance / other-debt stay on the same schedules. Wage tax begins on any remaining wages (existing retired `settleTaxes`).

### Income split (Edit plan)

Keep the linked fields. Add `/year` to the labels (or keep the household `$X/year · $Y/mo` line and make the field labels "My income ($/year)" / "My spouse's income ($/year)").

**Caption (replace):**

> This splits Insights employment income between you and your spouse (annual take-home). It drives wage columns, Social Security estimates, and when each person stops working. Household spending is a separate default (trailing Insights spend). Editing these amounts does not change spend. If someone stops working, their wages end and spend stays put.

Do not mention Insights net, wage share of savings, or "these two salaries added together as a second stream." After this spec the salaries **are** cashIn; the caption must still say they are not spend.

### Spend control

Phase 1: no new field. Default is Insights 12-month average headline, carved for the engine. Spending tab Current monthly remains the readout.

Phase 3 only if we still cannot override accumulation spend: one **Monthly spending** headline on Edit plan, hydrated from `summary.monthlyExpenses` / `spendingPlan.currentMonthlySpending`, written through `toEngineMonthlySpend` into `preRetirementAnnualSpending` (plus the same exclusions so housing/healthcare stay engine-owned). Independent of income split. Do not bind it to `retirement_spending_set`. Do not add a surplus-destination control.

### Year inspector (accumulation years)

Replace the Insights-net / "leftover after planned contribs stays in savings" sentence with the cash-flow identity. Keep the housing/healthcare reallocate caveat and the display-tax caveat.

**Caption (replace):**

> Working years use take-home income minus spending. Housing, healthcare, and debt lines reallocate trailing Insights spend — they are not added on top. A leftover goes to planned 401(k) / Roth / brokerage first, then savings at cash yield. A shortfall draws cash, then stocks, then deferred, then Roth. Taxes paid is estimated from projected income and brackets for this chart; it is not withdrawn again from take-home.

**Rows:**

| Label | Binding |
|-------|---------|
| Employment / spouse employment | Unchanged (annual wages) |
| Living / Housing / Healthcare | Unchanged (composed stack, annual) |
| Added to savings | Residual **annual** (`contributionsCash`; 0 when leftover ≤ planned or leftover < 0) |
| Monthly cash flow | **New.** `cashFlowLeftover / 12`, signed, labeled monthly. This is the −$12,194 row. Do not make Tyler divide Added to savings |
| Monthly spendable | Today `spendableIncome / 12` ≈ gross/12 during accumulation because wage tax is skipped. Relabel or hide in accumulation so it is not confused with leftover. Prefer Monthly cash flow as the leftover number |
| Taxable / tax-deferred / tax-free savings | Planned only |
| Taxable / deferred / tax-free withdrawals | Draw years |

All other inspector amounts stay annual. If a row is monthly, the label says monthly.

### Savings path

Stop implying leftover Insights net is Saved. Saved = planned + residual still, but residual is now `max(0, leftover − planned)` from the cash-flow identity, and is $0 on draw years. Body:

> Planned contributions are invested each year until retirement while take-home covers them. Leftover cash flow after those contributions stays in savings at cash yield. A shortfall draws cash then stocks — it is not a negative "Added to savings."

## Architecture / Data Model

No new tables. No surplus-destination column. Do not write `preRetirementAnnualNetIncome` from `applyLevers`.

### Engine identity (every year)

After wages/housing/healthcare/cashIn/cashOut are computed, **before** growth:

```text
coreOut = livingExpenses + housingExpenses + healthcareExpenses
        + recurringExpenseTotal + insurancePremiums + oneTimeOutflows
        + otherDebtService          // new: liability payments this year
coreIn  = employmentIncome + spouseEmploymentIncome + SS + spouse SS
        + rentalIncome + otherIncome + insuranceIncome + oneTimeInflows

cashFlowTax = settleTaxes(...)      // accumulation: still skip wages/rental
leftover    = coreIn − coreOut − cashFlowTax    // SIGNED. Do not clamp to 0.

if leftover < 0:
  plannedApplied = 0                // clip: do not 401(k) while draining
  needFromPortfolio = −leftover − rmd (floored at 0, same shape as retired)
  residual = 0
else if contributing:
  plannedApplied = min(plannedTotal, leftover)   // clip to remaining take-home
  # tax-advantaged first: deferred, then tax-free, then taxable, then stop
  residual = leftover − plannedApplied
  needFromPortfolio = 0
else:
  plannedApplied = 0
  residual = leftover
  needFromPortfolio = 0

withdraw cash → taxable stocks → deferred → Roth
balances += plannedApplied (split across buckets)
cashBalance += residual                 // never add a negative
recordedContributionsCash = residual
cashFlowLeftover = leftover             // new year field, signed
```

Then cash yield and bucket returns, same as today.

Retired years use this same leftover math. Folding planned contribs into retired `cashOut` (~600) is replaced by the clip/residual split above so the switch at `retirementAge` does not change identity. Open Question 4 if we must keep retired contribs inside `cashOut` bit-for-bit; default is unify.

`grownObservedNet` / `employmentShareOfSavingsNet` / `availableNet = max(0, …)` / `accumulationGap = max(0, −grownObservedNet)` all go away.

### Planned contribs when leftover < planned (decision)

| leftover | Default | Why |
|----------|---------|-----|
| `< 0` | **Clip planned to 0.** Draw the gap. | Do not 401(k) while selling stocks. Tyler's −$12,194 year. |
| `0 … planned` | **Clip planned to leftover** (tax-deferred, then tax-free, then taxable). Residual 0. | Floor while still contributing meant "fund planned from leftover before parking cash," not "create 401(k) dollars that were never take-home." |
| `> planned` | Planned in full. Residual to cash. | Surplus-to-savings. |

This **changes** `"applies planned Roth contributions when Insights net is zero"` and the $0-net floor tests. Call that out in the PR. Reopen only if Tyler wants paycheck deferral even when lifestyle spend exceeds take-home (keep floor by drawing). One-line disagreement: keep floor when leftover ≥ 0, clip only when leftover < 0.

### Year ledger

Add `cashFlowLeftover: z.number()` to `RetirementProjectionYearSchema` (`packages/contracts/src/retirement.ts`). Signed. Engine always writes it. Inspector Monthly cash flow = `/ 12`.

Keep `contributionsCash` as non-negative residual only. Do not stuff a negative leftover there.

Update `types.ts` ~242–247: `preRetirementAnnualNetIncome` is no longer the savings-capacity ceiling. Either deprecate the field or keep it as a hydrated Insights-net debug input that `project.ts` does not read.

### Other-debt carve (same pattern as housing)

In `build-baseline.ts`, add `otherDebtServiceMonthly` to `spendingExclusions` (sum of `liabilities[].monthlyPayment` where payment > 0; mortgages already excluded from that list). Subtract it from `preRetirementAnnualSpending` next to housing. In `project.ts`, add this year's `liability.monthlyPayment * 12` (while `balance > 0`) into `coreOut` / a ledger line (housing stays property-only; do not merge). `toEngineMonthlySpend` / `toHeadlineMonthlySpend` pick it up automatically if the exclusions object grows.

### Income vs spend independence

`applyLevers` does not write spend when it writes wages. `applyLinkedIncomeSplit` does not write spend. An Edit plan spend override (Phase 3) does not write `annualEmploymentIncome`. `resolveEmploymentIncome` stays share-of-Insights-pie.

## Worked Example

Fixture shape: `dualEarnerHousehold` wages — primary **$10,000/year**, spouse **$246,025/year**, `spouse_stops_working` at 30, headline Insights spend **$13,024/month**, mortgage with ~30 years remaining. Inflation/salary growth 0 for the identity check. 13,024 **includes** mortgage (Insights total). Engine housing is **not** subtracted on top of that blob.

**Year 30 (spouse out, mortgage on)**

| | Annual | Monthly |
|--|--------|---------|
| Primary take-home | $10,000 | $833.33 |
| Spouse take-home | $0 | $0 |
| Headline spend (Insights total) | $156,288 | $13,024 |
| Leftover | **−$146,288** | **−$12,190.67 ≈ −$12,194** |

Tyler's −$12,194 is `13,024 − 10,000/12` with $833 rounded (~$830 → $12,194). Tests use ≈ / $1–$5 tolerance, not fake cents. `10,000` is **not** monthly: treating it as monthly would produce leftover ≈ −$3,024, which is a **fail**.

Composed stack (same leftover):

```text
living     = 13,024 − P&I − propertyOpex − healthcare − insurance − otherDebtService
housing    = P&I + propertyOpex          // P&I still on
healthcare = carved healthcare
insurance  = carved premiums
otherDebt  = carved other-debt service   // 0 if none
cashOut/mo = 13,024
leftover   = 833.33 − 13,024 = −12,190.67
```

Inspector: Employment ~$10,000 (annual). Monthly cash flow ~−$12,191. Added to savings $0. Withdrawals: cash first, then `balanceTaxable`, then deferred, then Roth. Planned contribs $0.

**Later year, mortgage paid off (still accumulation, spouse still out)**

```text
housing P&I → 0
housing     = propertyOpex only (tax/insurance/HOA still inflate)
living      = unchanged (carve already removed P&I from living)
leftover    = previous leftover + P&I (+ extraMonthlyPayment if any)
```

If P&I was $2,400/month, Monthly cash flow improves by ~$2,400, not by full Housing (opex remains) and not by 2× P&I (that would mean we double-counted).

**Healthcare vs $13,024.** 13,024 is Insights **total**, not living-only. Healthcare is inside it, carved to the Healthcare row, added back in cashOut. Do not treat 13,024 as living-after-carve. If live Insights healthcare is ~$X, inspector Living is ~`13,024 − X − housing − insurance − otherDebt`, and the sum of those rows ≈ 13,024.

## Implementation Plan

Do **not** implement as part of writing this spec.

### Phase 1 — engine + tests (must ship)

1. In `project.ts`, delete `grownObservedNet` / `employmentShareOfSavingsNet` / `availableNet = max(0, …)` / the display-only accumulation `needFromPortfolio` branch. Accumulation and retired both use signed leftover from `coreIn − coreOut − cashFlowTax`.
2. Clip planned contribs as specified. Residual to `cashBalance` only when leftover > planned applied. Negative leftover → withdraw, `contributionsCash = 0`.
3. Add other-debt service to cashOut after carving it from `preRetirementAnnualSpending` (same exclusions object).
4. Add `cashFlowLeftover` to the year schema. Write it every year.
5. Stop reading `preRetirementAnnualNetIncome` in `project.ts`. Leave baseline hydration in place until a cleanup PR, or drop it in the same PR if tests are the only readers (`setup-checklist.test.ts` only fixtures the field).
6. Delete `employmentShareOfSavingsNet` from `project.ts`. Delete `employment-share.ts` + `employment-share.test.ts` if unused.
7. Keep residual-to-cash, cash yield, bucket returns, wage tax skip, withdrawal order, `retirementSavingsNet` exclusions (unused as driver).
8. Tests as listed under Acceptance Criteria.

**Acceptance:** spouse out at 30 on 10k/year vs $13,024/month spend → leftover ≈ −$12,194/month; mortgage payoff improves leftover by P&I; spouse-out does not shrink spend; planned contribs 0 on that year; draw is cash then stocks.

### Phase 2 — copy

1. Income-split caption + `/year` labels in `plan-settings-panel.tsx`.
2. Year inspector caption; Monthly cash flow row; do not leave Monthly spendable looking like leftover.
3. Savings path body.
4. `suggest-levers.ts` spouse-stop detail (~212) currently "savings net scales by remaining wage share" → wages end, spend stays. Do not resurrect `Removes $X/year` as if wages subtracted from Insights net.

**Acceptance:** a user reading Edit plan / inspector cannot conclude leftover is Insights net × 10/256, or that $10,000 is monthly.

### Phase 3 — accumulation spend override (only if still missing)

1. Edit plan **Monthly spending** headline, Insights 12-month default, `toEngineMonthlySpend` into living. Independent of income.
2. Do not invent a What-If spend widget if Edit plan covers it. `retirement_spending_*` remain retirement-only.

## Acceptance Criteria

- [ ] Accumulation leftover = `coreIn − coreOut − cashFlowTax` (signed). `coreOut` is living + housing + healthcare + insurance + other-debt + recurring + one-times. `coreIn` is gated wages + modeled non-wage cashIn. Insights net is not the driver
- [ ] Living is trailing Insights spend minus the existing carve-outs (housing P&I, property opex, healthcare, insurance, other-debt service). Engine housing/healthcare/insurance/other-debt are **not** added on top of the $13,024 blob
- [ ] `availableNet = max(0, …)` and `accumulationGap = max(0, −grownObservedNet)` are gone. Negative leftover is allowed and creates withdrawals
- [ ] Spouse/primary stop-working changes gated wages only. Spend / `preRetirementAnnualSpending` does not scale with who works
- [ ] `employmentShareOfSavingsNet` is not called from `project.ts`. Helper file deleted if unused
- [ ] `applyLevers` still does not write `preRetirementAnnualNetIncome` or spend when writing end ages
- [ ] Withdrawal order unchanged: cash (`splitTaxableWithdrawal`), taxable stocks, deferred, Roth
- [ ] Surplus after a later positive leftover still goes to `cashBalance` at cash yield (surplus-to-savings). Residual never goes to taxable
- [ ] Planned contribs clip to 0 when leftover < 0; clip to leftover when `0 ≤ leftover < planned`; full planned + residual to cash when leftover > planned
- [ ] Accumulation still skips wage/rental tax on cash flow (take-home). Display tax unchanged. Retired years still tax remaining wages
- [ ] Mortgage P&I does not inflate. Living inflates with `expenseGrowthRate`. When `loanBalance` hits 0, leftover improves by P&I (+ extra), not by 2× P&I
- [ ] Extra mortgage levers already on `extraMonthlyPayment` need no new engine path once cashOut drives leftover
- [ ] Worked example: primary $10,000 **per year**, spouse out at 30, headline spend $13,024/month including mortgage → year-30 leftover ≈ **−$12,194/month** / **−$146,288/year**. Treating $10,000 as monthly is a fail. `contributionsCash === 0`; withdrawals > 0 if there is cash/taxable to draw
- [ ] Same household, year after mortgage payoff: leftover − year-30 leftover ≈ that year's P&I (+ extra). Living expenses do not drop by P&I (already carved)
- [ ] Existing residual-to-cash tests rewritten against leftover = cashIn − cashOut − tax, not Insights net. Stocks still do not compound residual
- [ ] `"employment share of Insights savings net"` tests that assumed `N * 10/256025` leftover are replaced with the wages − spend identity. `assertScaledResidual` deleted or rewritten
- [ ] `"does not double-count planned contributions on top of Insights net"` no longer uses Insights net as the savings ceiling; no-double-count means planned is not added on top of leftover (planned comes **from** leftover)
- [ ] Year inspector: Monthly cash flow labeled monthly; Added to savings remains annual; caption does not say leftover Insights net is invested or scaled by wage share
- [ ] Income-split caption rewritten; My income labeled annual
- [ ] `SPENDING_BASELINE_MONTHS` stays 12. No second averaging window
- [ ] Live Plaid balances are not written. No clone, no commit in the spec-writing task

## Non-Goals

- Do not keep `employmentShareOfSavingsNet` as a savings driver. Wage share remains for Employment columns / SS FRA / end-age gates only (already true without the helper)
- Do not subtract Insights headline spend **and** engine housing
- Do not send leftover to taxable / stocks
- Do not clamp leftover to 0
- Do not treat My income $10,000 as monthly
- Do not reuse `retirement_spending_set` as accumulation spend
- Do not add a refinance lever (none exists; Edit plan loan terms already editable)
- Do not add a second 12-month averaging window
- Do not invent gross-pay tax withholding UI
- Do not flatten pre-retire vs retired **lifestyle** living (`preRetirementAnnualSpending` vs `retirementMonthlySpending` translation)
- Do not change `retirementSavingsNet` category exclusions except to stop driving savings
- Do not clone. Do not commit. Do not implement the engine in the spec-writing task

## Open Questions

1. **Wage tax during accumulation.** Default: **skip** (Insights / Edit plan income is take-home; Tyler's −$12,194 does not haircut the $10k). Reopen if My income is later defined as gross — then run `estimateAnnualTax` on remaining wages in `settleTaxes` for `!isRetired` too, and the worked example must move.
2. **Clip vs floor when leftover is positive but below planned.** Default: **clip planned to leftover** (and to 0 when leftover < 0). Reopen to "keep floor by drawing" if Tyler wants 401(k) deferral even when lifestyle spend exceeds take-home. Phase 1 tests must match the default.
3. **Other-debt cashOut.** Default: **yes — carve and add**, same as housing, so car/student loans leave cash-flow at payoff. Plaid $0-payment debts stay balance-only. Reopen to "mortgage only in v1" if we do not want to touch retired cashOut's missing liability line in the same PR; then other-debt payments remain inside living forever (they never drop).
4. **Unify retired contribs into the leftover split vs keep `isRetired ? totalContributions : 0` inside cashOut.** Default: **unify** so `retirementAge` is not an identity cliff. Reopen if a retired-contribs-in-cashOut test is load-bearing.
5. **Insights income that is not wages and not modeled rental/SS/recurring.** Default: **drop it** (modeled `cashIn` only). `annualizeInsightsEmploymentIncome` already folds non-rental Insights income into the wage pie, so most deposits already sit in My income / spouse income. Do not add Insights leftover on top.
6. **Refinance.** No lever. Default: **out of scope**; extra payment + Edit plan rate/term/payment are the knobs. Reopen if product wants a refinance What-If.
7. **Healthcare inside $13,024.** Default: **yes, Insights total includes it**; composed stack carves and reallocates. Confirm on the live Insights card if Tyler expected 13,024 to be living-only — if it is already living-after-carve, leftover would be `833 − 13,024 − engine housing − engine healthcare` and the −$12,194 identity would be wrong. The Insights total card is the default reading.

## Related Specs

- [retirement-surplus-to-savings/spec.md](../retirement-surplus-to-savings/spec.md) — residual to cash, not stocks; planned from leftover; **this spec keeps the landing bucket and replaces the leftover formula**
- [retirement-employment-share-savings/spec.md](../retirement-employment-share-savings/spec.md) — wage-share of Insights net as driver; **superseded as savings driver**. Wage gates / SS / inspector Employment stay
- [retirement-edit-plan-assumptions/spec.md](../retirement-edit-plan-assumptions/spec.md) — Edit plan; income split lives there; spend override would too
- [retirement/spec.md](../retirement/spec.md) — baseline + What-If + year inspector
- [synced-account-forecast-assumptions/spec.md](../synced-account-forecast-assumptions/spec.md) — planned contribs; remainder-goes-cash already superseded surplus-to-savings

## Suggested Commit Message

```text
docs (retirement): spec accumulation leftover as income minus spend
```
