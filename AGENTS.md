# Moat Finance — Root Engineering Harness

> **This is the master conventions file.** Every app-specific `AGENTS.md` inherits these rules and adds local depth on top. When in doubt, this file wins.

---

## Non-negotiables

- **Authorization is server-side.** UI visibility is UX — it is never access control. Any write action must be gated in `apps/api` via `withAuth` or `withDemoOrAuth`.
- **Modular code, single responsibility.** Each file exports one primary component or function. When a `.tsx` file grows beyond ~200 lines with multiple sub-components, split it into a sub-directory.
- **Prefer existing patterns.** Do not introduce a new abstraction unless a second concrete use case already exists in this codebase.
- **PRs are single-purpose.** Never mix refactors with new behavior, or unrelated fixes in one PR.
- **No silent failures.** Log meaningful errors, surface typed error responses, and make failures observable.
- **No PII in logs.** Never log email, account numbers, routing numbers, raw transaction descriptions, or tokens.
- **Postgres schema changes use migrations only.** Never `db push` on a shared or deployed database; never apply deployed (production) schema changes from local `.env`. See [apps/api/docs/patterns/prisma-and-migrations.md](apps/api/docs/patterns/prisma-and-migrations.md).
- **SDD first on non-trivial features.** Before writing code, read or write a `specs/features/[feature]/spec.md`. See [specs/README.md](specs/README.md) for how to write good specs, plus [specs/mission.md](specs/mission.md) and [specs/roadmap.md](specs/roadmap.md).

---

## Git workflow

- **Never automatically commit changes.** Make the changes, run `pnpm lint:fix` (and typecheck for the apps you touched), then let the user review and commit manually.
- **Only stage files (`git add`) if explicitly asked.**
- After code changes, suggest the user review with `git diff` before committing.
- Provide a commit message at the end of each session in the format: `feat (web): creates weekly chart usage report`

---

## File naming

- **kebab-case for all files** — `my-component.tsx`, not `MyComponent.tsx`.

---

## Import paths

| App | Alias | Maps to |
|-----|-------|---------|
| `apps/web` | `~/` | `src/*` |
| `apps/api` | `~/` | `src/*` |
| `apps/desktop` renderer | `~/` | `src/renderer/src/*` |

Never use `@/` in `apps/web` — it will cause TypeScript errors.

---

## Design system (`@moat/ui`)

Shared interactive UI comes from `@moat/ui` (Button, Select, Dialog, Input, Checkbox, etc.).

- **Prefer design-system primitives over native HTML** for controls such as `<button>`, `<select>`, checkboxes, dialogs, and menus.
- **Cross-platform / shared UI** (`packages/features`, desktop renderer) must import from `@moat/ui`.
- **Web app-local UI** may use `~/components/ui/*` (same design system surface) or `@moat/ui` — never invent a one-off native control when a primitive already exists.
- Do not import Radix primitives directly in app or feature code; go through `@moat/ui` / `~/components/ui`.
- Prefer icon glyphs without enclosing circles (e.g. `magnifyingglass`, not `magnifyingglass.circle`).

---

## State management

- **Zustand for UI state, React Query for server state** — do not introduce MobX, Jotai, Redux, or any other pattern.
- Default to plain `set` updates in Zustand. Immer is opt-in, only for deeply nested multi-field updates.
- Use `useShallow` for object selectors. Keep stores small; expose focused selector hooks.

---

## TypeScript — avoiding type assertions

- Assign to a `const`, then narrow with `!== undefined` — never call the same function twice to assert the second call.
- Use `withAuth` / `withDemoOrAuth` to get a guaranteed non-null `userId` in API handlers.
- Guard `arr.at(-1)` before using the result rather than asserting with `!`.

---

## Analytics (PostHog)

- Event naming: `<domain>_<object>_<action>` snake_case — e.g. `transaction_edit_completed`.
- Every event must include `{ userId?: string, demoUser?: boolean }` — never both.
- Identify signed-in users with `identify(userId, email)`: distinct ID is `userId`; account email is a person property for display. Never use email as the distinct ID. Never send `name`.
- Event payloads: only counts, booleans, enums, and non-sensitive IDs. Never send email, name, account numbers, or raw transaction data on capture events.
- Session recordings, autocapture, heatmaps, and surveys stay disabled in PostHog SDK init. Never re-enable them.

---

## Logging

- Use the shared `logger`, not raw `console.*`.
- Use `warn` for recoverable issues, `error` for failed operations.
- Include structured context where useful: `userId`, `demoUser`, feature, operation.
- Never log tokens, secrets, PII, account numbers, or raw transaction descriptions.

---

## Quick commands (repo root)

| Task | Command |
|------|---------|
| Install all deps | `pnpm install` |
| Dev: web | `pnpm --filter moat-web run dev` |
| Dev: api | `pnpm --filter moat-api run dev` |
| Dev: extension | `pnpm --filter moat-finance-extension run dev` |
| Dev: mcp | `pnpm --filter @moat/mcp run dev:http` |
| Dev: desktop | `pnpm --filter moat-desktop run dev` |
| Lint + format (all commit targets) | `pnpm lint:fix` |
| Lint + format (web) | `pnpm --filter moat-web run check:write` |
| Lint + format (api) | `pnpm --filter moat-api run check:write` |
| Typecheck (web) | `pnpm --filter moat-web run typecheck` |
| Typecheck (api) | `pnpm --filter moat-api run typecheck` |
| Build extension | `pnpm --filter moat-finance-extension run build` |
| Zip extension (Chrome Web Store) | `pnpm --filter moat-finance-extension run zip` |
| Zip extension (localhost) | `pnpm --filter moat-finance-extension run zip:development` |
| Dist desktop (mac) | `pnpm --filter moat-desktop run dist:mac` |
| Dist desktop (win) | `pnpm --filter moat-desktop run dist:win` |
| Sync main → staging (runs CI + Plaid goldens, then deploys staging) | `pnpm sync:branches` |
| Release cloud / desktop (last green staging SHA; bumps if tag exists) | `pnpm release:cloud` / `pnpm release:desktop` |
| Release iOS (bumps version, tags `ios-v*` → TestFlight) | `pnpm release:ios` |
| Emergency prod from main | `pnpm release:emergency` (type `PUSH TO PRODUCTION`) |
| Self-host stack (Docker) | `docker compose up -d --build` (see [docs/self-hosting.md](docs/self-hosting.md)) |
| API contract tests | `pnpm --filter moat-api run test:api-contracts` |
| MCP typecheck | `pnpm --filter @moat/mcp run typecheck` |
| MCP lint | `pnpm --filter @moat/mcp run check:write` |
| Desktop lint | `pnpm --filter moat-desktop run check:write` |
| Desktop typecheck | `pnpm --filter moat-desktop run typecheck` |

### Release pipeline (hosted instance)

The maintainer's hosted instance (app.moatfinance.ai) deploys from this repo. There is no billing anywhere in the pipeline.

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | push / PR to `main`, `workflow_call` | Lint, typecheck, API contract tests (no secrets) |
| `deploy-staging.yml` | push to `staging` (via `pnpm sync:branches`) | `ci.yml` + Plaid golden e2e (web + desktop), then migrate + deploy api, mcp, web, marketing to Vercel preview |
| `deploy-production.yml` | tag `cloud-v*` (via `pnpm release:cloud`) | `ci.yml`, build, migrate, deploy api, mcp, web, marketing to Vercel production |
| `desktop-release.yml` | tag `desktop-v*` (via `pnpm release:desktop`) | Signed mac + linux builds → GitHub Release + R2 downloads |
| `ios-release.yml` | tag `ios-v*` (via `pnpm release:ios`) | Build + upload to TestFlight |
| `plaid-sandbox-nightly.yml` | nightly schedule | Plaid sandbox smoke tests (skips without sandbox secrets) |

Deploy workflows only run on pushes to `main`/`staging`, tags, schedules, or `workflow_dispatch` — never `pull_request_target` — so fork PRs never see secrets. Scheduled jobs (Vercel crons and the self-host crontab) come from the `crons` array in `apps/api/vercel.json`.

---

## Repo map

| Concern | Location |
|---------|----------|
| Web UI (Next.js App Router) | `apps/web/src/` |
| API routes + services + Prisma | `apps/api/src/` |
| Browser extension (WXT + React) | `apps/extension/` |
| MCP server (Claude / LLM gateway) | `apps/mcp/` |
| iOS app (SwiftUI) | `apps/ios/` |
| Desktop app (Electron) | `apps/desktop/` |
| Marketing site (static HTML) | `apps/marketing/` |
| OpenAPI spec + codegen | `packages/openapi/` |
| TypeScript API client (SDK) | `packages/client-ts/` |
| MCP tool contracts / types | `packages/mcp-contracts/` |
| Shared retail scraping logic | `packages/retail-sync/` |
| Shared utilities | `packages/shared/` |
| Design system (Button, Select, Dialog, …) | `packages/ui/` (`@moat/ui`) |
| Shared feature UI | `packages/features/` |
| IPC channel contracts + types | `packages/contracts/` |
| SQLite Prisma client (desktop) | `packages/db-sqlite/` |
| DB schema (Postgres) | `apps/api/prisma/schema.prisma` |
| Auth handler context | `apps/api/src/server/api-context.ts` |
| Auth handler wrappers | `apps/api/src/server/handler-wrappers.ts` |

---

## App routing table — where to go for what

| When you are working on… | Read |
|--------------------------|------|
| Web UI, routing, components, stores | [apps/web/AGENTS.md](apps/web/AGENTS.md) |
| API handlers, services, Prisma | [apps/api/AGENTS.md](apps/api/AGENTS.md) |
| MCP tools, auth, transports | [apps/mcp/AGENTS.md](apps/mcp/AGENTS.md) |
| Desktop app (Electron, SQLite, IPC) | [apps/desktop/AGENTS.md](apps/desktop/AGENTS.md) |
| Browser extension (WXT, Chrome MV3) | [apps/extension/AGENTS.md](apps/extension/AGENTS.md) |
| iOS app (SwiftUI, FinanceKit) | [apps/ios/AGENTS.md](apps/ios/AGENTS.md) |
| Marketing site (static HTML) | [apps/marketing/AGENTS.md](apps/marketing/AGENTS.md) |

---

## Global pattern docs (shared reference)

| Topic | Read |
|-------|------|
| Auth & permissions (deep-dive) | [docs/patterns/auth-permissions.md](docs/patterns/auth-permissions.md) |
| API handler + service patterns | [docs/patterns/api-patterns.md](docs/patterns/api-patterns.md) |
| State management (Zustand + RQ) | [docs/patterns/state-management.md](docs/patterns/state-management.md) |
| Component organization | [docs/patterns/component-organization.md](docs/patterns/component-organization.md) |
| External integrations (Plaid, PostHog) | [docs/patterns/external-integrations.md](docs/patterns/external-integrations.md) |
| Error handling & observability | [docs/patterns/error-handling.md](docs/patterns/error-handling.md) |
| Prisma schema + Neon migrations | [apps/api/docs/patterns/prisma-and-migrations.md](apps/api/docs/patterns/prisma-and-migrations.md) |
| MCP tool patterns | [docs/patterns/mcp-tools.md](docs/patterns/mcp-tools.md) |

---

## Anti-patterns (global)

- **Don't put permission checks in React components.** Hiding a button is not access control.
- **Don't call `requireDemoOrAuthenticated()` manually** — use the wrappers.
- **Don't add Prisma to `apps/web`.** All DB access belongs in `apps/api`.
- **Don't introduce a new state management pattern** — Zustand + React Query is the stack.
- **Don't log sensitive payloads** — no emails, tokens, account numbers, or raw transaction descriptions.
- **Don't skip the service layer in the API.** Handlers call services; services own business logic.
- **Don't use `pnpm db:push` on Neon Postgres** — use committed migrations via `pnpm db:migrate:dev` locally and `migrate deploy` on deployed databases.
- **Don't use `contextBridge` to expose raw Node.js modules or Prisma** in the desktop app — expose typed, scoped IPC channels only.
- **Don't use native HTML controls** (`<button>`, `<select>`, etc.) when `@moat/ui` / `~/components/ui` already provides the primitive.
- **Don't re-enable the parked Taxes product.** `TAXES_PRODUCT_ENABLED` and iOS `ProductFlags.taxesEnabled` stay false unless a human **explicitly** asks to restore Taxes. Flipping the flag is not enough: the tax-document extraction path (`TAX_LLM_EXTRACTION_ENABLED`) is unfinished and must be proven end to end first. See the comment on `TAXES_PRODUCT_ENABLED`.
