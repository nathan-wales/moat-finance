# Moat Finance Desktop — Electron App Roadmap

## Overview

Moat Finance Desktop is a local-first Electron application that lets users run Moat Finance entirely on their machine — no account required, no cloud dependency by default.

The desktop app shares business logic with the cloud API through shared packages, stores data locally in SQLite, and (Phase 5+) exposes a **local agent gateway** so any MCP-compatible agent can access scoped financial context — without Moat Finance becoming an LLM or inference provider.

This document tracks the full scope and phased plan. Individual feature areas link to detailed specs.

### Detailed specs

| Phase | Spec | Status |
|---|---|---|
| 1 — Shared packages | [phase-1-shared-packages.spec.md](phase-1-shared-packages.spec.md) | ✅ Complete |
| 1.5 — Runtime + contracts | [phase-1.5-shared-packages-runtime-and-contracts.spec.md](phase-1.5-shared-packages-runtime-and-contracts.spec.md) | ✅ Complete |
| 2 — SQLite database | [phase-2-sqlite-database.spec.md](phase-2-sqlite-database.spec.md) | ✅ Complete |
| 3 — Shared UI | [phase-3-shared-ui-packages-and-consumption.md](phase-3-shared-ui-packages-and-consumption.md) | 🟡 In progress |
| **4 — Desktop v1 beta** | [phase-4-desktop-v1-beta.spec.md](phase-4-desktop-v1-beta.spec.md) | ⬜ Next |
| **5 — Agent gateway** | [phase-5-agent-gateway.spec.md](phase-5-agent-gateway.spec.md) | ⬜ After Phase 4 |
| 6+ — Plaid, sync, full parity | See "Future phases" below | ⬜ Deferred |

> **Note:** Phase 4 in this repo consolidates import/sync, feature IPC wiring, and packaging/distribution into one shippable beta milestone. Phase 5 adds the local agent gateway (MCP). Older roadmap labels ("Phase 3: AI") referred to since-superseded Ollama plans — see [phase-5-agent-gateway.spec.md](phase-5-agent-gateway.spec.md).

---

## Mental Model

> **Don't make Prisma portable. Make your business logic portable.**

Prisma is an implementation detail hidden behind repository interfaces. Domain services never call Prisma directly — they call repository methods. This is the unlock that lets the same business logic run against Postgres in the cloud and SQLite on the desktop.

```txt
apps/api                        apps/desktop
  ↓                               ↓
packages/domain ←————————————————→ packages/domain
  ↓                               ↓
packages/data-access interfaces   packages/data-access interfaces
  ↓                               ↓
packages/db-postgres              packages/db-sqlite
  ↓                               ↓
Postgres                         SQLite (local file)
```

Apps become thin adapters. All business logic lives in shared packages.

---

## Phase 1: Shared Package Extraction

### Goal

Extract business logic from `apps/api` into shared packages. This is the prerequisite for everything else — the desktop app, agent gateway portability, and testability all depend on it.

→ **Detailed spec:** [phase-1-shared-packages.md](phase-1-shared-packages.md)

### New Packages

```txt
packages/data-access
  Repository interfaces (provider-agnostic)
  No Prisma. No runtime dependencies.

packages/domain
  Pure business logic, calculations, and service functions
  Calls repository interfaces via AppContext
  No HTTP. No Electron. No Prisma.

packages/db-postgres
  Implements packages/data-access interfaces
  Uses existing Prisma Postgres client
  Only used by apps/api
```

### Repository Interface Pattern

Domain code never does this:

```ts
// Bad — Prisma leaks into domain logic
const transactions = await prisma.transaction.findMany({ ... });
```

It does this:

```ts
// Good — domain calls a repository interface
const transactions = await ctx.repositories.transactions.listForDashboard({ ... });
```

Example interface in `packages/data-access`:

```ts
export interface TransactionRepository {
  listForDashboard(input: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<DashboardTransaction[]>;
}
```

Implemented separately per provider:

```ts
// packages/db-postgres
class PostgresTransactionRepository implements TransactionRepository { ... }

// packages/db-sqlite (Phase 2)
class SqliteTransactionRepository implements TransactionRepository { ... }
```

### Migration Order

Migrate domain slices in this order (each one unblocks Phase 2 for that slice):

```txt
1. Dashboard summary
2. Transactions list/edit
3. Rules engine
4. Forecasting/scenarios
5. Budgets
6. Investments
7. Imports
8. Agent gateway / MCP tools (Phase 5)
```

### Per-Slice Pattern

```txt
1. Identify current API handler + service logic for the slice
2. Define repository interface(s) in packages/data-access
3. Extract pure business logic into packages/domain service function(s)
4. Implement Postgres repository in packages/db-postgres
5. Update apps/api handler to call the shared domain service
6. Verify apps/api behavior is unchanged
7. Add tests around domain logic
```

### App Responsibilities After Migration

```txt
apps/api
  HTTP / auth / session / permissions only
  calls packages/domain services

apps/desktop (Phase 2+)
  Electron IPC / local auth / local settings only
  calls packages/domain services through IPC handlers
```

---

## Phase 2: SQLite Local Database for Desktop

### Goal

Add a local SQLite database for `apps/desktop` by implementing the `packages/data-access` repository interfaces against a separate Prisma SQLite client. The desktop app runs entirely without calling any deployed API.

→ **Detailed spec:** [spec.md](spec.md)

### Key Principle: Two Prisma Schemas

Do not try to share one Prisma schema between Postgres and SQLite.

```txt
packages/db-postgres/prisma/schema.prisma   ← cloud
packages/db-sqlite/prisma/schema.prisma     ← desktop
```

Postgres and SQLite differ enough (enums, JSON, full-text search, decimal handling, indexing) that forcing one schema to serve both will create pain. Keep them aligned where practical but let them diverge where needed.

### New Package

```txt
packages/db-sqlite
  prisma/
    schema.prisma          ← SQLite-specific schema
  src/
    index.ts
    createSqliteClient.ts
    ensureLocalDatabase.ts
    migrations.ts
    repositories/
      SqliteTransactionRepository.ts
      SqliteAccountRepository.ts
      SqliteDashboardRepository.ts
```

### Startup Flow

```txt
Electron app ready
  ↓
resolve local DB path (OS app data dir)
  ↓
ensure directory exists
  ↓
initialize Prisma SQLite client
  ↓
run migrations / ensure schema
  ↓
seed default local user ("local-user")
  ↓
open window
```

### Constraints

- Prisma client must not be exposed to the renderer
- All DB access goes through Electron main IPC handlers
- Preload bridge is the only renderer surface

---

## Phase 5: Local Agent Gateway (Financial Context OS)

**Depends on:** Phase 4 (desktop v1 beta)

→ **Detailed spec:** [phase-5-agent-gateway.spec.md](phase-5-agent-gateway.spec.md)

### Strategic position

Moat Finance is **not** an LLM provider, agent provider, or inference company. Moat Finance is the **secure local financial memory and tool layer** that any AI agent can connect to — model-agnostic infrastructure ("Stripe for financial agent context").

The LLM can live anywhere (local Ollama, Claude, GPT, etc.). Moat Finance owns the data/context layer.

### Goal

Prepare the desktop app to expose a **local-first agent gateway**:

```txt
[SQLite DB]
      ↓
[Electron main / local daemon]
      ↓
[Local MCP server — localhost]
      ↓
[Any MCP-compatible agent + user's chosen LLM]
```

### Phase 5 delivers

```txt
- Local MCP server (stdio + localhost) wired to packages/domain + SQLite
- Permissions, scoped tool access, local audit log
- Financial context ontology v1 (structured entities beyond raw rows)
- Shared tool contracts aligned with apps/mcp where practical
- Desktop settings UX for agent connectivity
- Developer docs (Claude Desktop, Cursor, custom agents)
```

### Phase 5 does NOT deliver

```txt
- Proprietary LLMs or hosted inference
- "Moat Finance AI" chat as the primary product
- Ollama integration as a first-class Moat Finance feature (agents bring their own models)
- Heavy agent orchestration
- Plaid, extension sync, full investment parity (Phase 6+)
```

### Example flows

**Local LLM:**

```txt
Ollama → Agent → localhost Moat Finance MCP → SQLite
```

**Cloud LLM:**

```txt
Claude/GPT → local bridge → localhost Moat Finance MCP → scoped tool outputs only
```

Cloud models never receive raw full DB access — only scoped tool responses the user authorized.

---

## Phase 4: Desktop v1 Beta (current milestone)

**Depends on:** Phases 1–3 (Phase 3 can complete in parallel with 4.1–4.2)

→ **Detailed spec:** [phase-4-desktop-v1-beta.spec.md](phase-4-desktop-v1-beta.spec.md)

Covers:

```txt
- IPC handlers for full FinApiClient surface
- Write repositories + domain mutations
- CSV import (OFX/QFX stretch)
- Seed data + first-run experience
- Port transactions, budget, spending, rules to @moat/features
- electron-builder packaging, code signing, GitHub Releases, auto-update
```

Import sources in v1 beta: **CSV** (primary). Plaid, extension sync, and Apple FinanceKit remain Phase 6+.

Dashboard features delivered in Phase 4:

```txt
- Overview (net worth from accounts, monthly aggregates, cash flow)
- Transaction list, edit, delete
- Category budgets
- Spending breakdown and trends
- Rules engine (CRUD + apply on import)
```

Degraded in v1: full portfolio allocation, balance snapshot history, investments.

---

## Constraints (All Phases)

- Prisma client must never be exposed to the renderer process
- Agent/MCP tool handlers must never bypass the shared domain service layer
- Provider-specific LLM code must not appear inside Moat Finance desktop — agents bring their own models
- User financial data must not leave the machine except via explicit, scoped tool responses the user authorized
- Agent access is disabled by default; cloud model usage via agents is opt-in only
- No PII in logs at any layer
