# Ask AI — Feature Spec

## Overview

"Ask AI" embeds contextual, data-aware AI prompts throughout the Moat Finance platform. Every surface — web, iOS, and desktop — gets a curated library of financial prompts that launch the user's preferred AI agent (ChatGPT, Claude, or a local/open-source model) pre-loaded with a rich, actionable query that leverages the Moat Finance MCP server.

The goal is not to build an AI inside Moat Finance. The goal is to make it effortless for a user to take their Moat Finance financial data and bring it into their trusted AI agent for deep, personalized guidance.

---

## Core User Problem

Financial data is only as valuable as the actions it enables. Most users have their data in Moat Finance but don't know what questions to ask or how to translate raw numbers into decisions. AI agents (ChatGPT, Claude, etc.) are powerful enough to answer complex financial questions — but only if they have the right data and the right prompt. Moat Finance is uniquely positioned to supply both.

---

## Phases

### Phase 1 — Prompt Library (`packages/ai-prompts`)

Build a shared, versioned package of curated financial prompts that all Moat Finance apps can consume. This is the foundation every other phase builds on.

**Package location:** `packages/ai-prompts/`

Each prompt is a structured JSON/TypeScript object:

```ts
type AiPrompt = {
  id: string;               // e.g. "hsa-eligibility"
  title: string;            // Short display name: "Should I Open an HSA?"
  prompt: string;           // Full prompt text sent to the AI
  tags: string[];           // e.g. ["tax", "investing", "hsa"]
  surface?: string[];       // Optional hint: where this prompt is surfaced ("investments.hsa", "monthly-cash-flow")
}
```

**Prompt quality bar:**
- Every prompt begins with an instruction to use the Moat Finance MCP server: *"Use the Moat Finance MCP tools to..."*
- Prompts favor summary-level MCP tool calls first (`getSpendingBreakdown`, `getForecast`, `getBudgetStatus`) and only request granular transaction data when necessary
- Prompts are specific enough to produce a useful output, but not so narrowly scoped that they can't generalize across users
- Every prompt should produce something the user can act on — a recommendation, a report, a checklist

**Tag taxonomy (non-exhaustive):**

| Tag | Description |
|-----|-------------|
| `tax` | Tax strategy, deductions, year-end prep |
| `investing` | Portfolio analysis, HSA, retirement accounts |
| `budgeting` | Spending limits, category targets |
| `cash-flow` | Monthly income/expense trends |
| `debt` | Payoff strategies, interest analysis |
| `real-estate` | Rental tracking, write-offs |
| `insurance` | Coverage gaps, cost analysis |
| `goals` | Savings targets, timeline modeling |
| `net-worth` | Asset/liability composition |
| `rules` | Hashtag and rule setup recommendations |

**Example prompts (seed library):**

| ID | Title | Tags |
|----|-------|------|
| `hsa-eligibility` | Should I Open an HSA? | `tax`, `investing`, `hsa` |
| `tax-strategy-annual` | Build My Tax Strategy Report | `tax` |
| `rental-write-off-prep` | Prepare My Rental for Tax Season | `tax`, `real-estate`, `rules` |
| `monthly-cash-flow-analysis` | Analyze My Monthly Cash Flow | `cash-flow` |
| `budget-improvement-top3` | Where Should I Cut Spending? | `budgeting`, `cash-flow` |
| `debt-payoff-strategy` | What's the Best Way to Pay Off My Debt? | `debt` |
| `retirement-on-track` | Am I On Track for Retirement? | `investing`, `goals` |
| `net-worth-breakdown` | Break Down My Net Worth | `net-worth` |
| `rule-setup-for-taxes` | Set Up Rules and Hashtags for Tax Season | `tax`, `rules` |
| `insurance-gap-analysis` | Do I Have the Right Insurance Coverage? | `insurance` |
| `emergency-fund-check` | Do I Have a Strong Enough Emergency Fund? | `goals`, `budgeting` |
| `investment-rebalance` | Should I Rebalance My Portfolio? | `investing` |

---

### Phase 2 — Embedded Ask AI Buttons

Embed "Ask AI" entry points at high-value locations throughout the platform. These should feel like a natural layer of the UI — not a marketing push.

**Placement principles:**
- **Empty states** → primary CTA. If there's nothing else to show, Ask AI fills the space meaningfully.
- **Chart/widget menus** → secondary access. Add "Ask AI" inside the `...` three-dot overflow menu on charts and data cards.
- **Section headers** → tertiary access on dense pages. A small sparkle/AI icon button in a section header.
- Ask AI buttons should never be the loudest element on the screen. They are supportive, not promotional.

**Target surfaces (non-exhaustive initial list):**

| Location | Placement | Prompt ID |
|----------|-----------|-----------|
| Investments → HSA tab (empty state) | Primary card CTA | `hsa-eligibility` |
| Monthly Cash Flow chart | Three-dot menu | `monthly-cash-flow-analysis` |
| Budgeting overview | Three-dot menu | `budget-improvement-top3` |
| Transactions page (no transactions) | Empty state CTA | `rule-setup-for-taxes` |
| Net Worth summary card | Three-dot menu | `net-worth-breakdown` |
| Debt accounts section | Three-dot menu | `debt-payoff-strategy` |
| Goals page (empty state) | Primary card CTA | `retirement-on-track` |
| Prompt Library page | Full-page browsable list | All prompts |

**Prompt Library page:**
A dedicated page (`/ask-ai` or `/prompts`) where users can browse the full prompt library, filter by tag, and launch any prompt. This is the discoverability hub.

---

### Phase 3 — Agent Connection Flow

Before a user can click "Ask AI," they need a connected AI agent. This onboarding flow handles first-time setup and is reachable from the settings page afterward.

**Agent selection:**
A modal (dialog) appears when the user clicks "Ask AI" and has no primary agent configured. It mirrors the visual style of the existing onboarding step selectors — rounded cards centered in the dialog, one per provider.

Supported providers (v1):

| Provider | Deep-link method | MCP support |
|----------|-----------------|-------------|
| ChatGPT | `https://chatgpt.com/?q=...` (web/desktop) | Yes (via ChatGPT Apps/Plugins) |
| Claude | `https://claude.ai/new?q=...` (web) / `claude://claude.ai/new?q=...` (desktop) | Yes (via Claude MCP connector + Desktop extensions) |
| Grok | TBD — research required | TBD |
| Other / Local | Copy-to-clipboard fallback + manual redirect | Via LibreChat or compatible UI with MCP config |

**Primary vs. secondary agents:**
- One agent is designated as the **primary** — used automatically when clicking "Ask AI."
- Additional agents can be added as **secondary** from the Settings → AI Agents page.
- The agent selection UI in Settings shows each provider as a card. Already-connected providers show a checkmark badge in the top-right corner of their card.

**Setup flow per provider:**

*ChatGPT:*
1. User selects ChatGPT card.
2. Modal transitions to a simple step-by-step guide: open ChatGPT → go to Apps → search "Moat Finance" → install.
3. If automatable via URL params (e.g. `https://chatgpt.com/store?q=Moat Finance`), redirect directly. Otherwise guide manually.
4. User confirms setup → stored as primary agent.

*Claude:*
1. User selects Claude card.
2. Guide: open Claude Desktop → Settings → Connectors → add Moat Finance MCP server URL.
3. Or: web Claude users are instructed to use `claude.ai` with the Moat Finance MCP connector via API (for power users).
4. User confirms setup → stored as primary agent.

*Grok / Other:*
1. User selects provider.
2. Research-gated: show a "coming soon" or manual fallback flow.

**Fallback (no deep-link auto-fill):**
When auto-fill isn't possible (e.g. ChatGPT mobile, Claude mobile), the flow is:
1. Prompt text is copied to clipboard automatically.
2. A toast or modal appears: *"Prompt copied. Opening [Provider] — paste it to get started."*
3. App or browser opens to the provider's base URL.
4. User pastes and sends.

---

## Prompt Construction

Prompts are assembled at click time by combining:

1. **Static prompt body** from `packages/ai-prompts`
2. **MCP context prefix**: *"Use the Moat Finance MCP server (connected to my Moat Finance account) to..."*
3. **Optional dynamic context**: current date, account count, or other non-PII ambient context that helps the AI orient

The assembled prompt is URL-encoded and passed as a query parameter to the provider deep link. Prompt length should be kept reasonable — target under 1,000 characters for the static body so the full URL stays practical.

---

## Data & Storage

- **User's primary agent preference** — stored in the user profile (API + DB). Field: `primaryAiAgent` (enum: `chatgpt | claude | grok | other`).
- **Secondary agents** — stored as an array: `connectedAiAgents: string[]`.
- **Prompt library** — static; lives in `packages/ai-prompts/`. No DB storage needed for the library itself.
- **Prompt usage analytics** — PostHog events track which prompts are clicked, per provider, per surface. No PII.

---

## Analytics

Event naming follows `<domain>_<object>_<action>` convention:

| Event | When | Properties |
|-------|------|-----------|
| `ai_prompt_clicked` | User clicks any Ask AI button | `promptId`, `surface`, `provider`, `userId` |
| `ai_agent_connected` | User completes agent setup | `provider`, `isPrimary`, `userId` |
| `ai_agent_selection_opened` | Agent selection modal opened | `triggeredBy` (prompt click vs settings), `userId` |
| `ai_prompt_library_viewed` | User opens the prompt library page | `userId` |

---

## Non-Goals (v1)

- Moat Finance does not build or embed its own AI model or chat UI.
- Moat Finance does not proxy or store AI conversations.
- Moat Finance does not generate advice directly — it assembles prompts and routes to external agents.
- No real-time streaming or AI response rendering inside Moat Finance.

---

## Open Questions

- Can we deep-link to the ChatGPT plugin/app store with a search query pre-filled? Needs testing.
- What is Grok's deep-link/MCP story? Research required before including as a v1 option.
- Should the Prompt Library page be publicly accessible (marketing) or authenticated-only?
- Do we need per-prompt disclaimer text, or a single global disclaimer on the page/modal?
- Mobile: iOS deep links for Claude regular chat are undocumented. Test `claude://claude.ai/new?q=` on device.
