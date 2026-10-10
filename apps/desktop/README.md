# Moat Finance Desktop

Local-first Electron app for personal finance

## Prerequisites

```sh
# Install all workspace dependencies from repo root
pnpm install

# Generate the SQLite Prisma client (required before first build)
pnpm --filter @moat/db-sqlite run db:generate
```

## Development

```sh
# From repo root
pnpm --filter moat-desktop run dev

# Or from apps/desktop/
pnpm run dev
```

Opens Electron with HMR. The main process restarts automatically on changes to `src/main/` and `src/preload/`. The renderer reloads via Vite HMR.

## Build (unpackaged)

```sh
pnpm --filter moat-desktop run build
```

Outputs compiled files to `out/`. Use `pnpm run preview` to preview the renderer.

## Package (installable artifacts)

```sh
# macOS .dmg (requires Apple Developer ID cert for signing + notarization)
pnpm --filter moat-desktop run dist:mac

# Windows .exe / NSIS installer
pnpm --filter moat-desktop run dist:win
```

Artifacts are placed in `dist/`. See [Packaging & Signing](#packaging--signing) for cert setup.

## Typecheck

```sh
pnpm --filter moat-desktop run typecheck
```

## Linting

```sh
pnpm --filter moat-desktop run check:write
```

---

## Architecture

```
apps/desktop/src/
  main/
    index.ts              ← App entry: DB init → IPC handlers → window → gateway
    db.ts                 ← SQLite DB init (initDesktopDb / getDesktopDb)
    updater.ts            ← electron-updater wiring
    agent-gateway/        ← Phase 5: local MCP server
      index.ts            ← start/stop lifecycle
      mcp-server.ts       ← creates McpServer per authenticated request
      local-token-service.ts  ← generate/validate/revoke agent tokens
      scope-checker.ts    ← asserts agent has required scopes
      audit-log.ts        ← append-only JSONL audit log
      tools/              ← v1 MCP tool implementations (domain-only)
    ipc/
      register-handlers.ts ← single entry point; registers all handlers
      overview.ts, transactions.ts, ... ← per-domain IPC handlers
  preload/
    index.ts              ← Secure contextBridge surface (ElectronAPI)
  renderer/src/
    App.tsx               ← Sidebar nav + page routing
    lib/ipc-api-client.ts ← MoatApiClient impl over window.moatDesktop
    pages/
      settings.tsx        ← DB status + financial profile + agent access
      transactions.tsx, budget.tsx, ...

packages/
  domain/                 ← Pure business logic (no Electron, no Prisma)
  db-sqlite/              ← SQLite repositories + migrations
  mcp-contracts/          ← Shared tool schemas/scopes (cloud + desktop)
  contracts/              ← IPC schemas + channel names
```

**Data flows:**
- Renderer → `window.moatDesktop.*` → IPC → main process → domain services → SQLite
- External agent → `localhost:3030/mcp` → auth token → local MCP server → domain services → SQLite

**Security model:**
- Context isolation enabled; renderer never has direct Node.js access
- Agent gateway disabled by default; user enables per-session
- All IPC payloads validated with Zod schemas from `@moat/contracts`
- No raw SQL or Prisma client exposed to renderer or agent layer

---

## First-Run Flow

1. App opens → `initDesktopDb` creates `~/Library/Application Support/moat-finance/moat.db`
2. Migrations run (idempotent `CREATE TABLE IF NOT EXISTS`)
3. Default categories seeded (idempotent `upsert` by name)
4. Overview page shows empty state with "Import transactions" CTA
5. User picks a bank CSV → preview → confirm → transactions appear

---

## Importing Data

1. Navigate to **Import** in the sidebar
2. Choose a CSV bank export file
3. Map columns: date, description, amount (and optionally category)
4. Preview first rows → confirm → results shown
5. Active rules are applied automatically at import time

**Supported CSV formats:** Most bank export formats with `date`, `description`, `amount` columns. Debit/credit split columns are auto-detected.

---

## AI Access (Phase 5)

Moat Finance Desktop includes a local MCP server that AI assistants (Claude Desktop, Cursor, etc.) can connect to. It exposes curated read-only financial tools backed by your local SQLite database.

### Enabling the gateway

1. Open **AI Access** in the sidebar
2. Click **Enable Gateway** — the server starts on `localhost:3030`
3. Click **Generate Token** with a label (e.g. "Claude Desktop")
4. Copy the token — it is shown only once

### Connecting Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "moat-finance-local": {
      "url": "http://localhost:3030/mcp",
      "headers": {
        "Authorization": "Bearer <your-token-here>"
      }
    }
  }
}
```

Restart Claude Desktop. You can then ask Claude questions like:
- "What did I spend on groceries last month?"
- "How is my budget tracking this month?"
- "What are my biggest recurring expenses?"

### Connecting Cursor or other MCP clients

Any MCP client that supports HTTP/SSE transport can connect to `http://localhost:3030/mcp` with `Authorization: Bearer <token>`.

### Available tools (v1)

| Tool | Description |
|------|-------------|
| `fin.getProfileSummary` | Overall financial snapshot |
| `fin.listAccounts` | Your connected accounts with balances |
| `fin.listTransactions` | Transactions with date/category/type filters |
| `fin.searchTransactions` | Full-text search over transactions |
| `fin.getSpendingBreakdown` | Category spending totals and averages |
| `fin.getBudgetStatus` | Budget progress for current or past month |
| `fin.getForecast` | Net worth projection from forecast scenario |
| `fin.explainForecast` | Plain-language forecast summary |
| `fin.listRules` | Your transaction categorization rules |
| `moat.previewRuleMatches` | Preview which rules match recent transactions |

### Security notes

- The gateway only listens on `127.0.0.1` — not accessible from other machines
- Each token has read-only scopes by default; write tools are deferred
- Every tool call is written to `~/Library/Application Support/moat-finance/agent-audit.jsonl`
- Audit entries contain tool names and status — never raw transaction data or PII
- Disabling the gateway stops the server immediately; tokens remain for re-enabling

---

## Packaging & Signing

### macOS

1. Obtain an **Apple Developer ID Application** certificate
2. Set environment variables for notarization:
   ```sh
   export MACOS_CERTIFICATE="<base64 .p12>"
   export MACOS_CERTIFICATE_PASSWORD="<password>"
   export APPLE_ID="you@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="<app-specific password>"
   export APPLE_TEAM_ID="<your team ID>"
   ```
3. `pnpm --filter moat-desktop run dist:mac`

### Windows

1. Obtain an Authenticode (EV) certificate
2. Set `WINDOWS_CERTIFICATE` and `WINDOWS_CERTIFICATE_PASSWORD`
3. `pnpm --filter moat-desktop run dist:win` (on Windows or CI with Windows runner)

### Auto-update

The app checks `downloads.moatfinance.ai` on launch (packaged builds only). New versions are downloaded in the background and installed on next quit.

Tag convention: `desktop-v0.1.0` — separate from web/API deploy tags.

See [RELEASE.md](RELEASE.md) for signing secrets, tagging, and QA checklist before linking from the marketing site.

---

## Adding a new IPC handler

1. Define Zod schemas and channel names in `packages/contracts/src/ipc/<domain>.ts`
2. Add the handler implementation in `apps/desktop/src/main/ipc/<domain>.ts`
3. Register it in `register-handlers.ts`
4. Expose the method in `apps/desktop/src/preload/index.ts` (type + implementation)
5. Implement the `MoatApiClient` method in `lib/ipc-api-client.ts`

---

## Adding a new MCP tool

1. Add the tool contract to `packages/mcp-contracts/src/tools.ts`
2. Add the Zod input schema to `packages/mcp-contracts/src/schemas.ts`
3. Implement the tool in `apps/desktop/src/main/agent-gateway/tools/`
4. Register it in `tools/registry.ts`
5. (Optional) mirror in `apps/mcp/src/tools/` for cloud parity
