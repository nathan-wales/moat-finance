# Retirement Forecast Audit

Status: findings from a code-level audit of the live retirement engine against one Standard-scenario run:

| Observed | Value |
|----------|-------|
| Starting net worth | ~$561,709 (portfolio bar ~$562,140) |
| Deterministic net worth at 60 | $15,175,534 |
| Summary card “at retirement” | ~$13.5M |
| Monte Carlo median at 60 | ~$13.2M |
| Deterministic net worth at 95 | ~$71.6M |
| Monte Carlo median at 95 | ~$30.5M |
| Monte Carlo P10 and P25 at 95 | both exactly $5,989,714 |
| Confidence | 71% |
| Target retirement | 60 |
| Earliest funded age | 52 |
| Active scenario | Standard: 7% return, 3% inflation, 3% salary, 2% contribution, 3% expenses |

Engine under review: `packages/domain/src/retirement/`. UI: `packages/features/src/retirement/`. Account mapping: `packages/data-access/src/retirement-sources.ts`.

How to read this: each checklist item has a **verdict**, what the code actually does, how that maps to this run, and the highest-leverage fix. File paths are repo-relative.

---

## Scoreboard

| # | Item | Verdict |
|---|------|---------|
| 1 | $562k → $15.2M at 60 | **Questionable** — path is Insights net cash flow compounded at 7%, not a contribution schedule. $15.2M is arithmetically possible only with a young current age **or** a much higher savings rate than the Insights ~$73k fixture. |
| 2 | Contribution / transfer double-counting | **Mostly guarded, residual risk** — paired transfers and the Transfer category are excluded; the engine does not add `monthlyContribution` on top of Insights net. Dividends-as-income + 7% total return can still double-count investment yield. |
| 3 | 7% applied to total net worth | **Fail** — 7% is applied to every liquid bucket including cash and “other” assets. `cashYield` is stored and never used. Real estate is the one carve-out (appreciation + amortization). |
| 4 | Future dollars vs today’s dollars | **Fail (labeling)** — the ledger is consistently **nominal**. The UI never says so. $71.6M at 95 is ~$10–16M in today’s dollars depending on current age. |
| 5 | P10 = P25 = $5,989,714 at 95 | **Explained, misleading** — illiquid real-estate floor. Monte Carlo does not shock property values. With ~29% of trials depleted, both P10 and P25 sit on that identical floor. |
| 6 | Monte Carlo assumptions | **Partial** — 1,000 iid Normal(7%, 13%) years, clipped. No correlations, no asset-class mix, no historical bootstrap. Volatility comes from `forecastStyle`, not the scenario card. |
| 7 | Deterministic vs Monte Carlo | **Pass (intentional)** — same cash-flow engine; only the return sequence changes. The 60 and 95 gaps are volatility drag + sequence-of-returns, amplified after withdrawals start. |
| 8 | $13.5M vs $15.18M | **Explained, unlabeled** — $13.5M is **liquid + tax-advantaged** at 60; $15.18M is **net worth** (adds real-estate equity). Spec intended this split; the UI does not name it. |
| 9 | Taxes and withdrawal logic | **Partial** — buckets, RMDs, SS taxability, and withdrawal order are real. Cash is taxed like brokerage (50% of withdrawals treated as gains). HSA = Roth. No account-level cost basis. |
| 10 | 71% / retire at 60 / earliest 52 | **Fail (incompatible definitions)** — 71% is Monte Carlo at age 60; 52 is deterministic only; “retire at 60” is the plan setting. The metric strip presents them as one story. |

---

## 1. Trace $562k today → $15.2M at 60

**Verdict: Questionable.** The $15.2M is not a 7% grow-out of today’s $562k. It is today’s investable balances plus **every future year’s Insights net cash flow**, all compounded at the scenario return. Whether that is realistic depends on current age and whether Insights net is true new savings.

### What the engine actually saves

During accumulation, the ledger does **not** use a contribution schedule as extra cash. It takes trailing Insights net income and grows it with salary growth:

```554:604:packages/domain/src/retirement/project.ts
		const grownObservedNet = inputs.preRetirementAnnualNetIncome * salaryFactor;
		// ...
				const accumulationGap = Math.max(0, -grownObservedNet);
				needFromPortfolio = Math.max(
					0,
					oneTimeOutflows +
						taxResult.totalTax +
						accumulationGap -
						oneTimeInflows -
						rmd,
				);
```

Then it **reallocates** that net across 401(k) / Roth / taxable buckets and dumps the remainder into taxable:

```708:728:packages/domain/src/retirement/project.ts
		} else {
			// Allocate observed net across contribution buckets, remainder taxable.
			// Contributions are a reallocation of Insights net — not extra cashOut.
			const availableNet = Math.max(0, grownObservedNet);
			const deferredAdd = Math.min(contributionsTaxDeferred, availableNet);
			const freeAdd = Math.min(
				contributionsTaxFree,
				Math.max(0, availableNet - deferredAdd),
			);
			const taxableAdd = Math.min(
				contributionsTaxable,
				Math.max(0, availableNet - deferredAdd - freeAdd),
			);
			balances.taxDeferred += deferredAdd;
			balances.taxFree += freeAdd;
			balances.taxable +=
				Math.max(0, availableNet - deferredAdd - freeAdd - taxableAdd) +
				taxableAdd;
```

So for every pre-retirement year:

```text
annualSavings(age) = max(0, InsightsNet × (1 + salaryGrowth)^yearIndex)
```

`salaryGrowth` is the Standard scenario’s **3% Salary** field (`ForecastScenario.salaryGrowth`), **not** the 2% Contrib. field. `contributionChange` is never read by the retirement engine (`build-baseline.ts` wires `salaryGrowth`, `inflationRate`, `investmentReturn` only).

Contributions stop at `min(contributionsStopAge, employmentEndsAtAge)`, both defaulting to the retirement age. At 60, savings go to zero and withdrawals start.

The live per-year amounts are already on the projection:

- `years[].contributionsTaxable`
- `years[].contributionsTaxDeferred`
- `years[].contributionsTaxFree`

The year inspector does **not** render those fields (`packages/features/src/retirement/plan/year-inspector.tsx`), so the UI never shows the savings path that produces $15.2M.

### Starting balances (from the portfolio screenshot)

| Bucket | Amount | Engine treatment |
|--------|--------|------------------|
| Stocks | $181,101 | taxable, 7% |
| 401(k) | $80,775 | tax-deferred, 7% |
| Cash | $38,637 | taxable, **7%** (see §3) |
| Roth IRA | $29,371 | tax-free, 7% |
| Other assets | $23,000 | taxable, 7% |
| HSA | $15,000 | tax-free, 7% |
| Real estate (2 holdings) | $194,257 | **not** 7% — property schedule at ~3% appreciation |
| **Total** | **$562,141** | |

Liquid start ≈ $367,884. Real estate is projected separately. Manual `REAL_ESTATE` investment rows are skipped so they are not double-counted with `RealEstateInvestment` (`PostgresRetirementRepository.listAccountSources`).

Insights math used by retirement is the same helper as the Insights 12-month card (`getNetIncome` → `getMonthlyTotals`). A committed engine fixture for this household uses:

- trailing income **$268,437**
- trailing spend **$195,559**
- trailing net **$72,878**
- Roth **$29,371** and cash **$38,637** matching the screenshot

(`packages/domain/src/dashboard/get-net-income.test.ts`, `packages/domain/src/retirement/retirement-engine.test.ts`)

### Reconstructed path (nominal, 7% / 3% salary growth)

Closed-form check: end-of-year savings, then 7% on liquid; 3% on unlevered $194k real estate; $7k/mo retirement spend inflating at 3%. This is slightly simpler than the full tax/RMD ledger but is the right order of magnitude.

| Current age | Annual savings today | Model NW at 60 | Hits ~$15.2M? |
|-------------|----------------------|----------------|---------------|
| 40 | $72,878 (Insights fixture) | ~$6.0M | No |
| 40 | ~$220,000 | ~$14.7M | Only if almost all $268k income is treated as savings |
| **29** | **$72,878** | **~$15.3M** | **Yes** |
| 35 | $140,000 | ~$15.7M | Yes, if Insights net is ~2× the fixture |

If the plan’s current age is ~29–31 and Insights net really is ~$73k growing 3%/year, **$15.2M at 60 is arithmetically consistent with 7%**. Rough year-by-year savings for that case:

| Age | Assumed new savings (nominal) | Implied liquid (7%) | RE equity (3%) | Net worth |
|-----|-------------------------------|---------------------|----------------|-----------|
| 29 | $72,878 | — | — | $0.56M start |
| 35 | $87,020 | ~$1.3M | ~$0.23M | ~$1.6M |
| 40 | $100,880 | ~$2.4M | ~$0.28M | ~$2.7M |
| 45 | $116,948 | ~$4.1M | ~$0.32M | ~$4.4M |
| 50 | $135,560 | ~$6.6M | ~$0.37M | ~$7.0M |
| 55 | $157,140 | ~$10.2M | ~$0.43M | ~$10.6M |
| 59 | $176,820 | ~$14.1M | ~$0.49M | ~$14.6M |
| 60 | $0 (retired) | ~$14.8M liquid | ~$0.50M | **~$15.3M** |

Total new savings age 29→59 ≈ **$3.6M** of contributions; the rest is compound return. A 3% raise on $73k of saving for 30 years is aggressive but not impossible for a high earner whose spending stays a roughly constant share of income.

If current age is **~40** (the engine default when birth year is missing — `build-baseline.ts` uses `currentAgeHint ?? 40`), $15.2M would require ~$220k of new savings every year, i.e. the model treating ~82% of the $268k Insights income as investable. That is **not** realistic take-home saving; it is a symptom of inflated Insights net (see §2) or a missing spending side.

7% on the **entire** $562k with $73k of saving still only produces ~$6.6M at 60 from age 40. The $15.2M is therefore **not** “7% on the house.” It is “7% on liquid + a large, growing annual savings flow.”

### Is that savings flow realistic?

- **Realistic** if current age is late 20s / early 30s **and** Insights net is true cash left after living costs, taxes, and already-hidden transfers.
- **Not realistic** if current age is ~40+ **or** Insights net includes dividends, unpaired transfers-in, or gross wages without the matching 401(k)/tax withholdings.
- Standard **2% Contrib.** is ignored. Savings grow at **3% salary**, so the implied savings *rate* stays constant while dollar saving rises with income. That permanently high savings rate is the main driver of the hockey stick.

### Fix

1. Show `contributions*` on the year inspector and a “savings path” table on Plan.
2. Label the flow: “We invest your trailing Insights net ($X/year today), grown at salary growth, until retirement.”
3. Honor `contributionChange` or stop showing it on the scenario card as if retirement used it.
4. Cap or haircut Insights net that is tagged as investment income (dividends/interest).

---

## 2. Contribution / savings double-counting

**Verdict: Mostly guarded, with three residual holes.**

### What is already correct

1. **Contributions are not added on top of Insights net.** `monthlyContribution` only splits net across tax buckets. If detected 401(k)+Roth+taxable contributions exceed net, they are capped. Remainder of net still goes to taxable. You cannot get “net + 401(k)” in the current ledger.

2. **Paired internal transfers are hidden.** Transfer pairing (`apps/api/src/server/services/transfer-pairing.service.ts`) soft-hides both legs (`hidden = true`). `getMonthlyTotals` excludes hidden rows, so a checking→brokerage pair does not inflate Insights net.

3. **The Transfer category is hidden on Postgres** (`apps/api/prisma/migrations/20260423120000_add_hidden_fields/migration.sql`). Plaid `TRANSFER_IN` / `TRANSFER_OUT` map to Transfer (`packages/category-mapping/src/plaid.ts`). Hidden-category txs are dropped from monthly totals.

4. **Real estate is not counted twice.** `listAccountSources` skips `InvestmentType.REAL_ESTATE` because properties have their own schedule.

5. **Pre-retirement living expenses do not create extra withdrawals.** Housing, healthcare, and insurance are carved out of living expenses and the accumulation side follows Insights net only. That was an explicit fix (see `retirement-engine.test.ts` “does not create pre-retirement withdrawals when property costs are already in trailing spend”).

### Residual double-count / mis-count risks

| Risk | What happens | Direction |
|------|----------------|-----------|
| **Dividends and interest mapped as Salary** | Plaid primary `INCOME` → category `Salary`. Dividends land in Insights income. The engine then treats them as **new annual savings** *and* applies 7% total return to the same holdings. | Inflates age-60 balance |
| **One-sided transfers** | If the other account is not connected, pairing cannot hide the leg. A transfer-in to brokerage is INCOME with no matching EXPENSE. | Inflates savings |
| **Credit card payments** | Category is **not** hidden by default. Unpaired statement payments count as EXPENSE (the original customer report in `specs/features/transfer-pairing/spec.md`). | Deflates savings |
| **Desktop Transfer seed** | SQLite inserts canonical categories with `isHidden = 0` (`packages/db-sqlite/src/migrations.ts`). Desktop can include Transfer txs in net unless pairing hid them. | Inflates savings on desktop |
| **Plaid `monthlyContribution`** | `refreshPlaidInvestmentContributionInputs` averages **all INCOME** on investment accounts over 12 months — contributions, dividends, and transfers-in. Harmless for the *total* saved (still capped by net) but can mis-bucket yield into “401(k) contribution.” | Allocation distortion |
| **Employer match** | Detected as unmodeled (`employerMatchUnmodeled`) and **not** added unless the user applies the `employer_match` lever. | Slight undercount, not a double-count |
| **Payroll 401(k)** | If wages are net of 401(k) and the 401(k) deposit is INCOME on the retirement account, that INCOME is real new saving and belongs in net. If wages are gross **and** the 401(k) deposit is also INCOME, 401(k) is counted twice in Insights income. | Possible inflate |

A double-count here is one of the few ways a ~40-year-old with ~$73k of true saving could still print $15.2M at 60. **Dividends-as-savings + 7% total return is the most likely structural inflate** still in the model.

### Fix

- Exclude Plaid income types `INCOME_DIVIDENDS`, `INCOME_INTEREST_EARNED`, `INCOME_CAPITAL_GAINS`, and similar from Insights net used by retirement (keep them in Insights if you want, but do not treat them as a savings *rate*).
- Exclude unpaired Transfer / Investments / Credit card payment from `getMonthlyTotals` the same way Spending already documents.
- Seed Transfer as hidden on SQLite.
- Stop using all INCOME on an investment account as `monthlyContribution`.

---

## 3. Is 7% applied to total net worth?

**Verdict: Fail.** The Standard 7% is applied to **every liquid balance**, including cash and “other” assets. It is not applied to real-estate market value. `cashYield` (default 4%) is copied onto the inputs and **never read** in `project.ts`.

```731:737:packages/domain/src/retirement/project.ts
		const annualReturn = annualReturnForYear(inputs, yearIndex, age);
		balances.taxable = Math.max(0, balances.taxable * (1 + annualReturn));
		balances.taxDeferred = Math.max(
			0,
			balances.taxDeferred * (1 + annualReturn),
		);
		balances.taxFree = Math.max(0, balances.taxFree * (1 + annualReturn));
```

`annualReturnForYear` is the scenario `returnRate` (or a Monte Carlo draw). There is no per-account rate, despite `RetirementAccountSource.annualReturnRate` being loaded from Plaid/manual investments.

| Asset | Screenshot | Growth in engine |
|-------|------------|------------------|
| Stocks / brokerage | $181,101 | 7% (OK as a portfolio assumption) |
| 401(k) | $80,775 | 7% |
| Roth / HSA | $44,371 | 7% |
| **Cash / checking** | **$38,637** | **7%**, not `cashYield` 4% |
| **Other assets** | **$23,000** | **7%** (vehicles/collectibles would be wrong) |
| Real estate | $194,257 value in the bar | `appreciationRate` default **3%**, plus mortgage amortization |
| Credit / loans | (otherDebt) | Subtracted from **baseline** net worth only; **dropped from the projection** |

Cash mapping: Plaid `depository` / `cash` → `isCash: true`, `taxTreatment: "taxable"` (`retirement-sources.ts`). Cash is then folded into `balances.taxable` in `build-baseline.ts` and gets the equity return.

Per-account `annualReturnRate` is ignored. A money-market account with a 4% user-edited rate still compounds at 7%.

Real estate is the actual carve-out:

```139:139:packages/domain/src/retirement/project.ts
	property.value *= 1 + property.appreciationRate;
```

Default appreciation is `ForecastAssumptions.realEstateAppreciationRate` (3%), not the 7% return. Mortgages amortize monthly. Equity = value − loan. That part is correct.

Non-mortgage debt (`isDebt` Plaid credit/loan) is subtracted once on the baseline summary and then disappears. The projection’s `netWorth` is only `liquidAssets + realEstateEquity`. Paying down cards is not modeled; wiping them at year 0 slightly **overstates** future net worth.

On this run, 7% on cash + other (~$62k) for 20–30 years is hundreds of thousands to low millions of extra terminal value — material, but not the whole $562k→$15.2M jump. The jump is the savings flow (§1). Applying 7% to cash is still the wrong *story* for the Standard card.

### Fix

- Keep three return streams: portfolio `returnRate`, `cashYield` on `isCash`, property `appreciationRate`.
- Do not put cash in the taxable *return* bucket even if tax treatment is taxable.
- Honor per-account `annualReturnRate` when `forecastInputsUserEdited` is true.
- Carry `otherDebt` forward (at least as a flat balance or simple payoff).

---

## 4. Future dollars vs today’s dollars

**Verdict: The math is consistently nominal. The UI never says so.** $71.6M at 95 is the correct *nominal* number and looks extreme until deflated.

Every year the ledger multiplies stocks of spending, SS, premiums, and (for display) tax brackets by `(1 + inflationRate) ** yearIndex`. FRA Social Security is documented as today’s dollars, then inflated:

```271:273:packages/domain/src/retirement/project.ts
		// FRA amounts are in today's dollars; inflate with the rest of the
		// nominal ledger so benefits keep pace with spending.
		const socialSecurityIncome = socialSecurityMonthly * 12 * inflationFactor;
```

Returns are the scenario’s 7% **nominal** return, not a real return. There is no `realNetWorth` series, no purchasing-power toggle, and no “today’s dollars” label in `packages/features/src/retirement/` (grep is empty).

| Quantity | Units | Inflated? |
|----------|-------|-----------|
| Starting balances | today’s dollars | n/a |
| Insights net / contributions | today’s dollars, then × salary growth | salary, not CPI |
| Retirement living spend | input in today’s $/mo, then × CPI | yes |
| Healthcare | CPI + 2% premium | yes |
| Social Security | FRA in today’s $, then × CPI | yes |
| Tax brackets / standard deduction | 2026 statute × CPI | yes |
| Portfolio return | 7% nominal | n/a |
| Chart, $15.2M, $71.6M, $13.5M, safe spend | **nominal** | — |

Deflating $71.6M at 3% CPI:

| Years from today to age 95 | Implied current age | Purchasing power today |
|----------------------------|---------------------|------------------------|
| 50 | 45 | ~$16.3M |
| 55 | 40 | ~$14.1M |
| 60 | 35 | ~$12.2M |
| 65 | 30 | ~$10.5M |

Spending, income, taxes, and withdrawals are all in the same nominal units, so ratios (savings rate, funded/unfunded) are internally consistent. The *presentation* is the bug: a $71.6M legacy tile without “future dollars” will be read as today’s wealth.

Safe spending and expected spending are also nominal future-year dollars once overlayed, but they are described as “$/mo” as if they were today’s lifestyle.

### Fix

- Default the headline tiles and chart to **today’s dollars** (deflate by CPI), or put a persistent “Figures are future / nominal dollars” chip on every number.
- Dual-axis or a toggle: Nominal | Today’s $. Spec already allows a lens switcher; add a units switch next to it.
- Say “$X in 20XX dollars” on the age-95 tile.

---

## 5. Why P10 and P25 are both $5,989,714 at 95

**Verdict: Explained.** This is not a percentile bug. It is an **illiquid floor**.

Monte Carlo percentiles are taken on `year.netWorth` across trials:

```141:152:packages/domain/src/retirement/monte-carlo.ts
		? netWorthByYear.map((bucket, yearIndex) => {
				const sorted = [...bucket].sort((a, b) => a - b);
				return {
					age: inputs.currentAge + yearIndex,
					year: inputs.currentYear + yearIndex,
					p10: percentile(sorted, 0.1),
					p25: percentile(sorted, 0.25),
					p50: percentile(sorted, 0.5),
```

`netWorth = liquidAssets + realEstateEquity`. Liquid can go to zero. Real estate **does not** receive a random return — only `returnSequence` varies, and that sequence is applied to the three liquid buckets. Every trial has the **same** property path.

A trial is “depleted” when `liquidAssets < $1` or `shortfall > $0.50`. Confidence 71% ⇒ ~29% of 1,000 trials deplete before 95. The 10th and 25th percentiles of the age-95 **net worth** distribution therefore both fall inside the depleted mass. Those trials all report the same leftover: real-estate equity at 95, **$5,989,714**.

That dollar amount is **not** 3% on the $194k portfolio-bar figure ($194k × 1.03^55 ≈ $0.99M). Backing out 3% appreciation:

| Years to age 95 | Starting property **value** that grows to $5.99M |
|-----------------|--------------------------------------------------|
| 50 | ~$1.37M |
| 55 | ~$1.18M |
| 60 | ~$1.02M |

So the engine’s `currentEstimatedValue` (and loan paydown) is in the **~$1.0–1.4M** range, while the portfolio widget’s “Real Estate $194,257” is likely **equity**, a subset of holdings, or a different rollup. Two holdings plus amortization can also lift equity faster than 3% on today’s equity.

There is no extra clamp in `percentile()`; P10 = P25 because many trials share one number, not because extraction is wrong. `p10 <= p25 <= p50` is the only cone assertion in tests, so identical bands are allowed.

The cone is therefore **optimistic on the left tail of net worth**: “your 10th percentile is $6M” when that $6M is a house you still live in and cannot spend. Risk copy already says depleted trials “exhausted liquid assets”; the chart does not.

### Fix

- Percentile the **liquid** series (or show two cones: investable vs net worth).
- Shock real estate (even a low vol) so the floor is not a single spike.
- When P10 ≈ P25 ≈ realEstateEquity, label the band “home equity floor.”
- Surface `worstDecileLegacy` / `medianLegacy` which already exist on the Monte Carlo result.

---

## 6. Monte Carlo assumptions

**Verdict: Documented in code, thin vs the scenario card, and not shown in the UI.**

| Assumption | Implementation | Realistic? |
|------------|----------------|------------|
| Trials | `DEFAULT_MONTE_CARLO_TRIALS = 1000`, cap 2000 | Fine for a percentile cone |
| Seed | `userId + scenarioId + projectionKey` via mulberry32 | Stable across reloads; good |
| Return draw | `N(returnRate, volatility)` via Box–Muller, iid each year | Arithmetic mean, not lognormal. Left tail clipped at **−60%**, right at **+100%** |
| Volatility | `PORTFOLIO_PROFILES` from `forecastStyle`: conservative 8%, **balanced 13%**, aggressive 18% | 13% is a reasonable **equity/balanced** vol. It is **not** on the Standard card |
| Mean | Active `ForecastScenario.investmentReturn` (7%) | Matches the card |
| Inflation in MC | Deterministic 3% in every trial | No inflation uncertainty |
| Correlations | None — one factor hits taxable + 401(k) + Roth identically | No stock/bond mix, no international, no cash buffer |
| Sequence of returns | Independent annual draws; optional `sequenceRisk` / `marketShocks` levers only | No historical bootstrap, no regime switching (spec open question #6) |
| Real estate / cash | Not in the random vector | See §3 and §5 |
| Resolution | Annual | Matches the performance contract |

The Standard card shows 7% / 3% / 3% / 2% / 3%. Monte Carlo uses **7% mean, 13% vol, 3% inflation**. Salary 3% is used. Contribution 2% and expense 3% are **not**. Volatility is whatever `ForecastAssumptions.forecastStyle` says (default `"Balanced"` → 13%), even if the user only edited the scenario rates.

Geometric-mean drag of Normal(7%, 13%) ≈ `7% − 0.5 × 13%² ≈ 6.16%`. Clipping and the normal-not-lognormal choice add a fatter left tail than a GBM with the same vol.

Safe-spending search uses **250** trials, then confirms with 1,000 (`safe-spending.ts`). Confidence on the badge is the 1,000-trial number.

Nothing in the Risk tab lists vol, distribution, trial count beyond the “out of N futures” sentence, or “cash and homes are not randomized.”

### Fix

- Put vol, trial count, and “iid normal, homes/cash deterministic” on the Risk tab.
- Drive vol from the same scenario object as 7%, or show that balanced 13% is an implied default.
- Optionally use lognormal so a −50% year is less common than the current normal.

---

## 7. Deterministic vs Monte Carlo ($15.2M vs $13.2M at 60; $71.6M vs $30.5M at 95)

**Verdict: Pass on mechanism; the age-95 gap is large but expected.**

Monte Carlo is `projectRetirement({ ...inputs, returnSequence })`. Cash flows, contributions, taxes, RMDs, SS, and spending are **the same function**. The only stochastic input is the annual return.

That is the right design. The gaps are not from a second contribution model.

At **60** (still mostly accumulation):

- Deterministic: 7% every year.
- Median: roughly the geometric mean (~6.2%) plus a little path noise.
- `1.07^20 / 1.0616^20 ≈ 1.17`. Observed `15.2 / 13.2 ≈ 1.15`. Matches volatility drag, not a cash-flow bug.

At **95** (35 years of withdrawals after 60):

- Arithmetic 7% vs geometric 6.2% only explains `1.07^35 / 1.0616^35 ≈ 1.31`.
- Observed `71.6 / 30.5 ≈ 2.35`.
- The extra factor is **sequence-of-returns**: a bad decade at 60–70 forces sales that never recover, so the median path is much worse than “7% minus 0.8%.” Deterministic never sees a bad sequence. Some mass is also pinned to the $6M house floor, which pulls the median down relative to a no-floor model but not all the way to P10.

So: **intentional**, and the age-95 ratio is the honest one to talk about in the UI. A single 7% line next to a $71.6M tile without the $30.5M median is what feels like a bug.

### Fix

- Chart the deterministic line *inside* the cone, or default the Plan chart to the MC median.
- Caption: “Straight 7% is the middle of the assumption, not the typical outcome after retirement.”

---

## 8. “$13.5M at retirement” vs $15.18M on the chart

**Verdict: Intentional split, unlabeled.** Not a rounding error.

```753:815:packages/domain/src/retirement/project.ts
		if (age === inputs.retirementAge) assetsAtRetirement = liquidAssets;
		// ...
			liquidAssets,
			realEstateEquity,
			debtBalance,
			netWorth: liquidAssets + realEstateEquity,
```

`assetsAtRetirement` is **liquid + tax-advantaged** at year-end of age 60. The overview chart is hard-coded to `lens="netWorth"` (`overview-tab.tsx`). Tooltip uses `formatCurrency` (full dollars) → **$15,175,534**. The metric-strip hint uses `formatMoney(assetsAtRetirement)` → **$13.5M** once the amount is ≥ $10M (one decimal).

The V1 spec says this in so many words:

> Projected assets at retirement = total liquid + tax-advantaged balances (nominal)  
> Projected legacy = net worth at longevity, including illiquid real estate equity

The UI does not. The strip label is “Legacy at 95” with a hint “$13.5M at retirement.” Hovering the chart says “Net worth.” A user will assume they are the same stock.

$15.18M − $13.5M ≈ **$1.7M of real-estate equity at 60**, which is consistent with a ~$1.2M property plus 20–30 years of 3% and paydown, and with the $6.0M floor at 95 (§5).

Monte Carlo median at 60 (~$13.2M) is a different number (stochastic liquid + the same house). Do not conflate it with $13.5M.

### Fix

- Hint: “$13.5M investable · $15.2M including home equity.”
- Overview chart: default lens control, or plot both series.
- Rename `assetsAtRetirement` in the UI to “Investable at retirement.”

---

## 9. Taxes and account-specific withdrawal logic

**Verdict: Real bucket-level tax engine, not a pretax=$Roth model. Several planning-grade shortcuts remain.**

### What is modeled separately

| Topic | Behavior |
|-------|----------|
| Account buckets | `taxable` / `taxDeferred` / `taxFree` from subtype or `InvestmentType` |
| Withdrawal order | Default **taxable → tax-deferred → tax-free**; user-overridable; `resolveWithdrawals` stops at each bucket |
| RMDs | IRS Uniform Lifetime Table; start age 73, or 75 if birth year ≥ 1960 (`rmd.ts`, SECURE 2.0) |
| Tax-deferred withdrawals | Ordinary income, including RMDs and Roth conversions |
| Roth / HSA withdrawals | Tax-free bucket; **HSA has no extra medical-only rules** |
| Taxable withdrawals | **50%** assumed realized gain (`TAXABLE_GAIN_FRACTION`), taxed on the long-term scale (0/15/20%) |
| Social Security | Early/late factors; provisional-income 50%/85% inclusion; survivor = max of the two benefits |
| Federal tax | 2026 brackets + standard deduction + senior extra; brackets inflate |
| State tax | Flat `stateTaxRate` on taxable income |
| Roth conversions | Lever only (`annualAmount` or fill-to-bracket) |
| Home sale | 6% costs; primary exclusion $250k/$500k |

A $15M **401(k)** is not treated like $15M **Roth**. Tax-deferred draws raise ordinary income and can tax Social Security; Roth draws do not. That part of the concern is addressed.

### Shortcuts that still lump unlike assets

- **Cash is taxable.** Withdrawing checking is treated as 50% capital gain. Overstates tax on cash and understates tax if a brokerage is almost all gain.
- **HSA = Roth.** No 20% penalty, no qualified-medical distinction, no death-of-account-holder change.
- **Traditional IRA vs 401(k) vs 403(b)** are one `taxDeferred` pile. Fine for tax; wrong for contribution limits if a lever says “max 401(k).”
- **No NIIT, IRMAA, ACA, QCD, NUA, state retirement exclusions** — spec non-goals.
- **Accumulation-phase income tax is display-only.** Cash flow uses after-tax Insights net so wages are not taxed twice. The Taxes chart still paints a wage tax so the chart is “honest.” Spendable income in working years can disagree with Insights take-home.
- **`TAX_SOLVE_ITERATIONS = 4`** — withdrawals depend on tax depend on withdrawals; it iterates rather than fully solving.

For this run, the $15.2M at 60 is a mix (brokerage + 401(k) + Roth + HSA + cash + house). After-tax spendable in retirement is lower than $15.2M of Roth would be. The engine does capture that on the paycheck ledger; the headline tiles do not.

### Fix

- Split cash vs taxable-brokerage for both return and capital-gains fraction.
- Label tiles “pre-tax equivalent” vs “spendable” if you keep a single $15.2M.
- Keep HSA in tax-free but don’t allow unconstrained lifestyle withdrawals before 65 without a note.

---

## 10. “71% confidence,” “retire at 60,” “earliest funded age 52”

**Verdict: Fail.** Three different definitions, one metric strip.

| Metric | Definition in code | Uses Monte Carlo? | Uses target spend? |
|--------|--------------------|-------------------|--------------------|
| **Retire at 60** | `RetirementPlan.targetRetirementAge` (default 65, user/onboarding). Displayed as `retirementAgeUsed` | No | No — it is an input |
| **71% confidence** | `fundedTrials / trials` at **that same target age**, through `longevityAge`. Funded = never `liquid < $1` and never `shortfall > $0.50` | **Yes** (1,000 trials) | Yes — expected retirement spend |
| **Earliest funded 52** | Bisection on integer ages; `projectRetirement` deterministic only (`earliest-retirement.ts`) | **No** | Yes, deterministic spend |

Comments in `earliest-retirement.ts` are explicit:

> Deterministic only, per the performance contract… The Risk tab re-tests the answer with Monte Carlo when the user asks for it.

The Risk tab does **not** re-test earliest age. It re-runs confidence at the **current** target age.

Headline logic (`headline.ts` / `retirement-copy.ts`):

- If earliest ≤ target **and** confidence ≥ 80% (or MC still loading): “You’re on track to retire at {60}.”
- If earliest ≤ target **and** confidence < 80%: “You can likely retire at {60}, but the plan is sensitive to market conditions.”
- 71% should take the **sensitive** sentence once MC returns. Until MC returns, the page can flash “on track.”

Plan confidence (input completeness, `plan-confidence.ts`) is a **different** percentage, labeled “Retirement projection confidence” on the overview — easy to mix with 71%.

**Age 52 is not “71% safe.”** It is “the 7% straight line still pays the bills through 95.” Sequence risk is ignored. Confidence at 52 would be materially worse than 71% (fewer accumulation years, longer retirement). Showing 52 next to 71% and 60 implies a single safety concept.

The 80% “on track” cutoff is also independent of `confidenceTarget` (default **85%**), which is used for safe-spending search. You can be “on track” at 82% while safe spend is calibrated to 85%.

### Fix

- Caption earliest as “Earliest age the average 7% path funds (not a success probability).”
- Compute MC confidence at earliest age (even with 250 trials) and show it as a second badge, or hide 52 until that exists.
- Don’t put 71% on the same strip as 52 without “at age 60.”
- Drive the headline threshold from `confidenceTarget`, not a hard-coded 80%.
- Rename plan-confidence to “Input completeness.”

---

## Cross-cutting: what this run is really saying

A fair one-paragraph reading of **this** Standard run:

Moat is taking ~$368k of accounts it treats as investments (including cash), adding whatever Insights currently calls “net” every year, growing that net at 3% with salary, compounding the pile at a straight 7% until 60, then spending a CPI-indexed retirement lifestyle while the same 7% continues. The house (likely ~$1M+ of *value* in the property table, not the $194k bar) appreciates at 3% and is never sold. In future dollars that prints **$15.2M at 60** and **$71.6M at 95**. In a 1,000-trial world with 13% vol, the typical outcome is **~$13.2M at 60** and **~$30.5M at 95**, 29% of lives exhaust cash/investments, and those lives still “have” **$6.0M** because that is the house. **71%** means “71% of those lives can pay the plan at **60**,” not at 52. **52** is only the straight 7% line.

That is a coherent model. It is not the model the Standard card plus unlabeled tiles communicate.

---

## Recommended fix order

Highest leverage first; each item is a single-purpose PR.

1. **Label units and stocks** — “nominal / future $” vs “today’s $”; “investable” vs “net worth including home.” Unblocks §4 and §8 without touching math.
2. **Stop 7% on cash (and other non-market assets)** — use `cashYield`; don’t put `isCash` in the return bucket. Unblocks §3.
3. **Show the savings path** — year inspector + a table of `contributions*`. Unblocks §1.
4. **Strip investment income from Insights net used by retirement.** Unblocks §2 inflate.
5. **Cone on liquid assets** (or dual cone) so P10/P25 cannot collapse onto the house. Unblocks §5.
6. **Disclaim earliest age as deterministic**; optionally MC-test it. Unblocks §10.
7. **Honor or hide** scenario `contributionChange` / `expenseGrowth`; show MC vol on the scenario card. Unblocks §6.

---

## Code map

| Concern | File |
|---------|------|
| Year ledger, returns, contributions, NW | `packages/domain/src/retirement/project.ts` |
| Insights net, rates, buckets, cashYield | `packages/domain/src/retirement/build-baseline.ts` |
| Account tax treatment, isCash | `packages/data-access/src/retirement-sources.ts` |
| Monte Carlo, percentiles, depletion | `packages/domain/src/retirement/monte-carlo.ts` |
| Earliest age (deterministic) | `packages/domain/src/retirement/earliest-retirement.ts` |
| Headline “on track” vs “sensitive” | `packages/domain/src/retirement/headline.ts` |
| Taxes, SS inclusion, gains | `packages/domain/src/retirement/taxes.ts` |
| Withdrawal order | `packages/domain/src/retirement/withdrawal-order.ts` |
| RMDs | `packages/domain/src/retirement/rmd.ts` |
| $13.5M tile | `packages/features/src/retirement/header/metric-strip.tsx` |
| Chart hover $15.18M | `packages/charts/src/retirement-timeline-chart.tsx` |
| MC overlay on summary | `packages/contracts/src/retirement.ts` → `overlayRetirementMonteCarlo` |
| Transfer hiding | `apps/api/src/server/services/transfer-pairing.service.ts` |
| Insights totals | `packages/db-postgres/src/repositories/PostgresDashboardRepository.ts` `getMonthlyTotals` |
