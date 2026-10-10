# Synced Account Forecast Assumptions

## Status

Draft. Created 2026-08-26 for forecast contribution/return inputs on synced investment accounts.

## Goal

Let users set **Monthly contribution** and **Expected annual return** on synced (Plaid) investment accounts from the shared account details panel, and have those values drive net-worth forecasts and retirement projections — without changing the live synced balance.

Success means:

- Synced investment account details show a closed-by-default **Forecast investment assumptions** accordion
- Values persist on `PlaidAccount` (`monthlyContribution`, `annualReturnRate`, `forecastInputsUserEdited`)
- Retirement applies planned contributions as a savings floor and honors per-bucket weighted returns
- Dashboard forecasts continue to use per-account growth (already wired)
- Live Plaid balances are never accrued by the monthly manual-investment job

## Product Context

Manual investment accounts already expose contribution and return. Synced accounts only had a web-only **Edit investment** path that desktop never wired, and retirement treated most accounts as frozen (Insights net only; per-account return ignored).

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Account details panel | `packages/features/.../account-detail-dialog.tsx` | Shared web/desktop SidePanel |
| Manual investment fields | `packages/features/.../manual-account-dialog.tsx` | Contribution + return when investment toggled |
| Web-only investment editor | `apps/web/.../edit-financial-profile-account-dialog.tsx` | Remove after accordion lands |
| Postgres Plaid fields | `apps/api/prisma/schema.prisma` `PlaidAccount` | Already has forecast columns |
| Update investment API | `apps/api/.../handlers/investment.ts` | Updates Plaid rows when id is `plaid_*` |
| Retirement engine | `packages/domain/src/retirement/project.ts` | Insights-net accumulation today |
| Accordion pattern | `packages/features/.../real-estate-wizard-steps.tsx` | `@moat/ui` Accordion |
| SQLite PlaidAccount | `packages/db-sqlite/prisma/schema.prisma` | Missing forecast columns |

## Target Experience

1. Open a synced investment account (e.g. Roth IRA) from Financial Profile.
2. Expand **Forecast investment assumptions** (default closed).
3. Enter monthly contribution ($) and expected annual return (%).
4. Save; values persist and feed forecasts + retirement.
5. Checking / savings / credit / loan synced accounts do not show the accordion.

## Architecture / Data Model

- Canonical store: `PlaidAccount.monthlyContribution`, `annualReturnRate`, `forecastInputsUserEdited`
- Profile mirror: `ProfileInvestment` merged on GET (`plaid-{id}` / `plaid_{id}`)
- Save path: profile prefs via `updateFinancialProfileData` + `updateInvestment` for forecast fields
- Desktop: add SQLite columns + IPC update for `plaid_*` ids
- Retirement: planned contributions floor + per-tax-bucket weighted returns

## Acceptance Criteria

- [ ] Synced investment account details show collapsed **Forecast investment assumptions** accordion
- [ ] Fields: Monthly contribution ($), Expected annual return (%); no auto-update checkbox
- [ ] Save updates Plaid forecast fields and marks `forecastInputsUserEdited`
- [ ] Web and desktop share the accordion via `@moat/features`
- [ ] Web-only **Edit investment** menu/dialog removed
- [ ] Desktop SQLite has forecast columns and retirement/profile reads them
- [ ] Retirement applies planned contributions even when Insights net is $0
- [ ] When Insights net exceeds planned contributions, remainder goes cash (no double-count)
- [ ] Per-tax-bucket returns use balance-weighted account `annualReturnRate`
- [ ] Monthly accrual job still skips synced accounts

## Non-Goals

- Live balance accrual on synced accounts
- Accordion on non-investment synced accounts
- iOS parity in this change
- Rewriting retirement to project each account independently

## Related Specs

- `specs/features/manual-account-investment-fields/spec.md`
- `specs/features/manual-investment-balance-accrual/spec.md`
- `specs/features/retirement/spec.md`
- `specs/features/retirement/forecast-audit.md`

## Suggested Commit Message

```text
feat: synced account forecast assumptions
```
