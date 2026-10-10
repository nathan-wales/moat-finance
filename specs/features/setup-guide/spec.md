# Setup Guide Widget

## Status

Approved. Created 2026-09-22 after reviewing Stripe-style setup-guide screenshots, onboarding goals, dashboard layout, and shared completion across web, desktop, and iOS.

## Goal

After first-run onboarding, signed-in users get a floating setup guide in the bottom-right of the app. It always starts collapsed on the next incomplete step, expands into the full checklist, and stays in sync across web, desktop, and iOS because completion lives on the user in Postgres.

Success means:

- The card overlays signed-in app content and starts collapsed with `Next: {first incomplete step}`.
- The first four steps are always the same. Later steps follow `UserSettings.onboardingGoals`.
- Creating a rule during expense or income review also completes “Create your first rule”.
- Closing the card, or finishing every visible step, hides it on every platform.

## Product Context

Onboarding already asks “What are you here for?” and stores `onboardingGoals`. The setup guide is the follow-through: review the largest transactions, make a rule, connect an assistant, then do the work that matches those goals.

## Current Repo Context

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Onboarding goals | `apps/web/src/app/onboarding/onboarding-flow/types.ts`, iOS `OnboardingGoalOption.all` | Same ids: `budgeting`, `wealth`, `retirement`, `subscriptions`, `fraud`, `taxes`, `real-estate`, `clarity` |
| Saved goals | `UserSettings.onboardingGoals` via `POST /api/v1/onboarding/saveOnboardingGoals` | Edit writes this list |
| Transactions URL filters | `packages/features/src/transactions/build-transactions-path.ts` | `type=expense\|income` and `sort=amount-desc` already hydrate the table |
| AI connection | `prompt.hasAiConnection` / `hasPromptAiConnection()` | Completes the assistant step |
| Rules / budgets / alerts | `TransactionRule`, `CategoryBudget`, `NotificationRule` | Derived completion |
| Financial profile save | `financialProfile.update` | Marks the profile step; Plaid sync must not |
| Dashboard overlay | `apps/web/src/app/(dashboard)/layout.tsx`, desktop `App.tsx`, iOS `AppShellView` | Mount the card here |
| Shared UI | `@moat/features` + `@moat/ui` | Web and desktop share the card; iOS is native |

## Target Experience

Collapsed (default):

```
Setup guide          Edit  ↗  ×
████░░░░░░░░░░░░░░░░
Next: Review largest expenses
```

Expanded:

```
Setup guide          Edit  ↙  ×
████░░░░░░░░░░░░░░░░
Review largest expenses          ✓/›
Review largest income            ›
Create your first rule           ›
Connect your AI assistant        ›
…
```

Opening a row shows one sentence and a continue action. Completed rows stay in the list with a check.

Copy:

| Step | Title | Description |
|------|-------|-------------|
| `review_expenses` | Review largest expenses | Confirm your biggest expenses are categorized, and add rules for repeats. |
| `review_income` | Review largest income | Confirm your biggest income is categorized, and add rules for repeats. |
| `create_rule` | Create your first rule | Auto-categorize matching transactions so you don't do it by hand. |
| `connect_ai` | Connect your AI assistant | Connect ChatGPT, Claude, or Cursor to your Moat data. |
| `financial_profile` | Update your financial profile | Add real estate, assets, and insurance to your net worth. |
| `set_budget` | Set a budget | Set monthly category budgets so you can stay on track. |
| `review_retirement` | Review your retirement plan | Open retirement planning and confirm the defaults. |
| `set_alert` | Set up an alert | Get notified about subscriptions or unexpected charges. |

Edit reopens the onboarding goal picker (taxes omitted while `TAXES_PRODUCT_ENABLED` is false) and only changes steps after the fixed prefix.

## Architecture / Data Model

`UserSettings` gains:

- `setupGuideDismissedAt DateTime?`
- `setupGuideCompletedSteps String[]` — visit-based ids plus `financial_profile` when the user saves the profile

Visit-based: `review_expenses`, `review_income`, `review_retirement`.

Derived on read:

- `create_rule` — any `TransactionRule`
- `connect_ai` — `hasAiConnection`
- `set_budget` — any `CategoryBudget`
- `set_alert` — any `NotificationRule`
- `financial_profile` — stored visit after `financialProfile.update` (not Plaid sync)

API:

- `GET /api/v1/setupGuide/get`
- `POST /api/v1/setupGuide/completeStep` `{ stepId }`
- `POST /api/v1/setupGuide/dismiss`

Desktop shows the card only with a cloud session and proxies these calls to the cloud API. Local rules/budgets/alerts/AI still count as complete so offline-first work checks the step off.

## Acceptance Criteria

- [ ] Card is collapsed by default with title, Edit, expand, close, progress, and `Next: {title}`.
- [ ] Expand shows the ordered checklist; collapse returns to the next-step view.
- [ ] Review steps open transactions filtered by type and sorted by amount high to low, and complete on open.
- [ ] Creating any transaction rule completes `create_rule`.
- [ ] Connecting an assistant completes `connect_ai`.
- [ ] Saving the financial profile completes `financial_profile`; a Plaid sync does not.
- [ ] Goal mapping: `wealth` / `real-estate` / `clarity` → one profile step; `budgeting` → budget; `retirement` → retirement visit; `subscriptions` / `fraud` → one alert step; taxes never appears while parked.
- [ ] Dismiss and full completion hide the card on web, desktop, and iOS.
- [ ] Demo mode and onboarding do not show the card.
- [ ] Analytics: `setup_guide_step_opened`, `setup_guide_dismissed`, `setup_guide_goals_updated` with identity and a step or goal enum.

## Non-Goals

- A separate onboarding rewrite.
- Restoring the Taxes product as a setup step.
- Per-device expanded/collapsed persistence.
- A new review sheet of top transactions (use the existing transactions page).

## Related Specs

- [complete/shared-onboarding/spec.md](../../complete/shared-onboarding/spec.md)

## Suggested Commit Message

```text
feat: add post-onboarding setup guide
```
