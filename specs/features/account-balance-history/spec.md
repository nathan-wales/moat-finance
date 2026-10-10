# Account Balance History Charts

## Status

Draft. Created 2026-08-17 after reviewing financial profile account detail UX, `BalanceSnapshot`, daily balance sync cron, and manual investment accrual.

## Goal

When a user opens an account on Financial Profile, show a Robinhood-style balance history chart for that account alone: daily points for synced accounts, monthly points for auto-incrementing manual investments.

Success means:

- Synced accounts (Plaid + Apple Wallet) get one display-balance history row per day
- Manual investments with auto-increment get one history row per accrued month
- Web and desktop share one account detail modal + chart in `@moat/features` / `@moat/charts`
- iOS shows the same chart pattern on synced and eligible investment sheets
- Net-worth `BalanceSnapshot` behavior is unchanged

## Product Context

Users want to see how a single account moved over time when they click into it — not only portfolio net worth. The chart should feel familiar (range pills, gain/loss color, scrubbable value) while staying honest about daily/monthly granularity.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Net-worth snapshots | `BalanceSnapshot` + `takeSnapshot` | Skips excluded accounts, omits Apple, signs credit/loan negative — wrong for per-account charts |
| Daily balance cron | `runScheduledBalanceSync` | Already refreshes Plaid balances and calls `takeSnapshot` |
| Monthly accrual | `runManualInvestmentBalanceAccrual` / `accrueDueManualInvestments` | Updates `Investment.startingBalance` + audit rows |
| Financial profile table | `packages/features/.../accounts-section.tsx` | Rows not clickable; menu-only actions |
| iOS sheets | `financial-profile-account-sheets.swift`, `investment-detail-sheet.swift` | Tap-to-sheet already exists |
| Charts | `@moat/charts` (Recharts), iOS `FinancialLineChart` | No Robinhood range pills yet |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Balance sync after Plaid | `plaid-connection-sync.service.ts` | Hook history write next to `takeSnapshot` |
| Apple account upsert | `apple-financekit-import.service.ts` | Device-pushed balances |
| Desktop account sync | `apps/desktop/.../sync-accounts.ts` | Local SQLite balances |
| Accrual steps | `@moat/domain` `planAccrualSteps` | `periodEnd` + `newBalance` for monthly points |
| Net worth history API pattern | `balanceSnapshot.getHistory` | Mirror for per-account get |
| MoatApiClient | `packages/contracts/src/api-client.ts` | Add `getAccountBalanceHistory` |

## Target Experience

1. User clicks an account row on Financial Profile (web/desktop) or taps a row (iOS).
2. Modal/sheet opens with chart at the top: large balance, green/red delta for selected range, axisless line, pills `1D 1W 1M 3M YTD 1Y ALL`.
3. Scrubbing the chart updates the header value.
4. Details / actions remain below the chart.
5. Accounts without history eligibility (plain manuals, auto-increment off) omit the chart or show empty — no fake data.

**1D semantics:** previous snapshot → current (typically yesterday vs today). Label remains “Today”. Monthly-only investments may look sparse on short ranges; pills still show.

## Architecture / Data Model

```prisma
enum AccountBalanceHistorySource {
  PLAID
  APPLE_FINANCEKIT
  INVESTMENT
}

model AccountBalanceHistory {
  id       String
  userId   String
  source   AccountBalanceHistorySource
  sourceId String
  date     DateTime
  balance  Float
  @@unique([userId, date, source, sourceId])
  @@index([userId, source, sourceId, date])
}
```

- Store display balance (same sign as Financial Profile row).
- Same-day writes upsert.
- Leave `BalanceSnapshot` / `takeSnapshot` unchanged.

### Write path

- After Plaid balance sync + nightly sweep for users with synced accounts and no row for today
- After Apple FinanceKit account upsert
- After each applied accrual month (`periodEnd`, `newBalance`)
- Desktop: after `syncAccountsForItem` and after launch accrual

### Read API

`POST /api/v1/accountBalanceHistory/get`

Input: profile `accountId` (`plaid-{id}`, Apple id, `investment-acct-{id}`).

Output: `{ currentBalance, points: [{ date, balance }] }` — client filters ranges.

### UI

- Shared: `AccountHistoryChart` in `@moat/charts`, `AccountDetailDialog` in `@moat/features`
- iOS: `AccountHistoryChartView` on synced detail + eligible investment detail sheets

## Acceptance Criteria

- [ ] Synced Plaid and Apple Wallet accounts receive daily history rows
- [ ] Nightly sweep covers connections skipped as non-stale so every synced account still gets one point/day when possible
- [ ] Manual investments with `autoUpdateBalance` receive monthly history on accrual (including catch-up months)
- [ ] Plain manuals and auto-increment-off investments do not get history writes
- [ ] `BalanceSnapshot` / net-worth chart behavior unchanged
- [ ] Web/desktop share clickable account detail modal with chart + range pills
- [ ] iOS sheets show the same chart pattern for synced and eligible investments
- [ ] One-time backfill from existing `BalanceSnapshot` PLAID (+ auto-update INVESTMENT monthly points) for non-empty charts on day one

## Non-Goals

- Intraday / true tick-level 1D charts
- Snapshotting plain manual accounts
- Changing net-worth `BalanceSnapshot` semantics
- Forecast line on this chart
- Gear / chart settings UI

## Open Questions

- None blocking — product decisions captured in plan (1D = previous→current; Moat theme colors; no gear).

## Related Specs

- `specs/features/manual-investment-balance-accrual/spec.md`
- `specs/features/profile-net-worth-rollup/spec.md`

## Suggested Commit Message

```text
feat: adds per-account balance history charts
```
