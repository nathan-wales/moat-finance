# Alerts & Summaries — Financial Monitoring and Automation

## Status

In progress / V1 implementation. Created July 22, 2026 as a 1:1 capture of the product brief for Moat’s lightweight financial monitoring and automation system (signals → conditions → delivery). Implementation landed the Phase 1 foundations and Phase 2 MCP/NL/push-registration surface: `packages/monitoring-rules`, Prisma notification models, shared `notification-rule.service`, hourly evaluation crons, web Notifications home/builder, desktop local tables + UI shell, iOS models/service/view stubs, and MCP CRUD tools.

Updated July 22, 2026 after a deep cross-surface readiness review (web, desktop, iOS, MCP, API) grounded in the current monorepo. Two new sections were added — [Cross-surface readiness review](#cross-surface-readiness-review-added-july-22-2026) (answers "do we have enough detail to succeed on every surface") and [Bug-prevention & testability](#bug-prevention--testability-added-july-22-2026) (answers "how do we introspect to catch bugs early"). The desktop-participation open question is now resolved with a concrete recommendation. This remains a Draft — the review sharpens architecture intent but does not yet freeze Prisma/OpenAPI/APNs contracts.

Updated July 22, 2026 with a post-launch [vision fit report](./vision-fit-report.md) comparing shipped code to this brief. The [Current Repo Context](#current-repo-context) section was rewritten so it no longer claims the product does not exist.

## Goal

Frame notifications not as a fixed alert checklist, but as a **lightweight financial monitoring and automation system**:

> When something meaningful happens—or fails to happen—tell me in the right place, with enough context to act.

Success means:

- Users can create monitoring rules with the mental model **When [financial condition] happens, notify [person] through [channel]**.
- A default **weekly money summary** feels valuable (not marketing), arrives Monday morning local time, and is customizable.
- Moat supports both proven predefined alerts (Copilot/Monarch patterns) and user-created conditions, natural-language creation, missing-event detection, richer summaries, and MCP-created rules.
- Every notification explains **why it fired** and offers a direct action.
- The same structured rule model powers web, iOS, desktop, MCP, and AI assistants.

## Product Context

Monarch and Copilot mostly provide predefined alerts. Moat can combine those proven alerts with user-created conditions, AI-generated rules, missing-event detection, richer summaries, and eventually recommended actions.

### What competitors currently do

**Copilot** offers a conventional set of predefined push notifications:

- Bank-fee alerts
- Large purchases over $500 that are not recognized as recurring
- Over-budget category alerts
- Low checking or savings balances below $100
- Credit utilization alerts at 30%, 60%, and 90%

Several of those thresholds are fixed. Copilot users have specifically asked to customize the large-expense and low-balance thresholds — the concept is useful, but the implementation is too rigid.

Copilot also detects recurring expenses (rent, subscriptions, bills) and supports weekly, biweekly, monthly, and non-monthly recurrence schedules.

**Monarch** has stronger flexibility around transaction rules. Users can build a rule that only notifies them about transactions over a chosen amount. It also supports email and push preferences for recurring merchants and accounts. Bill-sync can notify when a new statement is received and remind when payment is due.

### Competitive pattern

| Player | Pattern |
|--------|---------|
| Copilot | Polished, useful defaults, but relatively fixed |
| Monarch | More configurable, especially through transaction rules |
| **Moat opportunity** | Arbitrary financial conditions, natural-language creation, missing-event detection, cross-domain financial context, and actionable summaries |

### Product positioning

> Moat keeps watch over your financial life. Create alerts for transactions, budgets, balances, bills, account syncing, and anything expected to happen—or not happen. Receive immediate notifications or personalized summaries by email and iOS push, and create new monitoring rules directly with your AI assistant.

The interface should feel as simple as:

> When [financial condition] happens, notify [person] through [channel].

The engine underneath should support historical patterns, forecasts, missing events, household permissions, multiple financial domains, and MCP-based creation. That combination is considerably more powerful than reproducing Monarch’s transaction rules or Copilot’s fixed alerts.

### Mission fit

Aligned with [specs/mission.md](../../mission.md): Moat as the financial data layer and operating system for personal AI agents — continuous monitoring over the full financial graph, with agents able to create structured monitoring rules (not arbitrary cron jobs).

---

## Core model — three concepts

### 1. Signals

A signal is **what Moat watches**.

Examples:

- A transaction appears
- A transaction does not appear
- An account balance crosses a threshold
- A budget reaches a percentage
- Spending velocity becomes unusually high
- A recurring expense changes
- An account stops syncing
- A credit-card statement arrives
- A bill is approaching
- Net worth changes materially
- Investment allocation drifts
- Insurance renewal approaches
- A tax deadline approaches
- A goal falls behind schedule

### 2. Conditions

A condition defines **when the signal matters**.

Examples:

- Rent has not appeared by the fifth day of the month
- Groceries reach 80% of the monthly budget
- Checking drops below $1,500
- A transaction over $300 appears outside known recurring bills
- A subscription increases by more than 10%
- Dining spending is 25% higher than its three-month average
- No transactions have synced from Chase in 48 hours
- Credit utilization exceeds 20%
- Monthly net cash flow is projected to become negative

### 3. Delivery

Users choose **where and how** they hear about it:

- Email
- iOS push
- In-app inbox
- Any combination of those

Later: SMS, Slack, webhook, or MCP callbacks. Keep V1 focused on email, iOS push, and in-app.

---

## Current Repo Context

> Post-launch snapshot (July 22, 2026). V1 foundations are in the monorepo. See [vision-fit-report.md](./vision-fit-report.md) for how close the ship is to this brief. The pre-implementation archaeology below was replaced because it incorrectly claimed nothing existed.

### What exists now

| Asset | Location | Notes |
|------|----------|-------|
| Canonical Zod model + evaluator | `packages/monitoring-rules/` | Signals, conditions, delivery, templates, NL heuristics, explanations, timezone helpers |
| Prisma models | `apps/api/prisma/schema.prisma` | `NotificationRule`, `NotificationPreference`, `NotificationDelivery`, `DevicePushToken`, `NotificationSuggestion`, `ExpectedRecurringEvent` (schema only) |
| API handlers / services | `apps/api/src/server/handlers/notification-rule.ts`, `apps/api/src/server/services/notification-*.ts` | CRUD, prefs, inbox, preview, NL parse, suggestions, push token register, weekly summary email |
| Evaluation crons | `apps/api/pages/api/cron/evaluate-notification-rules.ts`, `evaluate-notification-schedules.ts` | Hourly sweeps; default delivery mode is **shadow** |
| Web + shared UI | `apps/web/.../notifications/`, `packages/features/src/notifications/monitoring/` | Home, thin builder, settings, suggestions, history |
| Desktop local shell | `apps/desktop/` + SQLite `NotificationRule` | Shared UI; local inbox; suggestions stubbed empty |
| iOS stub | `apps/ios/Moat/Features/Notifications/` | List + models/service stubs; APNs not wired; README still lists push as out of scope |
| MCP tools | `apps/mcp/src/tools/notifications.ts` | list/create/update/pause/delete with confirmation gates |

### Remaining gaps (high level)

- Live multi-channel delivery incomplete (shadow default; push queued/logged, not APNs)
- Builder does not expose match criteria / thresholds / digest timing
- NL parser is keyword heuristics, not LLM → structured rule
- `ExpectedRecurringEvent` unused; absence detection is snapshot/heuristic
- Alert → workflow actions and household routing not shipped
- Forecast / cross-domain / goal / tax / insurance / investment alerts deferred (as planned)

### Related building blocks still reused

| Asset | Location | Notes |
|------|----------|-------|
| Transaction rules engine | `apps/api/src/server/rules-engine/`, `packages/domain/src/rules/` | Different domain (txn mutation) — not overloaded for notify |
| Recurring expenses / income | spending handlers, `recurring-income.ts` | Feed snapshot + suggestions; no durable expected windows yet |
| Budget status | `packages/domain/src/budgets/` | Budget-threshold signal input |
| Forecast / cash flow | `forecasting.ts`, `cash-flow.service.ts` | Fuel for later forecast-based alerts |
| Email (Resend) | `apps/api/src/lib/email/resend.ts` | Used when `NOTIFICATION_DELIVERY_MODE=live` |
| Household identity | `HouseholdMembership`, `resolve-active-context.ts` | No per-member alert routing yet |
| MCP write confirmation patterns | `specs/complete/mcp-financial-writes/spec.md` | Pattern for sensitive MCP-created rules |

### Related shipped / backlog specs

| Spec | Relevance |
|------|-----------|
| [vision-fit-report](./vision-fit-report.md) | Post-launch closeness assessment vs this brief |
| [mcp-financial-writes](../../complete/mcp-financial-writes/spec.md) | Structured MCP create/update with confirmation patterns |
| [insights](../../complete/insights.spec.md) / [ios-insights](../../complete/ios-insights.spec.md) | Insight content that summaries can reuse |
| [spending-shared-page](../../complete/spending-shared-page/spec.md) | Anomaly + recurring expense UI |
| [ai-reports-v2](../../complete/ai-reports-v2.spec.md) | Narrative report generation (not scheduled) |
| [bank-sync-updates](../../complete/bank-sync-updates.spec.md) | Stale sync signals |
| [goals backlog](../../backlog/goals/spec.md) | Later: goal-behind-schedule signals |
| [roadmap](../../roadmap.md) | No alerts/digests item yet — candidate for Planned |

---

## Target Experience

### Naming

- Section title: **Notifications**
- Subtitle: **Alerts, summaries, and financial monitoring**

---

### Default weekly summary

Enabled by default. Must feel valuable, not like a marketing email.

#### Default schedule

- Every **Monday morning at 8:00 a.m. local time**
- Covers previous **Monday 12:00 a.m. through Sunday 11:59 p.m.**

#### Onboarding / setup copy

> Your weekly money summary will arrive every Monday morning. You can change the day, time, content, or delivery method anytime.

#### Weekly email structure

**Your week at a glance**

- Money in
- Money out
- Net cash flow
- Current net worth
- Change from the previous week

**What changed**

- Spending was 14% higher than your recent weekly average
- Groceries were unusually high
- A recurring subscription increased
- Your checking balance dropped beneath its normal range
- Your investment portfolio gained or lost materially

**Budget progress**

Show trajectory, not only percentages:

> You have used 62% of your restaurant budget with 48% of the month remaining.

**Needs attention**

- 7 uncategorized transactions
- Rent has not yet been detected
- One account has not synced in three days
- A bill is due this week
- Possible duplicate transaction

**Looking ahead**

- Expected income
- Expected recurring bills
- Projected end-of-month cash balance
- Categories at risk of exceeding budget
- Goal progress

**Actions**

Every item should have a direct action:

- Review transaction
- Mark rent as paid
- Change budget
- Reconnect account
- Categorize transactions
- Snooze this alert
- Create a rule from this insight

That last action is especially powerful. An insight can become a persistent notification:

> “Dining was unusually high this week.” → Notify me whenever this happens again.

#### Weekly-summary customization

Users can choose:

- Delivery day and time
- Reporting period
- Email, push, or both
- Household-wide or individual summary
- Included accounts
- Included sections
- Detail level
- Comparison baseline
- Whether AI-written observations appear

**Reporting-period presets:**

- Previous calendar week (default — Monday–Sunday)
- Last seven days
- Month to date
- Previous month
- Custom period

---

### Manual notification creation flow

Mental model: **When this happens → send me this**

- **iOS:** full-screen flow
- **Web / desktop:** centered dialog or side panel

#### Step 1 — Template or custom

Short list of common templates (avoid dozens immediately; use grouped browse/search for the full library):

- Missing expected payment
- Budget almost reached
- Large or unusual purchase
- Low account balance
- Recurring bill changed
- Upcoming bill
- Account stopped syncing
- Weekly or monthly summary
- Create a custom notification

#### Step 2 — Define what Moat watches

Example after selecting **Missing expected payment**:

- Watch for: Rent
- Expected: Monthly
- Usually appears: Between the 1st and 3rd
- Consider it missing: After the 5th

Prefill from detected recurring transactions.

Match using any combination of:

- Merchant
- Transaction description
- Category
- Hashtag
- Account
- Amount or amount range
- Recurring transaction

Example:

> Watch for a transaction where the merchant contains “Property Management,” the category is Rent, or the hashtag is `#rent`.

Multiple identifiers prevent false missing-payment alerts when merchant names change.

#### Step 3 — Define the condition

Conversational language:

> Notify me if rent has not appeared by the 5th day of each month.

Condition types:

- Appears
- Does not appear by a date
- Exceeds an amount
- Falls below an amount
- Changes by a percentage
- Happens more than a certain number of times
- Is unusual compared with historical behavior
- Is forecast to happen
- Remains unresolved for a certain period

#### Step 4 — Choose delivery

Channels:

- Email
- Push notification
- In-app
- Email and push

Timing:

- Immediately
- Morning digest
- Evening digest
- Custom time

Encourage digests for less urgent notifications.

#### Step 5 — Preview

Show exactly what the user will receive.

**Push preview**

> Rent may be missing  
> Moat has not detected your usual rent payment this month. Review expected payments.

**Email preview**

Include why the alert fired, what data was checked, and suggested actions.

#### Step 6 — Save

Confirmation summarizes the complete rule in plain language:

> On the 5th of every month, Moat will check whether your rent payment appeared. If it did not, you will receive an email and iOS notification.

Not a dump of raw filters.

---

### Natural-language creation

Top of the manual flow:

> Describe what you want Moat to watch

Examples:

- “Email me if rent has not been paid by the fifth.”
- “Tell me when dining reaches 80% of its monthly budget.”
- “Notify me if any subscription gets more expensive.”
- “Send my wife and me a summary every Friday.”
- “Let me know if our checking account is likely to fall below $2,000 in the next 14 days.”

Moat converts the request into a **structured rule** and asks the user to review before activation.

Same structured model powers web, iOS, desktop, MCP, and AI assistants. An AI assistant does not create arbitrary cron jobs; it calls something like:

```ts
createNotificationRule({
  trigger: ...,
  conditions: ...,
  schedule: ...,
  channels: ...,
});
```

Users can later see, edit, pause, or delete the rule inside Moat regardless of where it was created.

#### MCP-created notifications

Example assistant prompt:

> I noticed your cash balance is getting close to one month of expenses. Would you like me to ask Moat to notify you if it falls below that point?

After approval, the notification appears in Moat with attribution:

> Created with ChatGPT  
> Last evaluated 14 minutes ago

**Require explicit user confirmation** before an AI creates:

- A new external recipient
- A high-frequency notification
- A notification containing sensitive tax, insurance, debt, or investment details
- Any write or automated financial action

---

### Notifications home screen

**Header**

- Title: Notifications
- Subtitle: Alerts, summaries, and financial monitoring

**Buttons**

- Create notification
- Search
- Notification settings

**Default weekly summary card** (pinned near top)

> Weekly money summary  
> Every Monday at 8:00 a.m. · Email  
> Previous Monday–Sunday

Actions: Preview · Edit · Toggle

**Active notifications** — example cards:

> Rent payment missing  
> Checks monthly on the 5th  
> Email + Push  
> Last checked: July 5 · Rent found

> Dining budget at 80%  
> Checks as transactions arrive  
> Push  
> Triggered twice this month

> Chase sync interrupted  
> Checks daily  
> Email  
> No current issues

**Suggested notifications** (from actual user data; dismissible; do not constantly regenerate):

- Your paycheck usually arrives twice monthly. Notify you if one is late?
- Your car insurance renews in 45 days. Create a reminder?
- Your checking balance varies significantly. Add a low-balance threshold?
- Your rent is reliably detected. Monitor for a missing payment?

**Notification history** — timeline of everything sent:

- Notification title
- Why it triggered
- Delivery result
- Read or unread
- Resolution status
- Linked financial data

History is critical for trust and debugging.

---

### iOS push experience

Push notifications remain concise and privacy-aware.

**Default lock-screen copy** avoids exact sensitive amounts:

> Your checking balance is below your preferred level

Inside the app, show the amount and details.

**Privacy levels** (user-configurable):

- Hide financial details
- Show general details
- Show amounts and account names

**Push actions:**

- Review
- Mark resolved
- Snooze
- Mute this notification

**Example copy:**

> You’re nearing your grocery budget  
> You have used 82% with 11 days left.

> Expected rent payment not found  
> Moat checked your connected accounts and did not find this month’s usual payment.

> Possible subscription increase  
> StreamCo changed from $14.99 to $18.99.

> Account sync needs attention  
> Your Chase data has not updated in 48 hours.

---

## How this becomes more powerful

### 1. Detect absence, not only events

One of the largest opportunities. Most systems say “a $2,000 transaction happened.” Moat should also say “something that normally happens did not happen.”

Examples:

- Paycheck did not arrive
- Rent or mortgage was not paid
- Credit-card payment was not detected
- Insurance premium did not post
- Expected reimbursement was not received
- A monthly investment contribution did not occur
- No account sync has completed

Requires recurring-event modeling and an **expected window**, not a simple date.

### 2. Forecast-based alerts

Because Moat has forecasting, notifications can happen before the problem:

> At your current spending rate, your checking account is projected to fall below $1,500 on August 4.

> Your dining budget is only 65% used, but current velocity suggests you will exceed it by $180.

> Your upcoming recurring expenses exceed expected income over the next 14 days.

Meaningfully stronger than a threshold alert after the fact.

### 3. Explain why every alert fired

Each notification detail page shows **Why you received this**, e.g.:

- Your normal rent payment appears between the 1st and 3rd
- Today is the 5th
- Moat checked these three accounts
- No matching transaction was found
- Pending transactions were also checked

Trust is especially important for missing-data alerts.

### 4. Confidence and uncertainty

For inferred events, prefer less technical wording:

> Moat did not find a likely rent payment. It may have been paid from an unconnected account.

(Optional technical form: “Possible missing rent payment · 82% confidence.”)

Responses that improve future detection:

- Mark as paid elsewhere
- Choose the matching transaction
- Update what counts as rent
- Ignore this month

### 5. Notification grouping and fatigue controls

**Urgency levels:**

| Level | Examples |
|-------|----------|
| Critical | Security, unexpected fees, broken sync, dangerously low balance |
| Important | Missing bill, major budget issue, unusual transaction |
| Informational | Weekly summaries, trends, milestones |

Users configure each level by channel. Also:

- Quiet hours
- Maximum push notifications per day
- Daily digest
- Weekly digest
- Bundle related events
- Do not repeat until something changes

### 6. Household notifications

Recipients:

- Only me
- All household admins
- A selected household member
- Different recipients by rule

Example:

> Notify both partners if the shared checking account is projected below $2,000.

Do not leak personal-account data to household members who lack access to those accounts.

### 7. Alerts that become workflows

The alert is not the end.

| Alert | Actions |
|-------|---------|
| Budget nearly reached | Increase budget · Move money · Pause until next month · Ask AI |
| Unusual transaction | Mark expected · Recategorize · Flag · Create merchant rule |
| Missing rent | Mark paid elsewhere · Link transaction · Change expected date · Remind tomorrow |
| Subscription increased | View history · Mark expected · Visit cancel page · Add annual-cost forecast |

### 8. Cross-domain financial intelligence

Where Moat’s wider financial graph becomes unique:

- Insurance renewal increased while coverage decreased
- Estimated tax reserve is below the projected tax obligation
- Investment contributions stopped
- Emergency fund fell below three months of expenses
- A major asset has no current insurance policy attached
- A liability’s promotional APR expires next month
- Property expenses for `#rentalA` exceed rental income
- A client tagged `#clientX` has not paid an expected invoice

Neither a basic budgeting alert system nor a transaction-only rules engine can easily do this.

---

## Recommended first-release scope (V1)

### Ship first

1. Weekly summary enabled by default
2. Email and iOS push channels
3. In-app notification inbox and history
4. Template-based manual builder
5. Natural-language builder
6. MCP create, read, update, pause, and delete
7. Trigger types:
   - Transaction appeared
   - Expected transaction missing
   - Budget threshold
   - Account balance threshold
   - Large transaction
   - Recurring amount changed
   - Upcoming recurring bill
   - Account sync stale
   - Scheduled summary
8. Quiet hours and digesting
9. Preview and “why this triggered”
10. Suggested rules generated from recurring financial behavior

### Add later

- Forecast-based alerts
- Statistical anomaly detection
- Goal and net-worth notifications
- Tax, insurance, and investment alerts
- Household routing
- SMS and external integrations
- Automatically recommended corrective actions
- Agent-executed workflows

---

## Architecture / Data Model

> Deferred detail. Capture intent-level contracts only in this draft. Follow-up pass should define Prisma models, evaluation jobs, OpenAPI, APNs registration, and MCP tool schemas against real paths.

### Intent-level rule contract

```ts
createNotificationRule({
  trigger: ...,   // signal type + match criteria
  conditions: ..., // thresholds, windows, absence rules
  schedule: ...,   // immediate | digest | cron-like summary
  channels: ...,   // email | push | in_app
});
```

### Platform surfaces (V1)

| Surface | Role | How it reaches the rule model today (see [readiness review](#cross-surface-readiness-review-added-july-22-2026)) |
|---------|------|------|
| `apps/api` | Cloud-authoritative rule store, evaluation, delivery orchestration, email, history | Postgres + handler/service layer; the single source of truth for cross-device alerts |
| `apps/web` | Notifications home, builder, settings, inbox | OpenAPI → `@moat/client-ts` (Orval) → `@moat/contracts` `MoatApiClient` |
| `apps/ios` | Push registration, push UX, full-screen builder, inbox | Hand-written `APIClient.swift` + hand-maintained Swift models — **no OpenAPI codegen** |
| `apps/desktop` | Local-only inbox + builder (parity UI); optional OS notifications | Offline-first SQLite via IPC (`packages/contracts`); **no cloud login, no email/push, no cross-device sync in V1** |
| `apps/mcp` | `create` / `read` / `update` / `pause` / `delete` notification rules | Cloud MCP writes **directly to Postgres via Prisma** (bypasses HTTP handlers) — must call the shared service layer, not duplicate writes |
| Email (Resend) | Weekly summary + alert emails via existing `sendTransactionalEmail` | Inline HTML strings today; no template engine |

> **Reality check:** "The same structured rule model powers web, iOS, desktop, MCP" is aspirational, not free. There is **no shared client SDK** — each surface reaches the backend differently, and the transaction-rule schema is currently duplicated in ≥6 places (`packages/mcp-contracts`, `apps/api` handler Zod, `packages/contracts` IPC, `packages/openapi/api-v1.yaml`, `packages/data-access` types, `apps/ios` Swift enums) with no single generator. The [readiness review](#cross-surface-readiness-review-added-july-22-2026) explains what must be true for the shared-model promise to hold.

### Separation from transaction rules

Transaction rules mutate transaction fields on match. Notification rules **observe** financial state and **deliver**. Do not overload `TransactionRuleAction` with notify — keep a dedicated notification-rule model (name TBD in follow-up).

### Evaluation principles (draft)

- Event-driven evaluation for transaction/balance/budget signals where possible
- Scheduled evaluation for missing-event windows, sync staleness, and summaries
- Every delivery persists history with explanation payload for “why this triggered”
- No PII in logs; lock-screen privacy levels respected for push payloads

---

## Cross-surface readiness review (added July 22, 2026)

> Answers: **do we have enough detail to succeed on all product surfaces?** Short version: the product model is strong, but the "one shared structured rule model across web / desktop / iOS / MCP / API" claim needs three concrete architectural decisions before implementation can safely start. Each is captured below with the real repo constraints that force the decision.

### Decision 1 — The canonical rule schema must live in one Zod package

The spec assumes a single `createNotificationRule({ trigger, conditions, schedule, channels })` contract shared everywhere. Today the analogous transaction-rule schema is **hand-copied across at least six locations** and only "agrees" on enum strings by convention. Repeating that for notification rules guarantees cross-surface drift (a signal type added on web that iOS silently can't parse).

**Recommendation:** introduce a new package `packages/monitoring-rules/` (Zod) as the single source of truth, modeled on the existing `@moat/mcp-contracts/src/schemas.ts` and the `@moat/shared/memories` cross-surface precedent.

```
packages/monitoring-rules/src/
├── signal.ts        # Signal enum: transaction_appeared, expected_transaction_missing,
│                    #   budget_threshold, balance_threshold, large_transaction,
│                    #   recurring_amount_changed, upcoming_recurring_bill,
│                    #   account_sync_stale, scheduled_summary
├── condition.ts     # thresholds, windows, absence rules, match criteria
├── delivery.ts      # channel (email|push|in_app), schedule (immediate|digest|cron), quiet hours
├── explanation.ts   # typed "why this triggered" payload (see testability section)
├── rule.ts          # notificationRuleSchema = signal + condition + delivery
└── index.ts
```

**Consumers:** `apps/api` handlers/services parse with it (no inline duplicate Zod); `packages/openapi/api-v1.yaml` mirrors it (ideally generated via `zod-to-json-schema`, already a dependency in `apps/api`); `packages/mcp-contracts` imports/re-exports it for tools; `packages/contracts` adds it to `MoatApiClient`; iOS keeps hand-maintained Swift enums (today's pattern) **plus a contract test** that fails when Swift falls out of sync (see testability §8).

**Do not** extend `packages/domain/src/rules/` — that package is transaction-**mutation** specific and coupled to `@moat/data-access` rule repos. Notification rules **observe and deliver**; they are a different domain (already noted in [Separation from transaction rules](#separation-from-transaction-rules)).

### Decision 2 — Cloud is authoritative; MCP must go through the shared service layer

There is **no shared HTTP client** across surfaces:

| Surface | Path to the backend |
|---------|---------------------|
| Web | OpenAPI → `@moat/client-ts` (Orval, `client: fetch`) → `httpApiClient` implements `@moat/contracts` `MoatApiClient` |
| iOS | `apps/ios/Moat/Core/Networking/APIClient.swift` (hand-written URLSession actor, Bearer JWT, unwraps `{ data: T }`) |
| MCP (cloud) | **Direct Prisma** (`apps/mcp/src/lib/db.ts` reuses `apps/api/generated/prisma`) — does **not** call `withAuth` HTTP handlers |
| Desktop | IPC → local SQLite (`window.moatDesktop.*`); cloud API only for a few flows (Plaid, vault recovery) |

Because cloud MCP bypasses the HTTP layer, if MCP writes notification rules with its own Prisma calls it will **skip the auth/household/validation invariants** the web path enforces. This is a real correctness/security hazard.

**Recommendation:** extract rule create/update/pause/delete/evaluate into a **framework-agnostic service module** (`apps/api/src/server/services/notification-rule.service.ts`) that both the HTTP handlers (`withAuth`) and the MCP tools call. MCP never writes Prisma directly for notification rules — it validates with `packages/monitoring-rules` Zod, then calls the shared service (which owns household scoping + confirmation gating). This mirrors how `apps/mcp/src/tools/rules.ts` already imports rules-engine helpers from `apps/api` rather than re-implementing them.

**Endpoints (proposed, following the `pages/api/v1/[router]/[action]` router):**

| Method + path | Handler | Wrapper |
|---------------|---------|---------|
| `POST /api/v1/notificationRule/create` | `handlers.notificationRule.create` | `withAuth` |
| `GET /api/v1/notificationRule/list` | `handlers.notificationRule.list` | `withDemoOrAuth` |
| `POST /api/v1/notificationRule/update` | `handlers.notificationRule.update` | `withAuth` |
| `POST /api/v1/notificationRule/pause` | `handlers.notificationRule.pause` | `withAuth` |
| `POST /api/v1/notificationRule/delete` | `handlers.notificationRule.delete` | `withAuth` |
| `GET /api/v1/notificationInbox/list` | `handlers.notificationInbox.list` | `withDemoOrAuth` |
| `POST /api/v1/notificationRule/preview` | `handlers.notificationRule.preview` | `withDemoOrAuth` |

iOS mirrors these with a new `NotificationRulesService.swift` (copy of `rules-service.swift`). **Every new endpoint costs hand-written Swift** — a standing argument for eventually adding OpenAPI→Swift codegen, tracked as an open question rather than V1 scope.

### Decision 3 — Desktop participation (resolves the open question)

The brief asked directly: *"desktop (through the shared package? And wait can the local desktop still do this?)"*. The honest answer from the code:

**What desktop is today:** fully local-first. Financial data lives in per-device SQLite as `"local-user"`; `getCloudMode()` always returns `false`; there is **no cloud login**; cloud sync is backlog-only (`specs/backlog/desktop-cloud-sync.spec.md`). The only recurring background job is a `setInterval` Plaid sync (`apps/desktop/src/main/plaid/scheduler.ts`) that **only runs after vault unlock and while the app is open** — on non-macOS the app quits when all windows close. There is **no `packages/jobs`, no cron, no Electron `Notification` usage, no system tray/daemon, and the `packages/events` bus is defined but entirely unused.**

**What this means for alerts:**

- Desktop **can compute** every V1 signal locally — `packages/domain` rule evaluation, budget status, spending anomalies, and summary aggregation all run against the SQLite `AppContext` today.
- Desktop **cannot deliver** scheduled alerts or a weekly summary when it is closed or the vault is locked, and it has **no email/push path** (the only outbound email is vault recovery, which delegates to the cloud API).
- Desktop rules stored in SQLite **will not appear** on web/iOS, and vice-versa, until cloud sync exists.

**Recommendation for V1 (removes ambiguity):**

1. **Cloud (`apps/api`) is the authoritative store, evaluator, and delivery engine** for cross-device alerts, email, and iOS push. Web and iOS are thin clients of it.
2. **Desktop V1 is local-only monitoring:** reuse the shared `packages/domain` evaluators against SQLite, add a local alert-definition + fire-history table to `packages/db-sqlite`, and deliver only to (a) an in-app inbox and (b) an **optional** native OS notification via Electron `Notification`, fired by a main-process scheduler that follows the existing Plaid `setInterval`-post-unlock pattern. **No desktop email, no push, no cross-device sync in V1.**
3. **The builder/inbox UI is shared** via `packages/features` so web and desktop render the same components against different transports (`ApiClientProvider` already abstracts this).
4. **Cross-device unified alerts (web ⇄ desktop) are explicitly deferred** and blocked on `desktop-cloud-sync`. When that lands, desktop switches its notification-rule reads/writes from local SQLite repos to the API-backed runtime — the shared Zod schema and shared UI make that a transport swap, not a rewrite.

This keeps desktop honest to its local-first, no-cloud-login promise while still shipping real value (local monitoring + OS notifications), and it avoids pretending the local app can send Monday-morning emails.

### Per-surface readiness scorecard

| Surface | Ready to build? | Biggest missing detail before coding |
|---------|-----------------|--------------------------------------|
| `apps/api` | Mostly | Prisma models (rules, prefs, delivery history w/ dedupe key, device tokens, expected windows); shared service layer; evaluator + cron design |
| `apps/web` | Yes | Inbox is greenfield (only Sonner toasts exist) — needs persistent inbox model + UI |
| `apps/ios` | **No — push is greenfield** | APNs entitlement + provider choice, device-token registration endpoint/model, `UNUserNotificationCenter` wiring, privacy-level payload rules; every field needs hand-written Swift |
| `apps/mcp` | Yes (with Decision 2) | Must call shared service, not Prisma; scope (`mcp:notifications:write`) + confirmation gates |
| `apps/desktop` | Yes (with Decision 3, local-only) | Local scheduler + Electron `Notification` primitives + SQLite alert tables; no email/push |
| Scheduling | **No — per-user local time unsolved** | See Decision 4 below |
| Email | Partial | No template layer for a rich multi-section summary (inline HTML strings today) |

### Decision 4 — Per-user local-time scheduling is not free

The default summary is "Monday 8:00 a.m. **local time**," and digests need morning/evening windows per user. Today **all** crons are single daily jobs at **UTC midnight** via Vercel Cron (`apps/api/vercel.json`), secured by `Authorization: Bearer ${CRON_SECRET}`. There is no per-user, timezone-aware scheduler.

**Recommendation:** add an **hourly sweep cron** (`/api/cron/evaluate-notification-schedules`) that, on each run, selects users whose stored profile timezone makes the current UTC hour equal their configured local send time (e.g. 08:00 Monday), then enqueues their summary/digest. This reuses the existing `CRON_SECRET` + service-layer pattern and needs only cron granularity Vercel already supports. Timezone **source of truth = the user profile** (not device, not household) to keep evaluation server-authoritative and testable. DST correctness is a named test requirement (see testability §3).

## Bug-prevention & testability (added July 22, 2026)

> Answers: **"any way to introvert and optimize so we catch bugs early?"** Notification systems fail in predictable, expensive ways: double-sends, timezone/DST drift, schema divergence between surfaces, privacy leaks on lock screens, and previews that don't match reality. The following are design constraints (not nice-to-haves) that make those failures show up in a unit test or a metric instead of in a user's inbox. The repo already runs pure-function tests via `node --test` + `tsx` (root `pnpm test` → `test:api-contracts`), including table-driven examples like `apple-financekit-mcc-mapping.spec-table.test.ts` — these recommendations lean on that existing style, no new test framework.

1. **One schema, validated at every boundary (kills drift).** `packages/monitoring-rules` Zod (Decision 1) is parsed on the API handler, in each MCP tool, and at the desktop IPC edge. Generate OpenAPI components from the same Zod via `zod-to-json-schema` so the HTTP contract can never silently diverge from validation.

2. **Pure, IO-free evaluator core.** Signal→condition evaluation lives as pure functions: `evaluate(rule, financialSnapshot, now) → { fired, explanation }`. No Prisma, no `Date.now()`, no network inside. This makes all nine V1 triggers deterministically unit-testable and lets cloud (cron) and desktop (main-process timer) share identical logic. Table-driven tests per trigger type, mirroring the existing spec-table test.

3. **Injected clock + explicit IANA timezone (kills the #1 flaky-bug class).** The evaluator and scheduler take `now` and a timezone as parameters — never read the ambient clock. Required test cases: Monday-8am selection across **DST spring-forward and fall-back**, month boundaries for "missing by the 5th," and expected-window math near midnight. Timezone source is the user profile (Decision 4).

4. **Idempotent delivery with a dedupe key (kills double-sends).** Every delivery writes history keyed by a deterministic `(ruleId, evaluationWindow)` dedupe key with a **unique constraint** in the delivery-history table, so a cron re-run, retry, or event replay cannot double-notify. The spec's "do not repeat until something changes" becomes a stored `lastFiredStateHash`; re-firing requires a changed hash. Both are first-class schema requirements, not app-logic afterthoughts.

5. **Preview shares the production path (kills preview ≠ reality).** The Step 5 preview endpoint (`/api/v1/notificationRule/preview`) runs the **same** evaluator and the **same** renderer as live delivery, against current data, and returns the typed explanation payload. Preview and production divergence is then impossible by construction.

6. **Typed "why this triggered" explanation payload.** Persist a structured `explanation` object (checked accounts, matched/absent transactions, thresholds, window, confidence) with every delivery. It powers the detail page, and doubles as the assertion surface in evaluator tests and a debugging artifact in history.

7. **Shadow mode + structured metrics before real sends.** Ship the evaluator in a "log-only" mode first: emit counts (rules evaluated / matched / suppressed by quiet hours / deduped / delivered / failed) through the shared `logger` and PostHog. Analytics follow AGENTS naming — `notification_rule_created`, `notification_delivery_sent`, `notification_delivery_suppressed` — counts/booleans/enums only, `{ userId? , demoUser? }`, **never** amounts, merchants, or account data.

8. **Cross-surface contract tests (catches hand-written-client drift).** Because iOS Swift enums and MCP schemas are maintained by hand, add tests that fail loudly on drift: (a) assert generated OpenAPI enums equal the canonical Zod enums; (b) a checked-in fixture of signal/condition/channel enum strings that a test compares against the Swift models file (or, if OpenAPI→Swift codegen is adopted, regenerate in CI). A new signal type cannot ship without touching every boundary.

9. **Privacy-level enforcement is a test, not a convention.** Push has "hide financial details / show general / show amounts" levels. Add explicit tests asserting that a `hide` payload's lock-screen copy contains **no** amounts or account names, and that email/push bodies never include PII the AGENTS logging rules forbid. Golden-file (snapshot) tests for the weekly-summary HTML and each push template catch both rendering regressions and privacy leaks.

10. **External delivery failures are typed and recorded, never silent.** Email (Resend) and APNs are fallible. Wrap sends with typed results, record `delivery_result` (sent / failed / suppressed) in history, and surface failures via the logger — consistent with the "no silent failures" non-negotiable. A failed send is observable and retryable, not lost.

11. **Migration/seed safety.** Schema changes are Neon migrations only (never `db push`); the desktop SQLite alert tables get their own `packages/db-sqlite` migration. Add a seed fixture of representative rules so evaluator tests and email golden files run against stable data.

**New testability gates to fold into acceptance criteria:** pure evaluator unit tests for all nine triggers; DST/boundary clock tests; dedupe-key uniqueness test; preview==delivery test; privacy-level payload tests; OpenAPI↔Zod↔Swift enum contract test.

## Implementation Plan

### Phase 0 — Spec clarity (this doc + follow-up)

1. Capture product model 1:1 (done).
2. Follow-up: Prisma sketch, API routes, evaluator design, APNs plan, MCP tool contracts, copy freeze.

### Phase 1 — Foundations

1. Notification preference + rule + delivery-history schema (migrations only).
2. Evaluation skeleton + quiet hours / digest queue.
3. In-app inbox + history (web).
4. Weekly summary job (default Monday 8am local) + email via Resend.
5. Template builder for V1 trigger types (no NL yet).

**Acceptance criteria:** Weekly summary delivers; user can create a budget-threshold or low-balance rule from a template; inbox shows history with why-triggered; quiet hours respected.

### Phase 2 — Missing events + push + NL + MCP

1. Expected-window model for recurring payments (absence detection).
2. iOS push registration + privacy levels + actions.
3. Natural-language → structured rule review flow.
4. MCP CRUD/pause for notification rules with confirmation gates.
5. Suggested rules from recurring behavior.

**Acceptance criteria:** Missing-rent style rule works; push delivers privacy-safe copy; NL and MCP both produce editable in-app rules; suggestions are dismissible.

### Phase 3 — Later differentiators

Forecast alerts, anomalies, household routing, cross-domain signals, agent workflows — per “Add later” list.

---

## Acceptance Criteria

### Product model

- [ ] Feature is framed as financial monitoring (signals → conditions → delivery), not a fixed alert checklist
- [ ] Weekly money summary is enabled by default (Monday 8:00 a.m. local, previous calendar week)
- [ ] Onboarding/setup clearly states the weekly summary schedule and that it is editable
- [ ] Weekly summary includes glance metrics, what changed, budget trajectory, needs attention, looking ahead, and actions
- [ ] Insights in the summary can become persistent notification rules

### Creation

- [ ] Manual builder follows When this happens → send me this (templates → watch → condition → delivery → preview → plain-language save)
- [ ] Natural-language creation converts to a structured rule and requires review before activation
- [ ] MCP can create/read/update/pause/delete the same structured rules
- [ ] MCP/AI creation requires confirmation for external recipients, high frequency, sensitive domains, and automated financial actions
- [ ] Rules created from any surface are editable/pausable/deletable inside Moat

### Delivery & trust

- [ ] Channels: email, iOS push, in-app inbox (any combination)
- [ ] Push defaults to privacy-aware lock-screen copy; richer previews are opt-in
- [ ] Every notification has a “why this triggered” explanation
- [ ] Notification history records title, reason, delivery result, read state, resolution, linked data
- [ ] Quiet hours and digests are available in V1

### V1 trigger coverage

- [ ] Transaction appeared
- [ ] Expected transaction missing
- [ ] Budget threshold
- [ ] Account balance threshold
- [ ] Large transaction
- [ ] Recurring amount changed
- [ ] Upcoming recurring bill
- [ ] Account sync stale
- [ ] Scheduled summary

### Home & suggestions

- [ ] Notifications home shows pinned weekly summary, active rules, suggestions, and history
- [ ] Suggestions are data-driven, dismissible, and do not constantly regenerate

### Cross-surface architecture (from the readiness review)

- [ ] Canonical rule schema lives in one Zod package (`packages/monitoring-rules`); no inline duplicate schemas per surface
- [ ] OpenAPI components are derived from the canonical Zod (e.g. `zod-to-json-schema`), not hand-written in parallel
- [ ] MCP notification-rule tools call the shared `notification-rule.service`, never Prisma directly
- [ ] Cloud (`apps/api`) is the authoritative store/evaluator/delivery engine for cross-device alerts, email, and push
- [ ] Desktop V1 is local-only (SQLite + in-app inbox + optional Electron `Notification`); no desktop email/push/cross-device sync
- [ ] Per-user digests fire at the user's profile-timezone local time via an hourly sweep cron secured by `CRON_SECRET`

### Bug-prevention & testability

- [ ] Evaluator is pure/IO-free with an injected clock and explicit IANA timezone (no ambient `Date.now()`)
- [ ] Table-driven unit tests cover all nine V1 triggers
- [ ] Clock tests cover DST spring-forward/fall-back and month/window boundaries
- [ ] Delivery history has a unique dedupe key `(ruleId, evaluationWindow)`; a re-run cannot double-send
- [ ] Preview uses the same evaluator + renderer as production delivery
- [ ] Typed "why this triggered" explanation payload is persisted with every delivery
- [ ] Privacy-level tests assert `hide` push copy contains no amounts/account names; golden-file tests cover summary email + push templates
- [ ] Contract test fails when OpenAPI / Zod / Swift enum sets diverge
- [ ] External delivery failures are typed, recorded in history, and logged (no silent failures)

## Non-Goals (V1)

- Forecast-based alerts (Phase 3 / later)
- Statistical anomaly detection as a first-class trigger (reuse anomalies content in summaries only as available)
- Goal, net-worth, tax, insurance, investment domain alerts
- Household routing of notifications
- SMS, Slack, webhook, MCP callback delivery
- Automatically recommended corrective actions / agent-executed workflows
- Overloading existing `TransactionRule` with notify actions
- Android push
- Marketing/promotional email content in the weekly summary

## Open Questions

### Resolved by the July 22, 2026 review

- **Local timezone source of truth for digests** → **user profile timezone** (server-authoritative, testable). See [Decision 4](#decision-4--per-user-local-time-scheduling-is-not-free).
- **Whether desktop participates in weekly summary email only, or also local OS notifications** → **Desktop V1 = local-only monitoring** (in-app inbox + optional Electron `Notification`), **no email/push, no cross-device sync**; cloud is authoritative for email/push. See [Decision 3](#decision-3--desktop-participation-resolves-the-open-question).
- **Where the shared structured rule model lives** → new `packages/monitoring-rules` Zod package as single source of truth. See [Decision 1](#decision-1--the-canonical-rule-schema-must-live-in-one-zod-package).
- **How MCP creates rules without bypassing invariants** → MCP calls a shared `notification-rule.service`, never Prisma directly. See [Decision 2](#decision-2--cloud-is-authoritative-mcp-must-go-through-the-shared-service-layer).

### Still open

- Exact Prisma model names and whether expected recurring events become a first-class entity vs derived from heuristics
- Push provider choice and APNs entitlement timeline for iOS (push is fully greenfield — no device tokens, no `UNUserNotificationCenter` today)
- Whether to adopt OpenAPI→Swift codegen now (removes hand-maintained Swift models + the enum-drift risk) or keep hand-written clients for V1 and rely on the contract test in testability §8
- Relationship between AI reports / insights copy and weekly-summary narrative generation
- Whether “Create a rule from this insight” creates a notification rule only, or can also create a transaction rule
- Urgency-level defaults per channel for new users
- How attribution (“Created with ChatGPT”) maps to MCP OAuth client identity
- Whether to introduce a real email template/render layer (e.g. React Email) for the multi-section summary, or extend the existing inline-HTML sender pattern with factored section renderers
- Roadmap placement: Planned vs Up next once product prioritizes

## Related Specs

- [Configurable watch queries](../configurable-watch-queries/spec.md) — structured filter → window → measure → predicate model (no SQL); closes count / day-of-month / expected-vs-actual gaps
- [Mission](../../mission.md)
- [Roadmap](../../roadmap.md) — candidate addition under Planned
- [MCP financial writes](../../complete/mcp-financial-writes/spec.md)
- [Insights](../../complete/insights.spec.md)
- [Spending shared page](../../complete/spending-shared-page/spec.md)
- [AI reports v2](../../complete/ai-reports-v2.spec.md)
- [Bank sync updates](../../complete/bank-sync-updates.spec.md)
- [Goals (backlog)](../../backlog/goals/spec.md)

## Suggested Commit Message

```text
docs: reviews alerts monitoring spec for cross-surface readiness
```

## Follow-up clarity pass (explicitly deferred)

The July 22, 2026 review settled the high-level architecture (canonical Zod package, cloud-authoritative store, shared service for MCP, desktop local-only, hourly-sweep scheduling). What still needs a concrete freeze before/at implementation:

1. Prisma / migration sketch for rules, preferences, delivery history (**with the unique dedupe key**), device tokens, expected windows — plus the parallel `packages/db-sqlite` migration for desktop-local alert tables
2. `notification-rule.service` module signature shared by HTTP handlers and MCP tools (auth wrappers, household scoping, no PII logs)
3. Evaluator design as pure functions (injected clock + timezone) and the two cron routes (`evaluate-notification-rules`, `evaluate-notification-schedules`)
4. Canonical Zod in `packages/monitoring-rules` + generated OpenAPI + MCP tool contracts (`packages/mcp-contracts`) + the enum-drift contract test
5. Web / iOS / desktop file layout and reuse of rules-builder UX patterns (`packages/features`, `ApiClientProvider`, iOS `NotificationRulesService.swift`)
6. Exact weekly email template and push payload schemas (+ golden-file fixtures and privacy-level assertions)
7. APNs entitlement/provider decision and iOS device-token registration
8. Roadmap entry once prioritized
