# Ask AI — Roadmap

## Phase 1 — Prompt Library

**Goal:** Establish a shared, well-curated prompt package as the foundation for every Ask AI entry point across the platform.

**Deliverables:**
- [ ] Create `packages/ai-prompts/` with TypeScript types (`AiPrompt`) and a seed library of ~15–20 prompts
- [ ] Cover all primary tag categories: `tax`, `investing`, `budgeting`, `cash-flow`, `debt`, `real-estate`, `goals`, `net-worth`, `rules`, `insurance`
- [ ] Export prompts as a typed array consumable by `apps/web`, `apps/ios`, and `apps/desktop`
- [ ] Write a short README explaining the prompt quality bar and how to add new prompts

**Success criteria:**
- Any app in the monorepo can `import { prompts } from '@moat/ai-prompts'` and filter by tag
- At least 15 prompts exist covering the tag taxonomy
- Every prompt references Moat Finance MCP tool calls and produces actionable output

---

## Phase 2 — Embedded Ask AI Buttons

**Goal:** Surface Ask AI entry points at high-value locations without cluttering the UI.

**Deliverables:**
- [ ] Build a shared `AskAiButton` component (web) and equivalent on iOS that accepts a `promptId` and resolves the provider URL at click time
- [ ] Implement the Prompt Library page (`/ask-ai`) — filterable by tag, launchable from any entry
- [ ] Embed Ask AI in empty states: HSA tab, Goals page, Transactions (first-use)
- [ ] Embed Ask AI in three-dot menus: Monthly Cash Flow chart, Budgeting overview, Net Worth card, Debt section
- [ ] Wire each entry point to the correct `promptId` from `packages/ai-prompts`
- [ ] Instrument all clicks with `ai_prompt_clicked` PostHog events

**Success criteria:**
- At least 6 surfaces have embedded Ask AI entry points
- Prompt library page is live and filterable
- No Ask AI button is the primary CTA on a non-empty screen

---

## Phase 3 — Agent Connection & Onboarding Flow

**Goal:** Make connecting an AI agent feel simple and guide the user to successful MCP setup in as few steps as possible.

**Deliverables:**
- [ ] Build agent selection modal (mirrors onboarding card UI) — appears on first Ask AI click
- [ ] Implement per-provider setup flows: ChatGPT, Claude — step-by-step with automation where possible
- [ ] Implement copy-to-clipboard + redirect fallback for mobile / unsupported deep-link scenarios
- [ ] Store `primaryAiAgent` and `connectedAiAgents` on user profile (API + DB schema update)
- [ ] Settings → AI Agents page: view connected agents, set primary, add secondary, see checkmark badges
- [ ] Instrument agent connection events (`ai_agent_connected`, `ai_agent_selection_opened`)
- [ ] Research and implement Grok deep-link support (or defer to v2 if undocumented)

**Success criteria:**
- A new user can go from clicking "Ask AI" to a working AI conversation in under 2 minutes
- Mobile fallback (copy + redirect) works for ChatGPT and Claude on iOS
- Users can add a secondary agent from settings without re-triggering the onboarding modal

---

## Future Phases (Backlog)

| Item | Notes |
|------|-------|
| Grok support | Pending research on deep-link/MCP story |
| iOS native deep-link testing | `claude://claude.ai/new?q=` on-device |
| Local/open-source agent (Ollama / LibreChat) | Power user flow; requires manual URL config |
| Smart prompt suggestions | Proactively surface relevant prompts based on account state (e.g. tax season → tax prompts) |
| Prompt contributions / community | Let users share custom prompts (long term) |
| In-app prompt history | Record which prompts a user has launched (local only, no conversations) |
| Desktop app (`apps/desktop`) Ask AI | Leverage Electron shell to open provider URLs |
