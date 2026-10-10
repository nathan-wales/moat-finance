# Budget Category Alerts

## Status

Draft. Created 2026-09-12 after reviewing the budget table, set-budget dialog, notification inbox, and nightly notification evaluation cron.

## Goal

Let people turn on simple **alerts** when they set a category budget, see those settings on the budget table, and get an in-app notification plus a dedicated email when a category hits a threshold or goes empty (over budget).

Success means:

- Setting a budget on a **flexible** category defaults alerts on for **75%** and **empty** (over budget)
- Fixed and non-monthly categories stay opt-in: the same dialog can add alerts, but they are off until the user checks them
- The budget table shows an Alerts column and a select-all toggle; row toggles stay out of the table
- Individual thresholds are edited in the set/adjust budget dialog
- The nightly cron writes one inbox item per newly firing category and sends at most one digest email that night
- Notification history can be filtered to budget alerts

## Product Context

Users already get suggested trailing-average targets on the budget page. They still need a lightweight “tell me when this category is going off the rails” control without opening the full notification builder.

This is a focused budget-page UX on top of the existing monitoring delivery path (inbox + Resend). It does not replace the Notifications builder.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Budget page / table / edit dialog | `packages/features/src/budget/` | Shared web + desktop UI. Desktop passes `showAlerts={false}` because it has no email or Notifications inbox. |
| Page data | `packages/domain/src/budgets/getBudgetPageData.ts` | Effective goal includes trailing-average fallback |
| Saved goals | `CategoryBudget` in `apps/api/prisma/schema.prisma` | One row per user + category |
| Notification inbox + email | `notification-delivery.service.ts` | Deduped deliveries; Resend when live |
| Nightly eval | `pages/api/cron/evaluate-notification-rules.ts` | Daily Hobby cron; currently only users with rules |
| Inbox history UI | `packages/features/src/notifications/monitoring/notifications-page.tsx` | History tab; search only, no tag filter |

Alerts apply only to **saved** `CategoryBudget` rows, not trailing-average suggestions.

## Target Experience

### Budget table

- New **Alerts** column (display only). Values: `75%, Empty`, custom labels, `Off`, or `—` when no saved budget.
- Top-right **Alerts on all categories** switch, default on when every saved **flexible** budget has alerts enabled. Turning one flexible category off (from the dialog) turns the master switch off. Turning the master on/off enables/disables saved flexible budgets without resetting custom thresholds or changing fixed / non-monthly opt-in alerts.
- Clicking the Alerts cell or Set budget / budget amount opens the existing edit dialog. No in-table alert toggle.

### Set / adjust budget dialog

Below the monthly target:

**Alerts**

- Switch for this category (default on when first set for flexible categories; off for fixed and non-monthly)
- “Notify me when this budget reaches 75%”
- “Notify me when this budget is empty”
- Optional extra percent rows (for example 50% + 75% + empty)

Copy uses **alerts**, not notifications. Fired items still appear in the notification center.

Desktop does not show this column or dialog section. Local SQLite still stores the same fields; there is no email or Notifications inbox to deliver them.

### Notification center

History can filter by a **Budget** tag (`explanation.signalType === budget_threshold`).

### Email

Nightly cron sends at most one budget-alert email per user. If several categories fire that night, they stack in one digest: each section keeps its title, threshold badge, progress bar, and top purchases, with a separator between them. Shared CTA, opt-out, and footer stay once at the bottom.

When a category crosses several thresholds in the same sweep (for example 75% and 100%), only the **highest** threshold is alerted. After a category has been alerted, it is silent for the rest of that calendar month even if spend later crosses a higher threshold. Deduped per category + calendar month (user timezone).

## Architecture / Data Model

`CategoryBudget` gains:

- `alertsEnabled Boolean @default(true)`
- `alertThresholds Json @default("[75, 100]")` — `100` means empty / over budget

Create paths set `alertsEnabled` from the resolved parent: **on** for `FLEXIBLE`, **off** for `FIXED` / `NON_MONTHLY`. Users can still enable alerts on those parents from the dialog. `CategoryBudgetRow.alerts` is `null` when the category has no saved budget.

Nightly sweep evaluates saved budgets even when the user has no custom notification rules. Each newly firing category records a `NotificationDelivery` with `signalType: budget_threshold` (in-app). The first delivery that night also sends the digest email.

## Acceptance Criteria

- [ ] New saved **flexible** budgets default to alerts on at 75% and empty as soon as the user sets a budget value
- [ ] New saved fixed and non-monthly budgets default to alerts off; the dialog can still add 75% / empty / custom thresholds
- [ ] Existing saved flexible budgets keep the 75% and empty defaults; stock defaults on fixed / non-monthly are turned off
- [ ] Table Alerts column is display-only; master switch enables/disables saved **flexible** budgets
- [ ] Edit dialog can turn alerts off or change thresholds for one category
- [ ] Nightly cron emails at most once per user, stacking every newly firing category into one digest
- [ ] A category that crosses multiple thresholds in one sweep is alerted only at the highest threshold
- [ ] A category that has already been alerted is not alerted again that calendar month
- [ ] Budget alert email shows a progress bar/badge, top five purchases, Transactions links sorted by amount, and a budget-page opt-out; multiple categories are separated sections in the same email
- [ ] Notification history can filter to budget alerts
- [ ] Desktop hides the Alerts column and dialog fields (`BudgetPage showAlerts={false}`); SQLite still stores `alertsEnabled` / `alertThresholds` for a future delivery channel. Saving a budget on desktop omits those fields so existing rows are not overwritten.

## Non-Goals

- Over-pacing as a separate default condition
- Side panel / “Notify me when…” button
- In-table per-row toggles
- iOS budget-alert editor
- Showing these as editable Active notification rules
- Forecast-based budget alerts

## Related Specs

- [Alerts & summaries monitoring](../alerts-summaries-monitoring/spec.md)

## Suggested Commit Message

```text
feat: consolidates nightly budget alert emails
```
