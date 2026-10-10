# Configurable Watch Queries — Structured Financial Monitoring Without SQL

## Status

Implemented August 1, 2026 (Phases 1–3). Engine (`watchQuery` Zod + evaluator + legacy compile), schedule day-of-month gates, API persistence, MCP docs, templates, and builder UI landed. Created August 1, 2026 after reviewing the Venmo “3 of 3 payments between the 1st–3rd” MCP prompt gap, the shipped `packages/monitoring-rules` model, [alerts-summaries-monitoring/spec.md](../alerts-summaries-monitoring/spec.md), and [vision-fit-report.md](../alerts-summaries-monitoring/vision-fit-report.md).

## Goal

Upgrade Moat’s notification rules from a fixed list of `signalType` triggers into a **structured watch-query configuration** that can express SQL-shaped intent (filter → window → aggregate → predicate → deliver) **without ever accepting custom SQL or arbitrary code**.

Success means:

- An AI assistant (or the Notifications builder) can author rules like “on the 3rd, report how many Venmo inflows between $520–$630 arrived since the 1st (expect 3)” using typed config only.
- The same model covers budget % alerts (“eating out at 50%”), amount/keyword transaction watches, missing expected payments, and weekly/monthly status reports.
- Evaluation is deterministic against the existing financial snapshot — no ad-hoc queries, no freeform JS.
- Legacy `signalType` rules remain supported via presets that compile into the new shape (no big-bang user migration).

## Product Context

The parent monitoring brief positions Moat as:

> When [financial condition] happens, notify [person] through [channel].

V1 shipped nine signal types and a decorative `conditions` array. The vision-fit report already called out the gap: **conditions are schema-ahead-of-product** — `happens_more_than`, `dayOfMonth`, and day-of-month windows exist in Zod but are not what the evaluator runs on.

That gap shows up immediately with agent prompts. Users (and MCP clients) naturally ask for:

- Count / sum over a multi-day window
- Day-of-month ranges (“between the 1st and 3rd”)
- Status reports even when the ideal condition is unmet (“2 of 3”)
- Keyword + amount + category + account filters that feel like a query builder
- Budget thresholds that are not “transaction appeared today”

Competitors either hard-code alerts (Copilot) or expose transaction-rule builders (Monarch). Moat’s opportunity is a **financial query builder for monitoring** — expressive enough for agents, safe enough for production, shared across web, MCP, desktop, and iOS.

Aligned with [mission.md](../../mission.md): Moat as the financial data layer for personal AI agents — agents create structured watches, not arbitrary SQL jobs.

---

## Current Repo Context

### What exists today

| Asset | Location | Notes |
|-------|----------|-------|
| Canonical Zod + evaluator | `packages/monitoring-rules/` | `signal.ts`, `condition.ts`, `delivery.ts`, `rule.ts`, `evaluate.ts`, `templates.ts` |
| Match criteria (flat) | `packages/monitoring-rules/src/signal.ts` | `merchantContains`, `descriptionContains`, `categoryName`, `hashtag`, `accountIds`, `amountMin`/`amountMax`, `recurringLabel` |
| Condition kinds (mostly unused) | `packages/monitoring-rules/src/condition.ts` | Includes `happens_more_than` + `count` + `dayOfMonth` — **not read by evaluator** |
| Schedule | `packages/monitoring-rules/src/delivery.ts` | `immediate`, digests, `custom_time`, `cron_summary`; has `dayOfWeek` / `minuteOfDay`; **no dayOfMonth** |
| Evaluation | `packages/monitoring-rules/src/evaluate.ts` | Branches on `trigger.signalType` only; ignores `rule.conditions` |
| `expected_transaction_missing` | `evaluate.ts` | Matches **whole calendar month**; `expectedWindowStartDay`/`EndDay` are explanation labels; gate is `missingAfterDay` |
| `transaction_appeared` | `evaluate.ts` | Same local day only (`isSameLocalDay`) |
| `budget_threshold` | `evaluate.ts` + trigger | Category % — works as a signal, not as a general measure |
| Snapshot loader | `apps/api/src/server/services/notification-snapshot.service.ts` | ~45 days of transactions |
| Daily crons | `apps/api/vercel.json`, `pages/api/cron/evaluate-notification-*.ts` | Once daily (Hobby plan); schedule tolerance ≈ full day |
| Rule CRUD | `apps/api/src/server/services/notification-rule.service.ts` | Persists JSON `trigger` / `conditions` / `schedule` |
| MCP tools | `apps/mcp/src/tools/notifications.ts` | `list` / `create` / `update` / `pause` / `delete` |
| MCP contracts | `packages/mcp-contracts/src/schemas.ts` | Re-exports monitoring-rules create/update schemas |
| Shared UI | `packages/features/src/notifications/monitoring/` | Builder, match fields, signal configure |
| Vision gap doc | `specs/features/alerts-summaries-monitoring/vision-fit-report.md` | Documents decorative conditions |

### Known gaps this spec closes

1. No count / sum over a multi-day or day-of-month window.
2. No day-of-month delivery schedule (`monthly_on_day`).
3. Day-of-month windows on missing-payment triggers are labels, not match filters.
4. `conditions` (including `happens_more_than`) are not evaluated.
5. No “always report status / expected vs actual” delivery mode — only `fired === true`.
6. OR/AND filter trees and richer field ops (`contains_any`, direction, signed amount) are unavailable.
7. Budget / balance / transaction watches use different mental models (`signalType` silos) instead of one query shape.

---

## Design principle

**No custom SQL. No arbitrary expressions. Typed config only.**

If a use case cannot be expressed, add a new:

- `source.kind`, or
- filter `field` / `op`, or
- `window.kind`, or
- `measure.metric`, or
- `report.mode`, or
- `schedule.kind`

Do **not** add a freeform query string, Prisma raw SQL escape hatch, or user-supplied JS.

Mental model for agents and UI:

```text
SOURCE  →  FILTER  →  WINDOW  →  MEASURE  →  PREDICATE  →  REPORT  →  DELIVERY
(what)     (which)    (when)     (how much)   (matters?)    (how to tell)  (where/when)
```

SQL analogy (documentation only — never exposed to users):

| SQL idea | Config layer |
|----------|----------------|
| `FROM transactions` | `source` |
| `WHERE …` | `filter` |
| date range / `EXTRACT(DAY …)` | `window` |
| `COUNT` / `SUM` / `%` | `measure` |
| `HAVING …` | `predicate` |
| always return a row | `report.mode` |
| cron / notify on day N | `schedule` |

---

## Architecture / Data Model

### Canonical package

Extend `packages/monitoring-rules/` (do not invent a second rule package).

Suggested new modules (kebab-case):

| File | Responsibility |
|------|----------------|
| `src/watch-query.ts` | Zod schemas for source, filter, window, measure, predicate, report |
| `src/evaluate-watch-query.ts` | Pure evaluator: `(rule, snapshot, now, timeZone) → EvaluateResult` |
| `src/compile-legacy-signal.ts` | Compile existing `signalType` + trigger → watch query (presets) |
| `src/watch-query-templates.ts` | Product templates that emit watch queries |

Keep `evaluateNotificationRule` as the public entry: if a rule has `watchQuery`, evaluate that; else compile legacy trigger then evaluate (or keep legacy branches until Phase 2 cutover).

### Rule persistence

`NotificationRule` already stores JSON blobs. Prefer additive fields on the Zod rule schema:

```ts
{
  // existing
  name, plainLanguageSummary, signalType?, trigger?, conditions?, schedule, channels, urgency, …

  // new (preferred authoring surface)
  watchQuery?: WatchQuery
}
```

**Compatibility rules:**

- MCP / UI may send `watchQuery` alone; server derives a display `signalType` / `templateId` for list cards when possible.
- Legacy rules with only `trigger` keep working indefinitely via compile path.
- Do not require a Prisma migration if JSON column already holds the rule payload; only migrate if column shape or indexes change.

### Watch query schema (canonical)

```ts
type WatchQuery = {
  source: WatchSource
  filter?: WatchFilter          // default: match all in source
  window: WatchWindow
  measure: WatchMeasure
  predicate: WatchPredicate
  report: WatchReport
}

type WatchSource = {
  kind:
    | "transactions"
    | "budgets"
    | "balances"
    | "recurring"
    | "accounts_sync"
    | "scheduled_summary"   // existing weekly summary content path
}
```

#### Filter — structured WHERE (AND / OR / NOT)

```ts
type WatchFilter = {
  all?: WatchClause[]   // AND
  any?: WatchClause[]   // OR
  none?: WatchClause[]  // NOT (exclude)
}

type WatchClause =
  | { field: "merchant"; op: "contains" | "contains_any" | "contains_all" | "eq" | "starts_with"; value: string | string[]; caseSensitive?: boolean }
  | { field: "description"; op: "contains" | "contains_any" | "contains_all" | "eq" | "starts_with"; value: string | string[]; caseSensitive?: boolean }
  | { field: "category"; op: "eq" | "in" | "not_in"; value: string | string[] }
  | { field: "categoryId"; op: "eq" | "in"; value: string | string[] }
  | { field: "hashtag"; op: "eq" | "in"; value: string | string[] }
  | { field: "accountId"; op: "in" | "not_in"; value: string[] }
  | { field: "amountAbs"; op: "eq" | "gt" | "gte" | "lt" | "lte" | "between"; value?: number; min?: number; max?: number }
  | { field: "amountSigned"; op: "eq" | "gt" | "gte" | "lt" | "lte" | "between"; value?: number; min?: number; max?: number }
  | { field: "direction"; op: "eq"; value: "inflow" | "outflow" | "transfer" }
  | { field: "isRecurring"; op: "eq"; value: boolean }
  | { field: "recurringLabel"; op: "contains" | "eq"; value: string }
  | { field: "connectionId"; op: "in"; value: string[] }  // accounts_sync / balances
```

**V1 ops to ship:** `eq`, `neq`, `contains`, `contains_any`, `contains_all`, `starts_with`, `in`, `not_in`, `between`, `gt`, `gte`, `lt`, `lte`.

**Explicit non-goal for V1:** user-facing `regex`. If agents need fuzzy merchant matching, use `contains_any` with a short synonym list. Regex may be considered later with hard length/complexity caps and never logged with raw description PII.

Empty / omitted filter = all rows in the source for the window.

#### Window — time scope

```ts
type WatchWindow = {
  kind:
    | "same_day"
    | "rolling_days"
    | "calendar_month"
    | "month_to_date"
    | "day_of_month_range"   // e.g. 1–3 every month
    | "previous_calendar_week"
    | "last_seven_days"
    | "previous_month"
    | "custom_period_days"
  startDay?: number          // 1–31, for day_of_month_range
  endDay?: number            // 1–31, for day_of_month_range
  days?: number              // rolling / custom_period_days (1–90)
  timezone?: string          // optional override; else user preference
}
```

**Semantics:**

- `day_of_month_range` with `{ startDay: 1, endDay: 3 }` includes local dates whose day-of-month is in `[1, 3]` **in the current month** (clamp endDay to month length).
- Evaluation outside that range for `status_report` / `expected_vs_actual` with `monthly_on_day` should **not** deliver early; wait for schedule.
- Snapshot lookback must cover the window (extend beyond 45 days if `previous_month` / long rolling windows require it — document in implementation).

#### Measure — aggregate

```ts
type WatchMeasure = {
  metric:
    | "count"                    // # matching transactions
    | "sum_amount_abs"           // sum of abs(amount)
    | "sum_amount_signed"        // signed sum (inflows positive convention TBD in open questions)
    | "avg_amount_abs"
    | "max_amount_abs"
    | "distinct_merchants"       // approximate “people/sources”
    | "budget_spent_percent"     // budgets source
    | "budget_remaining_amount"
    | "balance"
    | "exists"                   // 1 if any match else 0 (maps legacy appeared)
    | "missing"                  // 1 if zero matches after gate (maps legacy missing)
}
```

V1 must ship at least: `count`, `sum_amount_abs`, `exists`, `missing`, `budget_spent_percent`, `balance`.

#### Predicate — HAVING

```ts
type WatchPredicate = {
  op:
    | "eq" | "neq"
    | "gte" | "lte" | "gt" | "lt"
    | "between"
    | "crossed_above" | "crossed_below"   // requires prior state / stateHash
    | "always"                            // for pure status reports
  value?: number
  min?: number
  max?: number
  expected?: number   // for expected_vs_actual messaging (e.g. 3)
}
```

#### Report — how to tell the user

```ts
type WatchReport = {
  mode:
    | "on_match"             // classic: deliver only when predicate true
    | "on_change"            // deliver when measure crosses / stateHash changes meaningfully
    | "status_report"        // deliver whenever schedule hits; include measure even if predicate false
    | "expected_vs_actual"   // always include "2 of 3"; urgency bump if below expected
}
```

Explanation facts **must** include when relevant:

- Window label (“Aug 1–3, 2026”)
- Measure value + unit
- Expected (if set)
- Matched count / sample merchant labels (privacy-safe; no raw full descriptions in logs)
- Predicate result (`met` / `unmet`)

#### Schedule extensions

Extend `deliveryScheduleSchema` in `packages/monitoring-rules/src/delivery.ts`:

```ts
schedule: {
  kind:
    | "immediate"          // existing: evaluate when cron runs; deliver if report allows
    | "morning_digest"
    | "evening_digest"
    | "custom_time"
    | "cron_summary"
    | "monthly_on_day"     // NEW
    | "month_window_end"   // NEW — fire on window.endDay for day_of_month_range
  dayOfWeek?: number       // 0–6
  dayOfMonth?: number      // 1–31 NEW
  minuteOfDay?: number
  timezone?: string
}
```

Gate logic lives in `apps/api/src/server/services/notification-evaluation.service.ts` alongside existing local-time checks. For daily-only cron, `monthly_on_day: 3` means “deliver on local day 3 when the sweep runs,” with the same full-day tolerance as digests.

---

## Example configurations (acceptance fixtures)

These examples are **normative fixtures** — add them as unit tests in `packages/monitoring-rules` (golden evaluate results).

### 1. Venmo expected count (status on the 3rd)

```json
{
  "name": "Roommate Venmo check",
  "plainLanguageSummary": "On the 3rd, report how many Venmo payments between $520–$630 arrived since the 1st (expect 3).",
  "watchQuery": {
    "source": { "kind": "transactions" },
    "filter": {
      "all": [
        { "field": "merchant", "op": "contains_any", "value": ["Venmo"] },
        { "field": "amountAbs", "op": "between", "min": 520, "max": 630 },
        { "field": "direction", "op": "eq", "value": "inflow" }
      ]
    },
    "window": { "kind": "day_of_month_range", "startDay": 1, "endDay": 3 },
    "measure": { "metric": "count" },
    "predicate": { "op": "gte", "value": 3, "expected": 3 },
    "report": { "mode": "expected_vs_actual" }
  },
  "schedule": { "kind": "monthly_on_day", "dayOfMonth": 3, "minuteOfDay": 480 },
  "channels": ["email", "push", "in_app"],
  "urgency": "important"
}
```

**Expected notification copy (shape):**

> **Roommate Venmo check**  
> 2 of 3 expected payments found between Aug 1–3 ($520–$630). Missing 1.

If 3 of 3: informational success tone. If &lt; 3: important (or critical if user set critical).

### 2. Eating out at 50% of budget

```json
{
  "name": "Eating out halfway",
  "plainLanguageSummary": "Notify when Eating Out reaches 50% of this month’s budget.",
  "watchQuery": {
    "source": { "kind": "budgets" },
    "filter": {
      "all": [{ "field": "category", "op": "in", "value": ["Eating Out"] }]
    },
    "window": { "kind": "month_to_date" },
    "measure": { "metric": "budget_spent_percent" },
    "predicate": { "op": "crossed_above", "value": 50 },
    "report": { "mode": "on_change" }
  },
  "schedule": { "kind": "immediate" },
  "channels": ["push", "in_app"],
  "urgency": "important"
}
```

### 3. Overall budget 80%

Same as (2) with no category filter (or explicit overall budget id) and `value: 80`. Must compile from / replace today’s `budget_threshold` trigger.

### 4. Grocery spend status between the 17th–20th

```json
{
  "name": "Mid-month grocery check",
  "watchQuery": {
    "source": { "kind": "transactions" },
    "filter": {
      "all": [{ "field": "category", "op": "eq", "value": "Groceries" }]
    },
    "window": { "kind": "day_of_month_range", "startDay": 17, "endDay": 20 },
    "measure": { "metric": "sum_amount_abs" },
    "predicate": { "op": "always" },
    "report": { "mode": "status_report" }
  },
  "schedule": { "kind": "month_window_end" },
  "channels": ["in_app", "email"],
  "urgency": "informational"
}
```

### 5. Legacy missing rent (compiled)

Today’s `expected_transaction_missing` with window 1–3 / missing after 5 compiles to:

```json
{
  "watchQuery": {
    "source": { "kind": "transactions" },
    "filter": { "all": [/* match criteria → clauses */] },
    "window": { "kind": "calendar_month" },
    "measure": { "metric": "missing" },
    "predicate": { "op": "eq", "value": 1 },
    "report": { "mode": "on_match" }
  },
  "schedule": { "kind": "monthly_on_day", "dayOfMonth": 5 }
}
```

Note: true “window 1–3 only” matching can be expressed with `day_of_month_range` when product wants that semantics; compile path should document which semantics it preserves for old rules (recommend: keep month-wide match + `monthly_on_day` gate to avoid behavior change).

---

## Target Experience

### Mental model (UI + MCP docs)

Replace “pick a signal type” as the primary authoring path with five steps:

1. **Watch** — Transactions / Budgets / Balances / Recurring / Sync
2. **Match** — keyword, category, account, amount, direction (filter builder)
3. **Over** — window picker (today / MTD / days 1–3 / last 7 days / …)
4. **Measure & threshold** — count / sum / budget % + predicate + expected
5. **Tell me** — report mode + schedule + channels

Templates remain first-class: “Roommate payment check”, “Category budget %”, “Missing rent”, “Large purchase” — each expands to a full `watchQuery`.

### MCP / AI authoring

Update tool descriptions in `apps/mcp/src/tools/notifications.ts` and contracts so agents are instructed to prefer `watchQuery` for anything involving:

- counts, sums, day-of-month windows
- status / expected-vs-actual reports
- budget percent watches

Keep confirmation gates (`confirmed: true`) for email/push, high-frequency, and sensitive domains per existing MCP rules.

After create, continue to remind: rule appears under Notifications; editable/pausable there.

### Notification body rules

| Report mode | When predicate unmet | When met |
|-------------|----------------------|----------|
| `on_match` | No delivery | Alert |
| `on_change` | No delivery until cross | Alert on cross; dedupe via stateHash |
| `status_report` | Still deliver status | Deliver status |
| `expected_vs_actual` | Deliver “N of M” + shortfall | Deliver “M of M” success |

Never put raw transaction descriptions or emails in logs ([AGENTS.md](../../../AGENTS.md)). Explanation facts may show merchant display names already present on the snapshot for in-app “why.”

### Builder UI (Phase 3)

Extend `packages/features/src/notifications/monitoring/`:

- Reuse / expand `match-criteria-fields.tsx` into filter-clause editor
- Add window picker + measure/predicate controls
- Preview must run the same pure evaluator as production (`evaluateWatchQuery`)

---

## Implementation Plan

### Phase 1 — Engine: watch query evaluate + schedule day-of-month

1. Add Zod schemas in `packages/monitoring-rules/src/watch-query.ts`.
2. Implement `evaluateWatchQuery` with unit tests for fixtures 1–4.
3. Extend schedule schema + evaluation service gate for `monthly_on_day` / `month_window_end`.
4. Wire `evaluateNotificationRule` to prefer `watchQuery` when present.
5. Ensure explanation facts include count/expected/window.
6. Snapshot lookback: confirm 45 days covers day-of-month windows; extend if needed for `previous_month`.

**Acceptance criteria:**

- [ ] Venmo fixture evaluates to fired status report on local day 3 with correct N of M
- [ ] Before day 3, `monthly_on_day` schedule does not deliver
- [ ] `count` + `day_of_month_range` ignores txs outside 1–3
- [ ] No SQL or string-eval path introduced
- [ ] `pnpm` package tests in `packages/monitoring-rules` cover fixtures

### Phase 2 — Legacy compile + MCP surface

1. Implement `compileLegacySignal(trigger, conditions?) → WatchQuery` for all nine existing signal types.
2. Expose `watchQuery` on create/update via `packages/mcp-contracts` and API handlers.
3. Update MCP tool descriptions with watch-query examples (Venmo + budget).
4. Keep reading legacy-only rules without rewrite-on-read (optional background migrate later).

**Acceptance criteria:**

- [ ] Creating via MCP with `watchQuery` persists and evaluates
- [ ] Existing rules without `watchQuery` still evaluate identically (table-driven parity tests)
- [ ] `moat.createNotificationRule` docs/examples show filter/window/measure, not fake `happens_more_than` that is ignored

### Phase 3 — Product templates + builder UI

1. Add templates: Roommate payment check, Category budget %, Mid-month spend status.
2. Builder steps bind to watch-query layers (not read-only signal type).
3. Preview uses shared evaluator.
4. List/detail cards show plain-language summary derived from watch query when missing.

**Acceptance criteria:**

- [ ] User can create Venmo-style rule in UI without MCP
- [ ] User can create “50% of Eating Out budget” without code
- [ ] Pause / edit / delete unchanged

### Phase 4 — Richer measures (optional follow-on)

- `distinct_merchants`, `crossed_above` reliability across months, groupBy (merchant/day) for future digests
- Desktop local evaluator parity (`apps/desktop` local notification rules)
- iOS model updates (`notification-models.swift`) + contract drift test

---

## Acceptance Criteria (feature complete)

- [ ] Typed `watchQuery` schema is the preferred authoring contract for new complex rules
- [ ] Transaction filters support merchant/description keywords, amount bands, category, account, direction
- [ ] Windows support `same_day`, `month_to_date`, `calendar_month`, `day_of_month_range`, `rolling_days`
- [ ] Measures support at least `count`, `sum_amount_abs`, `budget_spent_percent`, `exists`/`missing`
- [ ] Report modes support `on_match`, `status_report`, `expected_vs_actual`
- [ ] Schedules support `monthly_on_day` and `month_window_end`
- [ ] Venmo “N of M on the 3rd” works end-to-end (create → daily eval → in-app history with why)
- [ ] Budget “50% Eating Out” works via watch query (and legacy compile)
- [ ] No custom SQL, Prisma `$queryRaw` for user rules, or user JS evaluation
- [ ] Conditions that previously did nothing are either implemented via watch query or removed from AI-facing docs so agents are not misled
- [ ] No PII in evaluation/delivery logs
- [ ] Cross-surface: Zod canonical; MCP contracts updated; OpenAPI/enum drift test updated if enums change

## Non-Goals

- Custom SQL / Prisma raw queries authored by users or agents
- Arbitrary JavaScript or expression-language predicates
- Real-time sub-hour evaluation (daily cron remains acceptable for V1 of this spec)
- Full group-by analytics digests (“break down by merchant”) in Phase 1–3
- Household multi-recipient routing
- Changing delivery shadow/live defaults or APNs (owned by parent monitoring spec)
- Replacing weekly `scheduled_summary` email content design
- Regex merchant matching in V1
- Forecasting / “is_unusual” ML anomaly metrics (may map later as new measures)

## Open Questions

1. **Signed amount convention** — Are inflows positive or negative in Moat snapshots today? Lock `direction` + `amountSigned` semantics against `notification-snapshot.service.ts` before implementing filters.
2. **Compile fidelity for missing payments** — Keep month-wide match for legacy rules, or tighten to `expectedWindow*` as a real filter? Recommend: preserve legacy behavior; offer new templates with true `day_of_month_range`.
3. **Overall budget** — How is “overall” represented in budget snapshot (null category vs sentinel)? Needed for fixture 3.
4. **`crossed_above` state** — Store prior measure in rule state / delivery history stateHash only, or add explicit `NotificationRuleState` table?
5. **UI vs MCP sequencing** — Ship Phase 1–2 (engine + MCP) before builder UI so agents unblock first?
6. **Roadmap placement** — Promote under Planned in [roadmap.md](../../roadmap.md) once prioritized.

## Related Specs

- [Alerts & Summaries — Monitoring](../alerts-summaries-monitoring/spec.md) — parent product brief; this spec is the expressiveness upgrade for conditions/windows/measures
- [Vision fit report](../alerts-summaries-monitoring/vision-fit-report.md) — documents decorative `conditions` and builder gaps
- [MCP financial writes](../../complete/mcp-financial-writes/spec.md) — agent write patterns / confirmation
- [Mission](../../mission.md) — agents operate on structured financial context

## Suggested Commit Message

```text
docs: adds configurable watch queries spec
```
