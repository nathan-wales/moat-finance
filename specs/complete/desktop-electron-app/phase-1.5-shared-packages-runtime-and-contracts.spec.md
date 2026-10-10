# Phase 1.5 - Desktop app shared packages runtime, contracts, and events.

Overall: yes, this is architecturally sound and you *are* accounting for the Electron desktop app correctly. The key insight — “make business logic portable, not Prisma portable” — is the right foundation.

But there are a few missing layers and some hidden Electron/runtime concerns that will matter later if you want Moat Finance to become a serious local-first financial operating system for agents.

The biggest thing missing is that you currently have:

```txt
packages/domain
packages/data-access
packages/db-postgres
packages/db-sqlite
packages/mcp-contracts   ← planned Phase 5
apps/api
apps/desktop
apps/mcp
```

…but you do **not** yet have a clearly defined:

```txt
packages/app-runtime
```

or

```txt
packages/context
```

layer that standardizes runtime wiring across:

* API
* Electron
* tests
* CLI jobs
* future MCP agents
* local automation
* background sync workers

That becomes important fast.

---

# What You're Missing

## 1. Runtime Composition Layer (Important)

Right now your architecture implies each runtime manually wires dependencies:

```ts
const ctx = await createDesktopAppContext();
```

But that will sprawl.

You should introduce:

```txt
packages/runtime
```

or:

```txt
packages/app-context
```

Responsible for:

* repository composition
* AI provider injection
* feature flags
* auth/user context
* settings
* encryption services
* sync adapters
* telemetry
* event bus
* job scheduling

Example:

```ts
export type AppRuntime = {
  repositories: RepositorySet;
  ai: AiProvider;
  events: EventBus;
  settings: SettingsProvider;
  secrets: SecretsProvider;
  sync: SyncProvider;
};
```

Then:

```ts
const runtime = await createDesktopRuntime();
const runtime = await createApiRuntime();
```

This becomes the real operating system abstraction layer.

Without this, dependency wiring leaks everywhere.

---

# 2. You Need a Background Job Architecture

Electron apps become messy if everything is request-response IPC.

You need:

```txt
packages/jobs
```

or:

```txt
packages/tasks
```

For:

* transaction sync
* recurring imports
* embeddings generation
* forecast recomputation
* AI indexing
* rules execution
* notification scheduling
* conflict resolution
* MCP sync refreshes

Otherwise your Electron main process becomes a giant monolith.

You eventually want:

```txt
Renderer
  ↓
IPC
  ↓
Job Queue
  ↓
Workers
  ↓
Repositories + AI
```

Even locally.

---

# 3. Event System / Domain Events

You’re missing a domain event layer.

You currently have direct imperative flows:

```ts
updateTransaction()
recomputeForecast()
refreshDashboard()
```

That becomes fragile.

Instead:

```ts
TransactionUpdated
BudgetExceeded
AccountSynced
RuleApplied
ForecastGenerated
ScenarioChanged
```

Then:

* dashboards react
* AI context updates
* embeddings regenerate
* sync propagates
* notifications fire

This matters enormously for agents later.

You likely want:

```txt
packages/events
```

with:

* typed event contracts
* local in-memory bus
* future durable queue support

---

# 4. You Need an Indexed Financial Context Layer

This is the largest long-term missing piece.

Right now the AI service builds prompts directly from repositories:

```ts
getDashboardSummary()
getRecentTransactions()
```

That works initially.

But agents eventually need:

* semantic retrieval
* memory
* financial embeddings
* time-aware context
* entity graphs
* long-horizon reasoning

You eventually need something like:

```txt
packages/financial-context
```

Responsible for:

* normalized financial graph
* embeddings
* entity extraction
* semantic indexing
* retrieval pipelines
* context windows
* agent memory

Otherwise prompts become gigantic and slow.

---

# 5. Electron Security Hardening

You mention:

* preload bridge
* no Prisma in renderer

Good.

But for a financial app you should explicitly define:

## Required Electron Security Constraints

```txt
contextIsolation: true
sandbox: true
nodeIntegration: false
enableRemoteModule: false
```

Also:

* strict IPC allowlists
* zod validation on every IPC boundary
* CSP headers
* signed auto-updates
* encrypted local DB
* renderer never touches filesystem directly

You should probably add a dedicated:

```txt
packages/security
```

eventually.

---

# 6. SQLite Encryption

Right now:

> SQLite local file

That is not enough for financial data.

You eventually need:

* SQLCipher
  or
* encrypted application-level fields

Especially for:

* account numbers
* access tokens
* institution metadata
* AI memory
* imported tax docs

Otherwise “local-first” still means:

> anyone with laptop access owns the data.

---

# 7. Sync Architecture Is Underdefined

Your “Phase 4 Import and Sync” is currently too small for what Moat Finance is becoming.

You actually need:

```txt
packages/sync
```

Handling:

* local ↔ cloud reconciliation
* conflict resolution
* offline mutations
* eventual consistency
* optimistic updates
* merge strategies
* encrypted sync payloads
* selective sync
* account-level sync permissions

Because eventually users will:

* use desktop + web + iOS simultaneously
* run local-only data
* partially sync subsets
* allow agents access to only certain scopes

This becomes core infrastructure.

---

# 8. MCP Gateway Needs First-Class Architecture

This is the most important strategic layer in Moat Finance and it’s barely represented here.

You mention MCP conceptually, but not architecturally.

You should eventually have:

```txt
packages/mcp
```

Containing:

* tool registry
* permission scopes
* audit logging
* agent execution policies
* context serialization
* financial query APIs
* streaming tool responses
* agent-safe abstractions

Because your real moat is likely:

> “Financial operating system for AI agents”

not dashboards.

---

# 9. Agent Infrastructure Will Grow Fast

> **Updated:** Phase 5 pivots from built-in Ollama/LLM integration to a **local agent gateway** (MCP + financial context OS). See [phase-5-agent-gateway.spec.md](phase-5-agent-gateway.spec.md).

Moat Finance is not an inference company. The moat is financial memory infrastructure — ontology, permissions, scoped tools — that any agent connects to.

Eventually the agent layer needs:

* local MCP server + permissions
* financial knowledge graph / ontology
* embeddings and semantic search (later)
* rerankers, structured extraction (later)
* tool-calling via shared contracts
* vector storage hooks

Likely package evolution:

```txt
packages/mcp-contracts      ← shared tool schemas (cloud + desktop)
packages/mcp-local          ← desktop gateway implementation
packages/financial-graph    ← ontology, entities, memories (future)
```

Not `packages/ai` with Ollama/OpenAI providers as the primary desktop deliverable.

---

# 10. You Need Shared Schema Contracts

Right now repositories define interfaces.

Good.

But you also need:

* DTO schemas
* IPC contracts
* API contracts
* event contracts
* sync payload contracts

Likely via:
Zod

Something like:

```txt
packages/contracts
```

This becomes the universal language of the system.

Especially critical for:

* Electron IPC
* MCP tools
* sync engine
* API
* mobile
* local agents

---

# Biggest Architectural Strength

This is the strongest decision in the entire roadmap:

```txt
Apps become thin adapters.
```

That is exactly correct.

You are building:

* a financial engine
* with multiple runtimes

not:

* a web app with a desktop client

That distinction matters a lot.

---

# Biggest Risk

The biggest risk is accidentally recreating a giant distributed monolith where:

* Electron main
* API routes
* AI services
* sync logic
* imports
* jobs

all start directly calling each other.

The cure is:

* repository boundaries
* runtime composition
* domain events
* contracts
* job system

Those four things keep the architecture survivable at scale.

---

# My Main Recommendation

Before Phase 2, I would strongly consider adding:

```txt
packages/runtime
packages/contracts
packages/events
```

Those three packages will prevent a lot of future architectural pain.
