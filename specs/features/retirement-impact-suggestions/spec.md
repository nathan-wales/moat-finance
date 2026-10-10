# Retirement Impact Suggestions

## Status

Draft. Created August 27, 2026 after reviewing `packages/domain/src/retirement/suggest-levers.ts`, `packages/domain/src/retirement/improve-plan.ts`, `packages/domain/src/retirement/getRetirementPlanOverview.ts`, `packages/domain/src/retirement/getRetirementOpportunities.ts`, `packages/domain/src/retirement/monte-carlo.ts`, `packages/features/src/retirement/what-if/suggested-levers.tsx`, `packages/features/src/retirement/what-if/what-if-tab.tsx`, `packages/features/src/retirement/improve/opportunity-list.tsx`, `packages/contracts/src/retirement.ts`, and the Improve / What If sections of [features/retirement/spec.md](../retirement/spec.md). No code in this change.

## Goal

Make the **Suggested** cards in the retirement scenario builder rank by *this user's* projected impact, not by a hardcoded catalog score. The highest-impact applicable change (max a Roth IRA, work three more years, delay Social Security, …) should sit at the top because Moat actually projected it, and clicking **Try it** should reproduce the number on the card.

Success means:

- Suggested order for a given user changes when their room to contribute, retirement age, or funding status changes. Maxing a Roth that is already at the limit never appears. Retiring three years later outranks maxing a 401(k) when that is what actually moves confidence.
- Every ranked card's claimed confidence (and secondary dollar delta) matches a replay of `applyLevers` + `runMonteCarlo` on that single lever, same seed and trial count the ranker used.
- `GET /api/v1/retirement/getPlanOverview` stays inside the existing first-paint budget. Ranking does not run a full Monte Carlo per catalog entry on that request.
- Suggested and "Highest-impact changes" stop fighting: the same ranker feeds both, and the accordion no longer hides the levers Suggested already claimed with a fake score.

## Product Context

The parent retirement spec already promised this. [features/retirement/spec.md](../retirement/spec.md) says What If suggestions are "ranked by projected absolute impact on confidence" and that Improve "asks hundreds of questions for you and surfaces the best answers." What shipped is a split:

- Suggested cards look like the primary "try this" list, but `estimatedImpactScore` is a constant per lever type (`retire_earlier` = 90, `max_401k` = 80, `spouse_stops_working` = 78, `spend_more` = 40, …). Eligibility is personalized. Ranking is not.
- A real ranker already exists (`findOpportunities`) and already Monte Carlos a candidate catalog. It is buried in an accordion titled "Highest-impact changes", and the UI **filters out any lever type already shown as Suggested**. The measured list is the leftovers.

The user's job on this screen is "what should I change first?" A static 90/80/70 grid answers "here is our catalog in a fixed order." That is the same failure mode as a generic calculator. Moat already has the graph and the engine; the cards should be the output of that engine.

This is not monthly `/what-if` and not `ForecastScenario` macro rates. Same naming collision as the parent spec.

## Current Repo Context

### Two catalogs, two scores, one screen

| Surface | Built by | Ranked by | Served on | Rendered by |
|---------|----------|-----------|-----------|-------------|
| Suggested (top 6 cards) | `suggestLevers()` in `packages/domain/src/retirement/suggest-levers.ts` | Hardcoded `estimatedImpactScore` | `getRetirementPlanOverview` → `overview.suggestedLevers` | `packages/features/src/retirement/what-if/suggested-levers.tsx` (`suggestions.slice(0, 6)`) |
| Highest-impact accordion | `findOpportunities()` in `packages/domain/src/retirement/improve-plan.ts` | Deterministic sweep, then reduced-trial Monte Carlo on 8 finalists, sort by `confidence` | `GET /api/v1/retirement/getOpportunities` | `packages/features/src/retirement/improve/opportunity-list.tsx` |

`OpportunityList` drops a measured opportunity when `suggestion.lever.type` is already in the static list:

```ts
if (suggestedTypes.has(opportunity.lever.type)) return false;
```

So if Suggested always emits `max_401k` (score 80), the Monte Carlo result for maxing the 401(k) never appears, even when it is the user's #1 move.

### Static scores in `suggestLevers` (today)

Eligibility filters are real and should stay (no max-Roth if already at the IRA limit, no downsize below $200k equity, etc.). The sort is the bug.

| `id` | Typical `estimatedImpactScore` | Notes |
|------|--------------------------------|-------|
| `retire_earlier` | 90 | Only if `earliestSustainableAge < target`. Often *lowers* confidence. Highest fake rank. |
| `max_401k` | 80 | |
| `spouse_stops_working` | 78 | Exploratory / adverse, not an improvement. Outranks delay-SS. |
| `employer_match` | 75 | |
| `max_roth_ira` / `max_spousal_iras` | 70 | |
| `social_security_claim_age` | 65 | |
| `spouse_retire_at_age` | 60 | Always +3 years |
| `roth_conversion` | 58 | |
| `mortgage_payoff_early` | 55 | |
| `downsize_home` | 50 | Always age 70, 60% replacement price |
| `taxable_investing` | 45 | Surplus, no brokerage |
| `spend_more` | 40 | Always on. Framing, not an improvement. |
| `returns_lower` | 35 | Always on. Stress framing. |
| `withdrawal_order` | 30 | |

`retire_later` is **not** in `suggestLevers` at all. It *is* in `findOpportunities` (`retire_later` for 1, 2, and 3 years). That is the user's example and it never reaches Suggested.

### How `findOpportunities` already ranks (reuse this)

`packages/domain/src/retirement/improve-plan.ts`:

1. `buildCandidates(baseline)` — applicable improvement-shaped levers only (max 401k/IRA/HSA, employer match, extra $250/$500/$1000 save, retire 1/2/3 years later, delay SS, spend $250/$500 less, mortgage payoff, downsize, Roth conversion, withdrawal order, spouse works +3 years).
2. Apply each candidate with `applyLevers`. Drop if `applied !== true`.
3. Cheap deterministic score: `ΔlegacyAtLongevity - 5 * ΔtotalShortfall`. Keep `score > 0`, sort, take `FINALIST_COUNT` (8).
4. `runMonteCarlo(inputs, { trials: REDUCED_MONTE_CARLO_TRIALS (250), seed, includeCone: false })` on the baseline and each finalist.
5. Sort by `confidence` descending, tie-break deterministic score, take `MAX_OPPORTUNITIES` (5).
6. Primary copy is "Retirement confidence" before → after. Secondary is a metric chosen per lever (`legacy`, `assetsAtRetirement`, `lifetimeSocialSecurity`, `lifetimeTaxes`).

Tests already require the claimed `confidenceAfter` to match a replay (`packages/domain/src/retirement/retirement-engine.test.ts`, "claims impacts that match a real projection of the same lever").

### Why overview cannot run this itself

`getRetirementPlanOverview` is documented as **deterministic only**. Monte Carlo is a separate query so first paint stays under 1.2s (`specs/features/retirement/spec.md` performance contract). Comment in the overview file: "Monte Carlo is a separate query so the page can render inside its budget."

Full MC is 1,000 trials and ~700ms. Ranking ~8 finalists at 250 trials is the existing Improve budget, already paid on `getOpportunities`. Do not add 8–20 full MCs to overview or to the client.

`useRetirementOpportunities` is already fetched on the What If column. `useRetirementMonteCarlo` scores the *active stack*, not the catalog. Do not loop that hook per suggestion on the client.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Candidate sweep + MC ranker | `packages/domain/src/retirement/improve-plan.ts` (`findOpportunities`, `buildCandidates`, `opportunityCandidates`) | Extend; do not write a second ranker |
| Personalized copy / eligibility | `packages/domain/src/retirement/suggest-levers.ts` | Keep titles, `detail` prefill, suppression rules |
| Apply a lever | `packages/domain/src/retirement/apply-levers.ts` | `applied !== true` means skip |
| Deterministic ledger | `packages/domain/src/retirement/project.ts` | Sweep stage |
| Monte Carlo | `packages/domain/src/retirement/monte-carlo.ts` (`includeCone: false`) | Finalist stage |
| Trial counts | `packages/domain/src/retirement/constants.ts` | `REDUCED_MONTE_CARLO_TRIALS = 250`, `DEFAULT_MONTE_CARLO_TRIALS = 1000` |
| Overview wiring | `packages/domain/src/retirement/getRetirementPlanOverview.ts` | Stay deterministic |
| Opportunities API | `packages/domain/src/retirement/getRetirementOpportunities.ts` | Ranking lives here |
| Suggested UI | `packages/features/src/retirement/what-if/suggested-levers.tsx` | Add measured delta line; keep `Try it` |
| What If column | `packages/features/src/retirement/what-if/what-if-tab.tsx` (`ScenarioColumn`) | Suggested + accordion |
| Accordion list | `packages/features/src/retirement/improve/opportunity-list.tsx` | Stop filtering out suggested types; treat as overflow |
| Queries | `packages/features/src/retirement/use-retirement-queries.ts` | `useRetirementOpportunities` already on this page |
| Lever catalog | `packages/features/src/retirement/lever-catalog.ts` | Includes `retire_later` |
| Contracts | `packages/contracts/src/retirement.ts` | `RetirementSuggestedLeverSchema`, `RetirementOpportunitySchema` |
| Engine tests | `packages/domain/src/retirement/retirement-engine.test.ts` | Extend replay + ordering cases |

## Target Experience

Suggested remains the first list under the lever stack. Six cards. Highest measured impact first.

```text
Suggested

┌─────────────────────────────────────────────────────────┐
│ Max your Roth IRA                                       │
│ +$7,000/year of contributions                           │
│ You're currently at $0                                  │
│ Confidence  72% → 81%                                   │
│                                             [ Try it ]  │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Retire 3 years later                                    │
│ Age 62 → 65                                             │
│ Confidence  72% → 89%                                   │
│                                             [ Try it ]  │
└─────────────────────────────────────────────────────────┘
```

(Example numbers are illustrative. Production numbers come from the ranker for that user.)

Behavior:

- Card title and contribution/age `detail` stay personalized the way `suggestLevers` already writes them.
- A new line shows the primary impact: `Confidence {before} → {after}`, same formatting as `OpportunityList` (`formatPercent` / `formatConfidence`).
- If baseline confidence is already ≥ 98% (overfunded), the primary line switches to the secondary dollar metric the ranker used (`Legacy at 95  +$241k`, `Safe spending  +$810/mo`) so the list is not a pile of `100% → 100%`.
- `Try it` still `addLever` + `retirement_lever_added` with `source: "suggested"`.
- While opportunities are loading, show the existing card skeleton / omit the confidence line rather than flashing the old static order and then reshuffling.
- Empty: if no candidate improves the plan (`deterministicScore > 0` and a real delta), hide the Suggested heading. Do not pad with `spend_more` / `returns_lower`.

### Framing cards move out of Suggested

`spend_more` and `returns_lower` stay available from the catalog picker and the Risk / stress surface. They are not "highest-impact plan improvements" and must not occupy Suggested slots. `spouse_stops_working` stays a What If the user can add, not a ranked suggestion.

### Accordion

Retitle is optional; the job is overflow.

- Suggested = ranks 1–6 of the shared list.
- "Highest-impact changes" = ranks 7+ (or hide the accordion when empty).
- **Delete** the `suggestedTypes.has(opportunity.lever.type)` filter. That filter is why the measured list is empty of the interesting levers.
- Keep the `stackedTypes` filter (do not suggest a lever already on the stack).

## Architecture / Data Model

No Prisma change. Contract tweak only.

`RetirementSuggestedLeverSchema` today:

```ts
id, title, detail, secondaryDetail, category, lever, estimatedImpactScore, isPersonalized
```

Add optional measured fields (keep `estimatedImpactScore` as the **sort key populated from measurement**, not a catalog constant):

| Field | Type | Meaning |
|-------|------|---------|
| `confidenceBefore` | `number` optional | Baseline MC confidence used for ranking |
| `confidenceAfter` | `number` optional | Candidate MC confidence |
| `primaryMetricLabel` | `string` optional | `"Retirement confidence"` or the overfunded fallback label |
| `primaryMetricBefore` | `string` optional | Formatted, shown on the card |
| `primaryMetricAfter` | `string` optional | Formatted |
| `estimatedImpactScore` | `number` | Required. **Measured**: `round((confidenceAfter - confidenceBefore) * 1000)` or, when overfunded, a scaled deterministic score. Used only as a sort key / MCP hint. |

Overview may still return eligibility-filtered levers with `confidenceAfter` unset (first paint / MCP `suggestedLeverCount`). The What If UI **does not sort that list**. It waits for the opportunities payload (or a ranked overview field added later) and renders that order.

### Shared ranker (recommended shape)

Extract the sweep+MC from `findOpportunities` so Suggested and Improve call one function:

```ts
rankLeverCandidates({
  baseline,
  levers,          // active stack; candidates apply on top
  candidates,      // from a unified builder
  trials?,         // default REDUCED_MONTE_CARLO_TRIALS
  seed?,
  limit?,
}): RankedLever[]
```

`findOpportunities` maps `RankedLever` → `RetirementOpportunity`. A thin adapter maps the same rows → `RetirementSuggestedLever` (copy from `suggestLevers` by `id` / lever type).

Do **not** invent a third projection engine. Do **not** run this on the client by calling `useRetirementMonteCarlo` in a loop.

### Ranking algorithm (normative)

1. **Candidates.** Union of:
   - `buildCandidates` from `improve-plan.ts` (includes `retire_later` 1/2/3, extra savings, spend less, max HSA).
   - Applicable `suggestLevers` rows that are improvement-shaped and missing from that catalog (`retire_earlier` only if it still scores > 0 after projection, `taxable_investing`, personalized mortgage/downsize/SS copy).
   - Exclude: `spend_more`, `returns_lower`, `spouse_stops_working`.
   - Exclude: lever types already enabled on the active stack.
   - Exclude: not applicable (existing `suggestLevers` / `buildCandidates` guards). Max Roth never emits when `annualRothContribution >= iraTarget`.
2. **Apply.** `applyLevers(baseline, stack + candidate)`. Drop `applied !== true`.
3. **Sweep.** Deterministic `projectRetirement`. `score = Δlegacy - 5 * Δshortfall`. Keep `score > 0`. Sort desc. Take 8 finalists.
4. **Measure.** One reduced MC on the stacked baseline, one per finalist, `includeCone: false`, same `seed` (today `13` in `findOpportunities`).
5. **Primary metric.** `Δconfidence = confidenceAfter - confidenceBefore`.
   - If `confidenceBefore < 0.98`, sort by `Δconfidence` desc, tie-break sweep score.
   - If `confidenceBefore >= 0.98`, sort by sweep score (legacy/shortfall) so an overfunded user still sees max-Roth above a no-op. Optional later: `solveSafeSpending` delta; that is slower (binary search × MC) and is **not** required for v1 of this spec.
6. **Emit.** Top 6 → Suggested. Remainder → accordion. Both lists highest impact first.

Latency budget: ranking stays on `getOpportunities` (or an equivalent ranked endpoint). Overview unchanged. Client does not run 20 MCs.

## Implementation Plan

### Phase 1 — Shared ranker, Suggested consumes it

1. Extract `rankLeverCandidates` from `findOpportunities` without changing Improve numbers (replay test must still pass).
2. Unify candidate construction so `retire_later` (1/2/3) is in the pool Suggested can show. Keep `suggestLevers` copy for titles/details.
3. Drop hardcoded `estimatedImpactScore` constants as the sort. Populate the field from measurement when ranking has run.
4. Point `SuggestedLevers` at `useRetirementOpportunities` (plus copy from overview). Rank 1–6. Show confidence (or overfunded fallback) on the card.
5. Remove the `suggestedTypes` filter in `OpportunityList`. Accordion shows ranks 7+ only.
6. Stop putting `spend_more` / `returns_lower` / `spouse_stops_working` in the ranked Suggested list.

**Acceptance criteria:** Phase 1 items in the list below.

### Phase 2 — Tests and catalog cleanup (same PR is fine if small)

1. Domain test: two fixtures where the winner flips (underfunded → `retire_later` or max-401k beats max-Roth; already-maxed IRA → Roth absent; overfunded → still ordered by dollar impact).
2. Domain test: claimed `confidenceAfter` on a Suggested card matches replay (same assertion Improve already has).
3. Domain test: `suggestLevers` eligibility still suppresses inapplicable levers.
4. Leave `getPlanOverview` deterministic. If MCP/desktop still need a list on overview, they can keep the unranked eligibility list; the What If UI must not use that order.

## Acceptance Criteria

- [ ] Suggested cards on What If are ordered by measured impact for that user (Monte Carlo Δconfidence, with the overfunded tie-break above), not by catalog constants 90/80/70.
- [ ] Inapplicable levers never appear (already-maxed IRA/401k, no mortgage, no spouse, etc.). Same suppression spirit as current `suggestLevers`.
- [ ] `retire_later` for 1–3 years is a candidate and can win Suggested when it is the highest-impact applicable change.
- [ ] Max Roth / max 401(k) / delay SS / extra savings can win when they are the highest-impact applicable change.
- [ ] `spend_more`, `returns_lower`, and `spouse_stops_working` are not in the ranked Suggested list.
- [ ] Each ranked card shows a concrete before → after impact line that matches a replay of `applyLevers` + `runMonteCarlo` with the ranker's seed and 250 trials.
- [ ] `Try it` still stacks the lever and the page projection/MC for the stack is unchanged.
- [ ] Levers already on the active stack are not re-suggested.
- [ ] `OpportunityList` no longer hides measured opportunities because they appeared in Suggested. Suggested is ranks 1–6; accordion is overflow or hidden.
- [ ] `getRetirementPlanOverview` does not run per-candidate Monte Carlo. Ranking uses the existing opportunities path and `REDUCED_MONTE_CARLO_TRIALS`.
- [ ] Engine tests cover ordering flip, inapplicable suppression, and replay of claimed confidence.
- [ ] Parent spec promise ("ranked by projected absolute impact on confidence") is implemented, not contradicted.

## Non-Goals

- Implementing this spec in this change (docs only).
- A new Monte Carlo engine, a client-side catalog of 20 full MCs, or scoring inside `getRetirementPlanOverview`.
- Changing Goal Seek, stress tests, safe-spending solve, or the Risk tab cone.
- Monthly `/what-if` (`WhatIfScenario` in `packages/features/src/what-if/calculator.ts`).
- Widening `ForecastScenario` macro rates to carry retirement levers.
- AI-authored suggestions or an LLM choosing the ranking.
- Parameter-sweeping every lever (e.g. retire later 1 through 10). 1/2/3 years is enough; Goal Seek covers named targets.
- iOS parity work (iOS What If can keep showing overview suggestions until it grows the opportunities query).
- Redesigning the What If column layout beyond Suggested + accordion composition.
- Persisting ranked suggestions. They re-derive from live baseline + stack, same as scenarios.

## Open Questions

- **Accordion after unification.** Hide it when Suggested already shows the useful six, vs keep "More high-impact changes" for ranks 7+. Default in this spec: keep as overflow, hide when empty.
- **Overfunded primary metric.** v1 uses sweep score (legacy/shortfall) when confidence ≥ 98%. Safe-spending delta is nicer copy but costs a binary-search MC per finalist; defer unless Phase 1 is clearly cheap enough.
- **`retire_earlier` in Suggested.** Only include when the sweep score is still > 0 (user can afford it). Otherwise it belongs in the catalog picker, not a "do this" card. Confirm product wants early-retirement as an improvement at all.
- **Overview payload.** Keep shipping unranked `suggestedLevers` on overview for MCP `suggestedLeverCount`, or switch that count to opportunities. Default: leave overview as eligibility list; UI ignores its order.

## Related Specs

- [features/retirement/spec.md](../retirement/spec.md) — parent. What If suggestions, Improve My Plan, performance contract, naming collision with `ForecastScenario` / monthly `/what-if`.
- [features/retirement/spec.md](../retirement/spec.md) Phase 2 / Phase 7 — What If engine and Improve My Plan. This spec is the missing ranking link between those two, not a new product surface.

## Suggested Commit Message

```text
docs (retirement): adds impact-ranked suggestion spec
```
