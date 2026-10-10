# Retirement smart plan engine — follow-up plan

## Status

- **Date:** 2026-08-28
- **Type:** Follow-up implementation plan. No code in this pass.
- **Prerequisite reading:** [`specs/features/retirement-calculation-audit/plan.md`](../retirement-calculation-audit/plan.md). That document is the audit of what exists and is **not modified by this plan**. Everything here assumes the audit's findings F-1…F-5 and its architecture items 1–4 land first (see Phase 0).
- **Basis:** live code on disk traced for this plan — `types.ts`, `project.ts`, `build-baseline.ts`, `apply-levers.ts`, `taxes.ts`, `constants.ts`, `spending-translation.ts`, `social-security.ts`, `retirement-sources.ts`, `apps/api/prisma/schema.prisma`, `packages/contracts/src/retirement.ts`, `packages/features/src/retirement/**`.
- **Scope boundary:** this plan defines the **baseline plan** layer ("how my financial life normally works"). It does not change the What-If scenario system's contract: a scenario is still `live baseline + ordered typed levers`, levers are still scenario-local, and no lever writes Financial Profile, Insights, or Plaid.

---

## Executive recommendation

The product boundary in the brief is right, and it maps cleanly onto an architectural boundary that already half-exists: **standing rules belong in the baseline, one-off changes belong in levers.** Adopt it.

But the biggest surprise from tracing the code is that **most of the suggested features are not missing engine math — they are missing a persistence and hydration layer.** `RetirementPlanInputs` (`types.ts:192–293`) already carries `rothConversion` (with bracket-fill), `annuities`, `recurringIncome`, `recurringExpenses`, `oneTimeEvents`, `spendingStages`, `preMedicareWindow`, `stateTaxChange`, `ltcCoverage`, `lifeCoverage`, `incomeAdjustments`. `build-baseline.ts:822–834` sets **every one of them to `[]` or `null`**. They are reachable only through a scenario lever, which by design does not persist as a baseline assumption. A Roth conversion ladder, a pension, a consulting-income rule, and a state-tax change at 65 are all things the engine can already project — the user simply has no way to say "this is my normal life."

So the shape of the work is:

1. **A standing-rule substrate** that persists `{ kind, params }` rows and singleton policy blobs on the plan, compiles them into `RetirementPlanInputs` in the shell, and mirrors the lever registry pattern. Roughly 60% of the suggestion list becomes available the moment this exists.
2. **Per-year policy evaluation** inside the year loop for the handful of rules that genuinely depend on projected state (contribution % of salary, employer match tiers, IRS limit path, cash sweep). This is the only place new engine math is required, and it is where today's model is actually wrong.
3. **A defaults-with-provenance module** so the drawer arrives pre-filled and every field can say where its number came from.

Two findings from this trace are severe enough that they gate Phase 2 and should be read before anything else:

> **A. The employer-match lever makes your cash flow worse.** `apply-levers.ts:741–754` computes the match and does `inputs.contributions.taxDeferred += match`. `project.ts:794–804` then runs `contributions.taxDeferred` through `clipPlannedFromLeftover`, which subtracts it from `cashFlowLeftover`. Employer money the household never sees is being charged against the household's take-home cash flow. Same class of error for `max_401k` (`:684–699`) and `max_hsa` (`:755–766`): they add employee deferrals to a bucket that is drawn from *after-tax* leftover.
>
> **B. There is no gross-compensation concept.** `annualEmploymentIncome` is derived from Insights *deposits* (`build-baseline.ts:643–660`), i.e. after payroll tax and after any 401(k) deferral already withheld. The accumulation identity intentionally does not tax wages again (`project.ts:660–675`). The moment a user says "contribute 10% of salary," there is no salary to take 10% of, and modeling that deferral as a draw on take-home double-counts a cost that never hit the bank.

Neither is fixable by adding fields. Both require a small, explicit income model — see **Phase 2 → Design decision D-1**.

### What I would build, and what I would cut

| Suggestion | Verdict | Why |
|---|---|---|
| 401(k)/403(b)/457 contribution policy (`$` / `% of salary` / `max`) | **Build — highest value** | Today contributions are a frozen scalar grown at `contributionGrowthRate`. "Max allowed" over 40 years is the single biggest realism gap named in the brief and it's correct. |
| Employer match formula (tiered), profit sharing | **Build** | Free money, materially changes outcomes, and today's implementation is backwards (finding A). |
| Catch-up contributions, auto-applied | **Build (cheap)** | `CATCH_UP_AGE`/`HSA_CATCH_UP_AGE` and the limits already exist in `constants.ts:101–109`; only the per-year application is missing. |
| Traditional/Roth deferral split | **Build** | One ratio; routes to `taxDeferred` vs `taxFree`. Trivial once contributions are a policy. |
| IRA / Roth IRA / backdoor Roth | **Build (fold into contribution policy)** | Same machinery. Backdoor Roth is a flag that skips the income phase-out check, not a new model. |
| HSA contributions + invest + retirement-healthcare treatment | **Build** | Detectable from `PlaidAccount.subtype` and `InsurancePolicy.hsaEligible`. Default "treat as retirement healthcare asset" = yes. |
| Pension (benefit, start age, COLA, survivor %) | **Build** | Genuine gap — no pension model exists anywhere. High dollar impact. |
| Annuity | **Build (wire only)** | `AnnuityPlan` already exists on inputs and in `project.ts:446–476`; baseline just never sets it. |
| Roth conversion strategy (fixed / bracket-fill) | **Build early — near-free** | `project.ts:715–739` and `taxes.ts:216–232` already implement both modes. Persist + hydrate is the whole job. |
| Recurring income / expense escape hatch | **Build early — near-free, high leverage** | Agreed, this is the most valuable item on the list. `RecurringFlow` exists; baseline sets `[]`. Prevents schema sprawl for consulting income, alimony, tuition, travel, club dues. |
| Retirement spending phases (early/normal/late) | **Build, defaults-first** | `spendingStages` exists on inputs *and* persists on `RetirementPlan.spendingStages`. Missing piece is a **default phase generator** + "% of current lifestyle." Do not ask for three numbers. |
| Pre-Medicare cost, Medicare start, Medicare + supplemental | **Build** | `preMedicareMonthlyPremium` is hardcoded to `950` (`constants.ts:191`) and `preMedicareWindow` is always `null`. Medicare cost after 65 is not modeled at all — healthcare just reverts to the general figure. |
| Healthcare inflation separate from CPI | **Already done — expose it** | `project.ts:264–265` uses `inflation + HEALTHCARE_INFLATION_PREMIUM` (2%, `constants.ts:189`). Make it visible/editable, don't rebuild it. |
| State in retirement | **Build** | `STATE_INCOME_TAX_RATES` covers all 51 jurisdictions (`constants.ts:230–289`) and `stateTaxChange` exists on inputs but is always `null`. We store no structured state on the user — that's the actual gap. |
| Income-type-aware taxation (wages vs Traditional vs Roth vs SS vs gains vs pension) | **Partially exists — extend** | `taxes.ts` already separates ordinary, capital gains, and SS provisional. The lie is `stateTax = taxableIncome × flatRate` (`taxes.ts:192`), which ignores that many states exempt SS and part of pension income. |
| Cash reserve target + excess-cash destination | **Build** | Correct diagnosis: residual→cash forever produces absurd terminal cash. But default the policy to **today's locked behavior** so this is a user choice, not a silent identity change. |
| RMD excess destination | **Build (with cash policy)** | Falls out of the cash policy for free. |
| Extra recurring debt payments | **Build (cheap)** | `ProjectedProperty.extraMonthlyPayment` exists; `ProjectedLiability` has no equivalent. |
| Property tax / insurance / HOA / maintenance, hydrated | **Build** | `RealEstateInvestment` already stores `monthlyPropertyTax`, `monthlyInsurance`, `monthlyHOA`, `monthlyMaintenance` (`schema.prisma:1011–1062`); the engine collapses them into one `monthlyExpenses`. Itemizing lets tax/insurance survive mortgage payoff and inflate on their own path. |
| Rental income growth / vacancy / opex | **Mostly exists** | Per-property `monthlyRent`, `vacancyRate`, `monthlyExpenses`, `expenseGrowthRate` are all modeled. Only rent *growth* separate from expense growth is missing. Low priority. |
| Asset allocation + glide path | **Build a reduced version, late** | `bucketReturns` is indexed by *tax* bucket, not asset class. A full stocks/bonds/cash model multiplies against that axis. Ship a glide path as a **return schedule by age**, not an asset model. |
| Spousal / survivor Social Security, auto-derived | **Build the spousal rule** | Survivor exists (`social-security.ts:69–74`); the spousal 50%-of-higher-PIA rule does not, and it's well-defined. Agreed: do not add inputs for it. |
| SS COLA as a user input | **Cut** | Agreed — keep internal. Today it rides general inflation, which is defensible. |
| Bonus / variable comp as a separate input | **Cut in v1 — it double-counts** | Baseline income is trailing 12-month Insights deposits, which **already include** any bonus that landed in the window. A separate additive bonus field silently double-counts. If added later it must be a *carve and re-shape* of detected income, not an addition. |
| Discretionary spending flexibility (guardrails) | **Defer** | This is dynamic-withdrawal policy (Guyton-Klinger). It changes what the deterministic ledger *means* and belongs with Monte Carlo work, not baseline settings. |
| Capital gains realization strategy | **Defer — blocked** | `TAXABLE_GAIN_FRACTION = 0.5` (`project.ts:33`) is an invented constant. Any gains strategy built on it is theater. The honest prerequisite is cost-basis tracking on the taxable bucket; make that its own phase. |
| Dividend treatment (reinvest vs cash) | **Defer** | Only meaningful once basis is tracked. Bundle with the cost-basis phase. |
| Tax-loss harvesting | **Cut** | Agreed, not v1. Arguably not ever, for a planner at this resolution. |
| Long-term care assumption as a baseline default | **Cut — keep as what-if** | `longTermCareEvents` and `ltcCoverage` already work as levers. LTC is a probabilistic *event*, not a standing policy; putting a default LTC event in every baseline makes every plan look worse for no informational gain. |
| IRMAA | **Defer to a named phase** | Real, and it interacts with Roth conversions via the 2-year lookback — which makes it a genuine feedback loop, not a line item. Schedule it after Medicare costs exist. |

---

## The one architectural idea: standing rules with effective dates

The brief's closing line is the correct abstraction and it should be taken literally:

> Almost every baseline assumption becomes `amount/strategy + start age + optional end age`.

### Why today's model can't express it

`applyLevers` is a **fold over `RetirementPlanInputs` evaluated once at t=0**. Every lever mutates a scalar or pushes onto an array, and the year loop then grows that scalar by a fixed factor. That is fine for "what if I retire two years earlier." It is structurally wrong for a policy, because a policy's value in year *N* depends on state the engine computes in year *N*:

| Rule | Depends on | Can it be a t=0 scalar? |
|---|---|---|
| "10% of salary to my 401(k)" | that year's salary after growth, levers, and job changes | No |
| "Max allowed each year" | that year's IRS limit and that year's catch-up eligibility | No |
| "100% of first 3%, 50% of next 2%" | that year's employee deferral | No |
| "Fill the 22% bracket" | that year's taxable income | No — and this one is already correctly done per-year at `project.ts:715–739` |
| "Sweep cash above 6 months of expenses" | that year's ending cash and expenses | No |
| "$2,400/mo pension from 65, 2% COLA" | age only | Yes |
| "$12k/yr consulting, 55→70" | age only | Yes |
| "Move to Nevada at 67" | age only | Yes |

### The two-track rule (give this to the implementing agent as a decision procedure)

> **Track A — compile in the shell.** If the rule's value is a function of age alone, compile it in `build-baseline.ts` into the arrays `RetirementPlanInputs` already has (`recurringIncome`, `recurringExpenses`, `annuities`, `oneTimeEvents`, `spendingStages`, `stateTaxChange`, `preMedicareWindow`, `rothConversion`). **No engine change. No new input field. Prefer this always.**
>
> **Track B — evaluate in the year loop.** Only if the rule reads a value the engine computes that year. Add a typed *policy object* to `RetirementPlanInputs` and a pure `calculate*` function called from the loop. Track B is expensive; justify each one.

Track B is required in exactly four places across this whole plan: contribution policy (Phase 2), cash policy (Phase 7), glide path (Phase 10, and even that can be Track A as a precomputed schedule), and the already-implemented Roth bracket fill.

### The persisted shape

Mirror the lever pattern — it is the established convention in this repo (`RetirementScenarioLever` is `{ type: String, params: Json }`, `schema.prisma:1202–1218`), the team already knows it, and it lets standing rules and levers share one registry mechanism.

```
RetirementStandingRule
  id, userId, planId
  kind        String      // PENSION | ANNUITY | RECURRING_INCOME | RECURRING_EXPENSE | ...
  label       String
  params      Json        // Zod-validated discriminated union member
  enabled     Boolean
  sortOrder   Int
```

Singleton policies (one per household, not a list) go as Zod-validated JSON columns on `RetirementPlan`, matching how `spendingStages` and `withdrawalOrder` are already stored (`schema.prisma:1139–1178`):

`contributionPolicy`, `spendingPolicy`, `healthcarePolicy`, `taxPolicy`, `cashPolicy`, `allocationPolicy`.

### Where it sits in Functional Core / Imperative Shell

```
        IMPERATIVE SHELL
  DB · Insights · Plaid · Profile
              │
              ▼
   buildRetirementBaseline()
              │
              ├── deriveSmartDefaults(signals)      ← pure, new
              │      (value + source + confidence)
              │
              ├── applyStandingRules(inputs, rules) ← pure, new  [Track A]
              │
              ▼
         PURE CORE
              │
         applyLevers()      ← may override policies + rules
              │
              ▼
      projectRetirement()
              │
        per-year loop
              ├── calculateContributions(policy, salary, age, limits)  [Track B]
              ├── calculateCashPolicy(policy, cash, expenses)          [Track B]
              └── … existing calculators from audit arch item 1
```

`applyStandingRules` is pure, clones, and runs **before** `applyLevers` so a lever can always override a rule.

### Relationship to levers (do not skip this)

Adding ~30 baseline settings must not become ~30 new lever types. The rule:

- **Levers target policies, not derived scalars.** After Phase 2, `max_401k` becomes "set `contributionPolicy.employee401k.mode = 'max'`" rather than `contributions.taxDeferred += delta`. This deletes finding A by construction and makes the lever's effect correct in every future year.
- **A lever may reference a standing rule by id** to disable or modify it — e.g. "what if my pension has no COLA." Add `ruleId` to the relevant lever params rather than inventing per-rule lever types.
- **The audit's lever-registry refactor (arch item 3) must land before this.** Adding policy-targeting levers to a 62-arm switch produces a 90-arm switch across four files.

---

## Smart defaults and provenance

The brief's real ask — "as many of these with defaults given what we know about the user so they don't have to fill it all out" — needs a mechanism, not good intentions. Two pieces.

### 1. Every policy field carries provenance

```ts
type PolicyField<T> = {
  value: T;
  source: "detected" | "assumed" | "profile" | "userEdited";
  confidence: "high" | "medium" | "low";
  /** One short sentence for the UI chip. No PII. */
  rationale: string;
};
```

Rules: `userEdited` is never overwritten by a later detection pass. `detected` and `assumed` re-derive on every baseline build (the baseline is a live twin — that property must not be broken). The UI renders a chip on non-`userEdited` fields ("From your Fidelity 401(k)" / "Industry assumption") with a single-tap edit. `plan-confidence.ts` weights `userEdited` above `detected` above `assumed`, and `setup-checklist.ts` gains encouraged items that ask the user to confirm the low-confidence ones.

### 2. What we can actually detect today

Traced against the live schema. This is the honest inventory — do not promise defaults outside it.

| Policy field | Signal available today | Location | Confidence |
|---|---|---|---|
| Which accounts are 401(k)/IRA/Roth/HSA/brokerage | `PlaidAccount.subtype`, `Investment.type` | `retirement-sources.ts:178–228`; `schema.prisma:1584–1618`, `:967–988` | high |
| Existing contribution amounts | `PlaidAccount.monthlyContribution`, `Investment.monthlyContribution` | user-entered today; already rolled up in `build-baseline.ts:488–503` | medium |
| HSA eligibility + self vs family coverage | `InsurancePolicy` health `hsaEligible`, party count | `financial-profile-data.ts` V2 insurance | medium |
| Asset allocation (equity/bond/cash) | `PlaidHolding.securityType`, `tickerSymbol`, `value` | `schema.prisma:1623–1648` | medium — **unused by retirement today** |
| Filing status, state tax rate | `TaxProfile.filingStatus`, `estimatedStateTaxRate` | already read at `build-baseline.ts:820–821` | high when set |
| **State of residence** | `FinancialProfileRecord.location` (free text) + modal `Transaction.location.region` from Plaid | `schema.prisma:611–612` | medium — infer, always confirm |
| Property tax / insurance / HOA / maintenance | itemized columns on `RealEstateInvestment` | `schema.prisma:1011–1062` | high when populated |
| Healthcare spend today | category-name regex over trailing spend | `build-baseline.ts:572–586` | medium |
| Recurring expenses (travel, dues, tuition) | `detectRecurringExpenses` | `packages/domain/src/spending/detect-recurring-expenses.ts` | medium — **not wired to retirement today** |
| Social Security at FRA | bend-point estimate from income | `social-security.ts:49–63` | medium (already used) |
| Employer match | **nothing** | — | assumed only (`ASSUMED_EMPLOYER_MATCH_PERCENT` 50% up to 6%, `constants.ts:197–198`) |
| Gross compensation | **nothing** — deposits are net | see D-1 | must be asked or grossed-up |
| Pension | **nothing** | — | must be asked |

Two of these are pure wins that no phase should skip: **`detectRecurringExpenses` already produces exactly the shape a recurring-expense standing rule needs** and is currently thrown away by the planner; and **`PlaidHolding` gives real allocation data** that the retirement engine has never read.

---

## Phase plan

Each phase is independently shippable and independently reviewable. Ordering differs slightly from the brief's suggested order — noted where it does and why.

### Phase 0 — Prerequisites (from the audit; not re-planned here)

**Do not start Phase 1 until these land.** Adding per-year policies to a 600-line inline loop, or new spend carve-outs to a double-carving composition layer, will compound the exact bugs the audit just found.

1. Audit fixes **F-1 → F-5** (mortgage double-carve, `income_change` leak, short-history annualization, liability-backed category dedupe, payoff-year proration).
2. Audit architecture item **1** — extract per-line calculators from the year loop.
3. Audit architecture item **2** — the single `composeSpend` partition module with the property test that `sum(partition) === headline`.
4. Audit architecture item **3** — lever registry replacing the 62-arm switch.
5. Audit architecture item **4** — golden fixtures + the per-year invariant test.

**Definition of done:** domain suite green; golden fixtures committed; `packages/domain/src/retirement/project.ts` year loop is a sequence of named pure calls.

---

### Phase 1 — Standing-rule substrate + defaults + IA shell

**Goal:** the plumbing, plus the two features that come free with it. No new financial math.

**Contracts** (`packages/contracts/src/retirement.ts`)
- `RetirementStandingRuleKindSchema` — start with `PENSION`, `ANNUITY`, `RECURRING_INCOME`, `RECURRING_EXPENSE`. Later phases extend the union.
- `RetirementStandingRuleSchema` — `{ id, kind, label, enabled, sortOrder, params }` as a discriminated union on `kind`, mirroring `RetirementLeverSchema` (`:103–538`).
- Shared `EffectiveWindowSchema` — `{ fromAge, toAge: number | null, inflates: boolean }`. Every rule that has a lifecycle embeds this. This is the literal encoding of "standing rules with effective dates."
- `PolicyFieldSchema<T>` generic wrapper.
- CRUD input schemas: `Create/Update/DeleteRetirementStandingRuleInput`.
- Add `standingRules: RetirementStandingRule[]` to `RetirementPlanOverviewSchema` (`:937–949`).

**Persistence**
- Postgres migration adding `RetirementStandingRule` (indexed on `userId`, `planId`) plus the six empty JSON policy columns on `RetirementPlan`. **Committed migration only — never `db push` on Neon.**
- Mirror in `packages/db-sqlite/prisma` with the established divergences (`Json` → `String`, enums → `String`, `Float` for money).
- Extend `RetirementRepository` with `listStandingRules` / `upsertStandingRule` / `deleteStandingRule`, implemented in `PostgresRetirementRepository` and `SqliteRetirementRepository`.
- Facade in `packages/domain/src/retirement/retirementStandingRules.ts`, matching `retirementScenarios.ts`.

**Domain**
- New `packages/domain/src/retirement/standing-rules/` — one module per kind exporting `{ schema, compile(inputs, params, ctx), describe, defaultParams }`, plus `registry.ts` and `apply-standing-rules.ts` folding the registry. Same shape as the Phase 0 lever registry so the two can share test helpers.
- New `packages/domain/src/retirement/defaults/` — pure `derive*(signals) → PolicyField<T>` functions and a `DefaultSignals` type assembled by the shell. **No I/O in this directory.**
- `build-baseline.ts`: read standing rules, call `applyStandingRules` before returning inputs. This replaces the hardcoded `[]`/`null` at `:825–834` for the kinds this phase covers.

**Free wins in this phase**
- `RECURRING_INCOME` / `RECURRING_EXPENSE` compile straight to the existing `RecurringFlow[]` inputs. Consulting income, alimony, family support, travel budgets, tuition help, club dues — all covered by one rule kind. This is the escape hatch, and it is the highest value-per-line item in the entire plan.
- Seed suggested recurring-expense rules from `detectRecurringExpenses` as `source: "detected"`, unconfirmed, surfaced as "We noticed $410/mo for X — should this continue in retirement?"

**API / hosts**
- `listStandingRules`, `upsertStandingRule`, `deleteStandingRule`. Reads via `withDemoOrAuth`, writes via `withAuth` (`handlers/retirement.ts` pattern). Mirror all three as desktop IPC channels with **identical wire shapes** — the audit's F-13 flags existing drift; do not add more.

**UI** (`packages/features/src/retirement/plan/`)
- Restructure `plan-settings-panel.tsx` (535 lines) and `plan-settings-assumptions.tsx` (565 lines) into `plan-settings/` with **one file per accordion section**, an `index.tsx` shell, and shared controls staying in `plan-settings-fields.tsx`. AGENTS.md requires splitting `.tsx` beyond ~200 lines with multiple sub-components; both files are already well past it and every later phase adds a section.
- Introduce the target IA (below) with later sections stubbed/hidden until their phase lands.
- Generic `StandingRuleList` + `StandingRuleRow` components driven by the registry's `describe`, so a new rule kind needs no new list UI.
- `ProvenanceChip` rendering `PolicyField.source` + `rationale`.
- Use `@moat/ui` primitives; kebab-case filenames; `~/` alias in web.

**Tests**
- Registry parity: every `RetirementStandingRuleKind` has a compile branch (mirror of the existing 62/62 lever parity test).
- `applyStandingRules` never mutates its input.
- Round-trip: rule → compile → `projectRetirement` produces the expected year-row deltas.
- Baseline test: a `RECURRING_INCOME` rule of $12k/yr from 55→70 appears in `otherIncome` for exactly those years and nowhere else.

**Risks**
- Rules and levers can now express the same thing twice (a pension rule *and* a `custom_income` lever). Levers apply after rules, so the levered projection is authoritative — but the impact table must not present the sum as if it were two independent changes. Add a conflict note keyed on `ruleId`.

---

### Phase 2 — Contributions and employer benefits

**The largest phase, the largest realism gain, and the only one with a blocking design decision.** This matches the brief's own top priority.

#### Design decision D-1 (blocking — get an answer before writing code)

Today: `annualEmploymentIncome` = trailing net deposits; the accumulation identity deliberately skips wage tax (`project.ts:660–675`); planned contributions are drawn from take-home leftover (`:794–804`).

That model cannot express "10% of salary" and it charges pre-tax deferrals against post-tax cash. Recommended resolution:

- Add `grossAnnualCompensation` (per person) as a **policy field with provenance**, defaulted by grossing up observed net deposits using filing status, state rate, and estimated payroll tax — clearly labeled `assumed`, and easy to overwrite with a real salary number.
- Split contributions into two engine concepts:
  - **`employeeDeferral`** — pre-tax (Traditional) portion reduces gross *before* take-home is derived; it is **not** a draw on `cashFlowLeftover`. Roth (post-tax) portion **is** a draw on leftover, correctly.
  - **`employerContribution`** (match + profit sharing) — **never touches `cashIn` or `cashOut`**. It is a pure balance addition applied at the same point as `clipped.taxDeferred` in `project.ts:806`, bypassing `clipPlannedFromLeftover` entirely. This is the direct fix for finding A.
- Preserve the locked worked example: with no contribution policy set, a household whose only input is $10,000/yr take-home and $13,024/mo composed spend must still produce **leftover −$146,288/yr ≈ −$12,191/mo** with `contributionsCash === 0`. Add this as an explicit regression assertion in the Phase 2 test file, not just in the existing engine test.

**Alternative if D-1 is rejected:** keep everything net, and restrict contribution modes to `$` and `max` (drop `% of salary`). Cheaper, meaningfully less useful, and leaves finding A to be fixed on its own.

#### `contributionPolicy` shape

```ts
type ContributionPolicy = {
  perPerson: {
    primary: PersonContributionPolicy;
    spouse: PersonContributionPolicy | null;
  };
  autoApplyCatchUp: boolean;      // default true
  contributionsStopAge: number | null;  // null = each person's employment end
};

type PersonContributionPolicy = {
  employerPlan: {                 // 401(k) / 403(b) / 457
    mode: "none" | "fixedAnnual" | "percentOfSalary" | "maxAllowed";
    amount: number | null;        // dollars or percent depending on mode
    rothShare: number;            // 0..1, remainder Traditional
    match: MatchTier[];           // [{ matchRate: 1.0, upToPercent: 0.03 }, { 0.5, 0.02 }]
    profitSharingPercentOfSalary: number;
  };
  ira: { mode: "none" | "fixedAnnual" | "maxAllowed"; amount: number | null; kind: "traditional" | "roth"; backdoor: boolean };
  hsa: { mode: "none" | "fixedAnnual" | "maxAllowed"; employeeAmount: number | null; employerAmount: number; invested: boolean };
  taxableMonthly: number;
};
```

`MatchTier[]` encodes "100% of first 3%, 50% of next 2%" exactly, and degrades to the single-tier case without a second shape.

#### Engine work (Track B)

- New `packages/domain/src/retirement/calculators/contributions.ts` exporting a pure `calculateContributions({ policy, grossSalary, spouseGrossSalary, age, spouseAge, year, limits, leftover })` returning `{ employeeTraditional, employeeRoth, employerTaxDeferred, taxable, hsa, clipped }`. It subsumes `clipPlannedFromLeftover`.
- **Contribution limits must become a schedule, not a constant.** `CONTRIBUTION_LIMITS_2026` (`constants.ts:101–109`) is a single year. Add `contributionLimitsForYear(year, inflationRate)` that indexes the 2026 base by inflation and rounds to the statutory $500/$1,000 increments. Without this, "max allowed each year" freezes a 2026 dollar amount for 40 years — the exact failure the brief calls out.
- Rewire `apply-levers.ts` cases `max_401k` (`:684–699`), `max_roth_ira` (`:700–715`), `max_spousal_iras` (`:716–740`), `employer_match` (`:741–754`), `max_hsa` (`:755–766`), `contribution_change`, `stop_contributions_at_age` to **set fields on `contributionPolicy`** instead of mutating `contributions.*`. Keep the lever type strings and params unchanged so saved scenarios keep working.
- Resolve audit **F-7** here (contributions when only the spouse works): a per-person policy makes the answer structural — each person contributes while *that person* is working — rather than a household-wide gate on the primary's `employmentEndsAtAge` (`project.ts:591–592`). Confirm this is the intended product answer.

#### Defaults
- Detect account kinds from `PlaidAccount.subtype` (`retirement-sources.ts:178–228`); pre-create a policy entry per detected plan type.
- Seed `mode: "fixedAnnual"` from existing `monthlyContribution × 12` when present, `source: "detected"`.
- Seed match as `[{1.0, 0.03}, {0.5, 0.02}]`, `source: "assumed"`, `confidence: "low"`, rationale "Typical employer match — confirm with your plan documents." Do **not** reuse the `employerMatchUnmodeled` heuristic in `build-baseline.ts:903–911` as if it were data.
- Seed HSA coverage type from the health `InsurancePolicy` party count; `invested: true` and treat-as-retirement-asset default `true`.
- `rothShare` default `0` (Traditional) unless the account mix already shows Roth deferrals.

#### UI
New section **Savings & contributions**, positioned directly after Investment accounts as the brief suggests. Per plan, render the radio + inline field pattern from the brief (`$/mo` · `% of salary` · `Max allowed each year`), the two-tier match row, the Traditional/Roth split, and the catch-up checkbox. Show the resolved dollar figure for the current year beneath the control so "max allowed" is never opaque.

#### Tests
- Match tiers: salary $200k, deferral 4% → match = 3%×100% + 1%×50% = $7,000; deferral 10% → capped at 3%+2% tiers = $8,000.
- `maxAllowed` at age 49 vs 50 (catch-up boundary), and in year 20 (limit must have grown).
- **Employer contribution does not move `cashFlowLeftover`** — the regression test for finding A.
- Traditional deferral does not double-reduce take-home (D-1).
- Locked worked example still holds with an empty policy.

---

### Phase 3 — Guaranteed income: pension, annuity, Social Security spousal

**Track A for pension and annuity — no year-loop change.**

- Standing-rule kinds `PENSION` and `ANNUITY`. Pension params: `{ monthlyBenefit, startAge, colaRate, survivorPercent, whom, taxTreatment }`. Compile to `recurringIncome` entries with `taxTreatment: "ordinaryIncome"`, plus a survivor branch that reduces the benefit to `survivorPercent` after the covered person's death (`spouseDeathAtAge` is already modeled at `project.ts:271–273`).
- `ANNUITY` compiles to the existing `AnnuityPlan[]` — the engine path at `project.ts:446–476` already works, it has simply never been fed from the baseline.
- **Social Security spousal benefit** (`social-security.ts`): add `spousalMonthlyBenefit({ ownPia, higherEarnerPia, claimAge, fra })` implementing "greater of own benefit or 50% of the higher earner's PIA, reduced for early claiming, no delayed credits on the spousal portion." Wire into `project.ts:330–375`. **No new user input** — this is exactly the "make Social Security smarter rather than adding inputs" ask.
- While in this file, address audit **F-11**: primary death is not modeled symmetrically with spouse death. Either implement it or document the asymmetry in the year-inspector copy.

**UI:** new **Income & benefits** section grouping Social Security (existing fields), Pensions (`+ Add pension`), and Annuities (`+ Add annuity`), matching the brief's layout.

**Tests:** pension with COLA starting at 65 appears in `otherIncome` from 65 on, grows at the COLA rate not general inflation, and drops to the survivor percentage after `spouseDeathAtAge`. Spousal benefit: low-earner spouse with own PIA $700 and partner PIA $2,000 claiming at FRA receives $1,000, not $700.

---

### Phase 4 — Roth conversion strategy in the baseline

Deliberately early — the engine already does the hard part, so this is the best value-per-hour item after Phase 1. (The brief ranks it fifth; I'd pull it forward.)

- `taxPolicy.rothConversion: { mode: "none" | "fixedAmount" | "fillToBracket", annualAmount, targetBracket, fromAge, toAge }`, compiled Track A into the existing `RothConversionPlan` (`types.ts:129–134`).
- `project.ts:715–739` already implements both modes inside the tax⇄withdrawal solve loop, and `headroomToBracketTop` (`taxes.ts:216–232`) already sizes the bracket fill.
- **Default the age window intelligently:** `findRothConversionWindow` (`taxes.ts:259–314`) already identifies the contiguous post-retirement, pre-RMD years whose marginal rate sits a bracket below the post-RMD median. Run it on the unlevered baseline projection and pre-fill `fromAge`/`toAge` as `source: "detected"`. This is the single most impressive default in the whole plan — the drawer opens already knowing your conversion window.
- UI: radio group exactly as the brief sketches (None / Fixed amount / Fill a tax bracket / Custom), inside **Taxes & withdrawal strategy**. Show the projected lifetime-tax delta beside the control.
- Tests: bracket-fill conversion raises `rothConversion` and `taxesPaid` in-window, lowers `requiredMinimumDistribution` after `rmdStartAge`, and leaves `cashFlowLeftover` identity intact.

---

### Phase 5 — Retirement spending lifecycle

`spendingStages` already exists on inputs, persists on `RetirementPlan.spendingStages`, and is consumed via `monthlySpendForAge`. The missing piece is **defaults and framing**, not storage.

- `spendingPolicy: { retirementSpendPercentOfCurrent: PolicyField<number>, phases: SpendingPhase[] | null, phaseModel: "flat" | "smile" }`.
- **Default generator:** a pure `deriveSpendingPhases({ retirementAge, longevityAge, baseMonthly })` producing the go-go / slow-go / no-go curve (early 100%, mid ~85%, late ~75% of the at-retirement figure by default). Surface the resulting numbers as editable, not as required input — the brief is right that users should not have to produce three figures.
- Default `retirementSpendPercentOfCurrent` to 90%, `source: "assumed"`.
- **Healthcare stays out of this partition.** It behaves differently and is already carved (`build-baseline.ts:572–586`) and separately inflated (`project.ts:264–265`). Phase 6 owns it.
- **Carve hazard:** every stage is passed through `toEngineMonthlySpend` (`build-baseline.ts:174`) — the same function implicated in audit F-1. This phase must go through the Phase 0 `composeSpend` module, not re-derive carve-outs. Assert `sum(partition) === headline` for every stage.
- UI: **Spending** section showing current lifestyle (read-only, from Insights), "% of current lifestyle at retirement," and the three phases with their computed amounts, editable.

---

### Phase 6 — Healthcare and Medicare

- `healthcarePolicy: { preMedicareMonthlyPremium: PolicyField<number>, medicareStartAge, medicareMonthlyCost: PolicyField<number>, healthcareInflationPremium: PolicyField<number>, includeHsaAsHealthcareAsset: boolean }`.
- Replace the hardcoded `PRE_MEDICARE_MONTHLY_PREMIUM` (`constants.ts:191`, wired at `build-baseline.ts:798`) with the policy value; keep 950 as the seeded assumption.
- Set `preMedicareWindow` from `{ retirementAge, medicareStartAge - 1 }` instead of `null` (`build-baseline.ts:799`).
- **Add a Medicare + supplemental cost line from age 65 on.** Today healthcare simply reverts to the general figure after the pre-Medicare window ends, which understates post-65 cost. Default to a Part B + Part D + Medigap estimate, per covered adult, labeled `assumed`.
- Expose `healthcareInflationPremium` (currently a fixed 2% over CPI at `constants.ts:189`) as an editable assumption. **Do not rebuild the mechanism — it works.**
- LTC stays a what-if. Do not seed a default LTC event.
- Tests: pre-Medicare premium applies for exactly the retirement→64 window and scales with `spouseAlive`; Medicare cost begins at 65; healthcare compounds at CPI + premium while living expenses compound at CPI.

---

### Phase 7 — Cash policy and RMD destination

- `cashPolicy: { targetReserve: { mode: "months" | "fixed", months: number, amount: number }, excessDestination: "cash" | "taxable" | "custom", rmdExcessDestination: "cash" | "taxable" }`.
- **Default `excessDestination: "cash"`** — identical to today's locked behavior (`project.ts:812–815`, spec `retirement-surplus-to-savings`). This phase makes the behavior *visible and choosable*; it must not silently change any existing projection. That property should be asserted by a golden-fixture diff of zero on the frozen fixtures.
- Track B: `calculateCashPolicy({ policy, endingCash, annualExpenses })` runs after the cash park and before the growth step, sweeping the excess into `balances.taxable` when the user opts in.
- This is what prevents the $14M-in-cash-at-95 artifact the brief flags, without reopening the residual→cash rule by fiat.
- RMD excess rides the same policy. Note the interaction with audit **F-8**: sweeping RMD proceeds into taxable creates future realized gains, so this phase must not land before F-8's accumulation-deduction question is answered.
- UI: **Investments & cash** section — "Target emergency reserve `[6]` months of expenses" and the destination radio, exactly as sketched.

---

### Phase 8 — Taxes: state of residence and retirement state

- `taxPolicy: { currentStateCode, retirementStateCode, stateChangeAtAge, useCurrentTaxLaw: boolean }`.
- Compile Track A into the existing `stateTaxChange` (`types.ts:265`, always `null` at `build-baseline.ts:822`) using `stateIncomeTaxRate()` (`constants.ts:284–289`), which already covers all 50 states + DC.
- **Default `currentStateCode`** by inferring from the modal `Transaction.location.region` across recent Plaid transactions, cross-checked against the free-text `FinancialProfileRecord.location`. Mark `detected`/`medium` and always ask for confirmation. Default `retirementStateCode` to the same value.
- Replace the typed flat "State tax 5%" field with a state picker; keep a manual override for users who know their effective rate.
- **Then extend beyond the flat rate.** `taxes.ts:192` computes `stateTax = taxableIncome × flatRate`, which ignores that most states exempt Social Security and many exempt some pension/retirement income. Add a per-state `StateRetirementTaxProfile { taxesSocialSecurity, retirementIncomeExclusion, hasFlatRate }` and apply it to the retirement-income components the engine already separates. This is what makes the brief's "a single 5% rate isn't going to hold up" concern concrete and fixable.
- Tests: moving from Utah to Nevada at 67 drops `stateTax` to zero from 67 on and does not disturb federal tax; a state that exempts SS produces lower state tax than the flat model for an SS-heavy retiree.

---

### Phase 9 — Housing ownership costs, rentals, and extra debt payments

- Feed the itemized `RealEstateInvestment` columns (`monthlyPropertyTax`, `monthlyInsurance`, `monthlyHOA`, `monthlyMaintenance`, `monthlyManagement`, `monthlyUtilities`, `monthlyOtherExpenses`, `schema.prisma:1011–1062`) into `ProjectedProperty` as named components instead of the single collapsed `monthlyExpenses`. Benefits: these survive mortgage payoff correctly, and property tax / insurance can inflate on their own paths.
- Optional maintenance-as-percent-of-value (e.g. 1%/yr) as an alternative to a fixed amount.
- Add `extraMonthlyPayment` to `ProjectedLiability` (`types.ts:35–42`) mirroring `ProjectedProperty.extraMonthlyPayment`, applied in `stepLiability`. Requires audit **F-5** (payoff-year proration) to be in place first or the acceleration will be masked by the 12-month overcharge.
- Rent growth separate from expense growth per property. Low priority; include only if cheap.
- **Carve hazard again:** trailing Insights spend already contains property tax, HOA, and home insurance if they were paid from a tracked account. The Phase 0 carve registry must own the decision for each component exactly once. This is audit F-4's disease generalized — treat any new housing component as a registry entry, never as an ad-hoc subtraction.

---

### Phase 10 — Asset allocation and glide path

Deliberately last of the build phases; highest effort-to-clarity ratio.

- **Do not add an asset-class model.** `bucketReturns` is indexed by tax treatment (`types.ts:28–33`); adding a stocks/bonds/cash axis multiplies against it and forces every fixture to specify a 3×3 matrix.
- Instead: `allocationPolicy: { targetEquityPercent: PolicyField<number>, glidePath: { enabled, equityAtRetirement, equityAtLongevity } }`, compiled Track A into a per-age `returnSchedule: number[]` derived from an equity/bond expected-return blend.
- **Interaction warning:** `returnSequence` (`types.ts:292`) already overrides bucket returns for Monte Carlo and it flattens per-bucket returns (audit **F-12**). Define precedence explicitly — `returnSequence` should shock *around* the glide-path mean, not replace it — and resolve F-12 in the same PR or the cone will contradict the deterministic line.
- **Default `targetEquityPercent` from `PlaidHolding`** (`schema.prisma:1623–1648`) by classifying `securityType` / ticker into equity / fixed income / cash. This is real data the retirement engine has never used and it makes the default genuinely personal rather than an age rule of thumb.

---

### Deferred backlog (named so they are not forgotten)

| Item | Blocker / reason | Prerequisite |
|---|---|---|
| Cost-basis tracking on the taxable bucket | `TAXABLE_GAIN_FRACTION = 0.5` (`project.ts:33`) is invented | its own phase; unblocks the next two |
| Capital gains realization strategy | meaningless without real basis | cost basis |
| Dividend treatment (reinvest vs cash) | same | cost basis |
| IRMAA surcharges | 2-year lookback creates a real feedback loop with Roth conversions | Phase 6 + Phase 4 |
| Spending guardrails / dynamic withdrawal | changes what the deterministic ledger means | Monte Carlo unification (audit open question 4) |
| Bonus / variable compensation | double-counts against trailing Insights income | requires D-1's gross-income model *and* an income-shape carve |
| Long-term care as a baseline default | it's an event, not a policy | stays a what-if |
| Tax-loss harvesting | not worth modeling at this resolution | — |

---

## Target Plan Settings information architecture

Current (6 sections): Timeline · Growth rates · Investment accounts · Properties & mortgages · Other debts · Taxes.

Target (10 sections, accordion, only Timeline + Income expanded by default):

| # | Section | Phase | Contents |
|---|---|---|---|
| 1 | Timeline & household | exists | birth years, retirement ages, planning horizons, spouse |
| 2 | Income & benefits | 3 | employment income, Social Security, pensions, annuities |
| 3 | Savings & contributions | 2 | 401(k)/403(b)/457, match, profit sharing, IRA, Roth, HSA, brokerage |
| 4 | Spending | 5 | current lifestyle, % at retirement, spending phases |
| 5 | Investments & cash | 7, 10 | accounts, returns, cash reserve + destination, allocation/glide path |
| 6 | Properties & mortgages | 9 | existing, plus itemized ownership costs and rental terms |
| 7 | Debts | 9 | existing, plus extra recurring payments |
| 8 | Healthcare | 6 | pre-Medicare, Medicare, healthcare inflation |
| 9 | Taxes & withdrawal strategy | 4, 8 | filing status, current/retirement state, Roth conversions, withdrawal order |
| 10 | Planning assumptions | exists | inflation, returns, real estate growth, longevity |
| — | Standing rules ("Recurring income & expenses") | 1 | the escape hatch; rendered inside §2 and §4 |

**Constraints for the implementing agent:** one file per section under `plan-settings/`; keep each under ~200 lines; `@moat/ui` primitives only (no native `<button>`/`<select>`); kebab-case filenames; `~/` alias in `apps/web`; the existing `handleSave` cascade to `writeOverlappingRatesToBothStores` must keep working and What-If must never route through it.

---

## Testing strategy

1. **Golden fixtures (from Phase 0) are the safety net.** Each phase adds one fixture exercising its policy and must produce a **zero diff** on the pre-existing fixtures when its policy is unset. That is the mechanical guarantee that "smart" defaults never silently change an existing user's plan.
2. **Registry parity tests** for standing-rule kinds, mirroring the 62/62 lever parity test.
3. **Carve-registry property test:** for arbitrary inputs, the spend partition sums to the headline, with every new Phase 5/6/9 component included. This is the generalized guard against F-1/F-4 recurring.
4. **Per-year invariant test** on every fixture: `cashFlowLeftover === cashIn − cashOut − cashFlowTax`, unchanged by any policy. If a phase breaks this, the phase is wrong, not the invariant.
5. **Provenance snapshot test:** for a fixed set of signals, `deriveSmartDefaults` produces a stable `{ value, source, confidence }` map. Catches accidental promotion of `assumed` to `detected`.
6. **Locked worked example regression** (Phase 2): $10,000/yr take-home, spouse out at 30, $13,024/mo composed spend → −$146,288/yr, `contributionsCash === 0`, spend does not shrink.
7. **Host parity:** every new endpoint has a desktop IPC channel with an identical wire shape. Do not repeat audit F-13.

---

## Migration and rollout

- Every schema change is a **committed Postgres migration** applied via `pnpm db:migrate:dev` locally and `migrate deploy` in CI. Never `db push` on Neon; never apply staging/production schema changes from a local `.env`.
- Every Postgres migration has a matching `packages/db-sqlite` migration in the same PR.
- All new columns default to empty (`{}` / `[]`), so an un-migrated user's plan projects exactly as it does today. Behavior changes only when a policy is populated.
- **One phase per PR.** Do not mix a policy addition with a refactor — the repo rule is single-purpose PRs, and this plan is specifically ordered so that never has to happen.
- PostHog: `retirement_policy_edited` with `{ policy: <enum>, source: "detected" | "assumed" | "userEdited" }`. Counts and enums only — no amounts, no PII.

---

## Open questions

1. **D-1 (blocking Phase 2): gross vs net income.** Do we introduce `grossAnnualCompensation` with a grossed-up default so `% of salary` and pre-tax deferral semantics work, or do we stay net-only and ship contributions as `$` and `max` modes only? Everything about the contributions phase depends on this answer.
2. **Employer contributions and leftover.** Confirm the intent: employer match and profit sharing should be balance additions that **never** appear in `cashIn`, `cashOut`, or `cashFlowLeftover`. (Today's `employer_match` lever reduces leftover — I believe that is simply a bug, but it is a behavior change to fix it and one saved scenario's numbers will move.)
3. **F-7, restated as product.** With per-person contribution policies, each person contributes while that person works. Confirm this replaces the current household-wide gate on the primary's `employmentEndsAtAge`.
4. **Cash policy default.** I recommend defaulting to `excessDestination: "cash"` to preserve the locked rule exactly, making investing-the-excess an opt-in. Agree, or should the default flip to `taxable` once the policy is user-visible?
5. **State tax depth.** Is a flat per-state rate plus SS/pension exclusions enough for v1, or do you want real state brackets? The former is roughly a day; the latter is a data-maintenance commitment across 51 jurisdictions, annually.
6. **Detected recurring expenses.** Should `detectRecurringExpenses` output be auto-seeded as unconfirmed standing rules (with a confirm/dismiss affordance), or only offered as suggestions the user explicitly adds? Auto-seeding is more "smart," but it changes the projection based on a heuristic the user never approved.
7. **Where standing rules surface in What-If.** When a baseline pension exists, should the catalog offer "what if my pension has no COLA" as a lever targeting that `ruleId`, or should rule edits stay strictly in Plan Settings? I lean toward `ruleId`-targeting levers, since it keeps the "what if" framing without duplicating the rule.
8. **Backdoor Roth honesty.** Modeling it as "Roth IRA contribution, ignore the income phase-out" is accurate on balances but silent about the pro-rata rule when the user holds pre-tax IRA money. Model the pro-rata tax, or ship it with a caveat in the help text?

---

## Explicitly out of scope

Reaffirming the locked rules so no phase reopens them: the leftover identity stays `cashIn − cashOut − cashFlowTax`, signed, every year. Insights hydrates and is never written by the planner. Income and spend remain independent. Wage-share-of-net and Insights-net-as-leftover stay dead. Scenarios remain `{ name, levers }` with no balance snapshot. Edit Plan keeps cascading to Financial Profile and the active ForecastScenario; What-If never touches that path.
