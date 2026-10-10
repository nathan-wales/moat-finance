# Manual Liability Balance Amortization

## Status

In progress. Created 2026-08-26.

## Goal

Manual liability balances auto-update once per month on a payment anniversary: apply interest and the scheduled payment to the remaining balance, persist the new balance in Financial Profile JSON, and keep net-worth snapshots in sync. Users can opt out with **Auto-update loan balance** (default on for **new** creates; existing rows stay off).

Success means:

- Cloud cron amortizes due liabilities nightly in batches
- Desktop amortizes due liabilities on app launch with the same shared logic
- Side panel form captures name, type (dropdown), balance, rate, payment, loan start date, loan term, linked asset, and options including auto-update
- Existing liabilities without the toggle are never rewritten by the first cron run

## Product Context

Liability interest and payment fields historically powered forecasts only. Users expect a manually entered mortgage or auto loan to pay down in the live balance over time, not only in retirement charts — parallel to manual investment balance accrual.

## Architecture / Data Model

- **SoT:** `FinancialProfileData.liabilities` JSON (no dedicated Prisma table)
- **Skip:** `autoUpdateBalance` missing or false; `balance <= 0`; `monthlyPayment <= 0`
- **Month step:** existing `amortizeMonth()` (interest then principal; term hard-stop)
- **Remaining term:** prefer `loanStartDate` + `loanTermYears`; else legacy `payoffDate`; else solve from payment/rate
- **Schedule:** Anniversary = day-of-month of `loanStartDate` when set, otherwise the day auto-update was first enabled; watermarks `lastBalanceAmortizedAt` / `nextBalanceAmortizationDueAt`; catch-up capped at 24 months
- **Existing-row safety:** missing `autoUpdateBalance` treated as `false` so first cron cannot rewrite historical balances
- **Shared math / scheduling:** `@moat/domain` used by API cron and desktop launch
- **Idempotency:** JSON watermarks + transactional profile write (no separate audit table)

## Target Experience

1. User adds a liability, sets balance / rate / payment / term, leaves auto-update on.
2. On the monthly anniversary, balance updates and appears in Financial Profile / net worth.
3. Turning auto-update off freezes the balance until the user edits it.
4. Editing the balance while auto-update is on resets the schedule so catch-up does not replay old months.

## Acceptance Criteria

- [ ] Midnight cron processes due profile liabilities in batches with snapshot refresh
- [ ] Desktop launch runs the same amortization for the local user
- [ ] Auto-update toggle on liability form (web/desktop/iOS), default on for new creates with explainer
- [ ] Existing liabilities are not auto-enabled / not historically due on first deploy
- [ ] Form uses type and loan-term dropdowns; loan start date replaces payoff date on the form
- [ ] Retirement projection prefers start+term over payoffDate
- [ ] Amortization requires non-zero monthly payment

## Non-Goals

- Promoting liabilities to a first-class Prisma table
- Auto-updating `RealEstateInvestment.currentLoanBalance`
- Dual-writing debt that also exists as a Plaid loan account
- Intra-month / real-time amortization

## Related Specs

- `specs/features/manual-investment-balance-accrual/spec.md`
