# apps/web — Agent Overlay

> **Baseline**: Read [CLAUDE.md](../../CLAUDE.md) first. This file adds web-specific context on top of it.

---

## Purpose

`apps/web` is the primary user-facing Next.js App Router application. It is a **thin UI layer** — it owns routing, rendering, and client-side state, but delegates all data access and business logic to `apps/api`.

---

## Commands

| Task | Command (from repo root) |
|------|--------------------------|
| Dev | `pnpm --filter moat-web run dev` |
| Typecheck | `pnpm --filter moat-web run typecheck` |
| Lint + format | `pnpm --filter moat-web run check:write` |

---

## Code structure

```
apps/web/src/
├── app/                    ← Next.js App Router routes
│   ├── (dashboard)/        ← Main authenticated dashboard layout
│   ├── auth/               ← Auth pages (sign-in, sign-up)
│   ├── onboarding/         ← New user onboarding flow
│   ├── household/          ← Household management
│   ├── mcp/                ← MCP OAuth consent page
│   └── extension/          ← Extension redirect/callback pages
├── components/             ← React components, organized by domain
│   ├── ui/                 ← shadcn/ui base primitives
│   ├── charts/
│   ├── dashboard/
│   ├── agent/
│   └── ...
├── context/                ← React context providers
├── lib/
│   ├── hooks/              ← Shared custom hooks
│   ├── logger.ts           ← Client-side logger (Axiom)
│   ├── posthog.ts          ← Analytics
│   ├── api/                ← OpenAPI-generated client + React Query wrappers
│   └── ...                 ← Feature utilities (budget-utils, forecasting, etc.)
├── server/                 ← Server-only utilities (auth config, server actions)
├── middleware.ts            ← Auth redirect middleware
└── env.js                  ← Type-safe environment variables (t3-env)
```

---

## Architecture

### Data fetching

The web app calls `apps/api` over HTTP using the OpenAPI-generated client from `packages/openapi/`. React Query manages server state (caching, loading, refetching). Never add Prisma or direct DB access to `apps/web`.

```
Component → React Query hook → OpenAPI client → apps/api REST endpoint
```

### Client-side state

Zustand stores live in `src/lib/`. See [docs/patterns/state-management.md](../../docs/patterns/state-management.md).

### Auth

NextAuth.js handles sessions in the web app. Auth pages are in `app/auth/`. Middleware enforces route protection in `middleware.ts`. See [docs/patterns/auth-permissions.md](../../docs/patterns/auth-permissions.md).

---

## Key conventions

- **Components are organized by domain**, not by type. Shared primitives live in `components/ui/` (and the shared `@moat/ui` package for cross-platform / `packages/features` UI).
- **Use design-system components, not native HTML controls.** Prefer `Button`, `Select`, `Dialog`, `Input`, `Checkbox`, etc. from `~/components/ui/*` or `@moat/ui` over `<button>`, `<select>`, and similar native elements when a primitive exists.
- **Use `~/server/` only for truly server-only code** (server actions, NextAuth config). Don't import server modules from client components.
- **No ternaries in JSX.** Compute conditional strings, values, and class names in `const` bindings before `return`. Use at most one ternary per expression; never nest ternaries — extract multi-branch logic into a helper function instead. See [docs/patterns/components.md](docs/patterns/components.md).

---

## Change-type routing table

| When you are doing X… | Read |
|-----------------------|------|
| Adding a new page, route, or layout | [docs/patterns/routing-and-pages.md](docs/patterns/routing-and-pages.md) |
| Adding or refactoring a React component | [docs/patterns/components.md](docs/patterns/components.md) |
| Adding data fetching (React Query hook) | [docs/patterns/state-and-data.md](docs/patterns/state-and-data.md) |
| Adding or modifying a Zustand store | [docs/patterns/state-and-data.md](docs/patterns/state-and-data.md) |
| Changing auth redirects, session shape, or demo mode | [docs/patterns/auth-and-sessions.md](docs/patterns/auth-and-sessions.md) |
| Writing or updating tests | [docs/patterns/testing.md](docs/patterns/testing.md) |
| Deep-dive on Zustand/React Query patterns | [../../docs/patterns/state-management.md](../../docs/patterns/state-management.md) |
| Deep-dive on component organization | [../../docs/patterns/component-organization.md](../../docs/patterns/component-organization.md) |
| Deep-dive on auth/permissions | [../../docs/patterns/auth-permissions.md](../../docs/patterns/auth-permissions.md) |

## Testing matrix

| Change type | Test approach |
|-------------|---------------|
| React component | React Testing Library render test |
| Custom hook | `renderHook` with QueryClient wrapper |
| Zustand store | Direct store unit test |
| Page-level integration | Mock API + full page render |
| Critical flow | Playwright e2e |

See [docs/patterns/testing.md](docs/patterns/testing.md) for examples.

---

## SDD guidance

Before building any non-trivial feature in the web app, check for a spec in `specs/features/[feature]/spec.md`. If none exists, write one. Read [../../specs/mission.md](../../specs/mission.md) and [../../specs/roadmap.md](../../specs/roadmap.md) to understand product context.

---

## Anti-patterns

- **Don't add Prisma to `apps/web`.** `apps/web/prisma/` is a legacy artifact currently being removed. See `specs/features/auth-migration/spec.md`.
- **Don't use `@/` imports** — only `~/` works with the tsconfig alias.
- **Don't call the API server directly from React render** — use React Query hooks so loading/error/caching are handled consistently.
- **Don't import from `apps/api/` directly** — the boundary is HTTP only.
- **Don't use native `<button>` / `<select>` (etc.)** when a design-system primitive exists in `~/components/ui` or `@moat/ui`.

---

## Active work

- Auth + Prisma migration: [specs/features/auth-migration/spec.md](../../specs/features/auth-migration/spec.md)
- Goals feature: [specs/features/goals/spec.md](../../specs/features/goals/spec.md)
