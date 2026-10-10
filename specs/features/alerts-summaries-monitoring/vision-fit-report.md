# Notifications & Alerts — Vision Fit Report

> Read-only assessment of how close the launched alerts/summaries system is to the product vision in [spec.md](./spec.md). No implementation work is prescribed here beyond documenting gaps. Dated July 22, 2026.

## Verdict

**The launch matches the vision’s architecture and V1 checklist at the data-model / evaluator layer (~70–80%), but the product experience and live delivery are much thinner (~35–45%).** Overall: a credible **foundation** for “financial monitoring,” not yet the differentiator described.

Closest match: signals → conditions → delivery as a first-class domain in `packages/monitoring-rules`, with all nine V1 trigger types evaluated, weekly summary bootstrap, MCP CRUD, in-app history with “why,” and a web home/builder shell.

Biggest miss vs the brief: the system still feels like **structured rules plumbing + a thin wizard**, not “When [condition] happens, notify [person] through [channel]” with rich matching, absence confidence, actionable workflows, and trustworthy live delivery.

Delivery default is **shadow mode** (`NOTIFICATION_DELIVERY_MODE` defaults to shadow in `apps/api/src/server/services/notification-delivery.service.ts`); iOS push only logs `notification_delivery_push_queued` — no APNs send. So “launched” is largely **evaluate + persist + UI shell**, not end-to-end user-visible monitoring.

---

## Scorecard vs recommended V1 scope

| V1 item from the brief | Status | Notes |
|---|---|---|
| 1. Weekly summary on by default | **Partial** | Bootstrap rule + Mon 8:00 prefs exist; email renderer has the right section skeleton; content is shallow (“Spending activity was recorded”) vs the insightful brief |
| 2. Email + iOS push channels | **Partial** | Email path exists (live mode only); push is token registry + privacy copy helper, **not** APNs; default delivery is shadow |
| 3. In-app inbox + history | **Mostly** | Web/desktop history with title/body/why summary/read/result; no detail page, weak resolution UI |
| 4. Template-based manual builder | **Partial** | 9 templates; steps exist; configure UI does **not** edit matchers/thresholds/windows |
| 5. Natural-language builder | **Partial** | Heuristic keyword parser, not LLM; limited phrases; review doesn’t expose editable structure |
| 6. MCP create/read/update/pause/delete | **Yes** | `apps/mcp/src/tools/notifications.ts` with confirmation gates |
| 7. Nine trigger types | **Yes (engine)** | All cases in `packages/monitoring-rules/src/evaluate.ts`; quality of absence/recurring modeling is still heuristic |
| 8. Quiet hours + digesting | **Partial** | Prefs + evaluator support; UI mostly toggle-only; digests exist as schedule kinds |
| 9. Preview + “why this triggered” | **Mostly** | Preview + explanation facts in engine/email; UI shows summary string more than full fact list |
| 10. Suggested rules from behavior | **Partial** | Web suggestions (rent missing, low balance, late paycheck); desktop empty; thin set vs brief |

**V1 bottom line:** Engine checklist is largely checked; product completeness of that checklist is not.

---

## Fit to the three core concepts

```mermaid
flowchart LR
  Signals[Signals_what_Moat_watches]
  Conditions[Conditions_when_it_matters]
  Delivery[Delivery_where_and_how]
  Signals --> Conditions --> Delivery
```

### Signals — strong V1 coverage, limited ambition

**Shipped (evaluable):** transaction appeared, expected missing, budget %, balance threshold, large txn, recurring amount changed, upcoming bill, account sync stale, scheduled summary.

**Vision examples not shipped (correctly “later”):** spending velocity, CC statement arrival, net worth material change, allocation drift, insurance renewal, tax deadline, goal behind schedule, credit utilization, bank fees.

**Assessment:** Matches the brief’s V1 trigger list well. Does **not** yet look like Copilot’s polished defaults catalog (no bank-fee or utilization templates) nor Monarch’s bill-statement alerts. The differentiator signal — **absence** — exists as a type, but `ExpectedRecurringEvent` is schema-only (unused), so missing-event detection is snapshot/heuristic rather than a durable expected-window model.

### Conditions — schema ahead of product

Condition kinds are defined (`appears`, `does_not_appear_by_date`, `exceeds_amount`, `is_unusual`, `is_forecast`, etc.) in `packages/monitoring-rules/src/condition.ts`, but evaluation branches on **`signalType` / trigger fields**, not a general condition engine. Forecast / unusual / happens-more-than are largely declarative.

The manual flow’s “define what Moat watches” (merchant OR category OR hashtag OR account OR amount range) is in the **data model** (`MatchCriteria`) but **not in the builder UI** — configure is name + plain-language summary + read-only signal type (`packages/features/src/notifications/monitoring/notification-builder-dialog.tsx`).

**Assessment:** This is the largest gap between “arbitrary financial conditions” positioning and what users can actually author.

### Delivery — channels modeled, live path incomplete

- Channels: email / push / in_app — correct for V1
- Schedule kinds: immediate, morning/evening digest, custom_time, cron_summary
- Urgency: critical / important / informational (critical bypasses quiet hours)
- Fatigue: quiet hours, max push/day, dedupe by window + state hash
- Push privacy levels: hide / general / show amounts — prefs + `renderPushCopy`

Gaps: shadow default; no real APNs; custom_time lightly wired; settings UI incomplete (no quiet window times, no digest picker, no per-urgency channel map); household routing deferred (correctly).

---

## Weekly summary — structure yes, value uneven

**Aligned with vision:**

- Default Monday 8:00 local, previous calendar week
- Onboarding-ish copy on the home card
- Email sections: glance (in/out/net/net worth/Δ), what changed, budget trajectory (“62% with X% month remaining”), needs attention, looking ahead
- Prefs model supports period presets, sections, AI observations, accounts

**Thin vs vision:**

- “What changed” is weak (generic spending line; recurring % change) — not “14% above weekly average / groceries unusually high / checking below normal range”
- Looking ahead lacks projected EOM cash, income, at-risk categories, goals
- No per-item action links in the sense of the brief (review txn, mark rent paid, create rule from insight)
- Customization UI is day/minute/enable only — not sections, period, household, detail level, AI toggle, account filter
- No standalone weekly preview on the card

---

## Creation flows

### Manual builder

Step skeleton matches the brief (NL → template → configure → delivery → preview → confirm). Substance does not:

- Templates are the right short list
- No real watch-criteria editor
- No conversational condition editing (“after the 5th”)
- Delivery step is channels only (no immediate vs digest timing)
- Preview is push + why summary (no email preview)
- Confirm uses plain-language summary — good intent

### Natural language

Exists, but is **keyword heuristics** (`parseNaturalLanguageRulePrompt`), not “Moat converts NL into a structured rule with AI.” Same structured model can power MCP/web — that part is right. Quality bar of the brief is not met.

### MCP / AI assistants

Closest to the vision’s “not arbitrary cron” requirement:

- `createNotificationRule({ trigger, conditions, schedule, channels })` style tools
- Confirmation for sensitive/high-frequency cases
- `source: "mcp"` attribution path exists

Missing polish: rich “Created with ChatGPT / last evaluated…” UI; no agent-proactive suggestion loop in product.

---

## Notifications home & cross-surface

| Surface | Fit |
|---|---|
| **Web** | Closest to brief: header, create, settings, pinned weekly card, active rules, suggestions, history |
| **Desktop** | Shares UI; local SQLite; suggestions empty; no Electron OS notifications found |
| **iOS** | Stub list only; README still “push out of scope”; no full-screen builder, privacy UX, or push actions |
| **Search on home** | Missing |
| **Suggested notifications** | Present on web, small heuristic set, dismissible |

History has title/why summary/delivery/read/resolution fields in API; web actions for resolve/snooze/mute are largely unused. Linked financial data and deep “why” fact UI are underbuilt. Alert → workflow actions (increase budget, mark paid elsewhere, reconnect, create rule from insight with high quality) are mostly missing — “create rule” from history is a weak template prefill.

---

## Competitive / differentiator lens

| Opportunity from the brief | Today |
|---|---|
| Arbitrary conditions + customizable thresholds | Model yes; authoring UX no — still closer to templates than Monarch’s rule flexibility |
| Natural-language creation | Shell only (heuristics) |
| Missing-event detection | Signal exists; expected-window persistence unused; confidence/uncertainty UX thin |
| Richer summaries | Section scaffold; insight quality low |
| Recommended / actionable next steps | Almost absent |
| Cross-domain graph alerts | Explicitly later — correctly deferred |
| Forecast-based alerts | Explicitly later — correctly deferred |
| MCP-created monitoring | Real and aligned |

**Vs Copilot:** Moat’s engine is *more* flexible on paper (custom thresholds in triggers), but Copilot’s fixed alerts may still feel more polished if Moat isn’t shipping live push + good defaults. Bank-fee and credit-utilization defaults are not in V1 templates.

**Vs Monarch:** Transaction-rule-style notify flexibility is not yet user-reachable; bill statement sync alerts aren’t there. Absence + MCP + weekly monitoring narrative are the intended wedge — only partially realized.

---

## What’s later (and correctly not shipped)

These match the brief’s “Add later” list and are largely absent — good scope discipline:

- Forecast-based alerts
- Statistical anomaly as first-class trigger
- Goals / net worth / tax / insurance / investment
- Household routing
- SMS / Slack / webhooks / MCP callbacks
- Agent-executed corrective workflows

---

## Overall closeness ratings

| Layer | Closeness to vision |
|---|---|
| Conceptual model (signals/conditions/delivery) | **High** |
| V1 trigger engine coverage | **High** |
| Trust primitives (why, privacy, quiet hours, dedupe) | **Medium–high** (engine), **medium** (UX) |
| Weekly summary product value | **Medium-low** |
| Manual + NL creation experience | **Low–medium** |
| Live multi-channel delivery (esp. iOS) | **Low** |
| Actionable workflows from alerts | **Low** |
| Differentiator depth (absence, forecast, cross-domain) | **Low** (absence stubbed; rest deferred) |
| MCP structured creation | **High** |

**Composite:** ~**50%** of the *V1 product vision* as a user would experience it; ~**75%** of the *V1 technical skeleton*; ~**20–30%** of the full differentiator ambition (which is fine if framed as Phase 1).

---

## Highest-leverage gaps (deferred — not in scope for this report)

Priority order by how much they close the vision gap:

1. **Turn on real delivery** — live email + APNs; exit shadow for dogfood
2. **Builder depth** — match criteria + threshold/window editors + digest timing
3. **Weekly summary insight quality** — comparisons, at-risk budgets, projected cash, actions
4. **Absence model** — persist expected windows; confidence + “mark paid elsewhere”
5. **History → workflow** — resolve/snooze/mute UI + deep links
6. **NL upgrade** — LLM → structured rule with review (same Zod model)
7. **iOS parity** — full-screen flow + push privacy + actions

---

## Sources of truth reviewed

- Spec: [spec.md](./spec.md) (the “Current Repo Context” archaeology section was stale vs landed code; refreshed alongside this report)
- Domain: `packages/monitoring-rules/`
- API: notification services/handlers + crons under `apps/api/`
- UI: `packages/features/src/notifications/monitoring/`
- MCP: `apps/mcp/src/tools/notifications.ts`
- Surfaces: web page wrapper, desktop local IPC, iOS stub views
