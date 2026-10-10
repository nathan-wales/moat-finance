# Retirement Surplus Cash Flow to Savings

## Status

Draft. Created 2026-08-28 after reviewing the accumulation loop in `packages/domain/src/retirement/project.ts` (~775–816), the leftover-on-taxable test in `packages/domain/src/retirement/retirement-engine.test.ts`, year-inspector and savings-path copy, `ProjectedNetWorthChart` Stocks vs Other mapping, cashYield wiring through `toRetirementPlanningContext`, and related specs (`synced-account-forecast-assumptions`, `retirement-edit-plan-assumptions`, `retirement/spec.md`).

## Goal

Stop auto-investing leftover cash flow in stocks. The retirement engine must compound **only** what the user said they will invest (planned 401(k) / Roth / taxable contributions at those buckets' returns). Insights net above that planned total is residual cash. Residual lands in the **savings / cash** bucket and earns cash yield — not the taxable/stock return.

Success means:

- Accumulation no longer does `balances.taxable += plannedTaxable + residualTaxable`. Residual goes to `cashBalance` instead.
- Year-1 Stocks for the live motivating case stay near start times stock return plus planned brokerage contribs (~$317k), not the residual-inflated ~$394k.
- Other / cash absorbs that residual and then grows at cash yield.
- Users move more money into investments only by raising monthly contributions on investment accounts — there is no surplus-to-brokerage sweep and no new "surplus destination" control in v1.

## Product Context

Leftover cash flow is not an unspoken brokerage mandate. Someone who sets Robinhood Individual to $1,000/mo at 7% asked the engine to compound **that** $1,000/mo in stocks. The rest of Insights net (take-home after spend, after those planned contribs) is money sitting in checking and savings. Wells Fargo checking might yield 0.01%. An HYSA might yield 3%. Household `defaultCashYield` (Edit plan / Financial Profile, often ~4.5%) is a fallback, not a silent upgrade for a 0.01% checking account.

The live bug that motivated this:

| Slice | What happened |
|-------|----------------|
| Stocks | $284,513 → $394,306 because residual Insights net was swept into taxable and grown at 7% |
| Stocks, intended | Only $1k/mo + 7% → ~$317k |
| Other / cash, today | $38,788 × 1.045 = $40,533 (existing cash yield, **no** residual added) |
| Other / cash, after | Residual lands in that cash bucket, then yields |

Tyler's product language for leftover is "~$70k profit after planned contribs." The Stocks identity implies residual **before yield** ≈ `$394,306 / 1.07 − $284,513` ≈ **$84k**. Do not invent extra precision; both figures are ≈. The identity to preserve in tests is the Stocks path (planned contribs only) plus residual-to-cash, not a reconciled $70k vs $84k.

Default bucket for leftover cash flow = **savings**. The user can later move more into investments by raising monthly contribs on Edit plan Investment accounts / account settings.

This is the same job as [retirement/spec.md](../retirement/spec.md) ("interrogate my own future") and [retirement-edit-plan-assumptions](../retirement-edit-plan-assumptions/spec.md) (cash yield is a real knob). It **supersedes** the remainder-goes-taxable rule in [synced-account-forecast-assumptions](../synced-account-forecast-assumptions/spec.md).

## Current Repo Context

### The bug (accumulation)

`packages/domain/src/retirement/project.ts`, `else` of `isRetired` (~782–801):

```text
// Planned contributions are a savings floor. Insights net above the
// planned total is residual cash that goes to taxable. This avoids
// double-counting when contributions are already inside Insights net.
plannedDeferred / plannedFree / plannedTaxable
plannedTotal = sum of those
availableNet = max(0, grownObservedNet)
residualTaxable = max(0, availableNet - plannedTotal)

balances.taxDeferred += plannedDeferred
balances.taxFree += plannedFree
balances.taxable += plannedTaxable + residualTaxable   // the bug
recordedContributionsTaxable = plannedTaxable + residualTaxable

cashBalance = cashBalance * (1 + inputs.cashYield)     // residual never added
balances.taxable *= (1 + taxable/stock return)
```

`grownObservedNet` is `inputs.preRetirementAnnualNetIncome * salaryFactor` (~617). `preRetirementAnnualNetIncome` is `retirementSavingsNet(...)` in `packages/domain/src/retirement/build-baseline.ts` (~603–606), which strips investment yield / transfers via `packages/domain/src/retirement/retirement-savings-net.ts`. **Do not change that net.** It remains the savings *capacity* ceiling. Only the *landing bucket* for residual changes.

Starting cash is already split out of investable balances in `projectRetirement` (`const { cash: startingCash = 0, ...startingInvestable } = inputs.balances`, ~200–202). `build-baseline.ts` (~461–469) puts `account.isCash` balances into `balances.cash` and skips them for contribution floors.

### Post-retirement surplus (same class of bug)

`project.ts` ~775–781, inside `if (isRetired)`:

```text
balances.taxable += contributionsTaxable
...
const surplus = cashIn + withdrawal.total - cashOut - taxResult.totalTax
if (surplus > 0) balances.taxable += surplus
```

That surplus also inflates Stocks. **Apply the same savings rule** (surplus → `cashBalance` before cash yield) unless product reopens it. Recommendation: same rule, for consistency. Flagged under Open Questions as the default decision.

### Why the chart lies toward Stocks

`packages/charts/src/projected-net-worth-chart.tsx` `toProjectedNetWorthPoints`:

- `stocks = year.balanceTaxable * mix.stocksOfTaxable` (`DEFAULT_LIQUID_TYPE_MIX.stocksOfTaxable` is `1` in `packages/contracts/src/retirement.ts`)
- `other = max(0, year.liquidAssets - allocated)`
- `liquidAssets = cashBalance + taxable + taxDeferred + taxFree` (`project.ts` ~833–834)

Cash is `isCash` → `"other"` in `packages/domain/src/retirement/liquid-type-mix.ts`. Residual currently inflates **taxable → Stocks**. After this change it inflates **cash → Other**. No chart-formula change is required for v1 if the engine landing bucket is correct.

### Cash yield today is one household rate

| Step | Location | What it does |
|------|----------|--------------|
| Profile field | `ForecastAssumptions.defaultCashYield` | Help text in `packages/features/src/financial-profile/field-options.ts`: "assumed annual yield for cash-like balances when an account-specific rate is unavailable" |
| Parse | `toRetirementPlanningContext` in `packages/data-access/src/retirement-sources.ts` (~597–600) | `cashYield: parseRateString(assumptions.defaultCashYield, DEFAULT_CASH_YIELD)` with `DEFAULT_CASH_YIELD = 0.04` |
| Baseline | `build-baseline.ts` ~745 | `cashYield: planningContext.cashYield` |
| Engine input | `RetirementPlanInputs.cashYield` in `packages/domain/src/retirement/types.ts` | Single household rate |
| Engine apply | `project.ts` ~801 | `cashBalance *= (1 + inputs.cashYield)` |
| Edit plan | `plan-settings-drafts.ts` parses **"Cash yield"**; Growth accordion in `plan-settings-assumptions.tsx` | Already editable. Do not add a surplus-destination control |

`RetirementBalances.cash` comment (`types.ts` ~14): "Checking / savings. Grown at `cashYield`, not the portfolio return." That comment is still right; residual simply was never added to cash.

`types.ts` ~243–246 is **stale** and must be updated with the engine:

> Observed trailing net cash flow (Insights net income). Applied to taxable balances during accumulation…

After this spec it is the savings-capacity ceiling; residual of that net lands in cash.

### Per-account cash rates exist on the row, not in the retirement mix

`RetirementAccountSource` (`packages/data-access/src/repositories/RetirementRepository.ts` ~106–118) already has `annualReturnRate`, `isCash`, `isDebt`. Plaid depository / `cash` types set `isCash` via `CASH_ACCOUNT_TYPES` in `retirement-sources.ts` (`depository`, `cash`).

`weightedBucketReturns` in `build-baseline.ts` (~68–91) **skips** `isCash` accounts. Cash therefore cannot pick up a 0.01% Wells Fargo rate today.

Trap: `PlaidAccount.annualReturnRate` defaults to **0.07** for every type (`apps/api/prisma/schema.prisma`), and `toRetirementAccountSourceFromPlaid` uses `row.annualReturnRate ?? fallbackReturnRate` (`DEFAULT_RETURN_RATE = 0.07`). `forecastInputsUserEdited` exists on `PlaidAccount` but is **not** on `RetirementAccountSource`. A naive weighted average of cash `annualReturnRate` would treat unedited checking as 7%. Phase 3 must not do that.

UI gap: `packages/features/src/financial-profile/account-detail-dialog.tsx` `showForecastAssumptions = isSynced && isInvestmentAccountType(account.type)` — synced checking / savings do **not** show the forecast accordion. Manual checking / savings only get Expected annual return if "Is investment account" is checked (`manual-account-dialog.tsx`). Phase 3 needs those rates settable on cash accounts (reuse `annualReturnRate` + `forecastInputsUserEdited`, not a new store). That is account settings, not a surplus-destination UI.

### Tests that encode leftover-on-taxable

`packages/domain/src/retirement/retirement-engine.test.ts`, describe `"synced account forecast assumptions"`:

- `"applies planned Roth contributions when Insights net is zero"` — keep. Floor behavior is unchanged.
- `"does not double-count planned contributions on top of Insights net"` — keep the no-double-count invariant (`totalNew === 73_000`) but move the $61k leftover from `contributionsTaxable` to **cash**. Today it asserts `year0.contributionsTaxable === 61_000` with `cashYield: 0`.
- `"compounds tax-free at a higher per-bucket return than taxable"` — unrelated; leave.

`"grows cash at cashYield instead of the portfolio return"` (describe `"forecast audit corrections"`) already proves $100k cash × 1.04 = $104k with $0 Insights net. Add a sibling that residual is included in that cash base before yield.

`packages/domain/src/retirement/retirement-savings-net.test.ts` — do not change. Exclusions stay.

### Copy that currently promises the sweep

Exact strings (only two surfaces; no iOS match):

**Year inspector** — `packages/features/src/retirement/plan/year-inspector.tsx`

- Accumulation caption (~35–41): `We invest your trailing Insights net each year until retirement, after stripping investment yield that the portfolio already compounds. Housing and healthcare lines reallocate that spend — they are not added on top. Taxes paid is estimated from projected income and brackets for this chart; it is not withdrawn again from take-home.`
- Row (~101–102): `label="Taxable savings"` bound to `year.contributionsTaxable` (planned **plus** residual today)

**Savings path** — `packages/features/src/retirement/plan/savings-path-table.tsx`

- Title: `Savings path`
- Body (~32–35): `We invest your trailing Insights net ({formatMoney(firstYearSavings)} this year), grown with salary and the scenario contribution rate, until retirement. Cash grows at the cash yield, not the portfolio return.`
- `firstYearSavings` and the Saved column sum `contributionsTaxable + contributionsTaxDeferred + contributionsTaxFree` (so Saved currently equals Insights net because residual is stuffed into taxable)

Risk tab (`packages/features/src/retirement/risk/risk-tab.tsx` ~106) `Cash grows at the cash yield; homes are not randomized.` is still true. No change required.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Accumulation loop | `packages/domain/src/retirement/project.ts` ~775–816 | Change residual destination; keep planned contribs as floor |
| Post-retirement surplus | same file ~780–781 | Same savings rule |
| Cash vs investable split | `project.ts` ~200–202; `build-baseline.ts` ~461–469 | `balances.cash` already exists |
| Insights net | `retirement-savings-net.ts` + `build-baseline.ts` ~603–606 | Capacity ceiling; do not retune exclusions |
| Year ledger | `RetirementProjectionYearSchema` in `packages/contracts/src/retirement.ts` | Add `contributionsCash` so inspector can split planned vs residual |
| Cash yield input | `RetirementPlanInputs.cashYield`; `planningContext.cashYield` | Phase 1 keeps household rate; Phase 3 recompute from cash accounts |
| Weighted-return helper | `weightedBucketReturns` in `build-baseline.ts` | Pattern for Phase 3 `weightedCashYield` |
| Account source | `RetirementAccountSource` (`isCash`, `annualReturnRate`) | Phase 3: also plumb `forecastInputsUserEdited` (or equivalent "rate is user-set") |
| Stocks / Other chart | `packages/charts/src/projected-net-worth-chart.tsx` | Engine landing bucket is enough for v1 |
| Liquid mix | `packages/domain/src/retirement/liquid-type-mix.ts` | Cash → `other` already |
| Year inspector | `packages/features/src/retirement/plan/year-inspector.tsx` | Split Taxable savings vs Added to savings |
| Savings path | `packages/features/src/retirement/plan/savings-path-table.tsx` | Copy + Saved still includes residual via `contributionsCash` |
| Edit plan cash yield | `plan-settings-drafts.ts` / `plan-settings-assumptions.tsx` | Household fallback; no surplus-destination widget |
| Account details accordion | `account-detail-dialog.tsx` | Phase 3: expose yield on checking/savings |
| Leftover test | `retirement-engine.test.ts` ~1913–1939 | Must expect leftover on cash |
| Cash yield test | same file ~1762–1781 | Keep; add residual-before-yield case |

## Target Experience

No new retirement chrome in v1. No "send surplus to brokerage" toggle. Behavior change is the engine; copy tells the truth.

### How leftover is steered (the only user control)

1. Open a brokerage / 401(k) / Roth in Financial Profile account details or Edit plan Investment accounts.
2. Set **Monthly contribution** (e.g. Robinhood Individual $1,000/mo) and **Expected annual return**.
3. Planned dollars compound in that tax bucket at that bucket's return.
4. Everything Insights net still has above the planned total stays in savings and earns cash yield.
5. Want more in stocks later? Raise the monthly contribution. The engine will not sweep the gap for you.

### Year inspector (accumulation years)

Replace the invest-the-net caption. Keep housing/healthcare/tax caveats; stop saying leftover net is invested.

**Caption (replace the first sentence; keep the rest):**

> Planned contributions are invested in 401(k), Roth, and brokerage. Leftover cash flow after those contributions stays in savings and earns cash yield. Housing and healthcare lines reallocate that spend — they are not added on top. Taxes paid is estimated from projected income and brackets for this chart; it is not withdrawn again from take-home.

**Rows:**

| Label | Binding after change |
|-------|----------------------|
| Taxable savings | Planned brokerage contributions only (`contributionsTaxable` **without** residual) |
| Tax-deferred savings | Unchanged (`contributionsTaxDeferred`) |
| Tax-free savings | Unchanged (`contributionsTaxFree`) |
| Added to savings | Residual Insights net (`contributionsCash`) |
| Cash | Ending `cashBalance` (start + residual − withdrawals, then cash yield) |

Do not keep stuffing residual into `contributionsTaxable` and relabeling. Split the ledger field so Saved math and inspector rows cannot drift.

### Savings path

**Body (replace):**

> Planned contributions are invested each year until retirement. Leftover cash flow after those contributions stays in savings and earns cash yield, not the portfolio return. This year's planned contributions are {formatMoney(plannedOnly)}; leftover added to savings is {formatMoney(residual)}.

If keeping a single Saved column, Saved = planned 401(k)+Roth+taxable + residual (`contributionsTaxDeferred + contributionsTaxFree + contributionsTaxable + contributionsCash`) so it still equals Insights net capacity. The sentence must not say that total is invested.

Columns can stay Age / Saved / Investable in v1. Optional later: split Saved into Invested vs Added to savings. Not required to ship Phase 2.

### Overview chart

No new series. After the engine change, year-1 Stocks should read ~$317k in the motivating case and Other should rise by residual × (1 + cashYield). If Stocks still jump toward $394k, the residual is still landing in taxable.

### Edit plan

Cash yield remains the household fallback (Growth accordion, label **Cash yield**). Do not add "Surplus destination: savings | brokerage".

## Architecture / Data Model

No new tables. No surplus-destination column. No change to live Plaid balances.

### Engine contract (Phase 1)

Each accumulation year, after withdrawals, **before** growth:

1. Apply planned 401(k) / Roth / taxable contributions to `taxDeferred` / `taxFree` / `taxable` only. Floor behavior unchanged: planned contribs apply even when Insights net is $0.
2. `residual = max(0, availableNet - plannedTotal)` is added to **`cashBalance`**, not `taxable`.
3. `recordedContributionsTaxable = plannedTaxable` only.
4. `recordedContributionsCash = residual` (new year field).
5. Then `cashBalance *= (1 + inputs.cashYield)`.
6. Then taxable grows at the taxable/stock return on **start + planned taxable contribs only**.

Post-retirement: `if (surplus > 0) cashBalance += surplus` (not `balances.taxable`), then the same cash yield step. Record that surplus on `contributionsCash` so the inspector stays honest.

Suggested loop shape (not a new API — same function):

```text
balances.taxDeferred += plannedDeferred
balances.taxFree += plannedFree
balances.taxable += plannedTaxable
cashBalance += residual            // accumulation
// or cashBalance += surplus       // retired
recordedContributionsTaxable = plannedTaxable
recordedContributionsCash = residual or surplus
cashBalance *= (1 + inputs.cashYield)
balances.taxable *= (1 + taxableReturn)
```

### Year ledger

Add `contributionsCash: z.number()` to `RetirementProjectionYearSchema` in `packages/contracts/src/retirement.ts`. Engine always writes it (0 when none). Update any fixture years that construct the object by hand.

Do not add a `residualTaxable` field. The whole point is there isn't one.

### Phase 3 cash yield (weighted)

New helper next to `weightedBucketReturns`, e.g. `weightedCashYield(accounts, fallbackRate)` in `build-baseline.ts`:

- Include `account.isCash && !account.isDebt` with `balance > 0`.
- Weight by **current cash balances**.
- Rate source: `annualReturnRate` **only when the user set it** (`forecastInputsUserEdited` on Plaid; manual cash rows that actually stored a rate). Never treat the Plaid schema default `0.07` as a cash yield.
- If no cash account has a user-set rate, return `planningContext.cashYield` / `ForecastAssumptions.defaultCashYield` (today's household rate).
- One engine `cashBalance` is enough. Do **not** split residual across Wells Fargo vs HYSA in v1. Only the **rate** reflects those accounts.

Default decision: **balance-weighted average of current cash balances** (honest, no silent optimization). A 0.01% WF checking with most of the cash plus a smaller 3% HYSA should pull the blended yield toward 0.01%, not toward 3% and not toward 4.5% default. Open question below if Tyler wants "highest cash rate" instead.

Plumb `forecastInputsUserEdited` (boolean) onto `RetirementAccountSource` from `PlaidAccountSourceRow` so the helper can see it. `toRetirementAccountSourceFromPlaid` must stop substituting `DEFAULT_RETURN_RATE` (7%) onto cash accounts when the column is "present" only because of the schema default — use the user-edited flag, not `?? 0.07`.

Account settings UI (still Phase 3, still not a surplus control): show Expected annual return / cash yield on checking and savings details, writing the same `annualReturnRate` + `forecastInputsUserEdited` columns. Manual cash accounts get that field without flipping "Is investment account."

`inputs.cashYield` remains a single number on `RetirementPlanInputs`. Phase 3 only changes how `build-baseline.ts` fills it. `project.ts` does not need a new rate parameter.

## Implementation Plan

Do **not** implement as part of writing this spec.

### Phase 1 — engine + tests (must ship first)

1. Change accumulation residual from taxable to `cashBalance` in `project.ts`. Update the comment that says residual goes to taxable.
2. Apply the same landing bucket to post-retirement surplus.
3. Stop folding residual into `recordedContributionsTaxable`. Write `contributionsCash`.
4. Add `contributionsCash` to `RetirementProjectionYearSchema`.
5. Update `types.ts` comments on `preRetirementAnnualNetIncome` and any "applied to taxable" wording.
6. Update `retirement-engine.test.ts`: leftover-on-taxable → leftover-on-cash; add residual-then-cash-yield; optional identity test using the ≈ $317k Stocks / residual-to-cash story (use ≈ / tolerances, not fake cents).
7. Leave `retirementSavingsNet` exclusions and the Insights-net-as-capacity-ceiling behavior alone.

**Acceptance:** planned contribs still apply at $0 Insights net; leftover of $73k net − $12k planned is on cash, not taxable; cash yield compounds start+residual; taxable return does not compound residual.

### Phase 2 — inspector / savings-path copy

1. Year inspector: new caption; split Taxable savings vs Added to savings.
2. Savings path: stop saying leftover Insights net is invested; say planned contributions are invested and leftover stays in savings at cash yield.
3. Saved column still sums planned + residual so it matches Insights net capacity.

**Acceptance:** a user reading Plan tab copy cannot conclude leftover net is auto-invested in stocks.

### Phase 3 — cashYield from checking/savings account rates

1. `weightedCashYield` from user-set cash-account rates, else household `defaultCashYield`.
2. Plumb `forecastInputsUserEdited` (or equivalent) onto `RetirementAccountSource`.
3. Expose yield on checking/savings account details (existing columns).
4. Edit plan Cash yield remains the household fallback / editor for the default. No surplus-destination UI.

**Acceptance:** 0.01% WF + 3% HYSA blend by current balances; a household with only unedited cash accounts still uses default cash yield (not silent 7%).

## Acceptance Criteria

- [ ] Accumulation residual (`max(0, availableNet - plannedTotal)`) is added to `cashBalance`, not `balances.taxable`
- [ ] Planned 401(k) / Roth / taxable contributions still apply as a floor, including when Insights net is $0
- [ ] Insights net is still the savings-capacity ceiling; planned contribs are not added on top of it (no double-count)
- [ ] `retirementSavingsNet` exclusions are unchanged
- [ ] After contributions, `cashBalance` grows at `inputs.cashYield`; taxable grows at the taxable/stock return on start + planned taxable only
- [ ] Post-retirement surplus uses the same savings landing bucket (`cashBalance`), unless Open Question 1 is reversed before implementation
- [ ] `RetirementProjectionYear.contributionsTaxable` is planned brokerage only; residual is `contributionsCash`
- [ ] `retirement-engine.test.ts` "does not double-count planned contributions on top of Insights net" still checks total new savings = Insights net, but leftover is on **cash** (today's `contributionsTaxable === 61_000` becomes cash)
- [ ] A test covers residual added to cash **before** cash yield (start + residual, then × `(1 + cashYield)`)
- [ ] Year-1 identity (motivating case, ≈): Stocks ≈ start × 1.07 + ~$12k planned brokerage grown ≈ **~$317k**, not ~$394k. Residual before yield ≈ `$394,306 / 1.07 − $284,513` ≈ **$84k**. Other/cash ≈ `($38,788 + residual) × (1 + cashYield)`. Today's Other path `$38,788 × 1.045 = $40,533` is the no-residual baseline
- [ ] Overview chart Stocks = taxable non-cash; residual no longer inflates Stocks and does inflate Other/cash
- [ ] Year inspector caption no longer says "We invest your trailing Insights net"; Taxable savings vs Added to savings are split
- [ ] Savings path no longer says leftover Insights net is invested
- [ ] No auto-allocation / surplus-destination UI in v1
- [ ] Live Plaid balances are not written by this work
- [ ] Phase 3: `cashYield` is the balance-weighted average of user-set checking+savings forecast rates, else household `defaultCashYield`; schema default 7% on `PlaidAccount.annualReturnRate` is not treated as a cash rate
- [ ] Related spec `synced-account-forecast-assumptions` remainder-goes-taxable checkbox is updated to remainder-goes-cash when this ships (do not silently leave that spec wrong)

## Non-Goals

- No auto-allocation UI (glide path, % to brokerage, surplus destination picker) in this spec
- Do not change Insights net calculation (`retirementSavingsNet` exclusions stay)
- Do not stop using Insights net as the savings *capacity* ceiling; only change *where residual lands*
- Do not change live Plaid balances
- Do not project checking and savings as separate engine buckets in v1 (one `cashBalance`)
- Do not silently pick the highest cash rate (HYSA) for residual unless Open Question 2 is reversed
- Do not retune `weightedBucketReturns` for stocks/401k/Roth as part of this work
- Do not implement the engine in the spec-writing task
- iOS copy parity (no matching strings found; not a v1 blocker)

## Open Questions

1. **Post-retirement surplus (~780–781) also `balances.taxable += surplus`.** Default decision: **same rule — surplus to cash.** Reopen only if Tyler wants retired leftover to keep sweeping into brokerage.
2. **0.01% WF checking + 3% HYSA:** is balance-weighted average OK, or should residual accrue at the highest cash rate? **Default decision: weighted average of current cash balances** (honest, no silent optimization). One-line disagreement path: if Tyler wants residual at the HYSA rate, say so before Phase 3; Phase 1 does not depend on this.
3. **Checking/savings yield UI.** Rates are supposed to come from account settings, but synced cash accounts currently hide the forecast accordion. Phase 3 exposes `annualReturnRate` on those details. Confirm that is wanted vs "household cash yield only until someone asks for per-account cash rates."

## Related Specs

- [synced-account-forecast-assumptions/spec.md](../synced-account-forecast-assumptions/spec.md) — planned contribs as floor; **supersedes** "remainder goes taxable"
- [retirement-edit-plan-assumptions/spec.md](../retirement-edit-plan-assumptions/spec.md) — cash yield already in Edit plan; household fallback
- [retirement/spec.md](../retirement/spec.md) — baseline + tax buckets + year inspector
- [retirement/forecast-audit.md](../retirement/forecast-audit.md) — earlier audit of Insights-net compounding; cash vs 7% (partially landed; residual-to-taxable is the remaining sweep)

## Suggested Commit Message

```text
docs (retirement): spec surplus cash flow to savings not stocks
```
