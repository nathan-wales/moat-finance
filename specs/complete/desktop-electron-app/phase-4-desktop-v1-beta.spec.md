# Phase 4: Desktop v1 Beta — IPC, Import, Features, and Distribution

## Prerequisite

**Phases 1, 1.5, and 2 are complete. Phase 3 is in progress.**

| Phase | Status | Spec |
|---|---|---|
| 1 — Shared package extraction | ✅ Complete | [phase-1-shared-packages.spec.md](phase-1-shared-packages.spec.md) |
| 1.5 — Runtime + contracts | ✅ Complete | [phase-1.5-shared-packages-runtime-and-contracts.spec.md](phase-1.5-shared-packages-runtime-and-contracts.spec.md) |
| 2 — SQLite local database | ✅ Complete | [phase-2-sqlite-database.spec.md](phase-2-sqlite-database.spec.md) |
| 3 — Shared UI packages | 🟡 In progress | [phase-3-shared-ui-packages-and-consumption.md](phase-3-shared-ui-packages-and-consumption.md) |
| **4 — Desktop v1 beta** | ⬜ This spec | — |

### Phase numbering note

The top-level [roadmap.md](roadmap.md) originally numbered AI as Phase 3 and import as Phase 4. This repo now uses:

- **Phase 3** = shared UI extraction (`@moat/ui`, `@moat/charts`, `@moat/features`)
- **Phase 4** = everything required to ship a usable, downloadable desktop beta
- **Phase 5** = local agent gateway (MCP, financial context OS) — see [phase-5-agent-gateway.spec.md](phase-5-agent-gateway.spec.md)
- **Phase 6+** = Plaid desktop, extension sync, full investment parity (deferred)

Phase 4 subsumes the original roadmap's "Phase 4: Import and Sync" and "Phase 5: Offline-First Dashboard" into one shippable milestone, plus adds packaging/distribution work that was never specced.

---

## Goal

Deliver a **local-first Moat Finance desktop app** that a user can:

1. **Download and install** on macOS and Windows
2. **Import financial data** (CSV first; OFX/QFX second)
3. **Use core dashboard features** offline — overview, transactions, budget, spending, rules
4. **Never require a Moat Finance account** or cloud API for core workflows

Success looks like: a signed `.dmg` (Mac) and `.exe`/`.msi` (Windows) on GitHub Releases, with auto-update, that opens to a working overview after importing a CSV.

---

## Current State (as of Phase 3 partial)

### What works

```txt
✅ Electron shell (secure preload, context isolation)
✅ SQLite init on startup (~/Library/Application Support/Moat Finance/moat.db)
✅ AppRuntime + 6 read-only SQLite repositories
✅ Domain read services (dashboard, transactions, budget, rules, forecasts)
✅ Settings page — DB health check via localDb IPC
✅ Overview UI mounted from @moat/features
✅ FinApiClient interface + HttpApiClient (web) + IpcApiClient stub (desktop)
✅ @moat/ui, @moat/charts packages; Overview ported to @moat/features
```

### What is broken or missing

```txt
❌ IpcApiClient — every FinApiClient method throws notImplemented()
❌ IPC handlers — only localDb:getStatus and localDb:getCounts exist
❌ Write repositories — data-access interfaces are read-only
❌ packages/domain/imports — does not exist
❌ Default categories + seed data — empty DB on first launch
❌ Remaining features — transactions, budget, spending, rules still in apps/web only
❌ NavigationProvider — defined but not wired in web or desktop
❌ Balance snapshots / investments — no SQLite schema or domain backing for full Overview parity
❌ electron-builder config, code signing, CI release workflow
❌ electron-updater — dependency present but not wired
```

---

## Architecture After Phase 4

```txt
apps/desktop (renderer)
  React UI from @moat/features
  IpcApiClient → window.moatDesktop.api.*
        ↓ preload bridge (Zod-validated)
apps/desktop (main)
  IPC handlers → packages/domain services
        ↓
  AppRuntime (AppContext + event bus)
        ↓
  packages/db-sqlite repositories (read + write)
        ↓
  moat.db (SQLite)
```

Import path (main process only):

```txt
User picks file (dialog.showOpenDialog)
  ↓
IPC import:parseAndPreview (main reads file, returns preview rows)
  ↓
User confirms mapping
  ↓
IPC import:commit → packages/domain/imports/importTransactions
  ↓
SqliteTransactionRepository.createMany + applyRules
  ↓
Event bus → invalidate renderer React Query caches
```

---

## Scope

### In scope (v1 beta)

| Area | v1 scope |
|---|---|
| **IPC** | Full `FinApiClient` surface for overview, transactions, budget, spending, rules, accounts, settings |
| **Import** | CSV bank export import; OFX/QFX if low-effort after CSV |
| **Seed data** | Default expense/income categories; optional demo dataset |
| **Features ported** | Overview (done), Transactions, Budget, Spending, Rules, Settings/financial profile |
| **Desktop shell** | Sidebar nav for all v1 pages; in-memory navigation adapter |
| **Packaging** | electron-builder, Mac + Windows artifacts, GitHub Releases |
| **Auto-update** | electron-updater against GitHub Releases (signed builds required on Mac) |
| **Dev ergonomics** | README, db:generate prebuild hook, sample CSV in repo |

### Out of scope (Phase 5 and later)

| Area | Reason |
|---|---|
| Plaid Link in desktop | Requires Electron-safe OAuth flow, token storage, Plaid SDK in main |
| Browser extension → desktop sync | Needs local bridge protocol |
| Agent gateway / local MCP | Separate phase; see [phase-5-agent-gateway.spec.md](phase-5-agent-gateway.spec.md) |
| Full investment / portfolio parity | No SQLite schema for investments; Overview charts degrade gracefully |
| Balance snapshot history | Requires new schema + domain service extraction from API |
| Mac App Store / Microsoft Store | Higher bar (sandboxing, review); GitHub Releases first |
| Cloud account linking | Desktop is local-first; no auth in v1 |
| `@moat/state` package | Defer until transactions store is ported and duplication is painful |
| Web app migration off duplicate charts/ui | Continue opportunistically during Phase 3; not a Phase 4 blocker |

---

## Sub-Phase Breakdown

Phase 4 is intentionally sequenced. Each sub-phase has independent acceptance criteria and should land as its own PR series.

```txt
4.1  IPC infrastructure + Overview handlers     ← unblocks visible progress
4.2  Write repositories + domain mutations      ← unblocks import + edits
4.3  Seed data + first-run experience           ← unblocks meaningful empty state
4.4  CSV import                                 ← unblocks real user data
4.5  Transactions feature (shared UI + IPC)     ← highest-value feature after overview
4.6  Budget + Spending features
4.7  Rules feature
4.8  Settings + financial profile
4.9  Desktop shell polish
4.10 Packaging, signing, CI, auto-update      ← shippable artifacts
```

---

## 4.1 — IPC Infrastructure + Overview Handlers

### Goal

Establish the IPC handler pattern and wire the Overview page end-to-end. After this sub-phase, opening Overview in dev mode shows real (empty) data instead of throwing.

### IPC handler pattern

Every feature domain follows the same structure established by `local-db.ts`:

```txt
packages/contracts/src/ipc/
  overview.ts          ← Zod input/output schemas
  transactions.ts
  ...

apps/desktop/src/main/ipc/
  overview.ts          ← ipcMain.handle → domain service → schema.parse(response)
  register-handlers.ts ← single entry called from main/index.ts

apps/desktop/src/preload/index.ts
  api.overview.getSummaryMetrics()  → ipcRenderer.invoke("overview:getSummaryMetrics")

apps/desktop/src/renderer/src/lib/ipc-api-client.ts
  getSummaryMetrics: () => window.moatDesktop.api.overview.getSummaryMetrics()
```

**Rules:**

- Channel names: `{domain}:{method}` (e.g. `overview:getSummaryMetrics`)
- All payloads validated with Zod schemas from `@moat/contracts` before crossing the IPC boundary
- Handlers call `getDesktopDb().appCtx` — never expose Prisma to renderer
- Handlers use `userId: "local-user"` (single-user desktop; no auth in v1)
- Log errors in main process; return typed error responses — no silent failures
- No PII in logs (no raw transaction descriptions, account numbers)

### Overview IPC methods

Map each `FinApiClient` overview method to a domain service or new domain extraction:

| FinApiClient method | Implementation strategy |
|---|---|
| `getSummaryMetrics` | **Extract** from `apps/api` dashboard handler → `packages/domain/dashboard/getSummaryMetrics.ts`; call via `DashboardRepository` |
| `getMonthlyAggregates` | **Extract** → `packages/domain/dashboard/getMonthlyAggregates.ts`; uses `DashboardRepository.getMonthlyTotals` |
| `getPreviousMonthCashFlow` | **Extract** from `apps/api/src/server/services/cash-flow.service.ts` → domain; SQLite-backed |
| `getBalanceSnapshotHistory` | **v1 degraded**: compute from transaction aggregates when no snapshot table; full snapshots deferred |
| `getPortfolioAllocation` | **v1 degraded**: return cash accounts only from `AccountRepository`; investments deferred |

Degraded responses must match `FinApiClient` types — empty arrays/sections, not errors.

### Files to add/modify

```txt
packages/contracts/src/ipc/overview.ts
packages/domain/src/dashboard/getSummaryMetrics.ts       (new extractions)
packages/domain/src/dashboard/getMonthlyAggregates.ts
packages/domain/src/dashboard/getPreviousMonthCashFlow.ts
apps/desktop/src/main/ipc/overview.ts
apps/desktop/src/main/ipc/register-handlers.ts
apps/desktop/src/preload/index.ts                        (expand ElectronAPI)
apps/desktop/src/renderer/src/lib/ipc-api-client.ts      (implement overview methods)
apps/desktop/src/main/index.ts                           (register overview handlers)
```

### Acceptance criteria

- [ ] `pnpm --filter moat-desktop run dev` — Overview page loads without React Query errors
- [ ] Empty DB shows zero-state charts/metrics (not crashes)
- [ ] Settings page still works
- [ ] All overview IPC responses pass Zod validation
- [ ] `pnpm --filter moat-desktop run typecheck` passes

---

## 4.2 — Write Repositories + Domain Mutations

### Goal

Extend the data layer so the desktop app can create, update, and delete data — required for imports, transaction edits, budget updates, and rules CRUD.

### Extend `packages/data-access` interfaces

Add write methods to existing repositories (minimal surface for v1):

```ts
// TransactionRepository — add:
createMany(input: { userId: string; transactions: CreateTransactionInput[] }): Promise<{ created: number; skipped: number }>;
update(input: { userId: string; transactionId: string; data: UpdateTransactionInput }): Promise<void>;
delete(input: { userId: string; transactionId: string }): Promise<void>;
bulkDelete(input: { userId: string; transactionIds: string[] }): Promise<number>;
listPaginated(input: TransactionListQuery): Promise<PaginatedTransactions>;  // replaces listRecent for transactions page
count(input: TransactionCountQuery): Promise<number>;

// AccountRepository — add:
upsert(input: { userId: string; account: UpsertAccountInput }): Promise<AccountSummary>;
listAll(input: { userId: string }): Promise<AccountSummary[]>;

// BudgetRepository — add:
upsertCategoryBudget(input: { userId: string; categoryId: string; monthlyGoal: number | null }): Promise<void>;

// RuleRepository — add:
listAll(input: { userId: string }): Promise<TransactionRule[]>;
create(input: { userId: string; rule: CreateRuleInput }): Promise<TransactionRule>;
update(input: { userId: string; ruleId: string; data: UpdateRuleInput }): Promise<TransactionRule>;
delete(input: { userId: string; ruleId: string }): Promise<void>;
toggleActive(input: { userId: string; ruleId: string }): Promise<void>;

// CategoryRepository — new:
listAll(input: { userId: string }): Promise<CategorySummary[]>;
findOrCreate(input: { userId: string; name: string; type: string }): Promise<CategorySummary>;
seedDefaults(input: { userId: string }): Promise<void>;

// FinancialProfileRepository — new:
get(input: { userId: string }): Promise<FinancialProfile>;
upsert(input: { userId: string; data: UpdateFinancialProfileInput }): Promise<FinancialProfile>;
```

Add corresponding SQLite implementations in `packages/db-sqlite/src/repositories/`.

Also implement Postgres equivalents in `packages/db-postgres` **only where needed for API parity** — desktop-first; API migration can lag for write paths not used by cloud yet.

### Domain mutation services

Add to `packages/domain`:

```txt
packages/domain/src/transactions/
  updateTransaction.ts
  deleteTransaction.ts
  bulkDeleteTransactions.ts
  getTransactionSummary.ts

packages/domain/src/budgets/
  updateCategoryBudget.ts
  getBudgetPageData.ts

packages/domain/src/rules/
  listRules.ts
  createRule.ts
  updateRule.ts
  deleteRule.ts
  toggleRuleActive.ts

packages/domain/src/settings/
  getFinancialProfile.ts
  updateFinancialProfile.ts
```

Extract logic from existing `apps/api` handlers/services where possible. Domain services own validation; repositories own persistence.

### SQLite schema additions (if needed)

Evaluate whether v1 needs:

```txt
FinancialProfile  — single row per local-user (monthlyIncome, monthlyExpenses, savingsGoal, currency)
ImportBatch       — track import file name, row count, status, createdAt (recommended)
```

Add migration in `packages/db-sqlite/prisma/migrations/` and update embedded SQL in `migrations.ts`.

Hashtags: **defer to Phase 6** unless transactions UI port requires them — if required, add `Hashtag` + join table to SQLite schema.

### Acceptance criteria

- [ ] Can create/update/delete a transaction via domain service + SQLite repo (unit or integration test)
- [ ] Can upsert category budgets
- [ ] Can CRUD rules through domain layer
- [ ] Postgres repo implementations compile (stubs acceptable for unused write paths)
- [ ] No Prisma imports in renderer or preload

---

## 4.3 — Seed Data + First-Run Experience

### Goal

First launch should not be a blank wasteland. Users need default categories and a clear path to import data.

### Default category seed

Extend `packages/db-sqlite/src/migrations.ts` (or dedicated `seedDefaults.ts`):

- After `seedLocalUser()`, call `CategoryRepository.seedDefaults({ userId: "local-user" })`
- Seed ~15–20 common categories matching cloud defaults (Housing, Groceries, Salary, etc.)
- Idempotent — safe on every startup (`upsert` by name)

Reference: `apps/api/prisma/seed.ts` or category constants in API for naming parity.

### First-run empty state

In `@moat/features` Overview (and later Transactions):

- When `transaction count === 0`, show empty state with CTA: **"Import transactions"** → navigates to Import page
- Desktop-only: CTA wired via navigation adapter

### Sample data (web link-out)

Desktop does not seed a local demo dataset. Settings → Local Database → **Open web demo** opens the web app demo instead. See `specs/features/desktop-demo-mode/spec.md`.

### Acceptance criteria

- [ ] Fresh install has default categories
- [ ] Overview empty state renders helpfully
- [ ] Settings opens the web demo (no local SQLite seed)
- [ ] Re-launching app does not invent sample transactions
---

## 4.4 — CSV Import

### Goal

Users can import bank CSV exports into the local SQLite database. This is the primary data-onboarding path for v1 beta.

### New package area: `packages/domain/imports`

```txt
packages/domain/src/imports/
  types.ts                    ← ParsedRow, ImportPreview, ImportResult
  parseCsv.ts                 ← Parse CSV buffer → normalized rows
  parseOfx.ts                 ← OFX/QFX parser (stretch goal)
  normalizeTransaction.ts     ← Map parsed row → CreateTransactionInput
  dedupeTransactions.ts       ← Hash-based dedupe (date + amount + description)
  importTransactions.ts       ← Orchestrator: parse → dedupe → createMany → applyRules
  index.ts
```

**Design principles:**

- Parsing runs in **Electron main process** (Node.js file I/O)
- Pure parsing/normalization logic lives in `packages/domain/imports` (testable without Electron)
- Category mapping: match CSV category column to existing categories; fallback to "Uncategorized"
- Account mapping: create account if CSV includes account name and it doesn't exist
- Apply `packages/domain/rules/applyRules` to each imported row before persist (or batch after insert)
- Return `ImportResult`: `{ imported: number; skipped: number; errors: string[] }`

### Reusable code from cloud

| Source | Reuse strategy |
|---|---|
| `apps/api/src/server/plaid/mapping.ts` | Extract category/type mapping helpers to `packages/domain` or `packages/shared` |
| `apps/api/prisma/seeds/demo-workspace.seed.ts` | Reference for realistic transaction shapes |
| `packages/retail-sync` | **Not** for bank CSV — retail parsers are separate concern |

No existing CSV import handler in API — this is greenfield.

### IPC surface

Add to `@moat/contracts`:

```txt
packages/contracts/src/ipc/import.ts
  ImportPreviewSchema
  ImportCommitInputSchema
  ImportResultSchema
```

Add to preload:

```ts
window.moatDesktop.import = {
  pickFile(): Promise<{ canceled: boolean; filePath?: string }>;
  preview(input: { filePath: string; format: "csv" | "ofx" }): Promise<ImportPreview>;
  commit(input: ImportCommitInput): Promise<ImportResult>;
};
```

Main process uses `dialog.showOpenDialog` with filters: `csv`, `ofx`, `qfx`.

### Import UI

Desktop-only page (can live in `apps/desktop/src/renderer/src/pages/import.tsx` initially — not shared):

```txt
Step 1: Choose file
Step 2: Preview first 10 rows + column mapping (date, amount, description, category)
Step 3: Confirm → import → show result summary
Step 4: Navigate to Overview
```

Port to `@moat/features/imports` only if web gains CSV import later.

### CSV format support (v1)

Support common export shapes via column auto-detection:

- Date column: `date`, `transaction date`, `posted date`
- Amount: single signed column OR separate debit/credit columns
- Description: `description`, `memo`, `name`
- Optional: category, account name

Document supported formats in `apps/desktop/README.md`.

### Acceptance criteria

- [ ] Import a real bank CSV → transactions appear in Overview charts
- [ ] Re-importing same file skips duplicates
- [ ] Invalid rows reported without failing entire import
- [ ] Import never blocks UI thread (main process async)
- [ ] No file paths or transaction descriptions in logs

---

## 4.5 — Transactions Feature

### Goal

Port the transactions page to `@moat/features` and wire desktop IPC. This is the most complex UI port.

### Port to `@moat/features/transactions`

Lift from `apps/web/src/app/(dashboard)/transactions/`:

```txt
packages/features/src/transactions/
  components/
    transaction-table.tsx
    transaction-filters.tsx
    edit-transaction-dialog.tsx
    bulk-action-bar.tsx
    transaction-summary.tsx
    category-input.tsx
  hooks/
    use-transactions.ts           ← useInfiniteQuery + useApiClient()
    use-transaction-mutations.ts
  store/
    transactions-store.ts         ← replace useRouter with useFinNavigation()
  index.ts
```

### Navigation adapter (required)

Wire `NavigationProvider` in both shells:

**Web** — `apps/web/src/lib/next-navigation-adapter.ts`:

```ts
export function useNextNavigation(): FinNavigation {
  // Adapts useRouter + useSearchParams + usePathname
}
```

**Desktop** — `apps/desktop/src/renderer/src/lib/memory-navigation.ts`:

```ts
export function useMemoryNavigation(): FinNavigation {
  // In-memory search params for filter state; no URL bar
}
```

Add to `dashboard-providers.tsx` (web) and `App.tsx` (desktop).

### IPC handlers

```txt
apps/desktop/src/main/ipc/transactions.ts
  transactions:list
  transactions:count
  transactions:getSummary
  transactions:update
  transactions:delete
  transactions:bulkDelete
  transactions:listHashtags        → return [] in v1 if hashtags deferred
  transactions:listCategories
```

### Desktop page

Add Transactions to sidebar in `App.tsx`.

### Web wrapper

Replace `apps/web/src/app/(dashboard)/transactions/` with thin import from `@moat/features/transactions`.

### Acceptance criteria

- [ ] Transactions page works in web (no regression)
- [ ] Transactions page works in desktop against SQLite
- [ ] Edit/delete/bulk-delete persist locally
- [ ] Filters work via memory navigation on desktop
- [ ] `pnpm --filter moat-web run typecheck` passes

---

## 4.6 — Budget + Spending Features

### Goal

Port budget and spending pages; wire IPC handlers calling existing domain services where available.

### Domain extractions needed

| Feature | Domain service | Notes |
|---|---|---|
| Budget page | `getBudgetPageData` | Compose `getBudgetStatus` + category list |
| Budget update | `updateCategoryBudget` | From 4.2 |
| Spending breakdown | `getSpendingBreakdown` | ✅ Already exists |
| Spending trends | **Extract** from API spending handler | New domain service |
| Spending anomalies | **Extract** from API | New domain service |
| Recurring expenses | **Extract** from API | New domain service |

Spending IPC can call domain services directly once extracted — same pattern as overview.

### Port to `@moat/features`

```txt
packages/features/src/budget/
packages/features/src/spending/
```

Source: `apps/web/src/app/(dashboard)/budget/`, `spending/`.

### Acceptance criteria

- [ ] Budget page shows categories with spend vs goal
- [ ] Updating a budget goal persists in SQLite
- [ ] Spending breakdown/trends render with imported data
- [ ] Web behavior unchanged

---

## 4.7 — Rules Feature

### Goal

Port rules builder UI; wire CRUD IPC handlers.

### Port to `@moat/features/rules`

Lift `apps/web/src/app/(dashboard)/rules/` including `rule-builder-dialog/` subdirectory (already follows component organization conventions).

### IPC handlers

```txt
rules:list
rules:create
rules:update
rules:delete
rules:toggleActive
```

### Rule application on import

After CSV import commits, run rules against newly inserted transactions:

```ts
// In importTransactions domain service
for (const tx of created) {
  const actions = applyRules(activeRules, tx);
  if (actions.length > 0) await repositories.transactions.update(...);
}
```

Historical backfill (apply rules to all past transactions) — **defer**; cloud has this in `rules-engine/backfill/` but not needed for v1.

### Acceptance criteria

- [ ] Create/edit/delete/toggle rules in desktop
- [ ] New imports respect active rules
- [ ] Rule builder dialog works in both web and desktop

---

## 4.8 — Settings + Financial Profile

### Goal

Expand Settings beyond DB diagnostics; support financial profile fields used by forecasting.

### SQLite schema

Add `FinancialProfile` model (or key-value store on `LocalUser`) for:

- `monthlyIncome`, `monthlyExpenses`, `savingsGoal`, `currency`

### Port settings form

Extract `financial-profile-form` from web to `@moat/features/settings` if not already shared.

Desktop Settings page sections:

```txt
1. Local Database (existing)
2. Financial Profile (new)
3. Import (link to import page)
4. About / version
```

### IPC

```txt
settings:getFinancialProfile
settings:updateFinancialProfile
```

### Acceptance criteria

- [ ] Financial profile saves and loads from SQLite
- [ ] Forecast selector on Overview respects profile defaults

---

## 4.9 — Desktop Shell Polish

### Goal

Make the desktop app feel like a product, not a dev harness.

### Navigation

Replace `useState` page switching with a minimal router or structured nav config:

```txt
apps/desktop/src/renderer/src/
  components/
    desktop-shell.tsx
    sidebar.tsx
  lib/
    routes.ts
```

Pages: Overview, Transactions, Budget, Spending, Rules, Import, Settings.

### Styling

- Align `apps/desktop/src/renderer/src/styles.css` with web design tokens
- Ensure `@moat/ui` Tailwind classes render correctly (content scan already in electron.vite / tailwind config)
- App icon in window title bar

### Dev ergonomics

Create `apps/desktop/README.md`:

```markdown
## Prerequisites
pnpm install
pnpm --filter @moat/db-sqlite run db:generate

## Dev
pnpm --filter moat-desktop run dev

## Build
pnpm --filter moat-desktop run build
pnpm --filter moat-desktop run preview

## Package (after 4.10)
pnpm --filter moat-desktop run dist:mac
```

Add to root `CLAUDE.md` commands table.

### Acceptance criteria

- [ ] All v1 pages reachable from sidebar
- [ ] Visual parity with web is "good enough" for beta
- [ ] README accurate

---

## 4.10 — Packaging, Signing, CI, and Auto-Update

### Goal

Produce installable Mac and Windows artifacts publishable on GitHub Releases.

### electron-builder configuration

Add to `apps/desktop/package.json`:

```json
{
  "version": "0.1.0",
  "scripts": {
    "build": "electron-vite build",
    "postinstall": "electron-builder install-app-deps",
    "predist": "pnpm --filter @moat/db-sqlite run db:generate && pnpm run build",
    "dist": "electron-builder",
    "dist:mac": "electron-builder --mac",
    "dist:win": "electron-builder --win",
    "dist:linux": "electron-builder --linux"
  },
  "build": {
    "appId": "com.moatfinance.desktop",
    "productName": "Moat Finance",
    "directories": { "output": "release", "buildResources": "build" },
    "files": [
      "out/**/*",
      "node_modules/**/*",
      "!node_modules/**/{test,tests,__tests__}/**"
    ],
    "extraResources": [],
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.finance",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "win": {
      "target": ["nsis"]
    },
    "publish": {
      "provider": "github",
      "owner": "<org>",
      "repo": "<repo>"
    }
  }
}
```

### Prisma native binary bundling

Electron packaging must include the SQLite query engine:

- Add `@prisma/client` and generated client path to `files` / `asarUnpack`
- Test `dist:mac` on a clean machine without Node installed
- Document known electron-builder + Prisma workarounds in README

### App icons

```txt
apps/desktop/build/
  icon.icns     ← macOS
  icon.ico      ← Windows
  icon.png      ← 512×512 source
```

### Code signing

| Platform | Requirement |
|---|---|
| **macOS** | Apple Developer ID Application cert; notarization via `notarize` option or `@electron/notarize` |
| **Windows** | Authenticode cert (EV recommended for SmartScreen) |

Secrets in GitHub Actions:

```txt
MACOS_CERTIFICATE          (base64 .p12)
MACOS_CERTIFICATE_PASSWORD
APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
WINDOWS_CERTIFICATE        (optional for v1 beta)
```

Unsigned builds are acceptable for **internal beta**; public release requires signing.

### Auto-update

Wire in `apps/desktop/src/main/updater.ts`:

```ts
import { autoUpdater } from "electron-updater";

export function initAutoUpdater(): void {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdatesAndNotify();
}
```

Call from `main/index.ts` after window opens. Requires signed builds + GitHub Releases publish config.

### GitHub Actions workflow

```txt
.github/workflows/desktop-release.yml

on:
  push:
    tags: ["desktop-v*"]

jobs:
  build-mac:
    runs-on: macos-latest
    steps: [checkout, pnpm, db:generate, dist:mac, upload-artifact]

  build-win:
    runs-on: windows-latest
    steps: [checkout, pnpm, db:generate, dist:win, upload-artifact]

  release:
    needs: [build-mac, build-win]
    runs-on: ubuntu-latest
    steps: [download artifacts, gh release create, upload .dmg + .exe]
```

Tag convention: `desktop-v0.1.0` (separate from web/api deploy tags).

### Acceptance criteria

- [ ] `pnpm --filter moat-desktop run dist:mac` produces a `.dmg` that launches on a clean Mac
- [ ] `dist:win` produces an installer on CI
- [ ] App opens, DB initializes, import works in packaged build
- [ ] GitHub Release workflow documented
- [ ] Auto-update checks GitHub Releases (signed build only)

---

## IPC Channel Reference (Complete v1 Surface)

```txt
localDb:getStatus
localDb:getCounts

overview:getSummaryMetrics
overview:getMonthlyAggregates
overview:getBalanceSnapshotHistory
overview:getPortfolioAllocation
overview:getPreviousMonthCashFlow

transactions:list
transactions:count
transactions:getSummary
transactions:update
transactions:delete
transactions:bulkDelete
transactions:listHashtags
transactions:listCategories

budget:getPageData
budget:updateCategoryBudget

spending:getCategoryBreakdown
spending:getCategoryTrends
spending:getAnomalies
spending:getRecurringExpenses

rules:list
rules:create
rules:update
rules:delete
rules:toggleActive

accounts:list

settings:getFinancialProfile
settings:updateFinancialProfile

import:pickFile
import:preview
import:commit
```

---

## Testing Expectations

### Per sub-phase

```sh
pnpm --filter @moat/db-sqlite run db:generate
pnpm --filter moat-desktop run typecheck
pnpm --filter moat-desktop run check:write
pnpm --filter moat-web run typecheck      # after each @moat/features port
```

### Domain import tests

```txt
packages/domain/src/imports/__tests__/
  parseCsv.test.ts
  dedupeTransactions.test.ts
  normalizeTransaction.test.ts
```

Use fixture CSV files in `packages/domain/src/imports/__fixtures__/`.

### Manual QA checklist (pre-release)

- [ ] Fresh install → default categories → import CSV → Overview populates
- [ ] Edit transaction → Overview updates
- [ ] Create rule → re-import → rule applies
- [ ] Set budget → Budget page reflects change
- [ ] Quit and relaunch → data persists
- [ ] Packaged `.dmg` on macOS without dev tools installed
- [ ] Packaged `.exe` on Windows without dev tools installed

---

## Anti-Patterns

- **Do not expose Prisma or raw SQL to the renderer** — main process only
- **Do not call `apps/api` from desktop** — local-first means SQLite + domain, not HTTP fallback
- **Do not store Plaid tokens or cloud API keys in SQLite** — use OS secure storage (Phase 5+ for agent tokens; Phase 6 for Plaid)
- **Do not block the renderer on file parsing** — import runs in main process
- **Do not log transaction descriptions, file paths with usernames, or account numbers**
- **Do not skip Zod validation on IPC responses** — contracts are the boundary
- **Do not bundle unsigned Mac builds for public download** — Gatekeeper will block users

---

## Commit Sequence (Suggested)

```txt
feat (contracts): add overview IPC schemas
feat (domain): extract overview metrics from api handlers
feat (desktop): wire overview IPC handlers and IpcApiClient
feat (data-access): add write methods to repository interfaces
feat (db-sqlite): implement write repositories
feat (domain): add transaction mutation and import services
feat (db-sqlite): seed default categories on first launch
feat (domain): add CSV parse and import orchestrator
feat (desktop): add import IPC and import page
feat (features): port transactions to shared package
feat (web): consume @moat/features transactions
feat (desktop): add transactions IPC and page
feat (features): port budget and spending features
feat (desktop): wire budget and spending IPC
feat (features): port rules feature
feat (desktop): wire rules IPC and page
feat (features): port settings and financial profile
feat (desktop): expand settings page
feat (desktop): add electron-builder config and app icons
chore (ci): add desktop release workflow
feat (desktop): wire electron-updater
docs (desktop): add README and update CLAUDE.md
```

---

## Phase 5 Preview (Not This Spec)

After v1 beta ships, the next spec is **Phase 5 — Local Agent Gateway**:

→ [phase-5-agent-gateway.spec.md](phase-5-agent-gateway.spec.md)

Moat Finance becomes the secure local financial memory and tool layer for AI agents (MCP-native, model-agnostic) — not a proprietary LLM or chat product.

Subsequent phases:

```txt
Phase 6a — Plaid Link in Electron (optional cloud bank sync)
Phase 6b — Extension → desktop sync bridge
Phase 6c — Investments, balance snapshots, full Overview parity
Phase 6d — Scoped write tools, embeddings/financial memory search
Phase 6e — Hashtags, scenarios/what-if, Mac App Store
```

See [roadmap.md](roadmap.md) for product intent and sequencing.

---

## Definition of Done (Phase 4)

Phase 4 is complete when:

1. A user can download Moat Finance Desktop for Mac or Windows from GitHub Releases
2. They can import a CSV and see their data in Overview, Transactions, Budget, and Spending
3. They can create and manage transaction rules locally
4. The app works fully offline with no Moat Finance account
5. Auto-update delivers subsequent beta builds to existing installers
6. All acceptance criteria in sub-phases 4.1–4.10 are met
