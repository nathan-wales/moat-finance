# Ask AI — Tech Stack

This file documents the specific technologies, patterns, and constraints for the Ask AI feature. Read the global [specs/tech-stack.md](../../tech-stack.md) first — this file extends, not replaces it.

---

## New Package: `packages/ai-prompts`

| Concern | Decision |
|---------|----------|
| Language | TypeScript |
| Output format | Plain `.ts` module exporting a typed array — no build step required |
| Consumed by | `apps/web`, `apps/ios` (via JSON export), `apps/desktop` |
| Package name | `@moat/ai-prompts` |
| No runtime deps | This package is pure data — no dependencies |

**Do not:** store prompts in the database, in a CMS, or behind an API. They are static content and belong in version control.

---

## Deep-Link URL Construction

All prompt dispatch logic lives in a shared utility (web: `~/lib/ask-ai.ts`, iOS equivalent in Swift). No third-party library is needed — this is plain URL construction.

| Provider | Web/Desktop URL | Desktop App URI | Mobile |
|----------|----------------|-----------------|--------|
| ChatGPT | `https://chatgpt.com/?q={encodedPrompt}` | Same (opens in browser) | Fallback: copy + redirect |
| Claude | `https://claude.ai/new?q={encodedPrompt}` | `claude://claude.ai/new?q={encodedPrompt}` | Fallback: copy + redirect |
| Grok | TBD | TBD | TBD |
| Other | Copy to clipboard | Copy to clipboard | Copy to clipboard |

URL encoding: standard `encodeURIComponent`. No custom encoding library needed.

---

## Agent Preference Storage

| Concern | Approach |
|---------|----------|
| Primary agent | New field on user profile model in `apps/api` Prisma schema |
| Secondary agents | Array field on same model |
| Enum values | `chatgpt \| claude \| grok \| other` |
| Web state | Zustand store slice or React Query query (read-only from API) |
| iOS | Stored via existing API profile endpoint; persisted locally in UserDefaults |

**Do not** store agent preferences client-side only. They must survive across devices.

---

## Agent Connection Modal

| Concern | Decision |
|---------|----------|
| Web component | shadcn/ui `Dialog` (consistent with existing modals) |
| Card grid layout | CSS Grid or Flex — mirrors the onboarding step card pattern |
| State machine | Local React state (`useState`) — no Zustand store needed for this UI |
| iOS equivalent | SwiftUI `Sheet` with matching card layout |
| Trigger | Any `AskAiButton` press when `primaryAiAgent` is null |
| Settings entry | Settings → AI Agents section (new settings sub-page) |

---

## AskAiButton Component

| Concern | Decision |
|---------|----------|
| Web | Single `AskAiButton` component accepting `promptId: string` |
| Icon | Lucide `Sparkles` or `Bot` — finalize during design |
| Variant | Small secondary button for three-dot menus; standard button for empty states |
| Resolution | At click time, looks up prompt by ID from `@moat/ai-prompts`, checks `primaryAiAgent`, constructs URL |
| Clipboard API | `navigator.clipboard.writeText()` for the fallback copy flow |
| iOS | Swift button that calls a shared `AskAIService` function |

---

## Prompt Library Page (Web)

| Concern | Decision |
|---------|----------|
| Route | `/ask-ai` (authenticated) |
| Data source | `@moat/ai-prompts` — imported statically at build time (no API call) |
| Filtering | Client-side filter by tag using `useState` — no server query needed |
| UI | Tag filter chips + prompt cards (title, tags, launch button) |
| Framework | Next.js App Router page (`apps/web/src/app/ask-ai/page.tsx`) |

---

## Analytics

PostHog only. No new analytics library or provider. Follow existing PostHog patterns in `apps/web`.

---

## Compliance & Disclaimers

- A static disclaimer must appear on the Prompt Library page and within the agent connection modal: *"AI-generated responses are for informational purposes only and do not constitute financial advice. Consult a qualified financial professional before making decisions."*
- Do not auto-submit prompts to AI providers (no `submit=true` equivalent for ChatGPT/Claude — user must press Send). This is intentional: the user reviews and sends, maintaining human-in-the-loop.
- Never include PII, account numbers, routing numbers, or raw transaction data in constructed prompt URLs.

---

## What Not to Use

- **No AI SDK / LangChain / Vercel AI SDK** — Moat Finance is not running inference. This feature is routing + URL construction only.
- **No iframe or embedded chat widget** — always redirect to the external provider.
- **No polling or webhook to capture AI responses** — Moat Finance does not store or process AI outputs.
- **No new state management library** — Zustand + React Query is the stack.
