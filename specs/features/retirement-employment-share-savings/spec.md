# Retirement Employment Share of Savings Net

## Status

Draft. Created 2026-08-28 after reviewing the accumulation loop in `packages/domain/src/retirement/project.ts` (`isRetired` ~248, wage gates ~251–292, `grownObservedNet` ~617, residual-to-cash ~786–805), `applyLevers` work/income cases in `packages/domain/src/retirement/apply-levers.ts`, `retirementSavingsNet` / `resolveEmploymentIncome` in `packages/domain/src/retirement/build-baseline.ts`, hardcoded `estimatedImpactScore` 78 in `packages/domain/src/retirement/suggest-levers.ts`, income-split copy in `packages/features/src/retirement/plan/plan-settings-panel.tsx`, and sibling specs (`retirement-surplus-to-savings`, `retirement-impact-suggestions`, `retirement/spec.md`). No code in this change. Do not clone. Do not commit.

## Goal

Keep Insights net (`preRetirementAnnualNetIncome`) as the household savings **level** during accumulation. When a spouse or the primary is no longer employed, scale that level by the remaining employment-wage share. Do not switch accumulation to raw `cashIn − cashOut`.

Success means:

- From the year someone is out (`age >=` their employment-ends age, or wages already gated to 0), accumulation savings net is `preRetirementAnnualNetIncome * (remainingWages / (primaryWages + spouseWages))`, then still grown by `salaryFactor`.
- Spouse out at 30 on a 10k / 246k wage split must drop net worth at primary retirement by far more than today's ~21.3M → ~21M rounding. The leftover Insights net must not keep compounding as if both people still earned.
- Primary `stop_working_at_age` before `retirementAge` uses the same helper (scale to spouse share, or 0 if no spouse). It does not set `isRetired`.
- Planned 401(k) / Roth / taxable contributions stay a floor. Lifestyle `cashOut` stays display-only in accumulation. `applyLevers` does not start writing `preRetirementAnnualNetIncome`.
- Income-split UI stops implying the 10k/246k columns are a second savings stream. Suggested copy stops advertising `estimatedImpactScore` 78 / "Removes $X/year" unless Insights net actually moves.

## Background

Until the **primary** hits `retirementAge`, `projectRetirement` saves `preRetirementAnnualNetIncome * salaryFactor` minus planned 401(k) / Roth / taxable, leftover to cash (`project.ts` ~617, ~786–805). That net is a household constant from `buildRetirementBaseline` (`retirementSavingsNet` → `inputs.preRetirementAnnualNetIncome`, `build-baseline.ts` ~625–628, ~772). It does not know who is still earning.

Spouse levers only set `spouseEmploymentEndsAtAge` / `spouseRetirementAge`:

| Lever type | What `applyOne` writes today | What it does **not** write |
|------------|------------------------------|----------------------------|
| `spouse_stops_working` | `inputs.spouseEmploymentEndsAtAge = lever.params.atAge` (~584–587). Skips if `spouseCurrentAge === null` ("This plan has no spouse.") | `preRetirementAnnualNetIncome`. Does not set `isRetired`. Does not touch primary `employmentEndsAtAge`. |
| `spouse_retire_at_age` | `inputs.spouseRetirementAge = lever.params.age` **and** `inputs.spouseEmploymentEndsAtAge = lever.params.age` (~578–582). Same no-spouse skip. | `preRetirementAnnualNetIncome`. Does not set `isRetired`. |
| `stop_working_at_age` (primary) | `inputs.employmentEndsAtAge` (max currentAge, params.age) and `inputs.contributionsStopAge = min(contributionsStopAge, employmentEndsAtAge)` (~551–560). Conflict slot `employmentEndsAtAge`. | `preRetirementAnnualNetIncome`. Does **not** call `setRetirementAge`. Does **not** set `isRetired`. Still on the Insights-net path until `age >= retirementAge`. |
| `retire_earlier` / `retire_later` / `retire_at_age` | `setRetirementAge` (~442–453): writes `retirementAge`, and only then moves `employmentEndsAtAge` / `contributionsStopAge` if they still tracked the previous retirement age. | Out of this helper. `isRetired = age >= retirementAge` is the switch **off** Insights net. |

Those end-age fields zero `spouseEmploymentIncome` / `employmentIncome` on the year ledger (`project.ts` ~251–261). That field is **not** the savings driver before primary retirement. `applyLevers` never writes `preRetirementAnnualNetIncome`.

Income split (plan settings 10k / 246k) reallocates the same Insights employment pie into wage columns used for display, SS FRA (`estimateFraBenefitFromIncome` in `build-baseline.ts` ~641–647), and the spouse-end gate. `resolveEmploymentIncome` (`build-baseline.ts` ~235–258) and `applyLinkedIncomeSplit` (`plan-settings-form.ts` ~99–124) do not change Insights net.

Primary `stop_working_at_age` is the same class of bug: it moves `employmentEndsAtAge` + `contributionsStopAge` but does not leave Insights-net mode. Only `setRetirementAge` (retire earlier / later / at age) sets `isRetired`.

Live symptom Tyler hit: spouse stops at 30 on a ~10k primary / ~246k spouse split. Inspector employment goes to the primary's slice; household savings net does not. Terminal net worth moves ~21.3M → ~21M (noise / SS-column side effects), not a 246/256 haircut of accumulation.

## Product Context

Accumulation is Insights-net capacity, not a wage cashflow identity. [retirement-surplus-to-savings](../retirement-surplus-to-savings/spec.md) already locked that: planned contribs are a floor, leftover lands in cash, lifestyle `cashOut` is display-only before retirement (`project.ts` ~660–663). This spec does not reopen that. It only answers "whose job is still producing that Insights net?"

The wage columns are a **share of Insights employment**, not a second savings stream. Editing "My income" $10k and "My spouse's income" $246k tells the engine how to split one pie for:

- Year-inspector Employment / spouse employment rows
- Social Security FRA estimates
- When each person's wages gate off (`employmentEndsAtAge` / `spouseEmploymentEndsAtAge`)

It does not tell the engine "save the primary's 10k and the spouse's 246k as two nets." There is one `preRetirementAnnualNetIncome`. When a wage line drops out, that one net must scale.

Suggested card "Your projection funds retirement from age 30" (`suggest-levers.ts` ~61, `retire_earlier` when `earliestSustainableAge` is 30) is **primary retire-earlier**. It is not spouse-stops-at-30. Out of scope to rewrite here; follow-up if ranking should use scaled net (see Open Questions).

## Current Repo Context

### Accumulation still uses a constant Insights net

`packages/domain/src/retirement/project.ts`, each year:

```text
isRetired = age >= inputs.retirementAge                         // ~248

employmentIncome =
  age < employmentEndsAtAge
    ? annualEmploymentIncome * salaryFactor : 0                 // ~251–254
spouseEmploymentIncome =
  spouseAlive && spouseEmploymentEndsAtAge !== null
    && spouseAge < spouseEmploymentEndsAtAge
    ? annualSpouseEmploymentIncome * salaryFactor : 0           // ~255–261
// then incomeAdjustments (~263–277), then incomeGaps (~279–289)
// disability_event later zeroes employmentIncome (~438–439)

grownObservedNet = preRetirementAnnualNetIncome * salaryFactor  // ~617  ← the bug

if (isRetired) {
  cashIn already includes gated wages                           // ~582–590
  surplus → cashBalance                                         // ~781–785
} else {
  availableNet = max(0, grownObservedNet)                       // ~794
  residual = max(0, availableNet - plannedTotal) → cash         // ~795–800
}
```

`salaryFactor = (1 + incomeGrowthRate) ** yearIndex` (~225). Residual-to-cash is the surplus-to-savings rule and stays.

`spouseEmploymentEndsAtAge === null` already means spouse wages are 0 every year (~257). No-spouse baselines set it null (`build-baseline.ts` ~740–743, ~760). Has-spouse baselines set it to `spouseRetirementAge ?? targetRetirementAge`.

### Insights net is not split into employment vs other

`packages/domain/src/retirement/retirement-savings-net.ts`:

```text
savingsNet = netIncome - excludedInvestmentIncome
excluded = investments | transfer | interest | dividends | capital gains
```

That is the only split. Tests in `retirement-savings-net.test.ts` cover yield stripping and "leaves wage income alone." There is **no** employment-vs-rental-vs-other split of `savingsNet`.

`annualizeInsightsEmploymentIncome` (`build-baseline.ts` ~209–233) carves **rental** out of **gross** Insights income to build the wage pie, then `resolveEmploymentIncome` splits that pie by stored 10k/246k shares. Rental cash flows themselves are projected from properties. That helper does not produce an employment-attributable *net*.

**Choice locked for v1:** scale the **full** Insights savings net (`preRetirementAnnualNetIncome`) by remaining/total wages. Why: there is no clean employment-vs-other net in `retirementSavingsNet` / `build-baseline.ts`. Inventing one would be a second Insights reconstruction (which slice of trailing spend belongs to which earner?). Smallest honest move is wage-share of the existing savings net. Do not haircut by inventing a rental/other remainder we cannot measure. Open Question 1 if we later carve a real employment-attributable net.

### Work/income levers today (quote from `apply-levers.ts`)

Scale in `project.ts` from the current year's wages vs baseline wage levels so any lever that already writes endsAtAge / wages / gaps / adjustments gets the effect. **Do not duplicate the scale in `applyLevers`.** `apply-levers.ts` stays as-is unless a lever is missing a wage/end-age write (none of the MUST list are).

| Type | Writes | Insights net today | This helper |
|------|--------|--------------------|-------------|
| `spouse_stops_working` | `spouseEmploymentEndsAtAge` | unchanged | **MUST** |
| `spouse_retire_at_age` | `spouseRetirementAge` + `spouseEmploymentEndsAtAge` | unchanged | **MUST** |
| `stop_working_at_age` | `employmentEndsAtAge` + `contributionsStopAge` | unchanged; still `!isRetired` until `retirementAge` | **MUST** |
| `income_change` | `incomeAdjustments` (`whom`, `fromAge`, `annualDelta` / `percentDelta`, `toAge: null`) (~589–601) | unchanged | **MUST** — it only moves year wages, not Insights net. Projector share picks it up. |
| `job_loss` | `incomeGaps` on primary (`shareOfYear`, severance on first year) (~603–622) | unchanged | **MUST** — same reason. Existing test only asserts `employmentIncome` halves (`retirement-engine.test.ts` ~618–635); must also assert scaled net. |
| `career_break` | `incomeGaps` primary `fromAge`→`toAge+1`, `shareOfYear: 1` (~624–633) | unchanged | **MUST** — same reason. |
| `part_time_before_retirement` | `incomeAdjustments` `setTo: annualIncome` on primary, extends `employmentEndsAtAge` to `toAge+1` (~562–576) | unchanged | **MUST** via the same helper (year wages become the set-to amount). Existing test only checks `employmentIncome` inflates with inflation (~1363–1375). |
| `disability_event` | `disabilityEvents`; projector zeroes `employmentIncome` for the duration (~438–439) | unchanged | **MUST** via projector (primary wages → 0). |
| `retire_earlier` / `retire_later` / `retire_at_age` | `setRetirementAge` → `isRetired` | Insights path unused after the new `retirementAge` | **OUT** |
| `annual_bonus` / `side_business_income` / `rental_income_change` / `custom_income` | `recurringIncome` | not in Insights net; accumulation still ignores them as savings | **OUT** of this helper. They are not wage-share. Do not start treating them as savings in this spec. |

`conflictFieldFor`: `stop_working_at_age` → `employmentEndsAtAge`; `spouse_retire_at_age` → `spouseRetirementAge`; `spouse_stops_working` → `spouseEmploymentEndsAtAge`. Additive types (`income_change`, `job_loss`, `career_break`) return `null` and always compose.

### Contributions already stop when both wage lines are 0

`project.ts` ~555–557:

```text
contributing =
  age < min(contributionsStopAge, employmentEndsAtAge)
  && employmentIncome + spouseEmploymentIncome > 0
```

If both wage lines are 0, planned contribs are already 0. Today the **same full Insights net** then lands in cash (`residual = availableNet - 0`). After this change remaining share is 0, so `availableNet` is 0, so residual is 0. Call that out in tests.

Quirk to **not** change here: `contributing` also requires `age < employmentEndsAtAge` (primary). Primary `stop_working_at_age` therefore stops planned contribs even if the spouse is still earning. This spec leaves that flag alone. Scaled net in that case is the spouse share; planned contribs stay 0; the whole scaled net goes to cash.

### Post-primary-retirement is out of scope

Once `isRetired`, savings is `cashIn − cashOut` (+ withdrawals, − tax), not Insights net. `cashIn` already includes `employmentIncome + spouseEmploymentIncome` gated by the same end ages (~582–584). Baseline already ends spouse work at `spouseRetirementAge ?? targetRetirementAge` (`build-baseline.ts` ~740–743, ~760). This spec does not change post-retirement `cashIn`.

If the spouse keeps working after the primary retires, those wages already flow through retired `cashIn`. No helper.

### Tests that only assert end-age was written

`packages/domain/src/retirement/retirement-engine.test.ts`:

- `"ends spouse employment when the spouse stops working"` (~575–589) — `applyLevers` + `assert.equal(inputs.spouseEmploymentEndsAtAge, 43)`. No `projectRetirement`.
- `"ends spouse employment before age 30"` (~591–606) — same, `atAge: 25`. No projection.
- `"reports why a spouse lever could not apply"` (~567–573) — skip note. Keep.
- `"suggests stopping spouse work when a spouse is still earning"` / `"…under 30"` (~787–826) — catalog presence + `atAge`. Not a savings assertion.
- `"zeroes only part of a year for a six-month layoff"` (~618–635) — asserts `employmentIncome` halved. Does **not** assert `grownObservedNet` / residual / net worth.
- `"does not double-count planned contributions on top of Insights net"` (~1939–1969) and `"adds residual Insights net to cash before applying cash yield"` (~1785–1808) — nobody stops working. **Must still pass.**
- `"grows liquid assets through mid-40s when Insights net is positive"` (~298) — nobody stops working. **Must still pass.**

There is no `stop_working_at_age` projection test today. `default-lever.ts` ~58–62 prefills it at `currentAge`.

### Copy that overclaims

**Income split** — `packages/features/src/retirement/plan/plan-settings-panel.tsx` ~351–355:

> Income split
> Changing either amount updates the other so they still add up to the Insights total.

`householdIncome` is `baseline.annualEmploymentIncome + baseline.annualSpouseEmploymentIncome` (~90–92), i.e. the resolved employment pie, not Insights net. `showIncomeSplit = form.hasSpouse && householdIncome > 0` (~257). `applyLinkedIncomeSplit` keeps the two fields summing to that pie. Form tests in `plan-settings-form.test.ts` use totals like 260023.

**Suggested spouse-stop** — `suggest-levers.ts` ~201–221:

```text
title: "Spouse stops working"
detail: Removes ${annualSpouseEmploymentIncome}/year at age ${spouseCurrentAge}
estimatedImpactScore: 78
```

That 78 outranks delay-SS (65) in the static sort. The dollar line is spouse **wages**, not household savings net. Until this engine change, Insights net does not move, so the card is a lie. After this change the net *does* move, but by wage **share**, not by `$X` of wages.

**Retire-earlier secondary** — `suggest-levers.ts` ~61: `Your projection funds retirement from age ${earliestSustainableAge}.` Primary `retire_earlier`. Out of scope.

Year inspector / savings-path copy from surplus-to-savings is still correct (planned contribs invested, leftover to cash). They will automatically show a smaller leftover once `grownObservedNet` is scaled. No required copy change there.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Year loop / Insights path | `project.ts` ~248, ~251–292, ~617, ~786–805 | Scale `grownObservedNet`; keep residual-to-cash |
| Wage gates | `project.ts` `employmentIncome` / `spouseEmploymentIncome` | Already apply end ages, adjustments, gaps |
| Insights net | `retirement-savings-net.ts` + `build-baseline.ts` ~625–628 | Capacity ceiling; do not retune exclusions |
| Wage pie split | `resolveEmploymentIncome` / `annualizeInsightsEmploymentIncome` | Display / SS / gates only |
| Lever writes | `apply-levers.ts` `applyOne` work & income cases | Stay as-is |
| Suggested copy / score | `suggest-levers.ts` ~201–221 | Drop 78 / rewrite "Removes $X/year" |
| Income-split UI | `plan-settings-panel.tsx` ~348–375; `applyLinkedIncomeSplit` | Copy only |
| Apply tests | `retirement-engine.test.ts` ~575–606 | Must gain a `projectRetirement` assertion |
| Residual tests | same file ~1785, ~1939 | Must still pass when nobody stops |

## Target Experience

No new chrome. No "spouse income is a separate savings stream" control. Behavior change is the projector; copy tells the truth.

### What-If: spouse stops / spouse retires at 30 / primary stops working

Adding `spouse_stops_working` at 30 on a 10k / 246k split:

1. Inspector Employment / spouse employment already show spouse wages gone from that age. Keep that.
2. Savings path leftover and year-inspector "Added to savings" drop to ~primary-share of Insights net from age 30 until primary retirement.
3. Net worth at primary retirement is materially lower than the unlevered baseline — not a ~1.5% wiggle.
4. Same visible result for `spouse_retire_at_age` 30 (that lever also writes `spouseEmploymentEndsAtAge`).
5. Primary `stop_working_at_age` before `retirementAge` keeps the household in accumulation (`isRetired` still false) and scales to the spouse share (or 0).

### Income split (Edit plan)

Replace the helper sentence. Keep the linked fields.

**Caption (replace):**

> This splits Insights employment income between you and your spouse. It drives wage columns, Social Security estimates, and when each person stops working. Household savings during accumulation is still Insights net — not these two salaries added together. If someone stops working, that net scales by the remaining wage share.

Do not imply editing 10k / 246k changes Insights net today. It only changes the share used when a wage line drops out.

### Suggested cards

- Stop sorting `spouse_stops_working` with hardcoded `estimatedImpactScore: 78`.
- Stop saying `Removes $X/year` unless that `$X` is measured savings-net (it is not; it is spouse wages). After the engine change, either drop the dollar claim or say savings net scales by remaining wage share (e.g. spouse share of household wages). Do not claim the wage amount is subtracted from Insights net dollar-for-dollar.
- Leave measured ranking to [retirement-impact-suggestions](../retirement-impact-suggestions/spec.md). This spec only stops the false advertising.
- `retire_earlier` "Your projection funds retirement from age 30" is out of scope.

## Architecture / Data Model

No new tables. No new `RetirementPlanInputs` field. Do not write `preRetirementAnnualNetIncome` from `applyLevers`.

### Helper

Suggested name: `employmentShareOfSavingsNet`. Put it next to the projector (same file or a tiny `packages/domain/src/retirement/employment-share.ts` imported by `project.ts`). Pure. No I/O.

```text
employmentShareOfSavingsNet(remainingWages, baselineWages) =
  1                                         if baselineWages <= 0
  max(0, remainingWages) / baselineWages    otherwise

grownObservedNet =
  preRetirementAnnualNetIncome
  * salaryFactor
  * employmentShareOfSavingsNet(remainingWages, baselineWages)
```

Product form (same identity when both wage totals already include `salaryFactor`):

```text
preRetirementAnnualNetIncome' =
  preRetirementAnnualNetIncome * (remainingWages / (primaryWages + spouseWages))
```

**Inputs, each accumulation year, after wage gates / adjustments / gaps / disability (~251–292 and ~438–439), before residual-to-cash (~794):**

| Symbol | Binding |
|--------|---------|
| `remainingWages` | this year's `employmentIncome + spouseEmploymentIncome` (already gated, adjusted, gapped, `max(0, …)`) |
| `baselineWages` (`primaryWages + spouseWages`) | `(annualEmploymentIncome + annualSpouseEmploymentIncome) * salaryFactor` |
| `preRetirementAnnualNetIncome` | unchanged input |
| `salaryFactor` | `(1 + incomeGrowthRate) ** yearIndex` — still applied to the net, same as today |

Share is computed from **current-year wages vs baseline wage levels**, not from lever type. That is why `apply-levers.ts` does not need to change: any lever that already zeroes or haircuts a wage line is picked up.

### When it runs

- Every year where `!isRetired`. Helper N/A after primary retirement (`isRetired` → Insights path unused; retired `cashIn` already has gated wages).
- After wage gates, `incomeAdjustments`, `incomeGaps`, and disability's `employmentIncome = 0`.
- Before `availableNet = max(0, grownObservedNet)` and residual-to-cash.
- `salaryFactor` interacts only as above: it grows both the wage totals (already) and Insights net (already). It cancels in the share if both remaining and baseline include it. Do not apply it a second time to the share.

### Divide-by-zero / null / already-retired

| Case | Share | Why |
|------|-------|-----|
| `baselineWages <= 0` (both wage lines 0 at baseline) | **1** | Nobody was employed. Insights net is not wage-driven; do not haircut it because an end-age fired. "1 if nobody was employed," not "0 if anyone is out." |
| Someone is out and baseline wages > 0 | `remaining / total` (0 if both out) | The product formula. |
| `spouseEmploymentEndsAtAge === null` | Spouse wages already 0 in `remainingWages` | No special case. No-spouse plans have spouse wages 0 and null end age. |
| Spouse lever on a plan with no spouse | `applyLevers` already skips ("This plan has no spouse.") | Unchanged. Primary-only Insights net unchanged. |
| Primary already retired (`isRetired`) | Helper not called | Insights path unused. |
| Share > 1 (raise / `income_change` percent / part-time setTo above baseline) | Allow; do not clamp to 1 | Wage-share of savings net should follow the wage line, including raises. See Open Question 2. |
| Share = 0 (both out, or primary out and no spouse) | 0 | `availableNet` 0; residual 0; planned contribs already 0. |

Do not clamp negative remaining; wages are already `max(0, …)` at ~291–292.

## Implementation Plan

Do **not** implement as part of writing this spec.

### Phase 1 — engine + tests (must ship first)

1. Add `employmentShareOfSavingsNet(remainingWages, baselineWages)` as specified.
2. In `project.ts`, after this year's wages are final and `!isRetired`, set `grownObservedNet = preRetirementAnnualNetIncome * salaryFactor * share`. Keep the residual-to-cash block. Keep retired `cashIn` alone.
3. Do not touch `apply-levers.ts` unless a MUST lever is found not to write wages/end-age/gaps (none are).
4. Do not change `retirementSavingsNet` exclusions.
5. Tests in `retirement-engine.test.ts` as listed under Acceptance Criteria. Existing apply-lever tests that only checked `spouseEmploymentEndsAtAge` must gain a `projectRetirement` assertion.

**Acceptance:** spouse out at 30 on 10k/246k drops accumulation net to remaining/total of N; both out → residual 0; nobody stops → existing residual tests still pass.

### Phase 2 — copy

1. Income-split caption in `plan-settings-panel.tsx` as specified.
2. `suggest-levers.ts`: drop hardcoded 78 as a meaningful rank; rewrite or drop `Removes $X/year`.
3. No change required to year-inspector / savings-path captions (surplus-to-savings copy stays true).

**Acceptance:** a user reading Edit plan cannot conclude 10k + 246k are two savings streams. A user reading Suggested cannot conclude spouse-stop removes $X of household savings net dollar-for-dollar unless a ranker measured it.

## Acceptance Criteria

- [ ] Each accumulation year, `grownObservedNet = preRetirementAnnualNetIncome * salaryFactor * employmentShareOfSavingsNet(remainingWages, baselineWages)` with remaining = this year's gated wages and baseline = `(annualEmploymentIncome + annualSpouseEmploymentIncome) * salaryFactor`
- [ ] `isRetired` years do not call the helper; post-retirement `cashIn` wages stay gated by employment ends only
- [ ] `applyLevers` still does not write `preRetirementAnnualNetIncome`
- [ ] Lifestyle `cashOut` remains display-only in accumulation (no switch to `cashIn − cashOut` as the savings identity)
- [ ] Planned contribs remain a floor; residual is still `max(0, availableNet - plannedTotal)` to cash
- [ ] `retirementSavingsNet` exclusions unchanged
- [ ] Baseline: primary 10k + spouse 246k wages, household Insights net `N`, `spouse_stops_working` at 30: from age 30 until primary retirement, `grownObservedNet ≈ N * salaryFactor * (10000 / 256025)` (or `remainingWages / (primaryWages + spouseWages)` of the actual wage columns — live pies are slightly non-round). Net worth at primary retirement **must drop vs unlevered**, not a rounding ~1.5% (~21.3M → ~21M is a **fail**)
- [ ] Same projection assertion with `spouse_retire_at_age` 30
- [ ] No spouse / spouse wages 0: spouse lever skip unchanged (`"This plan has no spouse."`); a spouse lever that does not apply leaves primary-only Insights net unchanged
- [ ] Both wage lines 0 in an accumulation year: planned contribs already 0; remaining share 0 (when baseline wages > 0) so residual 0 — Insights net does not all land in cash
- [ ] Primary `stop_working_at_age` before `retirementAge`: still `!isRetired`; scale to spouse share, or 0 if no spouse
- [ ] `income_change` / `job_loss` / `career_break` / `part_time_before_retirement` scale net through the same helper (they already move year wages)
- [ ] Existing Insights residual tests still pass when nobody stops working (`"does not double-count planned contributions on top of Insights net"`, `"adds residual Insights net to cash before applying cash yield"`, `"grows liquid assets through mid-40s when Insights net is positive"`)
- [ ] `"ends spouse employment when the spouse stops working"` and `"ends spouse employment before age 30"` gain a `projectRetirement` assertion, not only `spouseEmploymentEndsAtAge`
- [ ] Divide-by-zero: both baseline wage lines 0 → share 1
- [ ] Income-split copy no longer describes the two salaries as a second savings stream
- [ ] `suggest-levers.ts` does not advertise `estimatedImpactScore` 78 / `Removes $X/year` as if Insights net fell by spouse wages
- [ ] `retire_earlier` "Your projection funds retirement from age 30" not rewritten in this spec
- [ ] Live Plaid balances are not written. No clone, no commit in the spec-writing task

## Non-Goals

- Do not rewrite accumulation as a wage-based cashflow identity (`cashIn − cashOut`). Insights net stays the savings level; this spec only scales it.
- Do not make spouse-retire-at-30 mean the household is `isRetired`. Only `setRetirementAge` / `age >= retirementAge` does that.
- Do not change Insights net construction (`retirementSavingsNet` exclusions stay) except the wage-share scale on `grownObservedNet`.
- Do not invent an employment-vs-rental split of savings net in v1 (no clean split exists; see Open Question 1).
- Do not change post-retirement `cashIn`.
- Do not change the `contributing` flag's use of primary `employmentEndsAtAge`.
- Do not duplicate scaling inside `applyLevers`.
- Do not rewrite the `retire_earlier` "funds retirement from age 30" card.
- Do not ship a measured Suggested ranker here ([retirement-impact-suggestions](../retirement-impact-suggestions/spec.md)).
- Do not clone. Do not commit. Do not implement the engine in the spec-writing task.

## Open Questions

1. **Scale only employment-attributable Insights net vs full savings net.** Default: **full `preRetirementAnnualNetIncome` by wage share**, because `retirementSavingsNet` does not split employment vs rental/other. Reopen if we add a measured employment-attributable net (would need a rule for which trailing spend belongs to wages). Do not silently haircut rental/other in v1 without that split.
2. **`income_change` percent (and dollar delta, part-time `setTo`).** Default: **same helper** — current-year wages / baseline wages — so a 20% raise scales net 1.2× and a layoff year at `shareOfYear` 0.5 scales net 0.5×. Reopen if product wants end-age gates only (binary in/out) and percent changes to stay display-only. One-line disagreement path: if Tyler wants percent to not move Insights net, clamp the helper to `{0, remainingEndAgeShare, 1}` and leave adjustments out of the numerator.
3. **Ranking / impact scores.** After the engine is honest, `spouse_stops_working` will actually move the projection. Default for this spec: **drop hardcoded 78 and the "Removes $X/year" wage claim.** Measured confidence / net-worth delta belongs to [retirement-impact-suggestions](../retirement-impact-suggestions/spec.md). Follow-up: should Suggested ranking / `retire_earlier` earliest-age copy use the scaled net? Out of scope here.

## Related Specs

- [retirement-surplus-to-savings/spec.md](../retirement-surplus-to-savings/spec.md) — Insights net as capacity ceiling; residual to cash; lifestyle cashOut display-only in accumulation. This spec scales that ceiling; it does not move the landing bucket.
- [retirement-impact-suggestions/spec.md](../retirement-impact-suggestions/spec.md) — hardcoded `estimatedImpactScore` (spouse-stop = 78); measured ranking is a separate ship
- [retirement/spec.md](../retirement/spec.md) — baseline, levers, year inspector
- [retirement-edit-plan-assumptions/spec.md](../retirement-edit-plan-assumptions/spec.md) — Edit plan panel; income split lives there

## Suggested Commit Message

```text
docs (retirement): spec scale Insights net by remaining employment share
```
