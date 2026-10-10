# Federal Rules Registry

## Status

Draft. Created 2026-08-29 after reviewing `packages/domain/src/retirement/constants.ts`, contribution-policy / taxes / social-security call sites, `plan-settings-help.ts`, and the stale 2025 brackets in `apps/api/.../financial-profile.ts`.

## Goal

Replace frozen `*_2026` government limits with a **versioned, source-cited federal-rules registry** keyed by tax year. Official published future years sit in production months before they become the default; unknown future years are explicitly **estimated**. January 1 requires no deploy.

Success means:

- Every calculation and tooltip that needs an annual IRS/SSA number resolves it from `@moat/domain` federal-rules for an explicit `taxYear`.
- Appending next year’s official row is the only annual maintenance for live datasets; history is never overwritten to “make current year work.”
- Estimated forecast amounts are never labeled as IRS facts in UI copy.
- Profile tax defaults and the retirement engine share the same bracket tables.

## Product Context

Moat’s retirement planner, savings tooltips, and financial-profile tax defaults all depend on annual government limits. Today those live as a single frozen 2026 blob (plus a second, stale 2025 copy in the API profile handler). When the IRS publishes 2027 HSA limits in spring but IRA limits only in the fall, a single “current year” constant cannot represent both. Users also need historically correct law for prior years and honest forecasting for decades ahead.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Frozen 2026 constants | `packages/domain/src/retirement/constants.ts` | `RETIREMENT_TAX_YEAR`, `CONTRIBUTION_LIMITS_2026`, brackets, deductions |
| Inflation indexer | `contributionLimitsForYear` in same file | Indexes **all** limits from 2026 — cannot mix official 2027 HSA with estimated 2027 IRA |
| Year ledger | `packages/domain/src/retirement/project.ts` | Already passes `calendarYear` into the indexer |
| Tax estimator | `packages/domain/src/retirement/taxes.ts` | Inflates 2026 brackets via `inflationFactor`; LTCG brackets inlined |
| SS estimate | `packages/domain/src/retirement/social-security.ts` | Wage base `184_500` and bend points inlined |
| UI help | `packages/features/.../plan-settings-help.ts` | Bakes 2026 dollars at module load |
| Savings max display | `packages/features/.../savings-section.tsx` | Uses `CONTRIBUTION_LIMITS_2026` |
| Profile tax defaults | `apps/api/.../financial-profile.ts` | Separate 2025-era `FEDERAL_TAX_BRACKETS` / `STANDARD_DEDUCTIONS` |
| Client-safe export | `@moat/domain/retirement-constants` | Features/renderer must not import domain barrel |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Contribution policy | `ledger/contribution-policy.ts` | Already takes per-year `limits` |
| Projection `taxYear` | `RetirementPlanInputs.taxYear` | Stamped on every plan; surface on projections |
| Planning assumptions | rest of `retirement/constants.ts` | Portfolio profiles, assumed Medicare premium, state rates — **not** IRS tables |

## Architecture / Data Model

```text
packages/domain/src/federal-rules/
  types.ts
  sources.ts
  tax-year.ts
  statutory.ts                 # RMD ages, SS claim window, Medicare age, SS taxability thresholds
  data/hsa.ts
  data/ira.ts
  data/workplace-retirement.ts
  data/federal-tax.ts
  data/social-security.ts
  rules/hsa-limit.ts
  rules/ira-limit.ts
  rules/employee-deferral-limit.ts
  projections/resolve-annual.ts
  index.ts
```

Export as `@moat/domain/federal-rules` (client-safe). `retirement/constants.ts` keeps planning assumptions and re-exports statutory ages for `@moat/domain/retirement-constants` compatibility.

### Official vs estimated

- Official tables contain **only** IRS/SSA/CMS-published values, each with `authority: { agency, document, publishedYear }`.
- `resolveOfficialOrEstimated` returns `{ amount, status: "official" | "estimated", … }`. Missing future years inflate from **that table’s** latest official year (not a global base year).
- UI help for “this year’s limit” always cites the **latest official** year for that dataset. Forecasts may use estimated amounts internally.

### Tax year from the event

- `getTaxYear(date)` is only for the UI/baseline boundary.
- Engine year rows use `calendarYear`.
- Financial-profile `taxYear` is profile metadata; still resolve official tables by that year — do not conflate it with the engine stamp.

### Primary sources (order)

1. IRS Revenue Procedures / Notices / IRB
2. IRS summary pages as cross-check only
3. SSA for Social Security
4. CMS for Medicare (when a Medicare table is added)
5. Never Fidelity, NerdWallet, Investopedia, etc.

### Annual update calendar

| Approx. time | Update |
|--------------|--------|
| May–June | Next year’s HSA/HDHP in `data/hsa.ts` |
| October | Federal tax + LTCG in `data/federal-tax.ts` |
| October | SSA wage base / bend points in `data/social-security.ts` |
| Oct–Nov | IRA + workplace in `data/ira.ts`, `data/workplace-retirement.ts` |
| Jan 1 | **Nothing** — automatic year selection |

Corrections to a published year: edit that year’s object and update `authority`. Never overwrite other years.

### V1 datasets (Moat consumers today)

HSA, combined IRA (+ Roth MAGI ranges stored, not applied), workplace employee deferral / catch-up / super catch-up, federal brackets, standard deduction, senior extra, LTCG, SS wage base + PIA bend points.

### Deferred datasets (add `data/*.ts` when a feature needs them)

FSA, gift-tax exclusion, Medicare Part B / IRMAA, SEP/SIMPLE distinct caps, NIIT.

## Acceptance Criteria

- [ ] Official HSA 2025/2026/2027, IRA/workplace/tax/SS 2025–2026 seeded with authorities
- [ ] `getTaxYear`, `openContributionYears`, and official-or-estimated resolver exist
- [ ] `getHsaContributionLimit`, `getIraContributionLimit`, `getEmployeeDeferralLimit` (with 60–63 super catch-up) are the only contribution-limit entry points for the engine
- [ ] No `CONTRIBUTION_LIMITS_20*`, `FEDERAL_BRACKETS_20*`, `FEDERAL_TAX_BRACKETS`, or bare `184_500` outside `federal-rules/data`
- [ ] Plan settings help and savings max resolve from the registry for an explicit tax year
- [ ] API financial-profile tax defaults use the same federal-tax tables
- [ ] Calendar reminder tests encode the IRS publish schedule
- [ ] Spec documents iOS rule: never Swift literals; fetch cached tables from API later

## Non-Goals

- Monthly HSA proration / last-month rule / Medicare enrollment gating
- Applying Roth MAGI phaseouts in the engine (store ranges only)
- Populating unused official tables (FSA, gift, IRMAA, SEP/SIMPLE, NIIT)
- iOS HTTP endpoint or scraper
- Dual-year prior+current IRA/HSA contributions inside the 40-year forecast

## Open Questions

- None for v1; Roth phaseout application and contribution-tracking UI are follow-ups.

## Related Specs

- [retirement/spec.md](../retirement/spec.md) — engine constants contract
- [retirement-edit-plan-assumptions/spec.md](../retirement-edit-plan-assumptions/spec.md) — documents prior hardcoded 2026 tables
- [retirement-smart-plan-engine/plan.md](../retirement-smart-plan-engine/plan.md) — contribution schedule requirement

## Suggested Commit Message

```text
feat (domain): versioned federal rules registry
```
