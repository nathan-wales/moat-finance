# iOS AI Access

## Status

Implemented. Created July 12, 2026 after reviewing the web AI Access page, desktop MCP page, shared `@moat/features/mcp` scope helpers, cloud MCP API handlers, and the iOS More menu / feature-module patterns.

Updated July 12, 2026 to lock scope: UI-only parity against the existing shared cloud API — no API or database work.

Updated July 12, 2026 to include the global “Connect your personal AI assistant” top banner (current desktop shell CTA) until the user has MCP access connected.

Updated July 12, 2026 — native SwiftUI AI Access screen, More navigation, and connect banner shipped under `apps/ios/Moat/Features/AIAccess/`.

## Goal

Add a native SwiftUI **AI Access** screen to the iOS app that duplicates the web app’s AI Access experience (internally the MCP settings page), with one-to-one feature and wording parity — plus the existing connect-assistant top banner CTA so unconnected users are prompted until they set up access.

**This is a UI-only feature.** Web and iOS are both clients of the same cloud app — they share `apps/api` and the same Postgres database. The MCP list / create / revoke / disconnect / logs endpoints already exist and already power the web page. iOS should call those same endpoints; do not add handlers, services, schema, migrations, or OpenAPI changes.

This is an intentional **native SwiftUI reimplementation** of the web UI. Do not import, wrap, or reuse any React UI from `packages/features` or the web/desktop renderers. Duplicate the interactive experience and copy in Swift; reuse the existing HTTP contracts as-is.

Success means:

- iOS users can open **AI Access** from the **More** tab and manage the same cloud MCP settings surface as web.
- OAuth connections, personal access tokens, and MCP logs match web section titles, helper text, empty states, status labels, and actions.
- Create / revoke / disconnect / filter / load-more / log-details flows call the **existing** `/api/v1/mcp/*` endpoints — zero backend changes.
- A small top banner prompts unconnected users to connect a personal AI assistant, with a CTA into AI Access, and disappears once they have at least one cloud MCP connection (OAuth and/or PAT).
- The implementation follows existing iOS feature-module conventions (`Models` / `Services` / `ViewModels` / `Views`) and never reuses shared React UI packages.

## Product Context

Moat Finance is the financial context layer for personal AI agents. AI Access is how users authorize and audit those agents: hosted OAuth clients (ChatGPT, Claude, etc.), scoped personal access tokens for local/stdio MCP clients, and an activity log of tool calls.

On web, that surface is titled **AI Access** and is effectively the MCP settings page. Behind the scenes it is only UI over the cloud MCP API. Desktop has a separate local-gateway AI Access page that is **not** the shared cloud model.

iOS is another cloud UI client of the same API/database as web. It currently has no AI Access / MCP settings entry, so mobile users cannot review connections, mint tokens, or inspect agent activity from their phone — even though the API already supports all of that for their account.

Adding AI Access under **More** closes that gap by giving iOS the same interactive MCP settings experience as web, without touching the API. The connect-assistant banner brings the same “you haven’t set this up yet” prompt that desktop already shows in its shell.

## Current Repo Context

### Canonical cloud UX (web) — source of truth for AI Access page parity

Primary files:

| Asset | Location |
|-------|----------|
| Page shell | `apps/web/src/app/(dashboard)/ai-access/page.tsx` |
| Tab / page composition | `apps/web/src/app/(dashboard)/settings/ai-access/index.tsx` |
| OAuth card | `apps/web/src/app/(dashboard)/settings/ai-access/oauth-connections-card.tsx` |
| PAT card + create dialog | `apps/web/src/app/(dashboard)/settings/ai-access/personal-access-tokens-card.tsx` |
| Logs card | `apps/web/src/app/(dashboard)/settings/ai-access/mcp-logs-card.tsx` |
| Log details dialog | `apps/web/src/app/(dashboard)/settings/ai-access/mcp-log-details-dialog.tsx` |
| HTTP client + types | `apps/web/src/lib/api/mcp.ts` |
| Sidebar label | `apps/web/src/components/layout/sidebar.tsx` (`AI Access`) |

Web page structure:

```text
AI Access
Manage and monitor your MCP connections with your personal AI assistants.

[ OAuth connections ] [ Personal access tokens ]
[ MCP logs — full width ]
```

### Connect-agent top banner — current source of truth (desktop shell)

Web does **not** currently show a global connect-assistant banner. Desktop does, in the app shell above the main content:

Primary file: `apps/desktop/src/renderer/src/App.tsx`

Current desktop behavior:

- On launch, call `agent.listTokens()`; set `hasMcpConnection = tokens.length > 0`.
- While `hasMcpConnection === false`, render a full-width blue top banner.
- CTA navigates to the AI Access (`mcp`) page.
- When the MCP page creates/revokes tokens, `onTokenStateChange` updates the shell flag so the banner hides once a token exists.

**Exact desktop copy to port:**

| Element | Text |
|---------|------|
| Title | `Connect your personal AI assistant` |
| Supporting line | `Unlock AI-powered insights by connecting Moat to Claude Desktop or Cursor.` |
| CTA button | `Connect` |

iOS should bring this banner into the app shell until the user has cloud MCP access connected. Visibility uses the **same existing list APIs** already required by AI Access (no new endpoints).

### Desktop AI Access page — related but not the iOS data model

Primary files:

- `apps/desktop/src/renderer/src/pages/mcp/index.tsx`
- `apps/desktop/src/renderer/src/pages/mcp/local-gateway-card.tsx`
- `apps/desktop/src/renderer/src/pages/mcp/agent-tokens-card.tsx`
- `apps/desktop/src/renderer/src/pages/mcp/setup-instructions-card.tsx`
- `apps/desktop/src/renderer/src/pages/mcp/mcp-logs-card.tsx`

Desktop differs intentionally:

| Concern | Web (cloud) | Desktop (local) |
|---------|-------------|-----------------|
| Title | AI Access | AI Access |
| Subtitle | Manage and monitor your MCP connections with your personal AI assistants. | Manage local agent access, scoped tokens, and MCP activity. |
| Top-left card | OAuth connections | Local gateway |
| Top-right card | Personal access tokens | Agent tokens |
| Extra card | — | Connect your personal AI assistant (setup / `mcp.json`) |
| Logs | Cloud MCP logs API | Local JSONL audit log via IPC |
| Data source | `apps/api` MCP handlers | Electron agent gateway IPC |

**iOS v1 mirrors web/cloud**, not desktop local gateway. iOS authenticates to `apps/api` the same way web does; it does not host a localhost MCP server.

### Shared cloud backend — already complete

Web and iOS share one cloud application stack:

```text
apps/web  ──┐
            ├──►  apps/api  (/api/v1/mcp/*)  ──►  Postgres
apps/ios  ──┘
```

The web AI Access page already exercises the full MCP settings contract via `apps/web/src/lib/api/mcp.ts`. Those handlers in `apps/api/src/server/handlers/mcp.ts` are production-ready for iOS:

- List / create / revoke personal access tokens
- List / disconnect OAuth client connections
- List MCP logs with cursor paging and filters

**Implementation rule:** if a screen needs data or a mutation, find the matching call in `apps/web/src/lib/api/mcp.ts` and mirror it from `AIAccessService` on iOS. If something appears missing, treat that as a bug in discovery — not a reason to extend the API for this feature.

### Shared package note

`packages/features/src/mcp/` only exports scope-selection helpers:

- `McpScopeSelector`
- `McpScopePresetSelect`
- `useMcpScopeSelection`

There is no shared full-page AI Access React component used by both web and desktop. Scope labels / presets come from `packages/mcp-contracts/src/scopes.ts`. iOS should **duplicate** those scope strings and labels in Swift constants rather than depending on the JS package.

### Cloud MCP APIs (call as-is — no API work)

All handlers already live in `apps/api/src/server/handlers/mcp.ts`, are `withAuth`, and already back the web AI Access page. iOS only needs a thin service wrapper around these same paths:

| Action | Endpoint | Web client helper |
|--------|----------|-------------------|
| List PATs | `GET /api/v1/mcp/listPersonalAccessTokens` | `listMcpPersonalAccessTokens()` |
| Create PAT | `POST /api/v1/mcp/createPersonalAccessToken` | `createMcpPersonalAccessToken()` |
| Revoke PAT | `POST /api/v1/mcp/revokePersonalAccessToken` | `revokeMcpPersonalAccessToken()` |
| List OAuth connections | `GET /api/v1/mcp/listOAuthConnections` | `listMcpOAuthConnections()` |
| Disconnect OAuth | `POST /api/v1/mcp/revokeOAuthConnection` | `revokeMcpOAuthConnection()` |
| List MCP logs | `GET /api/v1/mcp/listMcpLogs` (cursor, limit, status, authType, clientName, search) | `listMcpLogs()` |

OAuth consent approve/deny stays on web (`/mcp` consent page). iOS does not host consent UI in v1, and does not need new consent APIs.

### iOS navigation and patterns to extend

| Asset | Location | Notes |
|-------|----------|-------|
| More menu | `apps/ios/Moat/App/more-menu-view.swift` | Lists `AppDestination.moreMenuDestinations` |
| Destinations | `apps/ios/Moat/App/app-destination.swift` | Add `.aiAccess` case + title + SF Symbol |
| Destination router | `AppDestinationView` in `more-menu-view.swift` | Switch arm → new view |
| Feature module layout | e.g. `Features/AccountSettings/`, `Features/Household/` | Models / Services / ViewModels / Views |
| API client | `apps/ios/Moat/Core/Networking/APIClient.swift` | Prefer `get(path:)` / `post(path:body:)` like Account Settings |
| Cards / sheets | `MoatCard`, `MoatGlassSheet`, `LoadingView`, `ErrorStateView` | Match existing More screens |
| Reference settings UX | `Features/AccountSettings/Views/account-settings-view.swift` | Scroll + section cards + sheets |
| App shell + top inset banner | `apps/ios/Moat/App/app-shell-view.swift` | Already hosts `DemoModeBanner` via `.safeAreaInset(edge: .top)` — same pattern for connect-assistant banner |
| Existing banner pattern | `Features/DemoMode/Views/demo-mode-banner.swift` | Compact top bar + CTA; reuse structure, not demo copy |

There is currently **no** MCP / AI Access Swift code under `apps/ios`.

## Parity Decision

| Surface | iOS v1 |
|---------|--------|
| Web OAuth connections | ✅ Duplicate UI; same API |
| Web personal access tokens (create / list / revoke / one-time copy) | ✅ Duplicate UI; same API |
| Web MCP logs (filters, load more 30, details sheet) | ✅ Duplicate UI; same API |
| Web page title + subtitle wording | ✅ Exact match |
| Desktop connect-assistant top banner | ✅ Port into iOS app shell until connected |
| New / changed API handlers | ❌ None — use existing `/api/v1/mcp/*` |
| Desktop local gateway enable/disable / auto-start | ❌ Out of scope |
| Desktop localhost setup / `mcp.json` snippet | ❌ Out of scope (optional later as read-only help linking to web docs) |
| Shared React UI from `@moat/features` | ❌ Do not reuse |
| OAuth consent approve flow | ❌ Remains on web |

Wording and features for the three cloud sections must be one-to-one with web. Layout adapts to iOS (single column, native sheets, list rows) without changing product meaning. The interactive experience is MCP settings; the page title stays **AI Access**. The connect banner uses the current desktop shell CTA copy and hides once cloud MCP access exists.

## Target Experience

### Connect-agent top banner

Show a small full-width banner across the top of the authenticated app shell **until the user has connected agent access**.

**Connected (banner hidden)** when either:

- at least one OAuth connection exists from `listOAuthConnections`, **or**
- at least one personal access token exists from `listPersonalAccessTokens`

(Desktop only checks local tokens; cloud iOS must count OAuth **or** PAT because hosted agents often connect via OAuth.)

**While unconnected (`hasMcpConnection == false`):**

```text
┌──────────────────────────────────────────────────────────┐
│ Connect your personal AI assistant                    [Connect] │
│ Unlock AI-powered insights by connecting Moat            │
│ to Claude Desktop or Cursor.                             │
└──────────────────────────────────────────────────────────┘
```

Exact copy (from desktop shell):

| Element | Text |
|---------|------|
| Title | `Connect your personal AI assistant` |
| Supporting line | `Unlock AI-powered insights by connecting Moat to Claude Desktop or Cursor.` |
| CTA | `Connect` |

Behavior:

1. Resolve connection state on app shell appear using existing list endpoints (can parallel-fetch OAuth + PATs; treat either non-empty as connected).
2. While loading / unknown, **do not flash** the banner (match desktop’s `null` → hide until known `false`).
3. Tapping **Connect** navigates to AI Access:
   - Select **More** tab and push/open `AppDestination.aiAccess`, or equivalent deep navigation used elsewhere in iOS.
4. After the user creates a PAT or gains an OAuth connection (from iOS AI Access, or after refresh if they connected on web), refresh connection state and hide the banner.
5. If the user later revokes/disconnects their **last** connection/token, show the banner again on next status refresh.
6. Banner can remain visible even while the user is already on AI Access (desktop does this) — it is a shell prompt, not a page-local empty state.
7. Stacking with demo banner: if demo mode banner is also showing, prefer demo banner first; connect-assistant banner may sit below it or be suppressed in demo if MCP APIs are unavailable — resolve during implementation without inventing API behavior.

Visual notes:

- Compact top inset, similar density to `DemoModeBanner`.
- Distinct accent treatment so it reads as a CTA strip, not a card.
- Do not invent dismiss-forever / “don’t show again” for v1 unless product asks — visibility is driven only by connection state.

### Navigation

1. User opens the **More** tab (`AppTab.more`).
2. List includes a new row: **AI Access** with SF Symbol `cable.connector` (or `point.3.connected.trianglepath.dotted` if preferred for visual consistency — lock the choice during implementation to one symbol).
3. Tapping navigates via `NavigationLink` → `AIAccessView`.
4. Banner **Connect** CTA also lands on this same destination.
5. Placement: near other power-user / settings destinations. Recommended order after Household and before Account settings (or immediately after Account settings). Exact list order can be finalized in review; default proposal:

```text
Budget
Rules
Categories
What If
Investments
Scenarios
Demo mode
Household
AI Access   ← new
Account settings
```

### Page chrome

- Large navigation title: `AI Access`
- Subtitle (under title or first text in scroll content):  
  `Manage and monitor your MCP connections with your personal AI assistants.`
- Pull-to-refresh reloads all three sections.
- Toolbar refresh optional (match Account Settings if useful).

### Layout (iOS)

Single vertical scroll — no two-column grid:

```text
AI Access
Manage and monitor your MCP connections with your personal AI assistants.

┌─────────────────────────────┐
│ OAuth connections           │
│ Hosted MCP clients…         │
│ [rows or empty state]       │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Personal access tokens      │
│ Scoped tokens…   [Create]   │
│ [rows or empty state]       │
└─────────────────────────────┘

┌─────────────────────────────┐
│ MCP logs                    │
│ Recent tool calls…          │
│ [filters]                   │
│ [rows / load more]          │
└─────────────────────────────┘
```

Use `MoatCard` / existing section-card patterns rather than inventing a new visual system.

---

### Section 1 — OAuth connections

**Copy (exact)**

| Element | Text |
|---------|------|
| Title | `OAuth connections` |
| Description | `Hosted MCP clients connected via OAuth.` |
| Empty | `No OAuth clients connected.` |
| Error | `Failed to load connections.` |
| Disconnect success toast/sheet | `Connection disconnected` |
| Disconnect failure | `Failed to disconnect` |
| Disconnect button | `Disconnect` |

**Row content (parity with web)**

- Display name: `connection.name` falling back to `clientProfile`
- Badge: `clientProfile`
- Status pill: `Active` | `Expired` | `Revoked`
  - Revoked if `revokedAt` set
  - Expired if `(refreshTokenExpiresAt ?? expiresAt) <= now`
  - Else Active
- Token prefix: `{tokenPrefix}…` (mono)
- Scopes: space-joined scope strings
- Meta line: `Connected {date} · Last used {date|Never} · Refresh expires {date|Never}`

**Actions**

- `Disconnect` enabled only when status is `Active`
- Confirmation before disconnect is recommended on iOS (destructive confirm sheet) even if web currently disconnects immediately — keep the action label `Disconnect` and success copy identical
- Call `POST /api/v1/mcp/revokeOAuthConnection` with `oauthClientIds`

**States:** loading spinner, error, empty, populated list

---

### Section 2 — Personal access tokens

**Copy (exact)**

| Element | Text |
|---------|------|
| Title | `Personal access tokens` |
| Description | `Scoped tokens for local MCP clients.` |
| Header action | `Create token` |
| Empty | `No personal access tokens yet.` |
| Error | `Failed to load tokens.` |
| Revoke button | `Revoke` |
| Revoke success | `Token revoked` |
| Revoke failure | `Failed to revoke token` |
| Create dialog title | `Create MCP token` |
| Create dialog description | `Use this token with Cursor, local stdio, or other MCP clients.` |
| Name label | `Name` |
| Default name | `Local MCP token` |
| Client name label | `Client name` |
| Client name placeholder | `Cursor` |
| Expiration label | `Expiration` |
| Access preset label | `Access preset` |
| Create submit | `Create token` / `Creating…` |
| Cancel | `Cancel` |
| Token reveal label | `Token` |
| Copy / Copied / Done | `Copy` / `Copied` / `Done` |
| Create success | `Token created` |

**Expiration options (exact)**

- `30 days` → 30
- `90 days` → 90 (default)
- `1 year` → 365
- `Never` → null

**Scope presets (duplicate from mcp-contracts)**

| Preset id | Label | Description |
|-----------|-------|-------------|
| `recommended` | `Recommended` | `Best for local AI tools. Can view your accounts, transactions, budgets, and forecasts.` |
| `read-only-full` | `Read-only full access` | `Can view all financial context, including rules and memories.` |
| `custom` | `Custom` | `Choose exactly what this token can access.` |

**Scope checkbox labels (exact)**

| Scope | Label |
|-------|-------|
| `mcp:read` | `Basic app access` |
| `mcp:accounts:read` | `View accounts` |
| `mcp:transactions:read` | `View transactions` |
| `mcp:budget:read` | `View budgets` |
| `mcp:forecast:read` | `View forecasts` |
| `mcp:rules:read` | `View rules` |
| `mcp:memories:read` | `Read memories` |
| `mcp:memories:write` | `Save memories` |
| `mcp:reports:write` | `Create reports` |
| `mcp:feedback:write` | `Send feedback` |

Default selected scopes = recommended preset (`mcp:read`, `mcp:accounts:read`, `mcp:transactions:read`, `mcp:budget:read`, `mcp:forecast:read`).

Create disabled when name is blank or no scopes selected.

**Token row**

- Name + status (`Active` / `Expired` / `Revoked`)
- `{tokenPrefix}…`
- Scopes joined by space
- `Created {date} · Last used {date|Never} · Expires {date|Never}`
- Non-active rows visually muted
- `Revoke` only when Active; confirm before revoke on iOS

**One-time token reveal**

After create, show plaintext token once in a sheet (selectable / copyable). Never persist plaintext in Keychain, UserDefaults, or logs. Closing the sheet discards it from memory.

---

### Section 3 — MCP logs

**Copy (exact)**

| Element | Text |
|---------|------|
| Title | `MCP logs` |
| Description | `Recent tool calls and activity from MCP clients.` |
| Search placeholder | `Search tool…` |
| Status filter | `All statuses` / `Success` / `Error` / `Denied` / `Rate limited` |
| Auth filter | `All types` / `PAT` / `OAuth` |
| Column headers | `Tool / client`, `Auth`, `Status`, `Duration`, `Time` (collapse secondary columns on narrow layout as needed) |
| Empty | `No logs found.` |
| Error | `Failed to load logs.` |
| Load more | `Load more` / `Loading…` |
| Details title | `Log details` |

**Row**

- Tool name (mono) + client name (`Unknown client` fallback)
- Auth type: `PAT` if `personalAccessTokenId`, else `OAuth` if `oauthAccessTokenId`, else `Unknown`
- Status icon + label: `Success` / `Denied` / `Rate limited` / `Error`
- Duration: `{durationMs}ms`
- Relative time (e.g. “3 minutes ago”)

**Paging**

- Page size **30** (match web)
- `Load more` when `nextCursor` present

**Details sheet fields (parity)**

- Status, Time (absolute), Client, Profile, Auth type, Tool / action, Duration
- Error code when present
- Rate limited: `Yes` when true
- Required scopes / Granted scopes blocks when non-empty

Tap row → details sheet (`MoatGlassSheet` or equivalent).

---

## Architecture / Data Model

### Boundary

| Layer | Change for this feature? |
|-------|--------------------------|
| `apps/ios` UI + service client | Yes — native AI Access screen |
| `apps/api` handlers / services | **No** |
| Prisma schema / migrations | **No** |
| OpenAPI / `packages/client-ts` | **No** (optional later if iOS adopts generated clients; not required) |
| `packages/features` React UI | **No** — do not reuse |

### Proposed iOS file layout

```text
apps/ios/Moat/Features/AIAccess/
├── Models/
│   ├── agent-access-models.swift      ← DTOs matching web mcp.ts types
│   └── mcp-scope-catalog.swift        ← scopes, labels, presets (Swift port)
├── Services/
│   └── agent-access-service.swift     ← APIClient calls to /api/v1/mcp/*
├── ViewModels/
│   ├── agent-access-view-model.swift  ← load/refresh, section state, mutations
│   └── agent-access-connection-store.swift  ← shell-level “has connection?” state for banner
└── Views/
    ├── agent-access-view.swift        ← page shell
    ├── agent-access-connect-banner.swift  ← top CTA strip
    ├── oauth-connections-section.swift
    ├── personal-access-tokens-section.swift
    ├── create-mcp-token-sheet.swift
    ├── mcp-logs-section.swift
    └── mcp-log-details-sheet.swift
```

Plus navigation / shell wiring:

- `apps/ios/Moat/App/app-destination.swift` — add `.aiAccess`
- `apps/ios/Moat/App/more-menu-view.swift` — route to `AIAccessView`
- `apps/ios/Moat/App/app-shell-view.swift` — host connect banner via top `safeAreaInset` (alongside demo banner) and honor Connect → AI Access navigation

### Models (mirror `apps/web/src/lib/api/mcp.ts`)

```swift
struct McpPersonalAccessToken: Decodable, Identifiable { ... }
struct CreatedMcpPersonalAccessToken: Decodable { ... } // includes plaintext `token`
struct McpOAuthClientConnection: Decodable, Identifiable { ... }
struct McpLogEntry: Decodable, Identifiable { ... }
```

Decode API envelopes the same way other iOS services do (`data` wrapper if present — match existing `APIClient` / service conventions).

### Service methods

| Method | Endpoint |
|--------|----------|
| `listOAuthConnections()` | GET `listOAuthConnections` |
| `revokeOAuthConnection(oauthClientIds:)` | POST `revokeOAuthConnection` |
| `listPersonalAccessTokens()` | GET `listPersonalAccessTokens` |
| `createPersonalAccessToken(...)` | POST `createPersonalAccessToken` |
| `revokePersonalAccessToken(tokenId:)` | POST `revokePersonalAccessToken` |
| `listMcpLogs(cursor:limit:status:authType:clientName:search:)` | GET `listMcpLogs` |

**No API, Prisma, migration, or OpenAPI changes.** Request/response shapes must match what web already sends and receives today.

### Auth / security

- All calls authenticated via existing Bearer token / session path in `APIClient`.
- Never log token plaintext, refresh tokens, emails, or raw financial payloads.
- Never store created PAT plaintext after the reveal sheet dismisses.
- Disconnect / revoke are server-authoritative; UI disable is UX only.

### Demo mode

MCP handlers use `withAuth` (real auth). If the user is in demo mode without a real session, show a clear empty/error state consistent with other authenticated-only More screens rather than inventing fake MCP data. Confirm behavior against how Account Settings / Household handle demo during implementation.

## Implementation Plan

### Phase 1 — Navigation + page shell

1. Add `AppDestination.aiAccess` with title `AI Access` and SF Symbol.
2. Include it in `moreMenuDestinations` (adjust filter/`allCases` as needed).
3. Route to empty `AIAccessView` with title + subtitle + placeholder sections.
4. Wire Xcode project membership for new files.

**Acceptance:** More → AI Access opens a native page with correct title/subtitle.

### Phase 1b — Connect-agent banner

1. Add shell-level connection status (unknown / unconnected / connected) using existing `listOAuthConnections` + `listPersonalAccessTokens`.
2. Render `AIAccessConnectBanner` from `AppShellView` when unconnected.
3. Wire **Connect** to open AI Access under More.
4. Refresh status after AI Access mutations and on foreground/appear.

**Acceptance:** Banner shows with desktop copy until first OAuth or PAT exists; Connect opens AI Access; banner hides after connect.

### Phase 2 — OAuth connections

1. Models + service list/revoke.
2. View model section state.
3. Section UI: loading / error / empty / rows / disconnect confirm.
4. Notify connection store when OAuth list becomes non-empty / empty.

**Acceptance:** Matches web OAuth card copy and disconnect behavior against live API; banner updates after disconnect-all / reconnect.

### Phase 3 — Personal access tokens

1. Scope catalog Swift port.
2. List + revoke.
3. Create sheet with presets, scope toggles, expiration, one-time copy reveal.
4. Notify connection store when PAT list becomes non-empty / empty.

**Acceptance:** Create shows token once; revoke works; wording matches web; banner hides after first token create.

### Phase 4 — MCP logs

1. Filtered list + cursor paging (limit 30).
2. Load more.
3. Details sheet.

**Acceptance:** Filters, paging, and details match web semantics and copy.

### Phase 5 — Polish

1. Pull-to-refresh across sections.
2. Destructive confirms, disabled states, muted revoked/expired rows.
3. Accessibility labels for status badges, banner CTA, and buttons.
4. Manual QA checklist against web AI Access + desktop banner side-by-side.

## Acceptance Criteria

- [ ] **AI Access** appears in the iOS **More** menu and navigates to a native screen.
- [ ] Page title is `AI Access` and subtitle matches web exactly.
- [ ] OAuth connections section uses web copy, status rules, row fields, and disconnect action.
- [ ] Personal access tokens section supports list, revoke, and create with matching fields, presets, scope labels, expirations, and one-time token reveal/copy.
- [ ] MCP logs section supports search, status filter, auth-type filter, 30-item pages, load more, and log details with matching fields/copy.
- [ ] Loading, error, and empty states exist for all three sections with web-equivalent messaging.
- [ ] Top **Connect your personal AI assistant** banner appears while the user has neither OAuth connections nor PATs, using desktop title / supporting line / `Connect` CTA copy.
- [ ] Banner **Connect** opens AI Access; banner hides once any OAuth connection or PAT exists; banner can return if the last connection/token is removed.
- [ ] Banner does not flash during initial unknown/loading connection state.
- [ ] No React / `packages/features` UI is reused; SwiftUI only.
- [ ] No plaintext PAT is persisted or logged after the create sheet closes.
- [ ] Existing `/api/v1/mcp/*` handlers are used exclusively; **no** API, DB, or OpenAPI changes ship with this feature.
- [ ] Desktop-only local gateway / setup / local audit log are not claimed as iOS features in v1.
- [ ] Follows iOS feature-module and kebab-case file naming conventions.

## Non-Goals

- Any work in `apps/api`, Prisma, migrations, or OpenAPI for this feature.
- Reusing or embedding `@moat/features` / web / desktop React components inside iOS.
- Building an on-device MCP server or local gateway on iOS.
- Porting desktop Local gateway / Setup instructions / local audit log as primary iOS sections.
- Hosting the MCP OAuth consent approve/deny web flow inside the iOS app.
- Changing cloud MCP schema, scopes, or handler contracts.
- Permanent dismiss / “don’t show again” for the connect banner (connection-state only).
- Adding the same banner to web in this iOS project (web currently lacks it; out of scope unless requested separately).
- Deep links from push notifications into AI Access (can be a follow-up).
- Analytics events beyond what similar iOS settings screens already do (add only if product explicitly wants `mcp_*` PostHog events later).

## Open Questions

1. **More menu order** — Confirm AI Access placement relative to Household and Account settings.
2. **SF Symbol** — Prefer `cable.connector` vs another plug/link symbol for visual parity with web’s Plug icon.
3. **Disconnect/revoke confirmation** — Web disconnects/revokes immediately; should iOS always require a confirmation sheet? Recommendation: yes for destructive actions.
4. **Demo mode** — Exact empty vs signed-out messaging when MCP APIs reject demo actors; also whether the connect banner is suppressed in demo.
5. **Optional help footer** — Should iOS include a short “Connect agents from the web app or desktop” note since OAuth consent is web-only? Recommendation: small secondary footer, not a full desktop setup card.
6. **Client name filter on logs** — Web has auth/status/search but the API also accepts `clientName`; include an explicit client filter control on iOS only if web adds it, otherwise stick to web’s three controls.
7. **Banner supporting copy** — Keep desktop’s “Claude Desktop or Cursor” line as-is on iOS, or broaden for cloud OAuth clients (e.g. ChatGPT / Claude)? Recommendation: keep exact desktop copy for v1 unless product wants cloud-specific wording.
8. **Banner + demo stacking** — If both demo and connect banners could show, which wins? Recommendation: demo first; suppress connect banner in demo if MCP calls are not meaningful.

## Related Specs

- [complete/mcp-settings.spec.md](../../complete/mcp-settings.spec.md) — original web AI Access / MCP settings product brief
- [complete/desktop-mcp-page/spec.md](../../complete/desktop-mcp-page/spec.md) — desktop AI Access page (local gateway variant)
- [complete/desktop-electron-app/phase-5-agent-gateway.spec.md](../../complete/desktop-electron-app/phase-5-agent-gateway.spec.md) — desktop gateway foundations
- [complete/ios-my-profile-overhaul.spec.md](../../complete/ios-my-profile-overhaul.spec.md) — prior example of native SwiftUI parity without shared React UI
- [apps/ios/AGENTS.md](../../../apps/ios/AGENTS.md) — iOS architecture overlay

## Suggested Commit Message

```text
docs (ios): adds agent access spec
```
