# Moat Finance — Engineering Reference

> **The master conventions file has moved.** All non-negotiables, commands, patterns, and routing tables now live in [AGENTS.md](AGENTS.md).

Read [AGENTS.md](AGENTS.md) first. The content below is preserved for tools that read CLAUDE.md directly.

---

## Non-negotiable defaults

- **Authorization is server-side.** UI visibility is not a permission check. Any write action must be gated in the API layer via `withAuth` or `withDemoOrAuth`.
- **Prefer existing patterns.** Do not introduce a new abstraction unless a second concrete use case exists in this codebase.
- **PRs are single-purpose.** Don't mix refactors with new behavior, or unrelated fixes in one PR.
- **No silent failures.** Log meaningful errors, surface typed error responses, and make failures observable.
- **No PII in logs.** Never log email, account numbers, routing numbers, raw transaction descriptions, or tokens.

---

## Quick commands

| Task | Command (from repo root) |
|------|--------------------------|
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
| Sync main → staging (runs full CI, then deploys) | `pnpm sync:branches` |
| Release cloud / desktop / iOS (last green staging SHA; bumps if tag exists) | `pnpm release:cloud` / `pnpm release:desktop` / `pnpm release:ios` |
| Emergency prod from main | `pnpm release:emergency` (type `PUSH TO PRODUCTION`) |
| Self-host stack (Docker) | `docker compose up -d --build` (see [docs/self-hosting.md](docs/self-hosting.md)) |
| API contract tests | `pnpm --filter moat-api run test:api-contracts` |
| MCP typecheck | `pnpm --filter @moat/mcp run typecheck` |
| MCP lint | `pnpm --filter @moat/mcp run check:write` |

---

## Repo map

| Concern | Location |
|---------|----------|
| Web UI (Next.js App Router) | `apps/web/src/` |
| API routes + services + Prisma | `apps/api/src/` |
| Browser extension (WXT + React) | `apps/extension/` |
| MCP server (Claude / LLM gateway) | `apps/mcp/` |
| iOS app (SwiftUI) | `apps/ios/` |
| Marketing site (static HTML) | `apps/marketing/` |
| OpenAPI spec + codegen | `packages/openapi/` |
| TypeScript API client (SDK) | `packages/client-ts/` |
| MCP tool contracts / types | `packages/mcp-contracts/` |
| Shared retail scraping logic | `packages/retail-sync/` |
| Shared utilities | `packages/shared/` |
| DB schema + migrations | `apps/api/prisma/schema.prisma` |
| Auth handler context | `apps/api/src/server/api-context.ts` |
| Auth handler wrappers | `apps/api/src/server/handler-wrappers.ts` |

---

## If you are working on…

| Topic | Read |
|-------|------|
| Auth & permissions | [docs/patterns/auth-permissions.md](docs/patterns/auth-permissions.md) |
| API handlers / service layer | [docs/patterns/api-patterns.md](docs/patterns/api-patterns.md) |
| State management (Zustand / React Query) | [docs/patterns/state-management.md](docs/patterns/state-management.md) |
| Component organization | [docs/patterns/component-organization.md](docs/patterns/component-organization.md) |
| External integrations (Plaid, PostHog, Axiom) | [docs/patterns/external-integrations.md](docs/patterns/external-integrations.md) |
| MCP tool development | [apps/mcp/AGENTS.md](apps/mcp/AGENTS.md) |
| Browser extension | [apps/extension/AGENTS.md](apps/extension/AGENTS.md) |
| iOS app | [apps/ios/AGENTS.md](apps/ios/AGENTS.md) |
| Web app (routing, components, stores) | [apps/web/AGENTS.md](apps/web/AGENTS.md) |
| API app (handlers, services, Prisma) | [apps/api/AGENTS.md](apps/api/AGENTS.md) |
| Error handling / observability | [docs/patterns/error-handling.md](docs/patterns/error-handling.md) |

---

## Before building a feature

For anything non-trivial, agree on scope first: open a GitHub issue or discussion describing the problem and the proposed approach before writing code.

---

## Anti-patterns (global)

- **Don't put permission checks in React components.** A component that hides a button is not access control. Gate writes in the API layer.
- **Don't call `requireDemoOrAuthenticated()` manually in handlers.** Use the `withAuth` / `withDemoOrAuth` wrappers from `handler-wrappers.ts`.
- **Don't add Prisma to `apps/web`.** The web app is a thin UI layer — all DB access belongs in `apps/api`.
- **Don't copy patterns from `apps/web/prisma/` or `apps/api/apps/`.** These are legacy / migration artifacts.
- **Don't introduce a new state management pattern** (MobX, Jotai, Redux, etc.) — Zustand + React Query is the established stack.
- **Don't log sensitive payloads** — no emails, tokens, account numbers, or raw transaction descriptions in any log.
- **Don't skip the service layer in the API.** Handlers call services; services own business logic and Prisma queries.
- **Don't re-enable the parked Taxes product.** `TAXES_PRODUCT_ENABLED` and iOS `ProductFlags.taxesEnabled` stay false unless a human **explicitly** asks to restore Taxes. Its tax-document extraction path is unfinished.

---

## Conventions

## Git Workflow
- **Never automatically commit changes** — make the changes, run linting/checks, but let the user review and commit manually
- After making code changes, suggest the user review with `git diff` before committing
- Only stage files (`git add`) if explicitly requested by the user

## File Naming
- Use kebab-case for all file names (e.g. `my-component.tsx`, not `MyComponent.tsx`)

## Import Paths
- **Web app (`apps/web`)**: Use `~/` path alias for all imports (e.g. `import { Button } from "~/components/ui/button"`)
  - The `~/` alias maps to `src/*` in tsconfig
  - Never use `@/` in the web app — this will cause TypeScript errors
- **API app (`apps/api`)**: Use relative imports or `~/` alias
- Verify tsconfig.json path mappings before creating new imports

## Component Organization & Modularity
- **Prefer modular components**: Break large component files into smaller, focused modules
- **Extract reusable components**: When a component file contains multiple sub-components (like `category-input`, `condition-row-ui`, `action-row-ui` in a dialog), consider extracting them into separate files
- **Use sub-directories for related components**: Group related components in a dedicated directory structure
  - Example: `rule-builder-dialog/` containing `index.tsx`, `category-input.tsx`, `condition-row.tsx`, `action-row.tsx`, `preview-row.tsx`
- **Extract utility functions**: Helper functions and type definitions should live in separate utility files when they grow beyond simple one-liners
- **Single Responsibility**: Each file should ideally export one primary component or function
- **Counter-example**: Avoid files that contain multiple components and multiple utility functions in a single 300+ line file. For stores or hooks with functions it's okay to have those be long files. This is mainly just for the .tsx files.

## State Management
- **Zustand for UI state, React Query for server state**
- **Default to plain Zustand**: Use standard `set` updates for most stores
- **Immer is opt-in, not default**: Only use for deeply nested or multi-field updates that are hard to read with plain updates
- **Avoid Immer for simple state**: Booleans, IDs, modals, tabs, shallow objects
- **Keep stores small**: If Immer feels needed everywhere, split the store
- **Use `useShallow` for object selectors**
- **Inject external deps via setters (not props)**
- **Expose focused selector hooks (e.g. `useFilterState`)**

## Linting
- After any code changes, run `pnpm lint:fix` from the project root before committing. It formats web, api, desktop, and mcp so CI `check` jobs (including `pnpm --filter moat-desktop run check`) pass.
- For a single app: `pnpm --filter moat-web run check:write`, `pnpm --filter moat-api run check:write`, `pnpm --filter moat-desktop run check:write`, or `pnpm --filter @moat/mcp run check:write`.

## TypeScript — Avoiding Type Assertions

- **Shared-context procedures**: middleware should resolve a `userId: string` into context once rather than asserting per-procedure. See `demoOrProtectedProcedure` in `trpc.ts`.
- **Double-calling functions to check + use**: assign to a `const` first, then narrow with `!== undefined`. Never call the same function twice to assert the second result.
- **`Map.get()` after `Map.set()`**: use `get()` → null check → `set()`, keeping a direct reference. Don't `.get()!` after `.set()`.
- **`array.at(-1)!`**: guard with `const last = arr.at(-1); if (!last) return ...` instead of asserting.
- **`biome-ignore` is acceptable** when suppression is genuinely the right answer (e.g. `document.cookie` — Cookie Store API not widely supported).

## API Handler Wrappers

All API handlers in `apps/api/src/server/handlers/` must use wrapper functions from `handler-wrappers.ts` instead of manual auth checks. Use `withAuth` for handlers that require real authentication (mutations, user-specific writes), `withDemoOrAuth` for handlers that should work in both demo mode and authenticated mode (reads, forecasts, projections), and `withPublic` for unauthenticated endpoints. These wrappers guarantee `userId` is a non-null string in the handler context, eliminating the error-prone pattern of checking `if (!ctx.userId)` after `requireDemoOrAuthenticated()`. The wrapper resolves the correct user ID (demo user or session user) before the handler runs, providing type safety and consistent auth behavior across all endpoints.

## Commit Messages
Format commit and PR titles like `feat (web): creates weekly chart usage report`:
- The prefix is `feat`, `fix`, or `chore`
- The `()` names the app changed (`web`, `api`, `mcp`, `desktop`, …); omit it when the change spans platforms
- Lowercase, one line, 5-7 words

Don't append a suggested commit message to every response; only write one when asked.

## PostHog Analytics Rules
- Event naming: `<domain>_<object>_<action>` (snake_case)
- Examples: `auth_login_completed`, `transaction_edit_completed`, `rule_created`, `forecast_viewed`
- Never use vague events like `button_clicked`
- Every event must include:
  ```ts
  { userId?: string, demoUser?: boolean }
* If logged in → include `userId`
* If not → `{ demoUser: true }`
* Never include both
* Track page views manually on route change using:
  `$pageview` with `{ path }`
* Identify signed-in users with `identify(userId, email)`: distinct ID is `userId`; account email is a person property. Never use email as the distinct ID. Never send `name`.
* Never send on capture events:
  * PII (email, account numbers)
  * raw transaction data
  * merchant names
* Only send on capture events:
  * counts, booleans, enums
* Session recordings, autocapture, heatmaps, and surveys stay disabled in SDK init. Never re-enable them.
* Track only meaningful actions (rules, forecasts)
* Avoid noisy or low-value events

## Logging Rules
- Use the shared logger, not raw `console.*` for app errors
- Log all meaningful failures, especially in `catch` blocks, error branches, and before re-throwing
- Use structured logs with useful context when available: `userId`, `demoUser`, feature, operation, route/procedure
- Use `warn` for recoverable issues and `error` for failed operations
- Never log secrets, tokens, PII, account numbers, routing numbers, raw transaction descriptions, or full sensitive payloads
- Avoid noisy logs; prefer one high-quality log at the failure boundary