# Manual Investment Balance Accrual

## Status

In progress. Updated 2026-08-08 after review hardening.

## Goal

Manual investment balances auto-update once per month on the account’s creation anniversary: apply expected return (annual ÷ 12) and monthly contribution, persist the new balance, and write an audit row. Users can opt out with **Auto-update my balance every month** (default on for **new** creates).

Success means:

- Cloud cron accrues due investments nightly in batches
- Desktop accrues due investments on app launch with the same shared logic
- Financial Profile “Is investment account” saves only to the canonical `Investment` row (no dual profile JSON for SoT fields)
- Prefs stubs (`includeInForecast`, `includedInNetWorth`, institution) remain in profile JSON keyed by investment id
- Audit trail records previous/new balance and increments per applied month

## Product Context

Contribution and return fields historically powered forecasts only. Users expect a 529 (or similar) with $50/mo and 7% return to grow in the live balance over time, not only in charts.

## Architecture / Data Model

- **SoT:** Prisma/SQLite `Investment` for manuals with investment semantics
- **Skip:** Plaid/synced accounts; `autoUpdateBalance === false`; `monthlyContribution === 0` (default 7% return alone is forecast-only)
- **Month step:** `balance * (1 + annualReturnRate / 12) + monthlyContribution`
- **Schedule:** Anniversary = day-of-month of `createdAt`; watermarks `lastBalanceAccruedAt` / `nextBalanceAccrualDueAt`; catch-up capped at 24 months
- **Existing-row backfill:** `autoUpdateBalance = false` and `nextBalanceAccrualDueAt = null` so first cron cannot inflate historical balances
- **Name:** bare name on `Investment`; institution on prefs account stub (legacy `"Name — Institution"` stripped on read)
- **Audit:** `ManualInvestmentBalanceAccrual` with unique `(investmentId, periodEnd)`
- **Shared math:** `@moat/domain` used by API cron and desktop launch

## Target Experience

1. User marks a manual account as investment, sets contribution/return, leaves auto-update on.
2. On the monthly anniversary, balance updates and appears in accounts / net worth.
3. Turning auto-update off freezes the balance until the user edits it.

## Acceptance Criteria

- [x] Midnight cron processes due investments in batches (`take: 200`) with audit + snapshot
- [x] Desktop launch runs the same accrual for the local user (transactional apply + idempotent period)
- [x] Auto-update toggle shown only for manual accounts (hidden for Plaid/synced), default on for new creates with `?` explainer (web/desktop/iOS)
- [x] Existing investments are not auto-enabled / not historically due on migrate
- [x] Investment-toggle saves write `Investment` only; profile GET still lists them under Accounts via merge
- [x] Prefs (forecast / net worth / institution) survive Accounts investment saves
- [x] Existing profile-only linked investments are promoted to `Investment` rows (preserve id, transactional, prefs stubs)
- [x] Accrual requires non-zero monthly contribution
- [x] iOS Accounts investment path uses Investment create/update/delete APIs

## Non-Goals

- Accruing Plaid / Apple synced balances
- Dual-writing ProfileAccount + ProfileInvestment JSON for the same asset SoT fields
- Intra-month / real-time accrual

## Related Specs

- `specs/features/manual-account-investment-fields/spec.md`
