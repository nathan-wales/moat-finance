# Desktop MCP Page

## Status

Draft. Created May 30, 2026 after reviewing the current web MCP settings page, desktop Settings agent access UI, local MCP gateway IPC handlers, local token service, audit log shape, shared `@moat/features` package pattern, and the desktop navigation shell.

## Goal

Move desktop MCP management out of the generic Settings page and into a first-class desktop MCP page under the `AI Assistant` navigation section, matching the web app's information architecture and clearer presentation.

The desktop page should feel like the web MCP page: connection/token management at the top, logs below, and setup instructions nearby. Desktop keeps its local-first differences: users must enable the local gateway, can choose auto-start, generate/revoke local agent tokens, and use a localhost MCP URL. Web keeps OAuth connections and cloud personal access tokens. Shared code should be introduced where it reduces duplication without hiding these real product differences.

Success means:

- `apps/desktop` has an `MCP` nav item at the bottom of the `AI Assistant` section, mirroring web.
- Desktop MCP controls are removed from `Settings` and replaced there with, at most, a small link or status summary.
- The desktop MCP page uses the web page's hierarchy: top cards for access/connections/tokens and a full-width logs card below.
- Desktop gateway lifecycle is visible and understandable without making the whole page read like a settings dump.
- Token creation, token revocation, setup instructions, and audit log review remain available in desktop.
- No OAuth UI is shown in desktop unless desktop actually supports OAuth later.
- Presentation components are shared through `packages/features` only at adapter-friendly boundaries.

## Product Context

Moat Finance's MCP gateway is how power users connect Claude Desktop, Cursor, ChatGPT, GitHub Copilot, and other agents to their financial context. The web app already treats MCP as its own AI-agent workflow, not as an incidental setting. Desktop should do the same because the local app is intended to become a local-first financial context OS for personal agents.

The current desktop page is functional but confusing because the agent gateway sits inside `Settings` alongside database/profile settings and mixes several concepts in one card: enablement, auto-start, token generation, scopes, token table, audit log, and setup JSON. The web page is easier to scan because it separates connections, personal access tokens, and logs into distinct cards.

Desktop should borrow that page structure while preserving the local gateway mental model:

- Web answers: Which hosted OAuth clients and cloud PATs can access my cloud Moat Finance data?
- Desktop answers: Is my local gateway running, which local agent tokens can access my local Moat Finance data, and what tools have agents called?

## Current Repo Context

### Web MCP Page

Primary files:

- `apps/web/src/app/(dashboard)/mcp-settings/page.tsx`
- `apps/web/src/app/(dashboard)/settings/mcp-settings/index.tsx`
- `apps/web/src/app/(dashboard)/settings/mcp-settings/oauth-connections-card.tsx`
- `apps/web/src/app/(dashboard)/settings/mcp-settings/personal-access-tokens-card.tsx`
- `apps/web/src/app/(dashboard)/settings/mcp-settings/mcp-logs-card.tsx`
- `apps/web/src/app/(dashboard)/settings/mcp-settings/mcp-log-details-dialog.tsx`
- `apps/web/src/lib/api/mcp.ts`
- `apps/web/src/components/layout/sidebar.tsx`

Current web behavior:

- Sidebar has `MCP` as the last item in the `AI Assistant` section.
- Page title is `AI Access` with short helper text.
- Top grid has `OAuth connections` and `Personal access tokens` cards.
- Logs are a full-width `MCP logs` card below the top grid.
- Logs support search, status filter, auth type filter, pagination, and a details dialog.
- PAT creation uses a modal with name, client name, expiration, and scopes.
- PAT token value is shown once and can be copied.
- OAuth connections can be disconnected.

The web reference is the right visual and structural source of truth for desktop, but not every web card maps 1:1 to desktop.

### Desktop Current UI

Primary files:

- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/renderer/src/components/sidebar.tsx`
- `apps/desktop/src/renderer/src/pages/settings.tsx`
- `apps/desktop/src/renderer/src/lib/ipc-api-client.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/main/ipc/agent.ts`
- `apps/desktop/src/main/agent-gateway/*`

Current desktop behavior:

- No `MCP` page id or nav item exists.
- `AI Assistant` section contains `Financial Profile` and `Ask AI` only.
- A top banner appears when no MCP token exists and routes users to `settings`.
- Settings includes an `AI Access` card with:
  - gateway status badge
  - enable/disable button
  - auto-start checkbox
  - token label input
  - scope checkboxes
  - generated plaintext token display
  - token table
  - revoke token and revoke all actions
  - view/refresh audit log button
  - recent audit log table
  - `mcp.json` setup snippet
- `SettingsPage` mixes local DB/profile state with all agent gateway state in one component.

### Desktop Gateway And Data Model

Current gateway management is already behind typed IPC, which should remain the boundary:

- `agent:getStatus`
- `agent:setEnabled`
- `agent:listTokens`
- `agent:generateToken`
- `agent:revokeToken`
- `agent:revokeAll`
- `agent:getAuditLog`
- `agent:getAutoStart`
- `agent:setAutoStart`

Current local token model:

- Tokens are stored in `userData/agent-tokens.json`.
- Plaintext token is shown once and never stored.
- Stored value is a SHA-256 hash.
- Local scopes cover local SQLite capabilities (accounts, transactions, budgets, forecasts, rules, assets, memories, notifications, profile/tax/insurance placeholders, and write actions). Cloud-only scopes are excluded:
  - Community tips (`mcp:community-tips:*`)
  - Feedback (`mcp:feedback:write`)

Current local audit log model:

- Audit entries are stored in `userData/agent-audit.jsonl`.
- Entries include timestamp, token id, tool, granted scopes, status, duration, and optional error code.
- Entries must not include PII, raw transaction descriptions, account numbers, token plaintext, or sensitive payloads.

## Recommendation

Build a dedicated desktop MCP page first, then extract shared presentation after the desktop shape is clear.

Do not make a fully shared `McpSettingsPage` that tries to cover web and desktop with conditionals. The two surfaces have different access concepts:

- Web has OAuth connections and cloud personal access tokens.
- Desktop has local gateway lifecycle and local agent tokens.

The useful shared layer is lower than the whole page:

- Card shells and row presentation for access tokens/connections.
- Token creation dialog presentation with host-provided create/revoke callbacks.
- Logs table, filters, status labels, and details dialog driven by a normalized log entry type.
- Scope selector presentation driven by host-provided scope options.
- Setup instructions block driven by host-provided URL/header snippet.

The host apps should own data fetching and mutations through adapters:

- Web adapter calls `apps/web/src/lib/api/mcp.ts` HTTP helpers.
- Desktop adapter calls `window.moatDesktop.agent.*` through a small renderer-side MCP gateway client.

## Target Information Architecture

### Desktop Navigation

Add a desktop page id:

```ts
type Page =
  | "overview"
  | "financial-profile"
  | "ask-ai"
  | "mcp"
  | ...;
```

Add `MCP` as the last item in the desktop sidebar `AI Assistant` section:

```ts
const aiItems = [
  { id: "financial-profile", label: "Financial Profile", icon: Folder },
  { id: "ask-ai", label: "Ask AI", icon: Sparkles },
  { id: "mcp", label: "MCP", icon: Plug },
];
```

Update desktop navigation routing in `App.tsx`:

- `routePages["/mcp"] = "mcp"`
- Render the new page when `page === "mcp"`.
- The existing no-token banner should navigate to `mcp`, not `settings`.

### Desktop Page Layout

Use the web MCP page as the layout reference:

```text
AI Access
Manage and monitor local MCP access for personal agents.

[ Local gateway card ] [ Agent tokens card ]
[ Setup instructions card, if useful as third/top or below tokens ]
[ MCP logs card spanning full width ]
```

Recommended v1 page structure:

- Header: `AI Access`
- Subtitle: `Manage local agent access, scoped tokens, and MCP activity.`
- Top grid at `lg:grid-cols-2`:
  - `Local gateway` card
  - `Agent tokens` card
- Full-width sections below:
  - `Connect your personal agent` setup card
  - `MCP logs` card

Why this layout:

- Gateway enablement is desktop-only and important enough to be a top card.
- Tokens are the desktop equivalent of connections because they represent authorized clients.
- Setup instructions are useful but should not dominate the top of the page after a user has connected an agent.
- Logs deserve the full-width, filterable table treatment from web.

## UX Requirements

### Local Gateway Card

Purpose: show whether desktop is exposing the local MCP server and let the user control lifecycle.

Required content:

- Title: `Local gateway`
- Description: `Allow local AI agents to connect to Moat Finance through a scoped MCP server.`
- Status badge:
  - `Running on localhost:3030` when running
  - `Stopped` when not running
  - optionally `Enabled`/`Disabled` if enabled and running can differ
- Primary action:
  - `Enable gateway` when disabled
  - `Disable gateway` when enabled
- Auto-start checkbox/toggle:
  - `Start gateway automatically on launch`
- Security copy in compact form:
  - `Only scoped tools are exposed. Raw database access is never granted.`

Behavior:

- Gateway actions call `agent.setEnabled`.
- Auto-start calls `agent.setAutoStart`.
- Show loading/disabled state while gateway mutations are pending.
- Surface failures with a visible error state or toast, not silent catch blocks.

### Agent Tokens Card

Purpose: manage local tokens for Claude Desktop, Cursor, and other local MCP clients.

Required content:

- Title: `Agent tokens`
- Description: `Scoped tokens for local MCP clients.`
- `Create token` button, matching web's button-forward card header.
- Empty state when no tokens exist.
- Token rows with:
  - label
  - token prefix or id-derived display value, never token hash
  - active status
  - scopes
  - created date
  - last used date
  - revoke action

Important security correction:

- The desktop token list must not display `tokenHash` or any hash-derived secret-looking value.
- If a prefix is desired, add a non-secret `tokenPrefix` to the token model at creation time, or display the token id like `ltk_abc123...`.
- Plaintext token is shown only in the creation success state.

Create-token dialog requirements:

- Label input, defaulting to something like `Claude Desktop` or `Local MCP token`.
- Scope selector using `localAgentScopes`, not the full cloud `mcpScopes` list.
- Generated plaintext token shown once with a copy button.
- Clear `Done` action that discards the plaintext from renderer state.
- Optional client preset labels later: Claude Desktop, Cursor, Copilot, Other.

Scope behavior:

- Default selected scopes should come from `localAgentScopes`.
- The UI should render friendly labels and the raw scope value in a way that does not hide what is being granted.
- The create action must be disabled if no scopes are selected.

### Setup Instructions Card

Purpose: help users configure their agent after creating a token.

Required content:

- Title: `Connect your personal agent`
- Short copy: `Add the following to your mcp.json:`
- Code block using the current gateway port:

```json
{
  "mcpServers": {
    "fin-local": {
      "url": "http://localhost:3030/mcp",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

Behavior:

- Use `gatewayStatus.port` when available.
- If the gateway is stopped, still show the expected localhost URL if a configured/default port is known, plus a compact stopped-state note.
- Add a copy button for the JSON block if this is implemented, using an icon button with accessible label.

### MCP Logs Card

Purpose: make local agent activity inspectable and reassuring.

Required content and behavior should copy the web logs card where possible:

- Title: `MCP logs`
- Description: `Recent tool calls and activity from MCP clients.`
- Search input for tool name.
- Status filter: all, success, denied, error.
- Auth type filter is optional on desktop v1 because all local entries are token/PAT-like. If included, it should show `Token` and not imply OAuth.
- Rows with:
  - tool name
  - client/token label when resolvable
  - status icon and label
  - duration
  - relative time
- Details dialog with:
  - status
  - time
  - token/client label
  - tool
  - duration
  - error code
  - granted scopes

Data improvements needed for a good desktop log:

- Current audit entries include `tokenId` but not token label. The renderer can join current tokens by id for active tokens, but revoked token labels will be lost.
- Preferred: append `tokenLabel` to new local audit entries. This is not sensitive and improves logs after token revocation.
- Keep audit entries payload-only and PII-safe.

Filtering options:

- Phase 1 can load the latest 100 entries and filter client-side.
- Phase 2 can add IPC parameters for `cursor`, `limit`, `status`, and `search` if logs become large.

## Shared Package Strategy

### Add A Shared MCP Feature Module After Desktop Extraction

Create this only once desktop has a clean local page shape:

```text
packages/features/src/mcp/
  index.ts
  mcp-page-shell.tsx
  mcp-gateway-card.tsx
  mcp-access-card.tsx
  mcp-token-create-dialog.tsx
  mcp-token-row.tsx
  mcp-logs-card.tsx
  mcp-log-details-dialog.tsx
  mcp-setup-instructions-card.tsx
  mcp-types.ts
  mcp-utils.ts
```

Expose it from `packages/features/package.json`:

```json
"./mcp": "./src/mcp/index.ts"
```

And from `packages/features/src/index.ts` if useful:

```ts
export { McpPageShell } from "./mcp/index";
```

### What Should Be Shared

Share presentation and normalized UI types:

- `McpPageShell`: header plus grid/section layout.
- `McpAccessCard`: generic list card for OAuth connections or tokens, if the row API stays clean.
- `McpTokenCreateDialog`: reusable create-token form with host-provided scope options, expiration optional, client-name optional, and callback props.
- `McpLogsCard`: filterable table and details dialog over normalized logs.
- `McpSetupInstructionsCard`: host-provided config snippet and copy behavior.
- Formatters for dates, status labels, relative time, and scope display.

### What Should Stay Host-Specific

Keep these in app code:

- Web HTTP API functions and React Query keys from `apps/web/src/lib/api/mcp.ts`.
- Web OAuth consent route and OAuth connection mutations.
- Desktop `window.moatDesktop.agent.*` calls.
- Desktop gateway enable/disable and auto-start mutations.
- Desktop local token storage and audit JSONL implementation.
- Any Electron preload/main-process types that would pierce the renderer boundary.

### Adapter Shape

A shared page can accept adapters instead of importing host APIs:

```ts
type McpTokenSummary = {
  id: string;
  label: string;
  displayPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
};

type McpLogSummary = {
  id: string;
  createdAt: string;
  toolName: string;
  clientName: string | null;
  authType: "OAuth" | "PAT" | "Token" | "Unknown";
  status: "success" | "denied" | "error" | "rate_limited";
  durationMs: number;
  errorCode?: string;
  grantedScopes: string[];
  requiredScopes: string[];
};
```

Desktop can normalize `LocalAuditEntry` to `McpLogSummary`; web can normalize `McpLogEntry` to the same shape.

## Implementation Plan

### Phase 1 - Desktop Page Extraction

1. Create `apps/desktop/src/renderer/src/pages/mcp/`.
2. Move desktop agent gateway state and UI out of `settings.tsx` into focused MCP page components.
3. Keep data calls in a small renderer client or hooks layer:
   - `useGatewayStatus`
   - `useAgentTokens`
   - `useAgentAuditLog`
   - `useCreateAgentToken`
   - `useRevokeAgentToken`
4. Add `mcp` to the desktop `Page` union, route map, and render switch.
5. Add `MCP` as the last desktop sidebar item in the `AI Assistant` section with the `Plug` icon.
6. Update the no-token banner to navigate to `mcp`.
7. Remove the `AI Access` card from Settings.
8. Keep Settings focused on local DB/profile/app settings.

Acceptance criteria:

- Desktop has a dedicated MCP page reachable from the sidebar.
- Settings no longer contains the full agent gateway management UI.
- Existing gateway enable/disable, auto-start, token generation, revoke, and audit log behavior still works.
- Errors are surfaced instead of silently swallowed.
- Renderer still uses typed IPC only.

### Phase 2 - Web-Inspired UI Polish

1. Rebuild the desktop page layout to match the web reference:
   - top card grid
   - full-width logs card
   - modal token creation
   - row-based token list
2. Move generated token plaintext display into the create-token dialog success state.
3. Add copy button for generated token.
4. Add copy button for setup JSON.
5. Normalize status badges and log icons to match web.
6. Add client-side log filters and details dialog.
7. Add `tokenLabel` to future local audit entries, or join token labels in the renderer with a graceful revoked-token fallback.

Acceptance criteria:

- Desktop MCP page visually reads as a sibling of the web MCP page.
- Token creation no longer stretches the main page with form controls.
- Logs are usable without pressing `View Audit Log` first.
- No secret hash is displayed in the token table.

### Phase 3 - Shared Presentation Components

1. Introduce `packages/features/src/mcp/` with normalized types and presentation components.
2. Migrate desktop MCP page to those shared components with a desktop adapter.
3. Migrate web MCP settings cards to those shared components with a web adapter where it simplifies code.
4. Keep OAuth card host-specific if the abstraction becomes awkward.
5. Keep desktop gateway card host-specific unless there is a future web gateway status concept.

Acceptance criteria:

- Shared components do not import Next.js, Electron IPC, `@moat/client-ts`, `window.moatDesktop`, Prisma, or app-local `~/` aliases.
- Web still supports OAuth connections, cloud PATs, and cloud MCP logs.
- Desktop still supports gateway lifecycle, local tokens, and local audit logs.
- Shared presentation reduces duplication without adding broad `platform ===` branches.

### Phase 4 - Contracts And Observability Hardening

1. Move duplicated desktop renderer MCP types out of `settings.tsx` / `ipc-api-client.ts` into shared contracts if appropriate.
2. Consider adding `packages/contracts/src/ipc/agent.ts` for IPC-safe agent DTOs and channel names.
3. Add IPC input validation for agent channels instead of raw casts.
4. Add non-PII `tokenLabel` to local audit entries.
5. Add tests for local token filtering, token revocation, audit log normalization, and gateway UI state.

Acceptance criteria:

- Agent IPC contracts are typed and validated consistently with other desktop domains.
- Audit log remains PII-safe.
- Token scope filtering continues to use `localAgentScopes`, not all cloud scopes.

## Data And Security Requirements

- Desktop token plaintext must only exist in memory long enough to show once after creation.
- Do not expose token hashes in UI.
- Do not log token plaintext, token hash, account numbers, raw transaction descriptions, or sensitive financial payloads.
- Local MCP tools must remain scope-gated through `assertScopes`.
- Desktop renderer must never import Node.js, filesystem APIs, Prisma, AppRuntime, or main-process modules directly.
- Gateway mutations must go through typed IPC.
- Web writes remain server-side through API handlers and existing auth wrappers.
- Desktop local scopes must continue using `localAgentScopes` from `local-token-service.ts` or a shared equivalent, not full cloud `mcpScopes`.

## Testing Plan

### Desktop Renderer

- Render MCP page with gateway stopped, no tokens, and empty logs.
- Render MCP page with gateway running, tokens, and audit entries.
- Create token dialog:
  - disables submit with no label or no scopes
  - shows plaintext once after success
  - copy action writes plaintext to clipboard
  - closing dialog clears plaintext
- Token revoke removes row or refetches token list.
- Setup JSON uses current gateway port.
- Log filters hide/show expected rows.
- Log details dialog displays status, tool, duration, error code, and scopes.

### Desktop IPC/Main

- `generateToken` filters scopes through local scope allowlist.
- `revokeToken` removes only the requested token.
- `setAutoStart` persists and status reflects the new value.
- `getAuditLog` returns newest entries first and handles malformed lines.
- Audit entries do not include disallowed fields.

### Manual Electron Pass

- Launch desktop app.
- Navigate to `AI Assistant` -> `MCP`.
- Enable gateway.
- Generate a token for Claude Desktop or Cursor.
- Copy the token and setup JSON.
- Call one local MCP tool.
- Confirm the log appears with success status and duration.
- Revoke the token.
- Confirm future calls with that token are denied.
- Disable gateway.
- Confirm Settings no longer contains the full MCP management UI.

## Open Questions

- Should the desktop page title be `AI Access` for parity with web, or simply `MCP` because it is no longer under Settings? Recommendation: use `AI Access` initially for parity, then revisit if the broader AI Assistant section is renamed.
- Should setup instructions be always visible or collapsed once at least one token exists? Recommendation: keep visible in v1 below the top cards because users often configure more than one agent.
- Should desktop support token expiration? Recommendation: not in this UI pass unless the local token service adds expiration semantics. Do not show an expiration control that does not work.
- Should desktop logs include auth type? Recommendation: normalize as `Token` for desktop and keep the filter optional.
- Should web's OAuth and PAT cards be unified into one `Connections` concept? Recommendation: no for now. Web users benefit from seeing OAuth connections and PATs separately.

## Non-Goals

- Adding OAuth connections to desktop.
- Adding cloud PAT management to desktop.
- Changing MCP tool permissions beyond using the existing local scope allowlist.
- Adding write-capable local MCP tools.
- Reworking the MCP protocol server or transport.
- Moving local gateway lifecycle into `packages/features`.
- Changing desktop database access boundaries.

## Suggested File Map

Desktop v1 extraction:

```text
apps/desktop/src/renderer/src/pages/mcp/
  index.tsx
  local-gateway-card.tsx
  agent-tokens-card.tsx
  create-agent-token-dialog.tsx
  mcp-logs-card.tsx
  mcp-log-details-dialog.tsx
  setup-instructions-card.tsx
  scope-options.ts
  types.ts
  utils.ts
```

Possible shared presentation later:

```text
packages/features/src/mcp/
  index.ts
  mcp-page-shell.tsx
  mcp-token-card.tsx
  mcp-token-create-dialog.tsx
  mcp-logs-card.tsx
  mcp-log-details-dialog.tsx
  mcp-setup-instructions-card.tsx
  types.ts
  utils.ts
```

Host adapter files:

```text
apps/web/src/app/(dashboard)/settings/mcp-settings/*
apps/desktop/src/renderer/src/pages/mcp/*
```

## Rollout Notes

- This is primarily a desktop IA and presentation refactor, so ship it without changing MCP authorization semantics.
- Keep the old settings route behavior only as a temporary link if needed, not as duplicate controls.
- After implementation, run:
  - `pnpm --filter moat-desktop run check:write`
  - `pnpm --filter moat-desktop run typecheck`
  - `pnpm --filter @moat/features run typecheck` if shared components are added

## Commit Message

```text
feat (desktop): adds mcp page spec
```
