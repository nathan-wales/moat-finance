# Spec: Desktop Cloud Sync — Database Mode Switching

## Goal

Allow desktop users to optionally back their local SQLite data up to the cloud and switch the desktop app to operate against the cloud Postgres database, enabling data continuity with the web app and iOS app. Users can revert back to local-only mode at any time.

This is explicitly **not** bidirectional sync. It is a **clean database mode cutover** — the desktop app points at one backend at a time: either local SQLite or the cloud API. No data exists in two places simultaneously (from the app's perspective).

---

## Why

The desktop app is intentionally local-first and offline-capable. But users who also use Moat Finance on the web or iOS have no way to see their desktop-entered transactions on those platforms, and vice versa. This creates a fragmented experience for multi-device users.

The proposed approach sidesteps the hardest sync problem (bidirectional conflict resolution with schema mismatches) by treating the database as a togglable plug under the existing `AppContext` abstraction — which was already designed to be backend-agnostic.

---

## Architecture Overview

The key insight is that the desktop's data access layer is already fully abstracted behind `AppContext`:

```
IPC handler (e.g. transactions.ts)
  → getDesktopDb().appCtx.repositories.transactions.listPaginated(...)
     ↑ AppContext — pure interface in @moat/domain
       → createSqliteAppContext(db)       ← local mode
       → createApiBackedAppContext(token) ← cloud mode  (to be built)
```

IPC handlers have zero knowledge of which backend they're talking to. Swapping the runtime means replacing `_desktop.appCtx` with a new `AppRuntime` instance. No IPC handler code changes. No renderer code changes beyond the settings toggle UI.

### Repository interface contract

`@moat/data-access` already defines the repository interfaces (`TransactionRepository`, `AccountRepository`, `BudgetRepository`, etc.) as pure TypeScript types. The SQLite implementations in `@moat/db-sqlite` satisfy these. The new cloud implementations in a new `packages/db-api` package will satisfy the same interfaces by making HTTP calls to `apps/api` via `packages/client-ts`.

---

## Phases

---

### Phase 1 — One-Way Migration: SQLite → Cloud

**Goal:** Let a user upload their local SQLite data to their cloud account as a one-time backup, seeding the cloud database with everything from their desktop.

This phase ships zero ongoing sync. It is a one-time data migration only. After migration, the user still operates in local mode — Phase 3 adds the actual mode switch.

#### What to build

**`apps/desktop` — migration IPC handler (`src/main/ipc/cloud-sync.ts`)**
- `cloudSync:authenticate` — open cloud sign-in (OAuth via Electron shell browser, or username/password flow hitting `apps/api`). Store the returned auth token using Electron's `safeStorage` API.
- `cloudSync:previewMigration` — read local SQLite counts (transactions, accounts, categories, rules, investments, forecasts) and return a summary for the user to review before committing.
- `cloudSync:migrateToCloud` — execute the migration (described below). Returns progress events via `ipcMain.emit` or a streaming response.

**Migration script logic (runs in the main process)**

The migration reads every entity from SQLite and upserts it into the cloud via `packages/client-ts`. The upsert strategy uses the existing SQLite string IDs — since the cloud Postgres schema also uses string IDs with no auto-generation constraint, the same IDs can be preserved, making future re-runs idempotent.

Transform rules:
| SQLite type | Postgres type | Transform |
|---|---|---|
| `Float` (amount) | `Decimal(14,2)` | `parseFloat(value).toFixed(2)` via API body serialization — no special handling needed |
| `String` enum (e.g. `"INCOME"`) | Postgres enum | Pass as-is; API validates on write |
| `Boolean` | `Boolean` | No transform needed |
| `Bytes` (Plaid access tokens) | Handled separately | See note below |
| `String` (raw JSON) | `Json` | `JSON.parse()` before sending |

**Plaid token handling:** `PlaidItem.accessTokenEncrypted` is stored as `Bytes` in SQLite using desktop-local encryption. These tokens cannot be migrated as-is — the cloud uses its own encryption key. Decision: **skip Plaid item migration**. After migrating to cloud mode, the user re-links their Plaid connections through the standard web/iOS flow. Document this clearly in the UI.

**Migration order (respects foreign keys):**
1. Categories (no foreign keys)
2. Accounts (→ none)
3. Investments
4. RealEstateInvestments
5. ForecastScenarios
6. CategoryBudgets (→ Category)
7. TransactionRules + RuleConditions + RuleActions (→ none)
8. Transactions (→ Account, Category)

**`apps/desktop` renderer — migration UI (settings page)**
- "Back up to cloud" section with account sign-in, preview counts, and a confirmation step.
- Progress bar during migration (emit progress over IPC).
- Clear disclaimer: "Plaid connections are not migrated. You will need to re-link your accounts after switching to cloud mode."
- On completion: offer to immediately switch to cloud mode (links to Phase 3).

#### What is explicitly not in this phase
- No mode switch yet — user stays on SQLite after migration.
- No conflict detection — migration is an overwrite/upsert.
- No reverse migration (Phase 4).

---

### Phase 2 — API-Backed Repository Implementations (`packages/db-api`)

**Goal:** Create a full set of repository implementations that satisfy the `@moat/data-access` interfaces but make HTTP calls to `apps/api` rather than hitting SQLite.

This is the most mechanical phase — it is pure plumbing with no user-facing impact.

#### New package: `packages/db-api`

```
packages/db-api/
  package.json              ← name: @moat/db-api
  tsconfig.json
  src/
    index.ts                ← exports createApiAppContext
    context.ts              ← createApiAppContext(token: string): AppContext
    repositories/
      TransactionRepository.ts
      AccountRepository.ts
      BudgetRepository.ts
      CategoryRepository.ts
      RuleRepository.ts
      ForecastRepository.ts
      DashboardRepository.ts
      InvestmentRepository.ts
      RealEstateRepository.ts
      PlaidItemRepository.ts
      PlaidAccountRepository.ts
```

Each repository class takes an authenticated `MoatApiClient` instance (from `packages/client-ts`) and maps its methods to the `@moat/data-access` interface contract. Example:

```ts
// packages/db-api/src/repositories/TransactionRepository.ts
export class ApiTransactionRepository implements TransactionRepository {
  constructor(private client: MoatApiClient) {}

  async listPaginated(input: ListTransactionsInput): Promise<PaginatedTransactions> {
    return this.client.transactions.list(input);
  }
  // ...
}
```

**Key implementation notes:**
- The API client is already authenticated (token injected at context creation time). No per-call auth needed inside repositories.
- Return types must match the `@moat/data-access` interface exactly. Where the API returns `Decimal` as a string (JSON serialization), normalize to `number` in the repository layer.
- Error handling: wrap all `client.*` calls and convert HTTP errors (`401`, `403`, `404`, `5xx`) to typed domain errors that the IPC layer can surface. Do not let raw `fetch` rejections escape.
- All methods are async — this matches the existing interface signatures. No interface changes needed.

#### `createApiAppContext(token: string): AppContext`

```ts
export function createApiAppContext(token: string): AppContext {
  const client = new HttpApiClient({ token });
  return {
    userId: decodeUserIdFromToken(token), // JWT decode, no network call
    repositories: {
      transactions: new ApiTransactionRepository(client),
      accounts: new ApiAccountRepository(client),
      // ...
    },
  };
}
```

#### Test coverage

Each repository should have unit tests using a mocked `MoatApiClient`. Focus on type normalization (Decimal strings → numbers) and error mapping.

---

### Phase 3 — Runtime Switching Infrastructure

**Goal:** Allow the desktop app to switch its active `AppRuntime` from SQLite-backed to API-backed (and back) at runtime, survive app restarts in the correct mode, and manage cloud auth tokens securely.

#### `apps/desktop/src/main/db.ts` — add `switchRuntime()`

```ts
export async function switchToCloudMode(token: string): Promise<void> {
  const apiCtx = createRuntime(createApiAppContext(token));
  _desktop!.appCtx = apiCtx;
  // Re-register IPC handlers? No — they call getDesktopDb().appCtx at invocation time.
  // Just updating _desktop.appCtx is sufficient.
}

export async function switchToLocalMode(): Promise<void> {
  // Re-init from the local moat.db (already on disk).
  const appCtx = createRuntime(createSqliteAppContext(_desktop!.db));
  _desktop!.appCtx = appCtx;
}
```

Because IPC handlers resolve `getDesktopDb().appCtx` at call time (not at registration time), updating `_desktop.appCtx` is sufficient. No re-registration needed.

#### Startup mode resolution (`apps/desktop/src/main/index.ts`)

On app startup, before opening the window:
1. Init SQLite as always (`initDesktopDb`) — this provides a stable local store regardless of mode.
2. Read the persisted mode preference from a config file (`userData/fin-config.json`).
3. If `cloudMode: true`, read the stored token from `safeStorage`. If valid, call `switchToCloudMode(token)`. If the token is missing or expired, fall back to local mode and surface a notification to the user.

#### Token storage

Use Electron's `safeStorage` API (OS keychain on macOS, DPAPI on Windows):

```ts
// Store on first sign-in
safeStorage.encryptString(token) → write to userData/cloud-token.bin

// Read on startup
const buf = fs.readFileSync(userData/cloud-token.bin)
const token = safeStorage.decryptString(buf)
```

Never write the raw token to disk. Never expose the token to the renderer via `contextBridge`.

#### Mode persistence

Store a simple JSON config at `userData/fin-config.json`:

```json
{ "cloudMode": true }
```

This file is written by the main process only. The renderer requests mode changes via IPC; it never writes this file directly.

#### New IPC channels (`CLOUD_SYNC_CHANNELS` in `@moat/contracts`)

```ts
cloudSync:authenticate          // sign in → store token → returns { userId, email }
cloudSync:getStatus             // returns { mode: 'local' | 'cloud', userEmail? }
cloudSync:previewMigration      // returns counts from local SQLite
cloudSync:migrateToCloud        // runs Phase 1 migration
cloudSync:switchToCloud         // activates cloud mode (requires prior auth)
cloudSync:switchToLocal         // deactivates cloud mode
cloudSync:signOut               // clears token + reverts to local
```

#### Plaid scheduler mode awareness

`apps/desktop/src/main/plaid/scheduler.ts` currently runs against the local SQLite AppContext. In cloud mode, Plaid sync should be **disabled on the desktop** — the cloud API already handles Plaid sync via its own scheduler. Add a guard:

```ts
if (getCloudMode()) return; // cloud Plaid is handled server-side
```

---

### Phase 4 — Cloud Mode UI

**Goal:** Expose the mode toggle and related flows in the desktop settings UI. Handle network failure gracefully.

#### Settings page additions

- **Cloud Sync section** (new card in the settings page):
  - If not signed in: "Back up & sync with cloud" CTA → triggers sign-in flow → migration preview → migration → mode switch.
  - If signed in and in local mode: "Switch to cloud mode" button + "You are signed in as [email]. Your local data has been backed up."
  - If in cloud mode: "Active — syncing with cloud" status + "Switch to local mode" button.
  - "Sign out of cloud" link (reverts to local, clears token).

#### Network error states

When in cloud mode, all IPC calls are HTTP calls. The IPC layer must handle network failures without crashing or hanging:
- Wrap repository calls in a timeout (5s default, configurable).
- On timeout or network error, return a typed error response that the renderer can display as a toast or banner.
- Add a global "cloud connection status" IPC channel (`cloudSync:connectionStatus`) that the renderer can poll or subscribe to.
- The overview and transactions page should show a "Cloud connection unavailable" banner rather than an empty state when in cloud mode with no internet.

#### Cloud → Local reversal UI

When the user initiates "Switch to local mode":
1. Show a warning modal: "Some data created on the web or iOS may not transfer back to your local database. Features like transaction splits and hashtags will not be available in local mode."
2. Offer: "Download a copy of your cloud data before switching" (triggers a CSV export via the API).
3. On confirm: run the cloud → local migration (Phase 5), then `switchToLocalMode()`.

---

### Phase 5 — Cloud → Local Reversal Migration

**Goal:** Allow users to move back to local mode by pulling their cloud data down into SQLite.

This phase is separated from Phase 4 because the reversal has a documented data-loss caveat that needs deliberate product decision-making around how to handle cloud-only features.

#### What transfers

All entities that the SQLite schema supports:
- Transactions (core fields only — see gaps below)
- Accounts
- Categories
- CategoryBudgets
- TransactionRules + conditions + actions
- Investments
- RealEstateInvestments
- ForecastScenarios

#### What does not transfer (cloud-only features)

| Cloud feature | SQLite support | Behavior on reversal |
|---|---|---|
| Transaction splits (`splitGroupId`) | None | Dropped — split transactions appear as the original unsplit amount |
| Hashtags | None | Dropped — hashtag associations are lost |
| `TransactionRuleApplication` history | None | Dropped — rules still exist but application history is gone |
| `FinancialProfileData` | None | Dropped |
| Household members/invites | None | Dropped |
| Plaid connections | Stored separately with re-encryption | Not migrated — user must re-link |

#### Migration implementation

Pull cloud data via `packages/client-ts` in the correct order (respect SQLite FK constraints), transform Decimal → Float and Json → String where needed, and upsert into the local SQLite DB using the same string IDs. The migration runs in the main process and emits progress events.

After migration completes successfully, call `switchToLocalMode()` and write `cloudMode: false` to the config.

---

## Data Constraints and Edge Cases

### ID preservation
Both schemas use plain string IDs. SQLite IDs are manually assigned (no `@default(cuid())`). The Postgres schema uses `@default(cuid())` but the value is just a string — the same ID value can be written from the migration. This makes upserts idempotent and round-trips safe.

### Amount precision
SQLite stores amounts as `Float`. Postgres stores as `Decimal(14,2)`. On the way up (local → cloud), floating-point amounts may have precision artifacts (e.g. `12.3000000001`). The migration should round to 2 decimal places before sending. On the way down (cloud → local), no precision is lost since Decimal(14,2) values are always 2dp.

### Category identity
System-default categories in Postgres are seeded with specific IDs and `isDefault: true`. The SQLite schema doesn't have `isDefault`. On local → cloud migration, only user-created categories need to be migrated — system defaults already exist in Postgres. The migration should skip categories whose IDs match known system-default IDs, or check for conflicts before inserting.

### Concurrent mode switch
The mode switch must be atomic from the IPC layer's perspective. Use a mutex or simple async lock around `switchToCloudMode` / `switchToLocalMode` to prevent handlers from resolving against a half-initialized context. A simple `_switching: boolean` flag with a promise queue is sufficient.

### First launch with cloud mode active
If the app is installed fresh (no local `moat.db`) and the user restores cloud token, skip SQLite seeding for local user and default categories — the SQLite DB is only used as a config store in this state.

---

## Data Retention Policy — No Automatic Deletion

Neither migration direction deletes the source data. This is a deliberate product decision, not an omission.

**Local → Cloud:** After the migration completes and the user switches to cloud mode, the local `moat.db` file remains on disk at `userData/moat.db` completely unchanged. It serves as a passive backup. If cloud mode fails, the token expires, or the user reverts to local mode, the pre-migration local data is still fully intact. There is no benefit to wiping it — SQLite files are small, the user's OS already manages disk space, and the cost of an accidental deletion would be unrecoverable.

**Cloud → Local:** After the reversal migration completes and the user switches back to local mode, the cloud Postgres account retains all of its data. The user is simply no longer pointing the desktop at it. Deleting cloud data would also affect the web app and iOS app — it would be a multi-platform destructive action triggered from a desktop settings toggle, which is never acceptable. If a user wants to delete their cloud account data, that is a separate explicit account-deletion flow.

In both cases: **the mode switch is about which database the app reads from and writes to, not about destroying the other copy.** The two copies may diverge over time (local data changes while in cloud mode are not reflected locally, and vice versa), but both remain intact and accessible.

The UI should communicate this clearly: "Your local data remains on your device as a backup" and "Your cloud data is not affected by this change."

---

## Non-Goals

- **Bidirectional real-time sync** — explicitly out of scope. The two databases do not coexist in an active sync relationship.
- **Conflict resolution** — not needed; only one database is active at a time.
- **Offline support in cloud mode** — the desktop in cloud mode requires internet. This is a known tradeoff and should be communicated in the UI. A future spec could add a local read-through cache for offline reads only.
- **Migrating Plaid tokens** — desktop and cloud use different encryption contexts. Users re-link Plaid after switching to cloud mode.
- **SQLite schema parity with Postgres** — the SQLite schema intentionally stays simpler. Features like splits and hashtags remain cloud/web-only.

---

## Open Questions

1. **Sign-in UX in Electron** — should auth use a native browser window (via `shell.openExternal` + deep link callback) or an embedded `BrowserWindow` pointed at the Moat Finance auth page? Deep link via custom protocol (`fin://`) is the more standard Electron pattern and avoids embedding a webview.

2. **What happens to the Plaid scheduler on cold start in cloud mode?** Currently the scheduler starts unconditionally. The guard needs to be in place before Phase 3 ships.

3. **Token expiry handling** — if the cloud token expires while the user is in cloud mode and mid-session, the IPC calls will start returning `401`. Does the app silently fall back to local mode, or does it show a "re-authenticate" prompt? The latter is safer UX but more complex.

4. **Migration failure recovery** — if the cloud migration fails partway through (network error, rate limit, etc.), the user's local SQLite data is unmodified (migration is additive to the cloud, not destructive locally). Document this clearly: the migration is safe to re-run.

5. **Multi-device desktop** — if a user has two desktop installs and both switch to cloud mode, they are both hitting the same cloud database. This is fine — the cloud API already handles concurrent access. But it's worth testing.

---

## Success Criteria

- [ ] A desktop user can sign in to their cloud account from the settings page.
- [ ] A preview of their local data (counts by type) is shown before migration.
- [ ] The migration completes without data loss for all SQLite-supported entity types.
- [ ] After switching to cloud mode, all core desktop features (transactions, budget, spending, rules, investments) work against the cloud database.
- [ ] The app starts in cloud mode after a restart without re-authenticating.
- [ ] The app surfaces a clear banner when in cloud mode with no internet connection.
- [ ] The user can revert to local mode with a clear warning about unsupported cloud features.
- [ ] No Plaid tokens are written to cloud storage during migration.
- [ ] The IPC handler codebase has zero changes — the repository swap is the only change in the main process.
