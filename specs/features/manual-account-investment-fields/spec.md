# Manual Account Investment Fields

## Status

Draft. Created 2026-07-28 for Add Account investment toggle on iOS, web, and desktop.

## Goal

When manually adding (or editing) an account, users can mark it as an investment account and enter monthly contribution and expected annual return without leaving the account sheet.

Success means:

- Add/Edit Account shows an **Is investment account** toggle (off by default)
- Turning it on reveals **Monthly contribution** and **Expected annual return** fields
- Values persist as a linked financial-profile investment
- Web and desktop share the same behavior via `@moat/features`

## Product Context

Users often create brokerage/retirement accounts from Financial Profile. Contribution and return assumptions power forecasts; today those fields only appear on separate investment editors.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| iOS Add Account sheet | `apps/ios/.../financial-profile-account-sheets.swift` | Name, institution, type, balance, net worth |
| iOS Add Investment sheet | `apps/ios/.../investments-view.swift` `InvestmentEditorSheet` | Type should be labeled full-width picker above name |
| Shared accounts UI | `packages/features/.../accounts-section.tsx` | Manual add via `EditFieldsDialog` |
| Profile investment model | `packages/contracts` `ProfileInvestment` | `monthlyContribution`, `expectedReturn`, `accountLink` |
| Web investment labels | `apps/web/.../standard-investment-form.tsx` | Monthly contribution ($), Expected annual return (%) |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `FinancialProfileLabeledToggle` | iOS labeled-field helpers | Net worth / forecast toggles |
| `FinancialProfileLabeledPicker` | iOS labeled-field helpers | Full-width input-styled dropdown |
| `ProfileInvestment` upsert | Financial profile update API / IPC | No schema migration |

## Target Experience

1. Open **Add Account** (or edit a manual account).
2. **Type** is the first field: label + full-width dropdown (not free text).
3. Toggle **Is investment account** (default off) below net worth.
4. When on, show contribution (default `0`) and expected annual return (default `7`).
5. Save upserts the account and a linked profile investment; toggling off removes the linked investment.

## Architecture / Data Model

No Prisma changes. Persist via `FinancialProfileData`:

- `accounts[]` — `ProfileAccount` (if investment and type is not already investment-like, set `type` to `"Investment"`)
- `investments[]` — linked `ProfileInvestment` with `accountLink = account.id`, `currentValue = balance`, `includeInForecast = true`

## Acceptance Criteria

- [ ] iOS Add/Edit Account has investment toggle + conditional fields
- [ ] iOS Add/Edit Account and Edit Investment both expose **Included in net worth** and **Included in forecast** for manual investment accounts (including 529)
- [ ] iOS Add Investment has Type above Name as labeled full-width dropdown
- [ ] Web/desktop Add/Edit manual account has the same toggle + fields, including forecast when investment is enabled
- [ ] Manual investment accounts remain editable from the accounts row menu
- [ ] Saving with toggle on creates/updates linked profile investment; off removes it

## Non-Goals

- Creating canonical `Investment` rows via `POST /investment/create`
- Changing Plaid/synced account edit dialogs
- Schema migrations

## Open Questions

- None — profile-only persistence chosen for cross-platform consistency.

## Related Specs

- `specs/complete/ios-my-profile-overhaul.spec.md`
- `specs/complete/desktop-feature-parity/spec.md`

## Suggested Commit Message

```text
feat: add investment fields to manual accounts
```
