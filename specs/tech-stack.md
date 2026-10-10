# Moat Finance — Tech Stack

This is the canonical stack reference. Read this before making technology or dependency decisions to avoid introducing duplicates or inconsistencies.

---

## apps/web (Next.js UI)

| Concern | Technology |
|---------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Component library | shadcn/ui (on top of Radix UI primitives) |
| Icons | Lucide React |
| Client state | Zustand |
| Server state / data fetching | React Query (via generated hooks) |
| API client | Orval-generated TypeScript client from OpenAPI spec |
| Auth (web session) | NextAuth.js |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Animations | Framer Motion |
| Environment variables | t3-env (type-safe env) |
| Logger | Axiom (via `apps/web/src/lib/logger.ts`) |
| Analytics | PostHog |
| Linter / formatter | Biome |
| E2E | Playwright (`@playwright/test` in `apps/web` and `apps/desktop`, `test:e2e:plaid-golden`) |
| Package manager | pnpm (workspace) |
| Deploy | Docker Compose (self-hosted, see docs/self-hosting.md) |

**Do not add**: Jotai, MobX, Redux, TanStack Router, SWR, Axios, moment.js

---

## apps/api (Backend)

| Concern | Technology |
|---------|-----------|
| Framework | Next.js 14 (API routes in `pages/api/`) |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (Neon, serverless) |
| Auth | JWT (custom — `apps/api/src/server/auth/`) + NextAuth session cookies |
| Bank data | Plaid |
| Email | Resend |
| Logger | Axiom (via `apps/api/src/lib/logger.ts`) |
| Validation | Zod |
| Linter / formatter | Biome |
| Deploy | Docker Compose (self-hosted, see docs/self-hosting.md) |

**Do not add**: TypeORM, Drizzle, Sequelize, any second ORM or query builder

---

## apps/extension (Chrome Extension)

| Concern | Technology |
|---------|-----------|
| Framework | WXT (WebExtension eXtensible Toolkit) |
| UI | React 19 |
| Language | TypeScript |
| Styling | CSS (scoped, no Tailwind in extension) |
| Storage | Chrome Storage API (via `lib/chrome-storage.ts`) |
| Messaging | Chrome runtime messaging (via `lib/messaging.ts`) |
| Manifest | V3 |
| Validation | Zod |
| Shared logic | `packages/retail-sync` |
| Deploy | Chrome Web Store (manual zip upload) |

---

## apps/mcp (MCP Gateway)

| Concern | Technology |
|---------|-----------|
| Framework | Express |
| Protocol | MCP SDK (Anthropic) |
| Language | TypeScript |
| Runtime | Node.js with tsx |
| Transports | HTTP + stdio (local) |
| Auth | PAT + OAuth 2.0 with PKCE |
| Rate limiting | Upstash Redis |
| Logging / audit | Axiom |
| ORM | Prisma (same DB as apps/api) |
| Validation | Zod |
| Shared types | `packages/mcp-contracts` |
| Deploy | Docker Compose (self-hosted, see docs/self-hosting.md) |

---

## apps/ios (iOS App)

| Concern | Technology |
|---------|-----------|
| Framework | SwiftUI |
| Language | Swift |
| Minimum iOS | iOS 16.0 |
| Token storage | iOS Keychain |
| Environment config | xcconfig files |
| FinanceKit (Apple Wallet) | iOS 17.4+ only |
| Build | Xcode |

---

## packages/

| Package | Purpose |
|---------|---------|
| `packages/openapi/` | OpenAPI spec (`api-v1.yaml`) + Orval codegen config |
| `packages/client-ts/` | Generated TypeScript API client |
| `packages/mcp-contracts/` | Shared MCP scopes, client profiles, tool schemas |
| `packages/retail-sync/` | Retail order parser/domain logic (shared between extension and API) |
| `packages/shared/` | Shared utilities used across apps |
| `packages/config/` | Shared TypeScript and Biome config |

---

## Global tooling

| Concern | Technology |
|---------|-----------|
| Monorepo | pnpm workspaces |
| Build orchestration | Turborepo |
| Linter / formatter | Biome (all JS/TS apps) |
| E2E | Playwright (`apps/web` + `apps/desktop` Plaid Golden, path-filtered CI) |
| Package manager | pnpm |
