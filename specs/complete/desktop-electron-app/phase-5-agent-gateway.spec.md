# Phase 5: Local Agent Gateway — Financial Context OS

## Prerequisite

**Phase 4 (Desktop v1 beta) must be complete.**

| Phase | Status | Spec |
|---|---|---|
| 4 — Desktop v1 beta | ⬜ Prerequisite | [phase-4-desktop-v1-beta.spec.md](phase-4-desktop-v1-beta.spec.md) |
| **5 — Agent gateway** | ⬜ This spec | — |

---

## Strategic Position

Moat Finance Desktop is **not** an LLM provider, agent provider, or inference company.

Moat Finance is:

> **The secure local financial memory and tool layer that any AI agent can connect to.**

Not:

- "chat with your finances"
- "our proprietary AI"
- "our own model"

Instead:

- standardized financial ontology
- local-first storage
- permissioned access
- agent interoperability
- secure personal finance MCP layer

**Positioning:** "The secure local financial memory layer for AI agents" — or "Financial infrastructure for personal AI."

The LLM can live anywhere (local Ollama, Claude, GPT, Apple Intelligence). Moat Finance owns the **data/context layer**, which is model-agnostic and strategically defensible.

---

## Goal

Phase 5 prepares the desktop app to become a **local-first agent gateway**: a daemon + MCP/API surface that exposes scoped financial tools to any connected agent, backed by local SQLite and shared domain services.

Phase 5 is **preparation and foundation** — not a full chat product, not hosted inference, not heavy agent orchestration.

Deliverables:

```txt
- Local MCP server (localhost) wired to SQLite + packages/domain
- Agent permissions + scoped tool access
- Financial context ontology (structured entities beyond raw rows)
- Desktop settings UX for agent connectivity
- Shared tool contracts aligned with apps/mcp (cloud) where practical
- Documentation for agent developers (Claude Desktop, Cursor, OpenClaw, etc.)
```

---

## What Phase 5 Builds

| Layer | Description |
|---|---|
| **Financial knowledge graph (v1)** | Structured entities: accounts, liabilities, recurring expenses, cash flow, budgets, goals (when available), merchant normalization hooks, financial events/memories schema |
| **Local MCP server** | `localhost` MCP-compatible server exposing curated read (and later scoped write) tools |
| **Local daemon / gateway** | Electron main process hosts the gateway; renderer never talks to agents directly |
| **Permissions layer** | Per-agent tokens, scopes, audit log — cloud model never gets raw DB; only scoped tool outputs |
| **Developer surface** | Tool schemas in shared contracts; connection instructions for common MCP clients |
| **Settings UX** | Agent access on/off, connected clients, scope review, test connection |

---

## What Phase 5 Does NOT Build

| Out of scope | Reason |
|---|---|
| Proprietary LLMs or hosted inference | Not our layer — agents bring their own models |
| "Moat Finance AI" chat UI as primary product | UI may consume tools later; Phase 5 is infrastructure |
| Heavy agent orchestration (LangGraph, multi-agent routing) | Agents connect to us; we don't orchestrate them |
| Auto-install Ollama or any LLM runtime | User/agent chooses inference stack |
| Full embeddings / vector search / rerankers | Phase 5+ follow-on; design hooks only |
| Plaid desktop, extension sync, investments parity | Phase 6+ (see [roadmap.md](roadmap.md)) |
| Encrypted cloud sync / cross-device agent state | Optional cloud follow-on |

---

## Architecture

### Winning stack

```txt
Desktop app (Electron)
  ├── Renderer — Moat Finance UI (existing Phase 4)
  ├── Main process
  │     ├── SQLite + packages/domain (existing)
  │     └── Local agent gateway (new)
  │           ├── MCP server (stdio + localhost HTTP/SSE)
  │           ├── Permissions + audit
  │           └── Tool handlers → domain services only
  └── Optional: lightweight background daemon mode (future)

Cloud (optional, later)
  └── Encrypted sync, backup, cross-device — not Phase 5 blocker

Agent ecosystem
  └── Any MCP client connects via localhost
```

### Data flow

```txt
[SQLite DB]
      ↓
[Electron main / local gateway]
      ↓
[MCP / scoped API server]
      ↓
[External agent + user's chosen LLM]
```

**Local LLM example:**

```txt
Ollama → Agent → localhost Moat Finance MCP → SQLite financial graph
```

**Cloud LLM example:**

```txt
Claude/GPT → local bridge tool → localhost Moat Finance MCP → scoped tool outputs only
```

The cloud model must **never** receive raw full DB or unrestricted access.

---

## Relationship to `apps/mcp`

The cloud MCP gateway (`apps/mcp`) already exposes curated Moat Finance tools over HTTP/stdio against Postgres. Phase 5 **reuses patterns and contracts**, not cloud infrastructure:

| Concern | Cloud (`apps/mcp`) | Desktop (Phase 5) |
|---|---|---|
| Database | Postgres via API | SQLite via `packages/db-sqlite` |
| Auth | PAT + OAuth | Local tokens / pairing codes |
| Transport | HTTP (Vercel) + stdio | localhost HTTP/SSE + stdio |
| Tool handlers | Prisma reads | Domain services + repositories |
| Audit | Remote audit log | Local audit log (no PII) |

Extract shared tool definitions into `packages/mcp-contracts` (or equivalent) so cloud and desktop expose the **same tool names and schemas** where the domain supports it.

---

## Local MCP Tool Surface (v1)

Initial tools map to existing domain services — no Prisma in tool handlers.

```txt
get_accounts()
get_transactions(input)
get_cashflow_summary(input)
get_budget_status(input)
get_spending_breakdown(input)
get_recurring_expenses()
search_transactions(input)
forecast_runway(input)          ← when domain supports it
get_financial_profile()
```

Future tools (design for, implement later):

```txt
search_financial_memories()
get_tax_exposure()
get_investment_positions()
normalize_merchant()
```

Every tool:

1. Validates input with Zod
2. Checks agent scope
3. Calls `packages/domain` only
4. Returns formatted, scoped output (no PII beyond what the tool contract allows)
5. Writes local audit entry

---

## Package Layout (proposed)

```txt
packages/mcp-local/                    ← or extend packages/mcp-contracts
  src/
    tools/                             ← shared tool schemas + descriptions
    server/
      createLocalMcpServer.ts
      registerTools.ts
    auth/
      local-token-service.ts
      scope-checker.ts
    audit/
      log-local-tool-call.ts

apps/desktop/src/main/
  agent-gateway/
    index.ts                           ← start/stop gateway
    mcp-server.ts
    permissions.ts
```

Do **not** create `packages/ai` with Ollama/OpenAI providers as the primary Phase 5 deliverable. Inference stays outside Moat Finance.

---

## Sub-Phase Breakdown

Phase 5 lands as a PR series. Each sub-phase has independent acceptance criteria.

```txt
5.1  Shared MCP tool contracts (desktop + cloud alignment)
5.2  Local MCP server in Electron main (stdio + localhost)
5.3  Permissions, scopes, and local audit log
5.4  Tool handlers wired to packages/domain + SQLite
5.5  Financial context ontology v1 (entities + schema hooks)
5.6  Desktop settings UX (agent access, pairing, status)
5.7  Developer docs + Claude Desktop / Cursor connection guides
```

### 5.1 — Shared MCP tool contracts

- Audit `apps/mcp` tool registry vs desktop domain capabilities
- Define canonical tool names, Zod input schemas, response shapes in shared package
- Document which tools are v1 desktop vs cloud-only vs deferred

**Acceptance:** Desktop and cloud reference the same contract types for overlapping tools.

### 5.2 — Local MCP server

- Start MCP server from Electron main after DB init
- Support stdio (spawned by Claude Desktop) and localhost HTTP/SSE (default port TBD, e.g. `3030`)
- Gateway lifecycle: start on app ready, stop on quit; configurable enable/disable
- Never expose Prisma or raw SQL to the MCP layer

**Acceptance:** `pnpm --filter desktop dev` starts gateway; external MCP client can connect in dev.

### 5.3 — Permissions and audit

- Local agent tokens (generated in Settings, revocable)
- Per-tool scope enforcement (mirror cloud scope model where practical)
- Local audit log: tool name, timestamp, scope, success/failure — no raw transaction text, no PII
- Default: agent access **disabled** until user explicitly enables

**Acceptance:** Tool call without valid token/scopes fails closed; audit entries written for every invocation.

### 5.4 — Tool handlers

- Implement v1 tools using `getDesktopDb()` → `AppContext` → domain services
- Match response formatting conventions from `apps/mcp` (`format.ts` patterns)
- Read-only in v1; scoped writes (e.g. categorize transaction) deferred to 5.x follow-on unless trivial

**Acceptance:** Agent can answer "what did I spend on groceries last month?" via tools only.

### 5.5 — Financial context ontology v1

- Document and implement minimal structured entities beyond flat transaction rows
- Schema hooks for: recurring patterns, financial events/memories, merchant normalization IDs
- Domain mappers produce agent-friendly summaries (cash flow, runway, budget status)
- Embeddings/vector storage: **design only** — interfaces, not implementation

**Acceptance:** At least one tool returns structured context (not raw DB dump); ontology doc exists in spec or `docs/`.

### 5.6 — Desktop settings UX

Settings page section:

```txt
AI Access
[ Enabled ] [ Disabled ]

Status: Running on localhost:3030
Connected clients: (list)
Generate token | Revoke all

Scopes granted: read transactions, read budgets, ...
Test connection
```

Copy for agents not running / gateway disabled must be actionable.

**Acceptance:** User can enable gateway, copy connection config for Claude Desktop, revoke access.

### 5.7 — Developer documentation

- `apps/desktop/README.md` — agent connection section
- Example MCP config snippets (Claude Desktop, Cursor)
- Security model summary: local-only default, scoped outputs, no cloud exfiltration by default

**Acceptance:** New developer can connect Claude Desktop to local Moat Finance in &lt; 15 minutes using docs only.

---

## Example Agent Flows

### Claude Desktop (stdio)

User adds Moat Finance local MCP server to Claude Desktop config pointing at desktop binary or helper script. Claude invokes `get_cashflow_summary` → main process → domain → scoped JSON response.

### Cursor / OpenClaw / custom agents

Same localhost MCP endpoint or stdio transport. Agent brings its own model; Moat Finance never calls OpenAI/Anthropic directly in Phase 5.

---

## Constraints

- Prisma client must never be exposed to renderer or MCP handlers directly — use repositories/domain
- No provider-specific LLM code in `apps/desktop` Phase 5
- User financial data must not leave the machine except via **explicit, scoped tool responses** the user authorized
- Agent access disabled by default
- No PII in logs or audit payloads
- Tool surface is curated — no generic SQL, shell, or REST passthrough

---

## Future Phases (After Phase 5)

```txt
Phase 6a — Plaid Link in Electron (optional cloud bank sync)
Phase 6b — Extension → desktop sync bridge
Phase 6c — Investments, balance snapshots, full Overview parity
Phase 6d — Scoped write tools (categorize, rules) + agent safety review
Phase 6e — Embeddings, financial memory search, semantic entities
Phase 6f — Encrypted cloud sync, backup, cross-device agent state
Phase 6g — Hashtags, scenarios/what-if, Mac App Store
```

See [roadmap.md](roadmap.md) for sequencing.

---

## Definition of Done (Phase 5)

Phase 5 is complete when:

1. Local MCP server runs inside Moat Finance Desktop and serves v1 financial tools against SQLite
2. External agent (e.g. Claude Desktop) can connect and query finances via scoped tools — not raw DB
3. User can enable/disable agent access and revoke tokens from Settings
4. Tool contracts align with cloud MCP where domain overlap exists
5. Financial context ontology v1 is documented with schema hooks for future memory/search
6. Developer docs enable third-party agent integration without Moat Finance-built chat UI
7. No proprietary LLM integration is required for Phase 5 to ship

---

## Suggested PR Series

```txt
feat (mcp-local): add shared tool contracts package
feat (desktop): start local MCP server in main process
feat (desktop): local agent tokens and scope enforcement
feat (desktop): wire MCP tools to domain services
feat (desktop): agent access settings UI
docs (desktop): agent connection guide for Claude Desktop and Cursor
```
