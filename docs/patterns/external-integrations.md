# Pattern: External Integrations

## Overview

External integrations (Plaid, PostHog, Axiom) each have a defined boundary and home in the codebase. Never scatter integration-specific code across handlers or components — keep it contained.

---

## Plaid

**Lives in**: `apps/api/src/server/plaid/`

Plaid is the primary bank data integration. All Plaid SDK calls go through service functions in `apps/api/src/server/plaid/`. Handlers never call the Plaid SDK directly.

Key conventions:
- Plaid item IDs and access tokens are stored in Prisma and never logged.
- Plaid webhook handling lives in `pages/api/plaid/webhook.ts` and is wrapped with `withPublic`.
- Re-authentication (Link update mode) is handled via the existing Plaid link flow.
- Never expose raw Plaid item data to the web client — normalize and select only needed fields.

---

## PostHog (Analytics)

**Lives in**:
- Web: `apps/web/src/lib/analytics.ts` (+ `posthog.ts`)
- MCP server: `apps/mcp/src/lib/analytics.ts` (`posthog-node`)
- Desktop renderer: `apps/desktop/src/renderer/src/lib/analytics.ts`
- Desktop main (updater): `apps/desktop/src/main/lib/analytics.ts`
- iOS: `apps/ios/Moat/Core/Analytics/Analytics.swift`

Event naming: `<domain>_<object>_<action>` (snake_case). Every event must include `{ userId }` or `{ demoUser: true }`. Never include both.

Identify signed-in users with `identify(userId, email)`: distinct ID is `userId`; account email is a person property. Never use email as the distinct ID. Never send `name`.

```ts
// ✅
capture("goal_created", { userId }, { goalType: "house" });
identify(userId, email);

// ❌ — vague name, and PII risk if merchantName is included
posthog.capture("button_clicked", { merchantName: "Amazon" });
```

Prohibited in capture events: email, account numbers, routing numbers, raw transaction descriptions, merchant names, PII of any kind. Email is allowed only as an identify person property.

Only send on events: counts, booleans, enums, IDs (non-sensitive).

Shared UI in `@moat/features` stays analytics-agnostic and emits via optional `onCapture`; hosts wire PostHog.

MCP tool usage is captured server-side (`mcp_tool_invoked`) so personal assistants (Claude, ChatGPT, Cursor) appear in PostHog without requiring the web UI.

Session recordings and autocapture are disabled in web, desktop, and iOS SDK init. Named product events only.

Catalog: `docs/security/analytics-events.md`. CI: `scripts/check-analytics-usage.mjs`.

---

## Axiom (Logging)

**Shared package**: `packages/logging` (`@moat/logging`)

**App wrappers**:
- API: `apps/api/src/lib/logger.ts`
- Web server: `apps/web/src/lib/logger.ts`
- MCP: `apps/mcp/src/lib/logger.ts`

**Dataset**: use a single dataset (`moat_finance`) and filter by structured fields.

### Standard log fields

| Field | Values |
|-------|--------|
| `app` | `web`, `api`, `desktop`, `ios`, `mcp` |
| `platform` | `nextjs`, `electron`, `ios` |
| `env` | `local`, `preview`, `production` |
| `level` | `info`, `warn`, `error` |
| `event` | snake_case event id |
| `message` | human-readable summary |
| `userId`, `sessionId`, `requestId`, `version`, `source`, `feature` | when available |

### Platform routing

| Platform | Path to Axiom |
|----------|---------------|
| API / web server / MCP | Direct ingest via `@moat/logging` |
| iOS | `POST /api/v1/clientLog/ingest` (Bearer auth) |
| Web browser | `POST /api/client-log` → API proxy |
| Desktop | `POST /api/v1/clientLog/ingest` when signed in for entitlements (local mode). Offline or signed out: no-op. |

Never embed `AXIOM_TOKEN` in iOS, desktop, or browser code.

### Example usage

```ts
logger.error("Plaid sync failed", {
  event: "plaid_sync_failed",
  feature: "plaid",
  userId,
  operation: "sync",
});
```

### Example Axiom queries

```txt
['moat_finance'] | where app == "ios" and level == "error"
['moat_finance'] | where feature == "plaid" and userId == "..."
['moat_finance'] | where app == "desktop" and event == "plaid.scheduled_sync_failed"
```

Never log: tokens, secrets, raw API responses containing PII, email addresses, full transaction descriptions.

---

## Adding a new integration

1. Create a directory in `apps/api/src/server/[integration-name]/`
2. Keep all SDK calls inside that directory — no SDK imports in handlers
3. Add credentials to `.env.example` and document in this file
4. Never log raw credentials or tokens
5. For webhooks: create a `withPublic` handler, validate the webhook signature
