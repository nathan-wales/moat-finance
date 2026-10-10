# apps/desktop — Agent Overlay

> **Baseline**: Read [AGENTS.md](../../AGENTS.md) first. This file adds desktop-specific context on top of it.

---

## Purpose

`apps/desktop` is the native desktop app built with Electron + React. It runs entirely offline-first against a local SQLite database, and optionally connects to the cloud API for Plaid sync. It also includes a local MCP gateway that lets AI agents (Claude Desktop, Cursor) access Moat Finance data without a network round-trip.

---

## Commands

| Task | Command (from repo root) |
|------|--------------------------|
| Dev | `pnpm --filter moat-desktop run dev` |
| Typecheck | `pnpm --filter moat-desktop run typecheck` |
| Lint + format | `pnpm --filter moat-desktop run check:write` |
| Build | `pnpm --filter moat-desktop run build` |
| Dist (macOS) | `pnpm --filter moat-desktop run dist:mac` |
| Dist (Windows) | `pnpm --filter moat-desktop run dist:win` |
| Dist (Linux) | `pnpm --filter moat-desktop run dist:linux` |
| Headless Plaid Golden | `pnpm --filter moat-desktop run test:plaid-golden` |
| Playwright Plaid Golden | `pnpm --filter moat-desktop run build` then `test:e2e:plaid-golden` |

---

## Code structure

```
apps/desktop/src/
├── main/                       ← Electron main process (Node.js, full OS access)
│   ├── index.ts                ← App entry: init DB, register handlers, create window
│   ├── db.ts                   ← SQLite init (initDesktopDb / getDesktopDb)
│   ├── updater.ts              ← Electron auto-updater
│   ├── ipc/
│   │   ├── register-handlers.ts  ← Barrel: registers all domain IPC handlers
│   │   ├── transactions.ts
│   │   ├── accounts.ts
│   │   ├── spending.ts
│   │   ├── budget.ts
│   │   ├── rules.ts
│   │   ├── import.ts
│   │   ├── investments.ts
│   │   ├── real-estate.ts
│   │   ├── overview.ts
│   │   ├── settings.ts
│   │   ├── agent.ts
│   │   ├── local-db.ts
│   │   └── plaid.ts
│   ├── agent-gateway/          ← Local MCP HTTP gateway (localhost:3030)
│   │   ├── index.ts            ← Gateway start/stop lifecycle
│   │   ├── local-token-service.ts  ← Agent token management
│   │   ├── scope-checker.ts    ← Per-tool scope enforcement
│   │   ├── audit-log.ts        ← JSONL audit log
│   │   ├── mcp-server.ts       ← Local MCP server (tool registration)
│   │   ├── tools/              ← Local tool handlers
│   │   └── types.ts
│   └── plaid/
│       └── scheduler.ts        ← Plaid sync scheduler
├── preload/
│   └── index.ts                ← contextBridge: exposes typed IPC channels to renderer
└── renderer/
    └── src/
        ├── App.tsx             ← Root React component + router
        ├── main.tsx            ← Renderer entry point
        ├── pages/              ← Page components (transactions, spending, budget, etc.)
        ├── components/         ← Domain and shared UI components
        └── lib/
            ├── ipc/            ← Typed wrappers around window.moat IPC channels
            ├── hooks/          ← Custom React hooks
            └── stores/         ← Zustand stores
```

---

## Architecture

### Process model

```
Renderer (React)
  → window.moatDesktop.* (contextBridge)
    → Preload (contextBridge / ipcRenderer)
      → Main process (ipcMain handlers)
        → AppRuntime (@moat/runtime)
          → SQLite DB (@moat/db-sqlite / Prisma)
```

The renderer never has direct access to Node.js or the filesystem. All data access goes through typed IPC channels.

For the full startup sequence and SQLite init pattern, see [docs/patterns/sqlite-and-local-data.md](docs/patterns/sqlite-and-local-data.md).

---

## Non-negotiables

- **`contextIsolation: true` and `nodeIntegration: false` always.** Never change these BrowserWindow settings.
- **Never expose raw Node.js, Prisma, or AppContext via `contextBridge`.** Only typed, scoped IPC channel functions.
- **All data access goes through `AppRuntime` repos**, not raw Prisma in IPC handlers.
- **Never run `prisma migrate reset`** on the local SQLite DB without explicit user consent — it destroys their data.
- **Renderer UI uses `@moat/ui`.** Import Button, Select, Dialog, Input, and other primitives from `@moat/ui` — not native HTML controls and not Radix directly.
- **Every new `@moat/features/<subpath>` import needs a Vite alias.** See [Vite aliases for `@moat/features/*`](#vite-aliases-for-moatfeaturessubpath) below — typecheck can pass while `pnpm --filter moat-desktop run dev` still fails.
- **Never import the `@moat/domain` barrel from the renderer or `@moat/features`.** The barrel pulls import/dedupe code that uses `node:crypto`, which Vite externalizes in the renderer. See [Client-safe `@moat/domain/<subpath>`](#client-safe-moatdomainsubpath) below.

---

## Vite aliases for `@moat/features/<subpath>`

Desktop Vite does **not** resolve `@moat/features` package `exports` subpaths. In `electron.vite.config.ts`, `@moat/features` is aliased to the barrel `src/index.ts`, which blocks Node-style subpath resolution (`@moat/features/rules`, `@moat/features/transactions`, etc.).

When you add or start importing a new features subpath in the renderer:

1. Export it from `packages/features/package.json` → `exports` (e.g. `"./rules": "./src/rules/index.ts"`).
2. Add an **explicit** renderer alias in [`electron.vite.config.ts`](electron.vite.config.ts) under `renderer.resolve.alias`:

```ts
"@moat/features/<subpath>": path.resolve(
  __dirname,
  "../../packages/features/src/<subpath>/index.ts",
),
```

3. Restart the desktop dev server after changing the Vite config.

`tsconfig.web.json` already has `"@moat/features/*": ["../../packages/features/src/*"]`, so TypeScript/typecheck often succeeds even when Vite does not. Symptom of a missing alias:

```text
[plugin:vite:import-analysis] Failed to resolve import "@moat/features/<subpath>"
```

---

## Client-safe `@moat/domain/<subpath>`

The `@moat/domain` barrel (`src/index.ts`) is main-process / API only. It re-exports CSV import helpers that import `@moat/financial-data-providers`, which calls `createHash` from `node:crypto`. The renderer cannot load that.

Shared UI (`packages/features`, `src/renderer`) must import a **client-safe subpath** instead:

```ts
// Wrong — pulls node:crypto into the renderer
import { CATCH_UP_AGE } from "@moat/domain";

// Right
import { CATCH_UP_AGE } from "@moat/domain/retirement-constants";
```

When you add or start importing a new domain subpath in the renderer:

1. Export it from `packages/domain/package.json` → `exports` (e.g. `"./retirement-constants": "./src/retirement/constants.ts"`). The file must not import `node:crypto` or other Node builtins.
2. Add an **explicit** renderer alias in [`electron.vite.config.ts`](electron.vite.config.ts) under `renderer.resolve.alias`.
3. Restart the desktop dev server after changing the Vite config.

Symptom of a barrel import leaking into the renderer:

```text
Module "node:crypto" has been externalized for browser compatibility.
Cannot access "node:crypto.createHash" in client code.
    at dedupe.ts:1:28
```

---

## Change-type routing table

| When you are doing X… | Read |
|-----------------------|------|
| Adding a new IPC channel / domain | [docs/patterns/main-renderer-ipc.md](docs/patterns/main-renderer-ipc.md) |
| Importing a new `@moat/features/<subpath>` | [Vite aliases for `@moat/features/*`](#vite-aliases-for-moatfeaturessubpath) — add alias in `electron.vite.config.ts` |
| Importing from `@moat/domain` in the renderer | [Client-safe `@moat/domain/<subpath>`](#client-safe-moatdomainsubpath) — never the barrel; add export + Vite alias |
| Working with SQLite, migrations, AppRuntime | [docs/patterns/sqlite-and-local-data.md](docs/patterns/sqlite-and-local-data.md) |
| Adding a tool to the local agent gateway | [docs/patterns/local-agent-gateway.md](docs/patterns/local-agent-gateway.md) |
| Packaging, signing, or updating the app | [docs/patterns/packaging.md](docs/patterns/packaging.md) |
| Adding UI components in the renderer | [../web/docs/patterns/components.md](../web/docs/patterns/components.md) — the renderer (`src/renderer/src/`) follows the same component modularity conventions as `apps/web`. The ~200-line / sub-directory split rule applies here too. |
| Zustand stores or React Query hooks | [../web/docs/patterns/state-and-data.md](../web/docs/patterns/state-and-data.md) (same conventions) |

## Testing matrix

| Change type | Test approach |
|-------------|---------------|
| IPC handler (unit) | `node:test` via `tsx` with mocked AppRuntime |
| AppRuntime repo method | Unit test with in-memory SQLite |
| Agent gateway auth | Unit test with mocked token store |
| Renderer component | React Testing Library |
| Full IPC round-trip | Playwright Electron (`test:e2e:plaid-golden`) |

## Anti-patterns

- **Don't set `nodeIntegration: true`** — this exposes all of Node.js to untrusted renderer content.
- **Don't expose AppContext, Prisma, or `db` directly via `contextBridge`** — only expose named, typed IPC functions.
- **Don't add Plaid or other cloud API calls in IPC handlers directly.** Route through `src/main/plaid/` for isolation.
- **Don't access `window.moatDesktop.*` from the main process.** The bridge is renderer → main only.
- **Don't skip audit logging for agent gateway tool calls.** The audit wrapper in `mcp-server.ts` covers registered tools automatically.
- **Don't run migrations manually.** Migrations run automatically at startup via `runMigrations(db)`.
- **Don't use native `<button>` / `<select>` (etc.) in the renderer** when `@moat/ui` already provides the primitive.
- **Don't import `@moat/features/<subpath>` without a matching Vite alias** in `electron.vite.config.ts`. Package `exports` + tsconfig alone are not enough for the desktop renderer.
- **Don't import `@moat/domain` from the renderer or `@moat/features`.** Use a client-safe subpath (`@moat/domain/scheduling`, `@moat/domain/retirement-constants`, …) so `node:crypto` never lands in the Vite bundle.
