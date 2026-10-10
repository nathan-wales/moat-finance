# Third-Party App Data Layer

## Status

Draft. Created June 9, 2026 after reviewing the Moat Finance mission, roadmap, API conventions, MCP conventions, iOS API auth pattern, generated OpenAPI client, and static marketing site constraints.

## Goal

Let a user or builder create their own Moat Finance-powered app and UI while treating Moat Finance as the secure financial data layer.

Success means:

- Builders understand that the REST API is the app data layer.
- MCP remains the agent/tool layer, not the general app backend.
- No builder receives direct database access.
- Auth, docs, examples, and API contracts are clear enough for an agent to scaffold a working UI.
- A final lean marketing-site page gives agents concise instructions for building a custom UI on top of Moat Finance.

## Product Context

Moat Finance's mission is to become the financial data layer and operating system for personal AI agents. That does not only mean users can chat with Moat Finance data. It also means a user should be able to bring their own interface, app shell, or agent-built workflow while Moat Finance remains the source of truth for accounts, transactions, budgets, forecasts, goals, memories, and related financial context.

The product distinction matters:

- `apps/api` is the platform data layer for complete app experiences.
- `apps/mcp` is the scoped agent gateway for LLM tools and agent workflows.
- `apps/marketing` should eventually expose minimal build instructions that an agent can consume without scraping long-form marketing copy.

The feature should not turn Moat Finance into an open database. Moat Finance owns authentication, authorization, provider integrations, business rules, and persistence. External apps call Moat Finance through supported API contracts.

## Current Repo Context

### API

Primary files and packages:

- `apps/api`
- `packages/openapi/api-v1.yaml`
- `packages/client-ts`
- `docs/patterns/api-patterns.md`

Current behavior:

- `apps/api` is the backend source of truth.
- API handlers use `withAuth`, `withDemoOrAuth`, and `withPublic`.
- Prisma access belongs in API services.
- The OpenAPI contract lives in `packages/openapi/api-v1.yaml`.
- `packages/client-ts` is generated from the OpenAPI contract.
- iOS already uses access and refresh tokens through `Authorization: Bearer <accessToken>`.

### MCP

Primary files and packages:

- `apps/mcp`
- `packages/mcp-contracts`
- `docs/patterns/mcp-tools.md`

Current behavior:

- MCP exposes a curated tool surface for LLM clients.
- MCP supports PAT and OAuth access with scopes.
- MCP tools are rate limited, scope checked, formatted for agents, and audit logged.
- MCP intentionally does not expose raw SQL, arbitrary REST passthrough, shell access, admin operations, or broad database access.

MCP should be documented as useful for agent workflows, but it should not be the recommended foundation for a complete user-facing app UI.

### Marketing

Primary files:

- `apps/marketing/index.html`
- `apps/marketing/styles.css`
- `apps/marketing/script.js`

Current behavior:

- Static marketing site.
- Plain HTML, CSS, and vanilla JavaScript.
- No framework, no build step, no client-side auth or user data.

The final phase must preserve this simplicity.

## Product Decision

The supported path is:

```text
Custom app or custom UI
  -> Moat Finance REST API
  -> Moat Finance service layer
  -> Moat Finance-owned database and integrations
```

The agent path is:

```text
Agent or LLM client
  -> Moat Finance MCP tools
  -> scoped, curated Moat Finance data access
```

Direct database access is not part of this feature.

## Gold Standard Target

The target is not just "we have endpoints." The target is a backend platform that an agent or developer can build against with confidence.

The gold standard stack is:

```text
OpenAPI 3.1 public contract
  -> generated and published SDKs
  -> OAuth/PKCE app authorization with scopes
  -> sandbox/demo data access
  -> recipe-based docs and examples
  -> stable versioning, changelog, and compatibility policy
  -> agent-readable marketing/developer instructions
```

Principles:

- OpenAPI is the contract. If an endpoint is not documented there, it is not public.
- SDKs are the happy path. Builders should not need to hand-roll auth, pagination, retries, or error parsing.
- Docs are workflows, not only reference pages.
- Sandbox data should let a builder ship a prototype without linking real bank data.
- Agents should get one short instruction page, one OpenAPI URL, one SDK install command, and one working example.

## Target Builder Experience

A builder should be able to say:

> Build me a Moat Finance dashboard using my Moat Finance account as the data layer.

An agent should then be able to:

1. Read the public build instructions.
2. Discover the API base URL and OpenAPI contract.
3. Authenticate through a supported app-safe flow.
4. Fetch accounts, transactions, budgets, forecasts, and profile data.
5. Render a custom UI without needing Moat Finance source code or database credentials.
6. Avoid MCP unless the desired output is an agent workflow rather than an app UI.

## Non-Goals

- Do not expose direct Postgres, Prisma, SQL, or database credentials to external builders.
- Do not make MCP a full replacement for the REST API.
- Do not add a broad MCP passthrough tool for arbitrary API calls.
- Do not require the marketing site to run a framework or build pipeline.
- Do not publish secret environment variables, internal service URLs, or private implementation details.
- Do not support third-party apps by asking users to paste Moat Finance email/password credentials into unknown clients.
- Do not promise API stability until versioning and compatibility requirements are met.

## Architecture Requirements

### API Boundary

The REST API is the only supported backend boundary for custom app UIs.

Requirements:

- Keep all DB access inside `apps/api` services.
- Keep OpenAPI as the source of truth for app-facing contracts.
- Keep generated client code aligned with the OpenAPI spec.
- Document which endpoints are stable enough for external app use.
- Return UI-friendly JSON, not Prisma models.
- Preserve server-side authorization for all user data.
- Host a public OpenAPI document once endpoints are ready, such as `https://api.moatfinance.ai/openapi.json`.
- Treat undocumented fields as private and unstable.

### SDKs And Client Libraries

SDKs should sit on top of OpenAPI and make the common path easy.

Recommended order:

1. TypeScript SDK for web apps, local dashboards, agents generating React apps, and Node scripts.
2. Swift SDK for native iOS/macOS builders if external native apps become a priority.
3. Python SDK for notebooks, automations, data workflows, and agent scripting.

TypeScript should be first because `packages/client-ts` already exists and the most likely custom UI builders will use React, Next.js, Vite, or agent-generated TypeScript.

Target TypeScript SDK shape:

```ts
import { createFinClient } from "@moat/sdk";

const fin = createFinClient({
  accessToken,
});

const accounts = await fin.accounts.list();
const transactions = await fin.transactions.list({ limit: 50 });
const forecast = await fin.forecast.get();
```

Requirements:

- SDKs must be generated or generated-first from OpenAPI where practical.
- SDKs should expose stable domain methods, not raw endpoint names only.
- SDKs should normalize auth headers, pagination, typed errors, and rate-limit responses.
- SDKs must not hide security-sensitive behavior such as token storage.
- SDK docs must explain that frontend apps still need a secure auth flow and should not embed secrets.

### Authentication

V1 can document the existing first-party token pattern for trusted/self-owned clients, but public third-party app support needs a safer authorization model.

Required direction:

- Keep existing session cookie auth for web.
- Keep existing access/refresh bearer token auth for mobile and native clients.
- Add or formalize an app-safe external authorization flow before encouraging public third-party apps.
- Prefer OAuth 2.0 + PKCE or another scoped user-consent flow for third-party app access.
- Avoid any flow where a third-party frontend directly collects and stores a user's Moat Finance password.
- Store tokens using the host platform's secure storage guidance.

Initial docs should distinguish:

- First-party clients: web, iOS, desktop, extension.
- User-owned local experiments: acceptable with personal tokens or dev credentials if explicitly marked as local/self-owned.
- Public third-party apps: require scoped app authorization before launch.

### Scopes And Permissions

External app access should be scoped separately from MCP scopes.

Recommended API app scopes:

- `api:profile:read`
- `api:accounts:read`
- `api:transactions:read`
- `api:transactions:write`
- `api:budgets:read`
- `api:budgets:write`
- `api:forecast:read`
- `api:rules:read`
- `api:rules:write`
- `api:goals:read`
- `api:goals:write`

Do not reuse MCP scopes as the long-term public API scope model. MCP scopes describe agent tool access; API scopes should describe app data permissions.

### Rate Limits And Abuse Controls

External app access must be rate limited by user, app, and token where possible.

Requirements:

- Define conservative default rate limits for public app tokens.
- Return typed rate-limit errors that agents and apps can handle.
- Audit token creation, token refresh, authorization grant, revocation, and high-risk writes.
- Add support tooling to revoke an app grant without deleting the user's Moat Finance account.

### Privacy And Logging

Requirements:

- No PII in logs.
- No account numbers, routing numbers, provider tokens, raw transaction descriptions, access tokens, or refresh tokens in analytics or logs.
- Marketing instructions must warn agents not to log raw financial payloads.
- API examples must avoid realistic sensitive payloads.
- Public docs should explain that Moat Finance is not giving database access and that user data stays behind Moat Finance authorization.

### Sandbox And Demo Data

Builders need a low-risk way to build.

Requirements:

- Provide demo or sandbox access that does not require linking real bank accounts.
- Use clearly fake accounts, transactions, budgets, forecasts, and goals.
- Make sandbox data deterministic enough for screenshots and tests.
- Mark sandbox responses so apps do not confuse them with production financial data.
- Decide whether sandbox access uses a dedicated sandbox token, demo OAuth grant, or existing demo mode.

### Versioning And Compatibility

External builders need clear expectations when API behavior changes.

Requirements:

- Keep public app endpoints under a stable version boundary.
- Publish breaking changes through a changelog.
- Prefer additive response changes over breaking field removals.
- Document deprecation windows before removing public fields or endpoints.
- Include SDK versioning guidance that maps SDK releases to API compatibility.

## Implementation Plan

### Phase 1 - Define The Supported External App Surface

1. Audit `packages/openapi/api-v1.yaml` for endpoints suitable for external custom UIs.
2. Group endpoints into public app domains:
   - auth
   - profile
   - accounts
   - transactions
   - budgets
   - forecasts
   - rules
   - goals, once available
   - investments
3. Mark endpoints that are internal-only, first-party-only, or not ready for public builders.
4. Identify response shapes that are too app-specific, underdocumented, or missing examples.
5. Decide which OpenAPI output becomes public: hosted JSON, hosted YAML, or both.
6. Decide whether `packages/client-ts` remains internal or becomes the seed for a publishable SDK package.

Acceptance criteria:

- There is a clear list of app-safe API domains.
- Internal-only endpoints are not presented as public app contracts.
- Gaps in OpenAPI examples, tags, summaries, and auth descriptions are recorded.
- MCP is explicitly excluded as the full app backend.
- A public OpenAPI hosting path is chosen, even if not published until later.

### Phase 2 - Harden API Contracts For Builder Consumption

1. Update OpenAPI descriptions, tags, request examples, and response examples for app-safe endpoints.
2. Normalize error response documentation.
3. Document pagination, sorting, date filtering, currency/amount conventions, and time zone behavior.
4. Document demo mode or sandbox behavior if it is supported for external examples.
5. Document the public error model for 400, 401, 403, 404, 409, 429, and 500.
6. Generate and verify the TypeScript client after OpenAPI updates.
7. Add a small example app or script only if it materially improves validation.

Acceptance criteria:

- An agent can infer how to fetch core dashboard data from the OpenAPI spec.
- Auth requirements are visible per endpoint.
- Generated client stays in sync with the contract.
- Existing first-party clients continue to work.
- The OpenAPI contract is strong enough to generate a usable SDK without hand-written endpoint docs for every call.

### Phase 3 - External App Auth And Grants

1. Choose the public app authorization model.
2. Recommended: OAuth 2.0 + PKCE for external app API access, separate from MCP OAuth clients.
3. Add app registration metadata if needed:
   - app name
   - redirect URIs
   - allowed scopes
   - rate limit tier
   - owner/developer user id
   - revoked status
4. Add user-facing grant management in the Moat Finance app:
   - connected apps list
   - scopes granted
   - last used
   - revoke action
5. Add audit logging for grants and token usage.
6. Add tests for authorization, scope enforcement, refresh, revoke, and denied access.

Acceptance criteria:

- A third-party app can request only the scopes it needs.
- A user can approve and later revoke app access.
- API handlers enforce granted scopes server-side.
- Revoked tokens fail closed.
- No third-party flow requires collecting the user's Moat Finance password in the third-party app.

### Phase 4 - Developer And Agent Documentation

1. Create internal docs for the supported app data layer:
   - API base URLs
   - auth flow
   - required headers
   - core data-fetch recipes
   - error handling
   - rate limits
   - security expectations
2. Add an agent-first quickstart that avoids prose-heavy marketing language.
3. Include minimal fetch examples:
   - authenticate
   - get profile summary
   - list accounts
   - list recent transactions
   - get forecast or spending breakdown
4. Include a recommended app architecture:
   - frontend calls Moat Finance API
   - secure token storage
   - no direct DB access
   - no MCP for full UI data fetching
5. Add recipes for common app screens:
   - account overview
   - recent transaction table
   - monthly spending chart
   - cash-flow forecast
   - rule management, if write scopes are available
6. Add guidance for using the public TypeScript SDK when available.
7. Add `llms.txt` or an equivalent agent-discovery file if it helps agents find the OpenAPI contract and build instructions.

Acceptance criteria:

- A human can understand the supported build path.
- An agent can turn the instructions into a working frontend scaffold.
- Docs clearly separate REST API app building from MCP agent tooling.
- Docs avoid exposing private repo internals that are not part of the public contract.
- Docs include at least one end-to-end "build a dashboard" recipe.

### Phase 5 - SDKs, Sandbox, Examples, And Versioning

1. Publish or prepare a TypeScript SDK, likely evolving from `packages/client-ts` into a public package such as `@moat/sdk`.
2. Add a small example app or template that demonstrates:
   - OAuth callback handling or token injection for local development
   - account list
   - recent transactions
   - forecast or spending chart
   - 401, 403, and 429 handling
3. Add sandbox or demo access for builders:
   - deterministic fake accounts
   - deterministic fake transactions
   - fake budget and forecast data
   - no real provider connections required
4. Publish the OpenAPI contract at a stable URL once public access is ready.
5. Add SDK documentation for:
   - installation
   - client creation
   - auth header usage
   - pagination
   - typed errors
   - rate-limit handling
6. Add versioning and changelog policy:
   - API version boundary
   - SDK release notes
   - deprecation windows
   - breaking-change process

Acceptance criteria:

- A TypeScript builder can install one package and fetch useful Moat Finance data with typed methods.
- A builder can develop against fake data without connecting real accounts.
- A generated app can handle auth and common API errors without custom reverse engineering.
- The public OpenAPI URL, SDK install command, and example app are ready to link from the final marketing page.
- API and SDK versioning expectations are explicit.

### Phase 6 - Marketing Site Agent Instructions

Add a lean static page to the marketing site that functions as instructions for an agent.

Recommended file:

```text
apps/marketing/build-with-fin.html
```

Recommended public path:

```text
/build-with-fin.html
```

The page should be intentionally simple:

- Plain HTML.
- No framework.
- No auth.
- No user data.
- No runtime API calls from the marketing site.
- Minimal styling reused from `apps/marketing/styles.css`.
- Short visible heading for humans.
- A prominent agent-readable instructions block.

Recommended content shape:

```text
# Build a custom UI with Moat Finance

You are building a custom frontend on top of Moat Finance.
Use the Moat Finance REST API as the data layer.
Do not request direct database access.
Do not use MCP as the full app backend.
Use MCP only for agent workflows.

API base URL:
- Production: https://api.moatfinance.ai
- Local development: http://localhost:3001

OpenAPI:
- https://api.moatfinance.ai/openapi.json

SDK:
- npm install @moat/sdk

Authentication:
- Use the documented external app OAuth/PKCE flow when available.
- Store tokens securely.
- Send Authorization: Bearer <accessToken>.

Core build steps:
1. Authenticate the user.
2. Fetch profile/account summary.
3. Fetch accounts.
4. Fetch transactions with date/category filters.
5. Fetch budgets, forecasts, rules, goals, and investments as needed.
6. Render the UI.
7. Handle 401, 403, 429, and validation errors.

Security rules:
- Never log tokens.
- Never log account numbers or raw transaction payloads.
- Never ask for database credentials.
```

Implementation notes:

- Link it discreetly from the marketing footer or developer-oriented section.
- Keep the page concise enough that an agent can consume it in one pass.
- Prefer headings and bullet lists over brand copy.
- Include a link to the OpenAPI contract or developer docs once publicly hosted.
- Include the SDK install command once the SDK is public.
- Include the sandbox/demo access path once supported.
- Include MCP links only as a separate "agent workflows" note.

Acceptance criteria:

- The marketing site remains static and framework-free.
- The page is accessible at a stable public URL.
- The page tells agents exactly which interface to use for custom UIs.
- The page does not imply direct database access.
- The page does not instruct agents to use MCP as the full app backend.
- The page points agents to OpenAPI, SDK, auth, sandbox/demo data, and one working example.

## Agent Instruction Contract

The final marketing page should be treated like a public contract for agents.

It should answer, in order:

1. What am I building?
2. Which Moat Finance interface should I use?
3. How do I authenticate?
4. What data can I fetch?
5. What should I avoid?
6. Where is the OpenAPI contract?
7. What errors must I handle?

Suggested agent-facing wording:

```text
If you are an AI agent building a custom Moat Finance UI, use the Moat Finance REST API as the data layer. Do not use MCP as the primary app backend. MCP is for agent tool calls and curated financial context. The REST API is for full app screens, tables, charts, forms, and user workflows.
```

## Security Requirements

- API access must be authenticated and authorized server-side.
- External app tokens must be revocable.
- External app scopes must be enforced in `apps/api`, not only in UI.
- API docs must not include secrets or internal environment values.
- Examples must not contain PII.
- Marketing must not claim that unsupported third-party public app access is production-ready before auth, scopes, and rate limits exist.
- Do not log token plaintext, refresh tokens, provider tokens, account numbers, routing numbers, or raw transaction descriptions.

## Testing Plan

### API Contract

- Validate OpenAPI after updates.
- Regenerate the TypeScript client.
- Run API lint and typecheck.
- Add contract tests for any new external auth endpoints.

### Auth And Scopes

- Test successful authorization grant.
- Test denied scope request.
- Test expired access token.
- Test refresh token rotation.
- Test revoked app grant.
- Test per-scope endpoint denial.

### Documentation

- Have an agent consume the draft instructions and generate a small frontend plan.
- Verify the generated plan uses REST API, not MCP, for app data fetching.
- Verify the generated plan does not request database credentials.
- Verify error handling includes 401, 403, 429, and validation failures.

### SDK, Sandbox, And Examples

- Verify the TypeScript SDK can authenticate and call core read endpoints.
- Verify SDK typed errors cover unauthorized, forbidden, rate-limited, validation, and server failures.
- Verify sandbox/demo data is deterministic and contains no real user data.
- Build the example app from scratch using only public docs, SDK, and OpenAPI.
- Have an agent generate a frontend using the public instruction page and confirm it chooses the SDK or REST API over MCP.

### Marketing

- Open `apps/marketing/build-with-fin.html` locally.
- Verify no build step is required.
- Verify the page is readable without JavaScript.
- Verify links resolve.
- Verify the page does not collect auth or user data.

## Open Questions

- Should external app API auth reuse the existing auth session/token manager or get a dedicated OAuth client/grant model?
- Should `@moat/client-ts` evolve into public `@moat/sdk`, or should it remain internal while a separate SDK wraps it?
- Which endpoints should be considered stable for v1 external app access?
- Should public app access launch as "bring your own local UI" first, before hosted third-party apps?
- Should rate limits differ for local user-owned apps and public hosted apps?
- Where should the OpenAPI contract be publicly hosted?
- Should sandbox access use demo mode, dedicated sandbox OAuth grants, or static sandbox tokens?
- Which example app should be canonical: Next.js, Vite React, SwiftUI, or a minimal HTML/TypeScript app?
- Should the marketing page be linked visibly from the homepage or only from a developer/agent URL?

## Rollout Notes

Recommended rollout:

1. Internal contract audit.
2. Private local-builder documentation.
3. External auth and grant management.
4. Public API/docs hardening.
5. SDK, sandbox, examples, versioning, and changelog.
6. Marketing agent instruction page.

Do not publish broad "build any app on Moat Finance" marketing copy until external auth, scopes, revocation, and rate limits are ready.

## Commit Message

```text
feat (specs): defines custom app data layer
```
