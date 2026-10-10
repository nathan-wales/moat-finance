# MCP Analytics

**Status:** In progress — implementing cross-platform PostHog coverage  
**Owner:** Moat Finance engineering

---

## Goal

Give product managers a complete PostHog story of how users discover AI Access, connect personal AI assistants (Claude, ChatGPT, Cursor, etc.), and use Moat tools through the MCP gateway — across web, desktop, iOS, and the MCP server.

---

## Product Context

Assistants invoke Moat tools without touching the web UI. Postgres `McpToolCall` audit already records every cloud tool call, but nothing lands in PostHog. AI Access / OAuth consent UIs have no product events today.

---

## Current Repo Context

| Area | Path |
|------|------|
| Cloud tool audit | `apps/mcp/src/audit/log-tool-call.ts` |
| Tool contracts | `packages/mcp-contracts/src/tools.ts` |
| Web AI Access | `apps/web/src/app/(dashboard)/settings/ai-access/` |
| OAuth consent | `apps/web/src/app/mcp/oauth/authorize/` |
| Desktop MCP page | `apps/desktop/src/renderer/src/pages/mcp/` |
| iOS AI Access | `apps/ios/Moat/Features/AIAccess/` |
| Web analytics wrapper | `apps/web/src/lib/analytics.ts` |
| Event catalog | `docs/security/analytics-events.md` |

---

## Target Experience (PM-readable)

1. User opens AI Access (web / desktop / iOS) → `mcp_ai_access_viewed`
2. Creates PAT or approves OAuth for Claude/ChatGPT/Cursor → connection events
3. Assistant calls tools → `mcp_tool_invoked` from `apps/mcp` with `client_profile`, `tool_domain`, `status`, `is_write`
4. User revokes → revoke events

Desktop local gateway tool bodies stay on-device (JSONL). Desktop PostHog covers UI only.

---

## Events

### Server (`apps/mcp`)

| Event | When | Props |
|-------|------|-------|
| `mcp_tool_invoked` | After audit write | `client_profile`, `auth_kind`, `tool_name`, `tool_domain`, `safety_class`, `status`, `is_write`, `duration_bucket`, `rate_limited`, `transport` |
| `mcp_auth_failed` | Unauthorized request | `auth_kind_attempt`, `transport` |
| `mcp_oauth_register_rejected` | Registration policy failure | `registration_kind`, `reason_code` |

### UI (web / desktop / iOS)

| Event | Surfaces | Props |
|-------|----------|-------|
| `mcp_ai_access_viewed` | all | `surface`, optional `tab` |
| `mcp_pat_create_started` / `mcp_pat_created` / `mcp_pat_revoked` | web, ios; desktop uses local token events | `surface`, scope enums/counts |
| `mcp_oauth_consent_viewed` / `_approved` / `_denied` | web | `client_profile`, privacy/scope counts |
| `mcp_oauth_connection_revoked` | web, ios | `client_profile`, `surface` |
| `mcp_gateway_toggled` | desktop | `enabled`, `auto_start` |
| `mcp_local_token_created` / `_revoked` | desktop | `scope_count`, `has_write_scope` |

Identity: `{ userId }` for authenticated cloud flows. Desktop vault-only may use `{ demoUser: true }`. Never send tokens, tool args, amounts, or merchant strings.

---

## Architecture

- Shared packages stay PostHog-free.
- `apps/mcp` uses `posthog-node` via a local analytics wrapper (same sanitizer rules as web).
- Web/desktop/iOS use their platform wrappers and pass `surface`.

---

## Acceptance Criteria

- [ ] Every cloud tool call emits `mcp_tool_invoked` (when PostHog key configured)
- [ ] AI Access viewed / PAT / OAuth consent / revoke fire on web
- [ ] Desktop MCP page fires viewed / gateway / local token events
- [ ] iOS AI Access fires viewed / PAT / OAuth revoke events
- [ ] Catalog lists all `mcp_*` events with owners
- [ ] CI blocks direct PostHog capture outside approved wrappers

---

## Non-Goals

- Streaming desktop local tool invocations to PostHog in v1
- Backfilling historical `McpToolCall` rows into PostHog
- Replacing Axiom ops logging
