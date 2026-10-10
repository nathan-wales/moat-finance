# Pattern: SQLite and Local Data (apps/desktop)

## Overview

The desktop app stores all data locally in a SQLite database managed by `@moat/db-sqlite`. This is a separate Prisma client from `apps/api` — it uses SQLite instead of PostgreSQL, with its own schema and migrations.

| Concern | Package / File |
|---------|---------------|
| SQLite Prisma client | `packages/db-sqlite/` |
| Schema | `packages/db-sqlite/prisma/schema.prisma` |
| Migrations | `packages/db-sqlite/prisma/migrations/` |
| App-level context (repos) | `packages/runtime/` or `@moat/runtime` |
| Desktop DB init | `apps/desktop/src/main/db.ts` |
| Legacy demo purge | `packages/db-sqlite/src/purge-legacy-demo-workspace.ts` |

---

## Startup flow

DB init runs **after vault unlock / setup**, not before the window. Vault IPC calls `initDesktopDb` via `ensurePostUnlockServices` once the vault is ready.

```ts
// apps/desktop/src/main/ipc/vault.ts (conceptually)
await initializeAfterVaultReady();
// → initDesktopDb(userDataPath)
// → initGateway + optional startGateway
```

Inside `initDesktopDb`:

1. Migrate legacy user-data paths when present
2. Resolve the SQLite file path: packaged `~/Library/Application Support/moat-finance/moat.db`; unpackaged `pnpm dev` uses `~/Library/Application Support/moat-finance-dev/moat.db` (macOS)
3. `ensureLocalDatabase(dbPath)` — creates the directory if missing
4. `createSqliteClient(dbPath)` — sets `DATABASE_URL` env var and creates the Prisma client
5. `runMigrations(db)` — runs embedded schema SQL (`CREATE TABLE IF NOT EXISTS`)
6. `seedLocalUser(db)` — idempotent: creates the `local-user` record if missing
7. `seedDefaultCategories(db)` — idempotent: creates default category records
8. `purgeLegacyDesktopDemoWorkspaces(db)` — one-shot removal of older local sample datasets
9. `createRuntime(createSqliteAppContext(db, activeUserId))` — builds the `AppRuntime` with typed repos

Fresh installs stay empty of transactions until the user imports CSV or connects Plaid. To explore sample data, Settings → Local Database → **Open web demo** opens the web app demo (see `specs/features/desktop-demo-mode/spec.md`).

---

## Sample data (web link-out)

Desktop does **not** seed a local demo workspace. Settings opens the web demo so sample data never mixes with the vault. Older installs that still have `demo_dataset_version` metadata are purged once at vault init.
---

## getDesktopDb()

After `initDesktopDb()` completes, IPC handlers access the database through `getDesktopDb()` (or `getUnlockedDesktopDb()` when vault-gated):

```ts
import { getDesktopDb } from "../db";

ipcMain.handle(TRANSACTION_CHANNELS.LIST, async (_event, input) => {
  const { appCtx } = getDesktopDb(); // throws if not yet initialized
  return appCtx.transactions.list(input);
});
```

`getDesktopDb()` throws if called before `initDesktopDb()` completes.

---

## Local vs. cloud Prisma

| | `@moat/db-sqlite` | `apps/api` Prisma |
|---|---|---|
| Engine | SQLite | PostgreSQL (Neon) |
| Migrations | `runMigrations()` at startup | `prisma migrate deploy` |
| Client path | `packages/db-sqlite/src/generated/client/` | `apps/api/generated/prisma/` |
| Owned by | Desktop app only | All server-side apps |

Never import the Postgres Prisma client from `apps/api` in the desktop app. The desktop runs entirely offline-first against its local SQLite DB.

---

## Migration strategy

Desktop migrations are run automatically at app startup via `runMigrations()`. There is no manual migration step for end users.

When changing the SQLite schema:
1. Modify `packages/db-sqlite/prisma/schema.prisma`
2. Run `cd packages/db-sqlite && pnpm prisma migrate dev --name <name>` to generate the migration file
3. Mirror schema changes in `packages/db-sqlite/src/migrations.ts` (runtime truth for packaged apps)
4. The migration file is bundled with the app and runs automatically on the next startup

**Never use `prisma migrate reset` in production** — it would wipe the user's local data.

---

## AppRuntime

`@moat/runtime` wraps the SQLite Prisma client in a typed repository layer (`AppRuntime`). IPC handlers go through `appCtx` repositories / domain services, not raw Prisma:

```ts
// ✅ Use AppRuntime repos
const { appCtx } = getDesktopDb();
const transactions = await appCtx.repositories.transactions.listRecent({
  userId: appCtx.userId,
  limit: 50,
});

// ❌ Don't use raw Prisma in IPC handlers (except localDb diagnostics / seed)
```

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a new IPC handler that reads/writes data | This file + [main-renderer-ipc.md](main-renderer-ipc.md) |
| Adding a new SQLite model or migration | This file (migration strategy section) |
| Sample / demo dataset | `specs/features/desktop-demo-mode/spec.md` |
| Local agent gateway accessing the DB | [local-agent-gateway.md](local-agent-gateway.md) |
