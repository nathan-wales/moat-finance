Plan: Per-App Agentic Engineering Harness
TL;DR: Every app domain gets its own AGENTS.md keystone + patterns directory with full content. A new root AGENTS.md becomes the master conventions file; CLAUDE.md becomes a 3-line shim. Each AGENTS.md gets a change-type routing table (not just a topic list) pointing to app-local pattern docs. Priority: web + api + mcp first, then desktop (no AGENTS.md at all right now), then extension/ios formatting standardization.

Current state gaps
Root CLAUDE.md is the de facto master — becomes a shim
Per-app AGENTS.md exist for 6/7 apps (desktop is missing entirely)
All routing tables point to global patterns — no per-app pattern docs exist anywhere
Routing tables use "Topic → file" format, not actionable "When you are doing X → read Y"
Phase 1 — Root restructure (sets the template)
Create root AGENTS.md — master non-negotiables: modular code, SRP, short files with directory splits, git workflow, naming conventions, auth-is-server-side, no PII in logs, SDD workflow. Routing table → all 7 app AGENTS.md files
Update root CLAUDE.md — replace body with 3-line shim forwarding to AGENTS.md
Phase 2 — apps/web harness (priority, parallel with Phase 3 & 4)
apps/web/docs/patterns/routing-and-pages.md — App Router: route groups, layouts, server vs client components, app/api/ handlers
apps/web/docs/patterns/components.md — domain directories, sub-component extraction, shadcn/ui primitives, anti-patterns
apps/web/docs/patterns/state-and-data.md — Zustand + React Query: OpenAPI client hooks, cache invalidation, useShallow, optimistic updates
apps/web/docs/patterns/auth-and-sessions.md — NextAuth.js: session shape, middleware.ts, demo mode indicators, redirect flows
apps/web/docs/patterns/testing.md — testing matrix by change type (component, hook, e2e)
Update AGENTS.md — change-type routing table, testing matrix section, SDD pointer, local pattern links
Phase 3 — apps/api harness (priority, parallel)
apps/api/docs/patterns/handler-service-layer.md — thin handler pattern, service conventions, Zod input validation, response shapes
apps/api/docs/patterns/auth-and-permissions.md — withAuth/withDemoOrAuth/withPublic deep-dive, ApiContext, household identity, worked example
apps/api/docs/patterns/prisma-and-migrations.md — schema ownership, Neon strategy (never reset, resolve --rolled-back), transaction-scope.ts
apps/api/docs/patterns/external-integrations.md — Plaid containment, webhook signing, adding new integrations
apps/api/docs/patterns/testing.md — handler integration tests, service unit tests, test DB strategy
Update AGENTS.md — change-type routing table, testing matrix, local pattern links
Phase 4 — apps/mcp harness (priority, parallel)
apps/mcp/docs/patterns/tool-lifecycle.md — adding tools end-to-end: registry, Zod schema, scope in mcp-contracts, audit wrapper, format.ts — with worked example
apps/mcp/docs/patterns/auth-and-scopes.md — PAT vs OAuth, token hashing, scope table, PKCE walkthrough, resolve-household-identity.ts
apps/mcp/docs/patterns/transports.md — HTTP vs stdio, Vercel edge config, Upstash rate limiting, local dev setup
apps/mcp/docs/patterns/testing.md — local stdio loop, simulating LLM calls, asserting scope enforcement
Update AGENTS.md — change-type routing table, testing matrix, local pattern links
Phase 5 — apps/desktop harness (new from scratch)
apps/desktop/docs/patterns/main-renderer-ipc.md — Electron process model, contextBridge, register-handlers.ts, type-safe IPC, no nodeIntegration
apps/desktop/docs/patterns/sqlite-and-local-data.md — @moat/db-sqlite, initDesktopDb/getDesktopDb, local vs cloud Prisma, migration strategy
apps/desktop/docs/patterns/local-agent-gateway.md — agent-gateway/ lifecycle, local-token-service.ts, scope-checker.ts, audit-log.ts JSONL, vs HTTP MCP gateway
apps/desktop/docs/patterns/packaging.md — Electron Builder, dist:mac/win, signing, notarization, updater.ts
Create apps/desktop/AGENTS.md — full keystone: non-negotiables (contextBridge only, no direct cloud DB), commands, architecture, change-type routing table, testing matrix, anti-patterns
Phase 6 — Standardization (lower priority)
Update AGENTS.md — format standardization to match new change-type routing table
Update AGENTS.md — same format pass
AGENTS.md — unchanged (appropriately minimal)
Relevant files
Root: CLAUDE.md (shim), new AGENTS.md
Per-app AGENTS.md: web, api, mcp (overhaul), desktop (new), extension/ios (format update)
19 new pattern docs across 4 new patterns directories
Global patterns — untouched (stays as shared reference; per-app docs link back where relevant)
Verification
Every AGENTS.md contains: non-negotiables, commands, code structure, change-type routing table, testing matrix, SDD guidance, anti-patterns
Every pattern file in each app's patterns is linked from that app's routing table
Root AGENTS.md routing table covers all 7 app AGENTS.md files
No broken relative links across files
pnpm --filter moat-web run typecheck and pnpm --filter moat-api run typecheck pass (doc-only changes, but confirms no accidental file mutation)
Decisions
Global patterns stays intact — per-app docs add depth, not replacement
Change-type routing tables replace current "Topic → Read" format everywhere
AGENTS.md stays minimal by design
Harness acceptance rubric (from the example) is out of scope for now — can be added after