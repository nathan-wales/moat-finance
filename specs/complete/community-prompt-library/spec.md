# Community Prompt Library — Submission & Moderation

## Status

Implemented July 14, 2026. Full community prompt library across web, desktop (private-only), iOS, and API.

## Goal

Expand the existing Moat prompt library so users can create, save privately, submit for community review, and revise published prompts — with administrator moderation — across **web**, **desktop**, **iOS**, and **API**, without replacing the current curated static library.

Success means:

- Users can create prompts manually or with a connected AI assistant, save them privately, and optionally submit them for community review.
- Submitted prompts remain usable in the creator's personal library while under review, with clear status badges.
- Only administrator-approved prompts appear in the public community library.
- Creators receive moderation feedback and can submit revisions without exposing unreviewed edits publicly.
- All authorization is enforced server-side; all moderation actions are auditable.
- **Web and desktop share one React implementation** in `packages/features` (same components, adapter props for platform differences).
- **Desktop runs in `private-only` mode** — users can create and save private prompts locally; no community tab, no submit-for-review, no publishing or sharing.
- **iOS ships a native SwiftUI reimplementation** with full community flows (same as web), calling the cloud API.
- Web and iOS expose equivalent community functionality; desktop exposes private prompt creation against the curated static library.

## Product Context

Moat's Ask AI feature helps users take their financial data into trusted AI assistants via curated, MCP-aware prompts. Phase 1 shipped a **static curated library** (`@moat/ai-prompts`) browsable on **web and desktop** (via `@moat/features`). Users cannot yet create, save, or share their own prompts. **iOS has no prompt library yet.**

Community prompts extend Moat from a read-only catalog into a **user-contributed library** while preserving quality through mandatory administrator review. This aligns with Moat as the financial context layer for personal AI agents: users who craft effective prompts should be able to share them, and other users should be able to **Save to my library** and customize a private copy.

This spec intentionally **extends** existing infrastructure rather than rebuilding it. The static curated library remains the seed catalog; community-approved prompts join the public library at runtime via API on **web and iOS only**.

**Desktop is local-first** — like AI Reports on desktop (local SQLite, no share-via-link), desktop prompt creation is **private and on-device only**. There is no concept of publishing or sharing prompts from the desktop app. The shared `@moat/features` UI respects a `capabilities.mode` prop so the same components render community flows on web but hide them on desktop.

## Current Repo Context

### Phase 1 audit summary

| Area | Exists today | Location |
|------|--------------|----------|
| Static curated prompt data | ✅ 13 prompts, client-side only | `packages/ai-prompts/` |
| Prompt types | `AiPrompt`, `AiPromptTag`, `AiPromptSurface`, `AiPromptContext` | `packages/ai-prompts/src/types.ts` |
| Shared prompt UI | Browse, tag filter, search, detail, copy, ChatGPT/Claude deep links | `packages/features/src/prompts/` |
| Web prompts page | Thin shell at `/prompts` | `apps/web/src/app/(dashboard)/prompts/page.tsx` |
| Desktop prompts page | Same shared components, no analytics | `apps/desktop/src/renderer/src/App.tsx` |
| Embedded Ask AI CTAs | `PromptMenu`, `PromptCardCta` on overview, budget, investments, transactions | `apps/web/src/components/common/prompts-button.tsx` |
| iOS prompt library | ❌ Not implemented | — |
| User-owned prompts (DB) | ❌ No Prisma models | — |
| Prompt API endpoints | ❌ None | — |
| OpenAPI prompt routes | ❌ None | `packages/openapi/api-v1.yaml` |
| Community moderation | ❌ None | — |
| In-app notification model | ❌ No `Notification` table | — |

### Existing prompt data model (static package)

```ts
// packages/ai-prompts/src/types.ts
type AiPrompt = {
  id: string;           // stable kebab-case, e.g. "hsa-eligibility"
  title: string;
  prompt: string;       // full body — maps to `body` in new model
  tags: AiPromptTag[];  // closed union of 11 tags
  surfaces?: AiPromptSurface[];
};
```

**Tag taxonomy (reuse as category seeds):** `tax`, `investing`, `budgeting`, `cash-flow`, `debt`, `real-estate`, `insurance`, `goals`, `net-worth`, `rules`, `hsa`.

**Surfaces** (`investments.hsa`, `cash-flow.chart`, etc.) are UI placement hints for embedded CTAs — not applicable to user-created prompts initially.

### How personal vs public library works today

| Layer | Behavior |
|-------|----------|
| Global curated library | Single static set in `@moat/ai-prompts`; same for all users; shipped via app releases |
| Personal library | Does not exist |
| Public / community library | Does not exist |
| Per-user customization | Runtime assembly only (`currentDate`; `accountCount` supported but unused) |

The `/prompts` page shows **only** the static curated library. There is no `+` creation action, no user library tab, and no community tab.

### Closest reusable patterns in the repo

| Pattern | Location | Reuse for |
|---------|----------|-----------|
| User-owned content + visibility | `AiReport`, `ReportVisibility`, `AiReportVersion` | Prompt ownership, public visibility, version history |
| API handler + service layer | `apps/api/src/server/handlers/ai-report.ts`, `services/ai-report.service.ts` | CRUD, list mine, list public |
| Shared page with list/detail via search param | `PromptLibraryPage` (`?promptId=`), `AiReportsPage` (`?reportId=`) | Personal + community library pages |
| Platform adapter props | `AiReportsPageProps` (`capabilities`, `notifications`, `navigation`) | Web/iOS/desktop shells |
| Feedback submission lifecycle | `Feedback`, `FeedbackStatus` | Moderation status naming reference (different domain) |
| Admin authorization | `ADMIN_USER_IDS` env + `requireAdmin()` in handlers | Moderation queue gating |
| MCP AI assistant connection | `apps/api/src/server/handlers/mcp.ts`, web/iOS AI Access | AI connection gate for "Create with AI" |
| Analytics | `ai_prompt_library_viewed`, `ai_prompt_clicked` | Extend with submission/moderation events |
| MCP audit log | `McpToolCall`, `mcp.listMcpLogs` | Audit pattern reference |

### AI assistant connection (today)

**Live path:** MCP OAuth connections + personal access tokens via AI Access (`/ai-access` web, `apps/ios/Moat/Features/AIAccess/`).

**Not built (legacy Ask AI spec):** `User.primaryAiAgent`, agent selection modal, per-provider deep-link routing based on user preference.

**AI connection gate should check:** user has at least one active MCP OAuth connection **or** at least one non-revoked PAT — same signal desktop uses for `hasMcpConnection`. Route "Connect an assistant" to existing AI Access flow (`/ai-access` web, AI Access on iOS).

**AI-assisted draft generation:** Use the in-app Moat agent (`apps/api/src/agent/`) or a dedicated service endpoint that calls the connected assistant. Keep generation inside Moat; do not auto-submit generated prompts for community review.

### Admin interfaces and authorization

```ts
// apps/api/src/server/services/sync-feature-flags.ts (pattern)
function isAdminUser(userId: string): boolean {
  const adminUserIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",").map((id) => id.trim()).filter(Boolean);
  return adminUserIds.includes(userId);
}
```

Same pattern in `handlers/institutions.ts`, `handlers/financial-connections.ts`. **No RBAC roles in Prisma.** Moderation admin UI is net-new; gate all moderation endpoints with `requireAdmin()`.

### Notifications (today)

- **Prompt library:** toast on copy only (`apps/web/src/app/(dashboard)/prompts/page.tsx`).
- **Feedback:** email notification to team on submit (`send-feedback-notification-email.ts`).
- **No in-app notification inbox** for users.

**V1 recommendation:** Add a lightweight `UserNotification` model (or extend an existing pattern if one ships before implementation) with deep links. Fallback: email + toast on next library visit. See Open Questions.

### Analytics (existing)

| Event | Properties |
|-------|------------|
| `ai_prompt_library_viewed` | none |
| `ai_prompt_clicked` | `promptId`, `surface`, optional `provider` |

**Constraints:** Never send prompt body, description, or financial data in analytics. Use stable IDs and enums only. See `docs/security/analytics-events.md`.

### Spec drift from completed Ask AI docs

| Item | Old spec | Current code |
|------|----------|--------------|
| Route | `/ask-ai` | `/prompts` |
| Prompt count target | 15–20 | 13 shipped |
| iOS consumption | Planned | Not implemented |
| Disclaimer on library page | Required | Not present |
| Phase 3 agent prefs | `primaryAiAgent` on User | Not in schema |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Static prompt seeds + tag taxonomy | `packages/ai-prompts/` | Keep as Moat-curated catalog; do not migrate to DB |
| Prompt library UI shell | `packages/features/src/prompts/prompt-library-page.tsx` | Extend with tabs: Curated / My library / Community |
| Prompt cards | `packages/features/src/prompts/prompt-card.tsx` | Add status badges for personal library |
| Navigation via search params | `packages/features/src/navigation-context.tsx` | `?promptId=`, `?tab=`, `?create=` |
| AI Reports page pattern | `packages/features/src/ai-reports/` | API-backed list/detail, React Query, adapter props |
| Handler wrappers | `apps/api/src/server/handler-wrappers.ts` | `withAuth`, `withDemoOrAuth`, `withPublic` |
| MCP connection APIs | `apps/api/src/server/handlers/mcp.ts` | Gate "Create with AI" |
| Web AI Access page | `apps/web/src/app/(dashboard)/ai-access/` | "Connect an assistant" destination |
| iOS AI Access | `apps/ios/Moat/Features/AIAccess/` | Same destination on iOS |
| iOS bottom sheets | Transaction sheets, MCP token sheets | Pattern for `+` creation sheet |
| Web dialogs/drawers | shadcn/ui in `apps/web/src/components/ui/` | Creation flow modals |
| Badge component | `@moat/ui` / shadcn Badge | Status badges |
| Feedback admin lifecycle | `FeedbackStatus` enum | Naming reference only |

## Platform Architecture & Package Boundaries

This feature ships on three clients. **Web and desktop must not fork UI** — they consume the same shared React module. **iOS is intentionally native** (same pattern as AI Access: shared API, duplicated SwiftUI).

### Canonical layering

```text
packages/contracts (+ packages/openapi → packages/client-ts)
  ↓ types + MoatApiClient prompt methods
packages/features/src/prompts/          ← ALL React UI (web + desktop)
  ↓ adapter props: navigation, notifications, analytics, capabilities
apps/web/src/app/(dashboard)/prompts/   ← thin shell (PostHog, sonner)
apps/desktop/src/renderer/src/pages/prompts/  ← thin shell (inline notice, ipcApiClient)
apps/ios/Moat/Features/Prompts/         ← native SwiftUI (NOT @moat/features)
  ↓
apps/api (Postgres, handlers, services)
```

Follow the **AiReportsPage / PromptLibraryPage pattern** documented in [specs/complete/desktop-ai-reports/spec.md](../../complete/desktop-ai-reports/spec.md): full interactive page in `@moat/features`, thin app shells, platform injected via props.

### Shared package — `packages/features/src/prompts/`

Extend the existing prompts module (do not create a parallel `community-prompts/` tree). New and migrated files:

| File | Purpose |
|------|---------|
| `prompt-library-page.tsx` | Extend with tabs; hide Community when `mode: 'private-only'` |
| `prompts-page-header.tsx` | Extract header + `+` button (currently inline in page) |
| `prompt-card.tsx` | Extend with status badges, community vs personal variants |
| `community-prompt-card.tsx` | Public library card (creator attribution, Reviewed by Moat) |
| `prompt-detail-page.tsx` | Detail for user-owned + community prompts; moderation feedback |
| `prompt-create-choice-dialog.tsx` | Create with AI / Write manually choice |
| `prompt-ai-connection-gate-dialog.tsx` | Connect assistant interstitial |
| `prompt-ai-builder-form.tsx` | AI-assisted draft builder |
| `prompt-manual-form.tsx` | Manual creation + visibility selection |
| `prompt-visibility-section.tsx` | "Who is this prompt for?" — rendered only when `mode: 'community'` |
| `prompt-status-badge.tsx` | Maps `PromptReviewStatus` → badge label/color |
| `prompt-moderation-feedback.tsx` | Expandable feedback for changes requested / rejected |
| `prompt-moderation-page.tsx` | Admin queue (web only; requires `mode: 'community'` + `moderation: true`) |
| `types.ts` | `PromptLibraryPageProps`, `PromptLibraryCapabilities`, navigation, notifications |
| `utils.ts` | Badge mapping, tab helpers, query keys |
| `index.ts` | Barrel exports |

**UI primitives:** Use `@moat/ui` only inside shared components — never `~/components/ui/*` from web. This is required for desktop consumption.

**Data fetching:** React Query hooks inside `@moat/features`, using `useApiClient()` from `api-client-context.tsx`. Web provides cloud `MoatApiClient`; desktop provides a local IPC-backed client when `mode: 'private-only'`.

### `PromptLibraryCapabilities` — platform mode switch

Shared components **must** branch on a capability prop — never hard-code platform checks inside `@moat/features`.

```ts
type PromptLibraryMode = "community" | "private-only";

type PromptLibraryCapabilities = {
  /** Default: "community" (web, iOS). Desktop passes "private-only". */
  mode?: PromptLibraryMode;
  /** Admin moderation queue. Only when mode is "community". Web only in v1. */
  moderation?: boolean;
};
```

| `mode` | Passed by | Behavior |
|--------|-----------|----------|
| `"community"` | Web, iOS | Full feature: My library + Community tabs, submit for review, moderation badges, save to library, revision flow |
| `"private-only"` | Desktop | **Private saves only:** Curated + My library tabs; no Community tab; no "Submit to the community" option; no publish/share/moderation UI; badge shows **Private** only |

**When `mode: 'private-only'`, hide or disable:**

- Community tab and all community list/detail routes
- "Who is this prompt for?" visibility section — always save as private
- Primary button is always **Save private prompt** (never "Save and submit for review")
- Status badges: **Private** only (no In review, Published, Changes requested, Rejected)
- Submit, withdraw, revision-for-publication actions
- Save to my library (from community)
- Admin moderation page/route
- Moderation feedback sections

**When `mode: 'private-only'`, keep:**

- Curated by Moat tab (`@moat/ai-prompts` static catalog)
- My library tab (user's locally stored private prompts)
- `+` creation flow (Create with AI / Write manually)
- AI connection gate → AI Access
- Create, edit, delete private prompts
- Copy / launch curated prompts (existing behavior)

### Web shell — `apps/web/`

| File | Role |
|------|------|
| `apps/web/src/app/(dashboard)/prompts/page.tsx` | Thin wrapper: PostHog `onCapture`, sonner toasts, page view event |
| `apps/web/src/app/(dashboard)/admin/prompt-moderation/page.tsx` | Admin route shell; passes `capabilities={{ moderation: isAdmin }}` |
| `apps/web/src/components/common/prompts-button.tsx` | Keep embedded CTAs; unchanged for curated static prompts |
| `apps/web/src/lib/http-api-client.ts` | Add prompt API methods (or use regenerated `@moat/client-ts`) |

Web route stays `/prompts`. Pass `capabilities={{ mode: 'community' }}`. Admin moderation at `/admin/prompt-moderation`.

### Desktop shell — `apps/desktop/`

Desktop ships **private prompt creation only** — no publishing, sharing, or community library. Pass `capabilities={{ mode: 'private-only' }}` into the shared page.

| File | Role |
|------|------|
| `apps/desktop/src/renderer/src/pages/prompts/index.tsx` | **New** thin page; passes `mode: 'private-only'` |
| `apps/desktop/src/renderer/src/App.tsx` | Replace inline `PromptLibraryPage` render with `DesktopPromptsPage` |
| `apps/desktop/src/renderer/src/lib/ipc-api-client.ts` | Add **local** prompt IPC methods (not cloud community endpoints) |
| `apps/desktop/src/main/ipc/prompts.ts` | **New** IPC handlers for local prompt CRUD |
| `packages/db-sqlite/` | **New** `UserPrompt` tables for on-device private prompts |
| `apps/desktop/src/renderer/src/components/sidebar.tsx` | Prompts nav item unchanged |
| `apps/desktop/src/renderer/src/components/route-command-menu.tsx` | `/prompts` entry unchanged |

**Desktop adapter pattern:**

```tsx
// apps/desktop/src/renderer/src/pages/prompts/index.tsx (sketch)
<PromptLibraryPage
  capabilities={{ mode: "private-only" }}
  navigation={{
    openPrompt: (id) => nav.push(`/prompts?promptId=${encodeURIComponent(id)}`),
    closePrompt: () => nav.push("/prompts"),
    openAiAccess: () => nav.push("/mcp"),
  }}
  notifications={desktopInlineNoticeAdapter}
  onCapture={undefined}
/>
```

**Local storage (not cloud):** Desktop private prompts live in **local SQLite** via `packages/db-sqlite` — same local-first pattern as desktop AI Reports. Do **not** call cloud `prompt/submit`, `prompt/listCommunity`, or other community endpoints from desktop. The desktop `MoatApiClient` / IPC layer implements only:

- `listMyPrompts` (local)
- `getPrompt` (local)
- `createPrompt` (local, always private)
- `updatePrompt` (local)
- `deletePrompt` (local)
- `generateDraft` (optional — may call cloud Moat agent if online, or local-only builder)

**No admin moderation route on desktop.**

**AI connection gate on desktop:** Check local MCP connection via `agent.listTokens()`. Route "Connect an assistant" to `/mcp`.

**Analytics:** Wire `onCapture` when desktop analytics infra exists; shared components accept optional `onCapture`.

### iOS — `apps/ios/Moat/Features/Prompts/`

Native SwiftUI reimplementation — **do not** import or wrap React from `@moat/features`. Duplicate interactive experience and copy in Swift; reuse HTTP contracts only.

| File | Purpose |
|------|---------|
| `Models/prompt-models.swift` | Mirror API types; badge enums |
| `Services/prompts-service.swift` | Cloud API calls (same endpoints as web/desktop) |
| `ViewModels/prompts-view-model.swift` | Tab state, list/detail, create flow state machine |
| `ViewModels/prompt-create-view-model.swift` | AI builder + manual form |
| `Views/prompts-view.swift` | Root: tabs + navigation |
| `Views/prompt-library-tab-view.swift` | Curated (static JSON from bundled export or API) / My library / Community |
| `Views/prompt-detail-view.swift` | Detail + moderation feedback |
| `Views/prompt-create-choice-sheet.swift` | `+` bottom sheet |
| `Views/prompt-ai-connection-gate-sheet.swift` | Connect assistant interstitial |
| `Views/prompt-ai-builder-sheet.swift` | AI-assisted builder |
| `Views/prompt-manual-form-sheet.swift` | Manual form + visibility |
| `Views/prompt-status-badge.swift` | Status badge component |
| `Views/community-prompt-card.swift` | Community list card |

**Navigation:** Add Prompts to iOS tab bar or More menu (product decision — see Open Questions). Use `.sheet` / `.confirmationDialog` patterns from `Features/AIAccess/` and transaction sheets.

**Curated tab on iOS:** Bundle `@moat/ai-prompts` as JSON at build time **or** fetch static catalog from a lightweight API. Prefer build-time JSON export from `packages/ai-prompts` to avoid network for curated prompts (matches original Ask AI spec intent).

**AI connection gate:** Reuse `AIAccessConnectionStore` / `ai-access-service.swift` to detect MCP OAuth + PAT; route to `AIAccessView`.

### Shared contracts — `packages/contracts` + OpenAPI

| Asset | Location |
|-------|----------|
| TypeScript API types | `packages/contracts/src/prompt.ts` (new) |
| `MoatApiClient` methods | Extend `packages/contracts/src/api-client.ts` |
| OpenAPI paths | `packages/openapi/api-v1.yaml` |
| Generated client | `packages/client-ts` regeneration |
| Badge helpers (cross-platform logic) | `packages/shared/src/prompt-status.ts` or `packages/contracts` — consumed by web/desktop TS; Swift duplicates enum mapping in `prompt-models.swift` |

### Capabilities adapter (web vs desktop vs iOS)

| Capability | Web | Desktop | iOS |
|------------|-----|---------|-----|
| `capabilities.mode` | `"community"` | `"private-only"` | `"community"` |
| Create / edit private prompts | ✅ cloud | ✅ local SQLite | ✅ cloud |
| Submit / withdraw review | ✅ | ❌ hidden | ✅ |
| Browse community library | ✅ | ❌ hidden | ✅ |
| Save to my library (from community) | ✅ | ❌ hidden | ✅ |
| Admin moderation UI | ✅ (if admin) | ❌ | ❌ v1 |
| Analytics `onCapture` | ✅ PostHog | Optional | ✅ |
| AI Access deep link | `/ai-access` | `/mcp` | `AIAccessView` |
| Notifications | sonner toast | inline notice banner | SwiftUI alert / banner |
| Prompt storage | Postgres (cloud API) | SQLite (local IPC) | Postgres (cloud API) |

## Target Experience

### Library page structure

**Web and iOS** (`mode: 'community'`) — three tabs:

```text
┌─────────────────────────────────────────────────────────┐
│  Prompts                                    [ + ]       │
├─────────────────────────────────────────────────────────┤
│  [ Curated by Moat ] [ My library ] [ Community ]     │
├─────────────────────────────────────────────────────────┤
│  (tag chips + search)                                   │
└─────────────────────────────────────────────────────────┘
```

**Desktop** (`mode: 'private-only'`) — two tabs only:

```text
┌─────────────────────────────────────────────────────────┐
│  Prompts                                    [ + ]       │
├─────────────────────────────────────────────────────────┤
│  [ Curated by Moat ] [ My library ]                     │
├─────────────────────────────────────────────────────────┤
│  (tag chips + search)                                   │
└─────────────────────────────────────────────────────────┘
```

| Tab | Content source | Actions (community mode) | Actions (private-only / desktop) |
|-----|----------------|--------------------------|----------------------------------|
| **Curated by Moat** | `@moat/ai-prompts` (static) | Copy, launch AI | Copy, launch AI |
| **My library** | Cloud API (web/iOS) or local SQLite (desktop) | Open, edit, submit, use | Open, edit, delete, use |
| **Community** | Cloud API: approved public prompts | View, Save to my library | **Tab hidden** |

### Plus-button creation flow

**Trigger:** `+` button on Prompts page header (web, desktop, and iOS).

| Platform | Container | Implementation |
|----------|-----------|----------------|
| Web | `Dialog` / responsive `Sheet` | `prompt-create-choice-dialog.tsx` in `@moat/features` |
| Desktop | Same shared `Dialog` | Same component via `DesktopPromptsPage` — no desktop fork |
| iOS | Native bottom sheet | `prompt-create-choice-sheet.swift` |

**Screen 1 — Choose creation mode:**

| Option | Label | Supporting copy |
|--------|-------|-----------------|
| Primary A | **Create with AI** | "Describe what you want, and your connected AI assistant will help build the prompt." |
| Primary B | **Write manually** | "Write the prompt yourself, choose a category, and decide whether to keep it private or submit it to the community." |

Use exact label **Write manually** — not "Write manual."

### AI connection gate

When user selects **Create with AI**, check MCP connection status (OAuth and/or PAT).

**Connected →** Continue to AI-assisted builder.

**Not connected →** Interstitial sheet/modal:

| Element | Copy |
|---------|------|
| Title | Connect an AI assistant first |
| Body | To build prompts with AI, connect an assistant to Moat. You can still write and save prompts manually without connecting one. |
| Primary action | Connect an assistant → route to AI Access |
| Secondary action | Write manually instead → manual form |

**Platform routing for "Connect an assistant":**

| Platform | Destination |
|----------|-------------|
| Web | `/ai-access` |
| Desktop | `/mcp` (AI Access page) |
| iOS | `AIAccessView` (push or sheet from More / settings) |

Do not silently redirect. Prefer consumer term **AI assistant** over "AI provider."

### AI-assisted prompt builder

Stay inside Moat. First input:

> **What should this prompt help you accomplish?**

Optional follow-ups (single screen or stepped — implementer choice, keep ≤ 2 steps):

- Which financial data should the prompt use?
- What should the response include?
- One-time analysis or reusable workflow?
- Insights only, or may the assistant request actions?
- Additional constraints or context

**Generate** (via connected assistant or Moat agent) produces editable draft:

- Title
- Short description
- Prompt body
- Suggested category
- Suggested tags
- Suggested required connections
- Suggested financial-data scopes

User **must review and edit** before saving. **Never auto-submit** AI-generated prompts to the community.

### Manual creation form

| Field | Required | Notes |
|-------|----------|-------|
| Title | ✅ | Reuse text field components |
| Prompt body | ✅ | Multiline; map to `body` |
| Category | ✅ | Select from `PromptCategory` table |
| Short description | — | |
| Tags | — | Multi-select; validate against allowed tags or free-form with limits |
| Required connections | — | MCP scope / connection picker if existing selector exists |
| Required financial-data scopes | — | Reuse MCP scope catalog where possible |
| Example / expected output | — | Only if model supports |
| Suggested frequency | — | Only if scheduled/reusable prompts exist |

### Visibility selection — "Who is this prompt for?"

**Only shown when `capabilities.mode === 'community'`** (web and iOS). Desktop skips this section entirely — all saves are private.

Do **not** use a vague "Publish for review" checkbox.

| Option | Label | Supporting copy | Primary button |
|--------|-------|-----------------|----------------|
| 1 | **Just me** | Save it privately in your library. | **Save private prompt** |
| 2 | **Submit to the community** | Send it for review. It will remain available privately while it is reviewed. | **Save and submit for review** |

When `mode: 'private-only'`, show only a single **Save private prompt** button with no visibility chooser.

### Personal library status badges

**When `mode: 'community'`** — display on cards and detail views for creator-owned cloud prompts:

| Badge | When |
|-------|------|
| **Private** | `visibility=PRIVATE`, `reviewStatus=NOT_SUBMITTED` |
| **In review** | `reviewStatus=PENDING` |
| **Changes requested** | `reviewStatus=CHANGES_REQUESTED` |
| **Published** | `visibility=PUBLIC`, approved |
| **Rejected** | `reviewStatus=REJECTED` |

**When `mode: 'private-only'` (desktop)** — all user prompts are private. Show **Private** badge only, or omit badges entirely (product choice — default: no badge needed since everything is private).

**Community-mode rules:**

- Never show a submitted prompt as only "Private."
- Creator can open and **use** prompts while `PENDING`.
- Changes requested / rejected: moderation feedback prominently accessible (banner or expandable section on detail).

### Submission confirmation

After successful community submission:

| Element | Copy |
|---------|------|
| Title | Submitted for review |
| Body | You can continue using and editing this prompt privately. We'll let you know when it is approved or if changes are needed. |

### Edit-during-review warning

When creator saves edits to a `PENDING` prompt:

> **Editing this prompt will remove it from review.** You can submit the updated version again when you are ready.

Require confirmation (alert dialog on web/desktop via `@moat/ui` AlertDialog, `.confirmationDialog` on iOS) before persisting.

**Behavior:** Invalidate active submission → `reviewStatus=NOT_SUBMITTED`; preserve moderation history.

### Public community library

Only **approved** revisions appear in Community tab and public list endpoints.

**Public prompt card / detail shows:**

- Title, description, category, tags
- Creator attribution (display name policy — see Open Questions)
- **Reviewed by Moat** badge
- Published or last-updated date
- Required connections / data scopes
- Usage or save count (if analytics support exists)
- **Save to my library** action (not "Fork")

**Save to my library:** Creates a **new private `UserPrompt`** copy owned by the current user, with `sourcePromptId` / `sourceRevisionId` provenance. User edits their copy without affecting the community version.

### Creator revision flow (published prompts)

When creator edits a **published** prompt:

1. Public approved revision **stays live**.
2. Edits stored as **private draft revision** (new `PromptRevision` row).
3. Creator continues editing draft.
4. Creator submits draft revision for review.
5. On approval, public revision replaced **atomically**.
6. Rejected revision does **not** affect live public version.

### Admin moderation interface

Administrator-only route on **web only** (shared `prompt-moderation-page.tsx` in `@moat/features`). Not available on desktop (`mode: 'private-only'`) or iOS in v1.

| Platform | Route / entry |
|----------|---------------|
| Web | `/admin/prompt-moderation` |
| Desktop | **Not available** — no community prompts on desktop |
| iOS | Not in v1 |

Gated by `ADMIN_USER_IDS` server-side **and** `capabilities.moderation === true` (requires `mode: 'community'`).

**Tabs / filters:** Pending | Changes requested | Approved | Rejected | Unpublished

**Each queue item shows:**

- Creator (user ID + display name)
- Prompt metadata (title, description, category, tags)
- Full prompt body
- Diff vs current approved revision (for revision submissions)
- Required connections, financial-data scopes
- Submission date
- Prior moderation history (timeline)
- Similar / duplicate hints (keyword search against public library — best effort)

**Moderation actions:**

| Action | Effect |
|--------|--------|
| **Approve** | Set revision approved; publish; `visibility=PUBLIC`; record reviewer + timestamp; notify creator; atomically swap public revision if applicable |
| **Request changes** | Require feedback; `CHANGES_REQUESTED`; keep private; notify creator |
| **Reject** | Require reason; `REJECTED`; keep private; notify creator |
| **Unpublish** | Remove from public library; preserve history + last approved revision; record admin + reason; notify creator |

**Safety signals (admin hints, not auto-block):**

- Guaranteed financial results language
- Regulated advice stated as certainty
- Illegal / deceptive / high-risk behavior
- Unnecessary financial-data access
- Account numbers / highly sensitive info requests
- Prompt-injection / instruction-override language
- Actions without user confirmation
- Near-duplicate of existing public prompt

Implement as server-side flags (keyword heuristics + optional metadata). Administrator is final decision-maker.

## Architecture / Data Model

### Design principles

1. **Separate visibility from review status** — pending review is not a visibility state.
2. **Public prompt always points to an approved revision** — never expose draft/pending content publicly.
3. **Extend, don't replace** — static `@moat/ai-prompts` remains the curated catalog.
4. **Future visibility types** — enum extensible to `HOUSEHOLD`, `TEAM`, `UNLISTED` without rewrite.
5. **Server-side authorization** — all writes and moderation gated in `apps/api`.

### Enums (Prisma naming — SCREAMING_SNAKE)

```prisma
enum PromptVisibility {
  PRIVATE
  PUBLIC
  // future: HOUSEHOLD, TEAM, UNLISTED
}

enum PromptReviewStatus {
  NOT_SUBMITTED
  PENDING
  CHANGES_REQUESTED
  APPROVED
  REJECTED
}

enum PromptModerationAction {
  SUBMITTED
  WITHDRAWN
  APPROVED
  CHANGES_REQUESTED
  REJECTED
  UNPUBLISHED
}
```

### Core models (sketch)

```prisma
model PromptCategory {
  id          String   @id @default(cuid())
  slug        String   @unique   // maps to AiPromptTag values initially
  label       String
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  prompts     UserPrompt[]
  revisions   PromptRevision[]
}

model UserPrompt {
  id                    String              @id @default(cuid())
  creatorId             String
  title                 String
  description           String?
  body                  String              @db.Text
  categoryId            String
  tags                  String[]            // or PromptTag join table if normalization preferred
  visibility            PromptVisibility    @default(PRIVATE)
  reviewStatus          PromptReviewStatus  @default(NOT_SUBMITTED)
  moderationFeedback    String?             @db.Text
  rejectionReason       String?             @db.Text
  submittedAt           DateTime?
  reviewedAt            DateTime?
  reviewedById          String?
  publishedAt           DateTime?
  requiredConnections   String[]            @default([])
  requiredDataScopes    String[]            @default([])
  // Provenance when saved from community
  sourcePromptId        String?
  sourceRevisionId      String?
  sourceCommunityPromptId String?           // self-FK to original community prompt
  publishedRevisionId   String?             @unique
  deletedAt             DateTime?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  creator               User                @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  category              PromptCategory      @relation(fields: [categoryId], references: [id])
  publishedRevision     PromptRevision?     @relation("PublishedRevision", fields: [publishedRevisionId], references: [id])
  revisions             PromptRevision[]    @relation("PromptRevisions")
  moderationHistory     PromptModerationEvent[]

  @@index([creatorId])
  @@index([visibility, reviewStatus])
  @@index([categoryId])
  @@index([submittedAt])
  @@index([publishedAt])
  @@index([creatorId, deletedAt])
}

model PromptRevision {
  id                  String             @id @default(cuid())
  promptId            String
  version             Int
  title               String
  description         String?
  body                String             @db.Text
  categoryId          String
  tags                String[]
  reviewStatus        PromptReviewStatus @default(NOT_SUBMITTED)
  moderationFeedback  String?            @db.Text
  rejectionReason     String?            @db.Text
  submittedAt         DateTime?
  reviewedAt          DateTime?
  reviewedById        String?
  requiredConnections String[]           @default([])
  requiredDataScopes  String[]           @default([])
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  prompt              UserPrompt         @relation("PromptRevisions", fields: [promptId], references: [id], onDelete: Cascade)
  category            PromptCategory     @relation(fields: [categoryId], references: [id])
  publishedFor        UserPrompt?        @relation("PublishedRevision")

  @@unique([promptId, version])
  @@index([promptId, reviewStatus])
  @@index([submittedAt])
}

model PromptModerationEvent {
  id            String                 @id @default(cuid())
  promptId      String
  revisionId    String?
  actorId       String                 // admin or creator for submit/withdraw
  action        PromptModerationAction
  feedback      String?                @db.Text
  reason        String?                @db.Text
  metadata      Json?                  // safety flags, duplicate hints
  createdAt     DateTime               @default(now())

  prompt        UserPrompt             @relation(fields: [promptId], references: [id], onDelete: Cascade)

  @@index([promptId, createdAt])
  @@index([action])
}
```

Add a **desktop-local** SQLite model (separate from cloud Postgres) for private prompts:

```prisma
// packages/db-sqlite — desktop only, simplified
model LocalUserPrompt {
  id          String   @id @default(cuid())
  title       String
  description String?
  body        String
  categorySlug String
  tags        String   // JSON array
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Cloud Postgres models (`UserPrompt`, `PromptRevision`, etc.) remain unchanged for web/iOS community flows. Desktop does not sync local prompts to cloud in v1.

| Static | DB |
|--------|-----|
| `id` | Not used for user prompts — use cuid; static IDs remain in package |
| `prompt` | `body` |
| `tags` | `tags[]` or join table |
| `surfaces` | Not stored on user prompts (curated-only) |

### Revision and publication rules

| Prompt state | Creator edits | Result |
|--------------|---------------|--------|
| Private, not submitted | Direct update on `UserPrompt` | No revision row |
| Pending review | Edit after confirm | Withdraw: `NOT_SUBMITTED`, clear `submittedAt`, history preserved |
| Published (has `publishedRevisionId`) | Edit | Create/update draft `PromptRevision` (private, `NOT_SUBMITTED`) |
| Published + draft exists | Edit | Update draft revision only |
| Draft revision | Submit | Draft → `PENDING`; public unchanged |
| Pending revision | Approve (admin) | Transaction: approve revision, set `publishedRevisionId`, update prompt fields, `visibility=PUBLIC`, `publishedAt` |
| Pending revision | Reject | Draft stays rejected; public unchanged |

**First-time publication:** Treat initial submit as revision `version=1` OR store content on `UserPrompt` until approved — implementer should pick one path and use it consistently. Recommended: **always use `PromptRevision`** for anything entering moderation so admin queue is uniform.

### Status transition matrix (server-enforced)

| From | Action | To | Valid? |
|------|--------|-----|--------|
| `NOT_SUBMITTED` | submit | `PENDING` | ✅ creator |
| `PENDING` | withdraw (explicit) | `NOT_SUBMITTED` | ✅ creator |
| `PENDING` | edit (confirmed) | `NOT_SUBMITTED` | ✅ creator |
| `PENDING` | approve | `APPROVED` + public | ✅ admin |
| `PENDING` | request changes | `CHANGES_REQUESTED` | ✅ admin + feedback |
| `PENDING` | reject | `REJECTED` | ✅ admin + reason |
| `CHANGES_REQUESTED` | resubmit | `PENDING` | ✅ creator |
| `REJECTED` | edit + resubmit | `PENDING` | ✅ creator |
| `APPROVED` (public) | unpublish | `PRIVATE` + unpublished flag | ✅ admin |
| Any | direct publish without approve | — | ❌ |
| Any | approve withdrawn | — | ❌ |
| Any | edit another user's prompt | — | ❌ |

### API endpoints

Follow existing REST convention: `/api/v1/prompt/[action]` via handler registry.

| Action | Auth | Description |
|--------|------|-------------|
| `create` | `withAuth` | Create private prompt |
| `generateDraft` | `withAuth` | AI-assisted draft (returns editable fields, does not persist) |
| `update` | `withAuth` | Update private prompt or draft revision; handles pending-withdraw logic |
| `submit` | `withAuth` | Submit prompt or revision for review |
| `withdraw` | `withAuth` | Withdraw pending submission |
| `createRevision` | `withAuth` | Start draft revision for published prompt |
| `listMine` | `withDemoOrAuth` | User's library (excludes deleted) |
| `get` | `withDemoOrAuth` | Prompt detail + review status + draft revision if any |
| `delete` | `withAuth` | Soft-delete private unpublished prompt (creator only) |
| `listCommunity` | `withDemoOrAuth` or `withPublic` | Approved public prompts only |
| `getCommunity` | `withDemoOrAuth` or `withPublic` | Public prompt detail (approved revision only) |
| `saveToLibrary` | `withAuth` | Copy community prompt to user's private library |
| `listModeration` | admin | Moderation queue with filters |
| `getModeration` | admin | Single submission + history + diff |
| `approve` | admin | Approve submission |
| `requestChanges` | admin | Request changes + feedback |
| `reject` | admin | Reject + reason |
| `unpublish` | admin | Remove from public library |
| `getModerationHistory` | admin or creator | History for a prompt |

**OpenAPI:** Add paths to `packages/openapi/api-v1.yaml`; regenerate `packages/client-ts`.

**Validation (Zod in handlers):**

| Field | Limit |
|-------|-------|
| Title | 1–120 chars |
| Description | 0–500 chars |
| Body | 1–10,000 chars (adjust to match deep-link constraints if launches still supported) |
| Tags | max 10, each max 32 chars |
| Category | must exist and `isActive` |

### Shared types package

Extend `packages/contracts` (preferred over a new package):

- `PromptVisibility`, `PromptReviewStatus`, `UserPromptSummary`, `CommunityPromptSummary`, etc.
- API request/response types
- Extend `MoatApiClient` with prompt methods (web `http-api-client.ts` + desktop `ipc-api-client.ts` both implement)

Add `packages/shared/src/prompt-status.ts` (or keep in contracts):

- Badge label mapping helpers (`getPromptStatusBadge()`) — shared by web/desktop TS; Swift duplicates in `prompt-models.swift`

Extend `@moat/ai-prompts` only for static catalog — do not merge DB types into that package.

Optionally add `packages/ai-prompts/export-json.ts` build script for iOS bundled curated catalog.

### Database migration strategy

1. Add new tables + enums via committed migration (`pnpm db:migrate:dev`).
2. Seed `PromptCategory` from existing `AiPromptTag` union.
3. **Do not migrate** static `@moat/ai-prompts` into DB — keep dual source (curated static + community API).
4. No backfill needed for user prompts (greenfield). Existing static prompts unchanged.

### Approval transaction (atomic)

Within a single Prisma transaction:

1. Mark submitted revision `APPROVED`, set `reviewedAt`, `reviewedById`.
2. Set `UserPrompt.publishedRevisionId` to revision id.
3. Copy revision fields to `UserPrompt` headline fields (title, body, etc.) for list queries.
4. Set `UserPrompt.visibility = PUBLIC`, `reviewStatus = APPROVED`, `publishedAt`.
5. Supersede prior approved revision (if any) — keep row, no longer referenced as published.
6. Insert `PromptModerationEvent`.
7. Enqueue creator notification.

### Notifications

Notify creator on: approved, changes requested, rejected, revision approved, unpublished.

| Channel | V1 |
|---------|-----|
| In-app | New `UserNotification` model (recommended) with `deepLink: /prompts?promptId=` |
| Email | Optional follow-up using existing email infra |
| Toast | On next visit if notification already seen |

Deep-link targets prompt detail with moderation feedback expanded when applicable.

### Analytics events (new)

All events include `{ userId?: string, demoUser?: boolean }` — never both. Never include prompt body.

| Event | When |
|-------|------|
| `prompt_creation_sheet_opened` | `+` tapped |
| `prompt_create_with_ai_selected` | Create with AI chosen |
| `prompt_write_manually_selected` | Write manually chosen |
| `prompt_ai_connection_gate_shown` | Gate displayed |
| `prompt_ai_connection_flow_opened` | Routed to AI Access |
| `prompt_ai_draft_generated` | Draft returned |
| `prompt_private_saved` | Private save success |
| `prompt_submitted_for_review` | Community submit success |
| `prompt_submission_withdrawn_by_edit` | Edit withdrew pending |
| `prompt_community_approved` | Creator notified / status → approved |
| `prompt_changes_requested` | Moderation outcome |
| `prompt_rejected` | Moderation outcome |
| `prompt_community_saved_to_library` | Save to my library |
| `prompt_revision_submitted` | Published prompt revision submitted |
| `prompt_revision_approved` | Revision went live |

Update `docs/security/analytics-events.md`.

## Implementation Plan

### Phase 1 — Repository audit & schema ✅ (this spec)

Document existing state; define data model, API surface, UX copy, acceptance criteria, and **three-platform delivery model**.

### Phase 2 — API, contracts & data layer

1. Prisma models + migration + category seed.
2. `prompt.service.ts` — business logic, transitions, ownership checks.
3. `handlers/prompt.ts` — Zod validation, wrapper auth.
4. OpenAPI paths + `packages/contracts` types + `MoatApiClient` methods.
5. Regenerate `packages/client-ts`.
6. Unit + integration tests: full moderation lifecycle.

**Acceptance criteria:** All API acceptance scenarios pass; unauthorized access returns 403/404.

### Phase 3 — Shared React package (`@moat/features`)

Build **all** web + desktop UI in `packages/features/src/prompts/`:

1. Extend `PromptLibraryPage` with tabs (Curated / My library / Community).
2. Extract `PromptsPageHeader` with `+` button.
3. Creation flow components (choice → gate → AI builder / manual form).
4. Status badges, detail page, moderation feedback, community save.
5. `prompt-moderation-page.tsx` for admin queue.
6. React Query hooks wired through `useApiClient()`.
7. Component tests in `packages/features` (RTL).

**Acceptance criteria:** Shared page renders in Storybook or test harness with mock `MoatApiClient`; no web/desktop-specific imports inside feature module.

### Phase 4 — Web & desktop shells (together)

Ship both platforms from the same shared components; **different capability modes**.

**Web:**
1. Update `apps/web/src/app/(dashboard)/prompts/page.tsx` — pass `capabilities={{ mode: 'community' }}`, PostHog, sonner.
2. Add `apps/web/src/app/(dashboard)/admin/prompt-moderation/page.tsx`.
3. Extend `http-api-client.ts` with cloud prompt API methods.
4. Playwright smoke tests for community flows.

**Desktop:**
1. Create `apps/desktop/src/renderer/src/pages/prompts/index.tsx` — pass `capabilities={{ mode: 'private-only' }}`.
2. Update `App.tsx` to use `DesktopPromptsPage`.
3. Add local SQLite schema + IPC handlers for private prompts.
4. Extend `ipc-api-client.ts` with local prompt CRUD (not cloud community endpoints).
5. Wire inline notice adapter; verify AI gate routes to `/mcp`.

**Acceptance criteria:**
- Web: full community flows (create, submit, browse, save, revisions, moderation).
- Desktop: curated browse + create/edit/delete **private** prompts only; no Community tab; no submit/publish UI.

### Phase 5 — iOS native UI

1. Create `apps/ios/Moat/Features/Prompts/` module (Models / Services / ViewModels / Views).
2. Add navigation entry (tab or More menu).
3. Bundle curated prompts JSON from `@moat/ai-prompts` export.
4. Implement all sheets: create choice, AI gate, AI builder, manual form.
5. Status badges, moderation feedback, save-to-library.
6. AI connection gate → `AIAccessView`.
7. XCTest for view models and service layer.

**Acceptance criteria:** iOS parity with **web community flows** (not desktop private-only mode).

### Phase 6 — Polish & documentation

1. Update `docs/security/analytics-events.md`.
2. Implementation summary (architecture, migrations, endpoints, screens per platform, tests).
3. Local setup notes (desktop: for private prompts; web/iOS: cloud API).

## Acceptance Criteria

### Web & iOS (community mode)

- [ ] User can create and save a private prompt (manual or AI-assisted).
- [ ] User can submit a prompt for community review.
- [ ] Submitted prompt remains usable in creator's My library while pending.
- [ ] Creator sees **In review** badge (not only Private).
- [ ] Administrator can approve, request changes, or reject from moderation queue (web).
- [ ] Only approved prompts appear in Community tab / public list API.
- [ ] Moderation feedback visible to creator on detail view.
- [ ] User can save an approved community prompt to My library.
- [ ] Saved copy is privately owned and independently editable.
- [ ] Editing a pending prompt withdraws review after confirmation; requires resubmit.
- [ ] Editing a published prompt creates a private draft revision; public version stays live.
- [ ] Public version replaced only after revision approval.

### Desktop (private-only mode)

- [ ] Desktop passes `capabilities={{ mode: 'private-only' }}` — no Community tab, no publish/share UI.
- [ ] User can create, edit, and delete **private** prompts stored in local SQLite.
- [ ] Creation form shows **Save private prompt** only (no visibility selection).
- [ ] Curated by Moat tab unchanged (static `@moat/ai-prompts`).
- [ ] No cloud community API calls from desktop.

### All platforms

- [ ] Shared `@moat/features` components branch on `capabilities.mode` — no platform forks in feature module.
- [ ] All cloud authorization enforced server-side (`withAuth` / admin checks).
- [ ] All moderation actions create `PromptModerationEvent` records (cloud only).
- [ ] Existing curated `@moat/ai-prompts` behavior remains intact.

## Testing Requirements

### Unit tests (API service layer)

- Status transition rules
- Visibility rules
- Revision publication logic
- Ownership checks
- Admin permission checks
- Validation schemas
- Badge mapping helpers
- Community copy (`saveToLibrary`) creates independent private prompt

### API integration tests

- Create private prompt
- Submit for review
- Edit pending → withdraw
- Approve first publication
- Request changes / reject
- Create revision of published prompt
- Approve revision without exposing draft early
- Unauthorized moderation / edit attempts
- Save public prompt to library
- Access non-public prompt as non-owner → 404

### UI tests

**Shared (`packages/features`):**
- Plus-button choice dialog
- AI connection gate
- Manual creation + visibility selection
- Submission confirmation
- Personal library badges
- Moderation feedback display
- Public save-to-library
- Published revision flow

**Web:** Playwright smoke on `/prompts` and `/admin/prompt-moderation`.

**Desktop:** Verify `mode: 'private-only'` hides community UI; local create/edit/delete works.

**iOS:** XCTest for view models; UI tests for create choice sheet, manual form, status badges.

Use existing frameworks: Jest (API), React Testing Library (shared features), Playwright (web), XCTest (iOS).

## Non-Goals

- Replacing or migrating static `@moat/ai-prompts` curated catalog to the database.
- Building a complex automated safety classifier (heuristics + admin review only).
- **Duplicating React prompt UI in `apps/web` or `apps/desktop`** — all shared UI lives in `@moat/features`.
- **Community / publish / share flows on desktop** — desktop is `private-only` via capabilities.
- **Wrapping React/`@moat/features` on iOS** — iOS is native SwiftUI only.
- iOS admin moderation UI in v1 (web only).
- Cloud community prompt storage on desktop (local SQLite for private prompts only).
- Grok / provider-specific deep-link routing (Phase 3 Ask AI — separate track).
- Household / team visibility (enum reserved, not implemented).
- Public browse without authentication (can defer — currently all behind dashboard auth).
- Prompt usage analytics beyond the global launch-count feature (PostHog-only events remain separate).
- Merging community-approved prompts back into `@moat/ai-prompts` npm package automatically (manual curation PR remains an option).

## Launch counts

- Global `launchCount` per `(source, promptId)` — Copy and Open in ChatGPT/Claude increment; opening detail does not.
- Backend silently enforces **one counted launch per user per UTC day** (`PromptLaunchDaily`); the UI does not expose the quota.
- Library sort: pins first (most recently pinned first), then unpinned by `launchCount` desc.
- Web/iOS share cloud counts; desktop stores device-local counts in SQLite (mirrors local-only pins).

## Open Questions

1. **Creator attribution display name** — Use Moat account name, first name only, or anonymous username for public prompts?
2. **In-app notifications** — Introduce `UserNotification` model vs email-only vs polling on library visit?
3. **Tag model** — Postgres `String[]` vs normalized `PromptTag` join table (start with array for speed; migrate if search suffers)?
4. **First-time submit storage** — Content on `UserPrompt` until first approval vs always creating `PromptRevision` v1 (spec recommends latter)?
5. **Community browse auth** — Require login for Community tab or allow `withPublic` read?
6. **Unpublish policy** — Can creator revise and resubmit after admin unpublish, or permanent ban on that prompt id?
7. **AI draft generator** — Moat in-app agent vs external MCP-connected assistant for generation (Moat agent preferred for consistency)?
8. **Duplicate detection scope** — Title fuzzy match only, or body similarity (v1: title + tag overlap)?
9. **iOS navigation placement** — Tab bar item vs More menu entry for Prompts?
10. **Curated tab on iOS** — Build-time JSON bundle from `@moat/ai-prompts` vs API fetch?

## Related Specs

- [specs/complete/ask-ai/spec.md](../../complete/ask-ai/spec.md) — Phase 1–3 Ask AI foundation (static library, embedded CTAs, agent connection)
- [specs/complete/ask-ai/roadmap.md](../../complete/ask-ai/roadmap.md) — Prompt contributions listed in backlog
- [specs/complete/desktop-ai-reports/spec.md](../../complete/desktop-ai-reports/spec.md) — Shared page pattern for API-backed features
- [specs/features/ios-agent-access/spec.md](../ios-agent-access/spec.md) — AI Access / MCP connection (AI gate destination)
- [docs/patterns/api-patterns.md](../../docs/patterns/api-patterns.md) — Handler + service conventions
- [docs/patterns/auth-permissions.md](../../docs/patterns/auth-permissions.md) — Server-side authorization
- [docs/security/analytics-events.md](../../docs/security/analytics-events.md) — Event catalog

## Suggested Commit Message

```text
docs: updates community prompt library spec for web desktop ios
```
