# Phase 2: SQLite Local Database for Desktop

## Prerequisite

**Phase 1 (Shared Package Extraction) must be completed first.**

This spec assumes `packages/data-access` and `packages/domain` exist, and that `apps/api` has been updated to call shared domain services through repository interfaces. The SQLite package created here implements those same interfaces for the desktop runtime.

---

## Goal

Add a local SQLite database for `apps/desktop`. The desktop app stores all financial data in a local file and runs entirely offline — no deployed API, no cloud DB.

`packages/db-sqlite` implements the `packages/data-access` repository interfaces using a Prisma SQLite client. Domain services in `packages/domain` are completely unaware of whether they run against Postgres or SQLite.

---

## Architecture

```txt
apps/desktop (IPC handlers)
  ↓
packages/domain service functions
  ↓
packages/data-access interfaces (TransactionRepository, etc.)
  ↓
packages/db-sqlite implementations
  ↓
Prisma SQLite client
  ↓
moat.db (local file)
```

Domain code never does this:

```ts
// Bad — Prisma leaks into domain logic
const rows = await prisma.transaction.findMany({ ... });
```

It does this:

```ts
// Good — domain calls a repository interface
const transactions = await ctx.repositories.transactions.listForDashboard({ userId, startDate });
```

---

## Requirements

### 1. Local Database Location

On app startup, resolve an OS-appropriate app data directory.

Use Electron’s app path utilities.

Target locations:

```txt
macOS:
~/Library/Application Support/Moat Finance/moat.db

Windows:
%APPDATA%/Moat Finance/moat.db

Linux:
~/.config/Moat Finance/moat.db
````

Do not store the database inside the app bundle.

---

## 2. Add `packages/db-sqlite`

Create a new package:

```txt
packages/db-sqlite/
  package.json
  tsconfig.json
  prisma/
    schema.prisma
    migrations/
  src/
    index.ts
    createSqliteClient.ts
    ensureLocalDatabase.ts
    migrations.ts
    repositories/
      SqliteTransactionRepository.ts
      SqliteAccountRepository.ts
      SqliteDashboardRepository.ts
    mappers/
      transactionMappers.ts
      accountMappers.ts
```

Each repository file implements the matching interface from `packages/data-access`. Mapper files convert Prisma SQLite model types to the shared domain types — Prisma types must not leak into `packages/domain`.

Example repository:

```ts
import type { TransactionRepository } from "@moat/data-access";
import type { PrismaClient } from "../generated/client";

export class SqliteTransactionRepository implements TransactionRepository {
  constructor(private db: PrismaClient) {}

  async listForDashboard(input: { userId: string; startDate?: Date; endDate?: Date }) {
    const rows = await this.db.transaction.findMany({
      where: {
        userId: input.userId,
        ...(input.startDate && { date: { gte: input.startDate } }),
        ...(input.endDate && { date: { lte: input.endDate } }),
      },
      orderBy: { date: "desc" },
    });
    return rows.map(mapSqliteTransactionToDashboard);
  }
}
```

Use existing monorepo package naming conventions.

---

## 3. Prisma SQLite Schema

Use a **separate schema** from the Postgres schema. Do not try to share one Prisma schema across both providers.

```txt
packages/db-postgres/prisma/schema.prisma   ← cloud (existing)
packages/db-sqlite/prisma/schema.prisma     ← desktop (new)
```

Postgres and SQLite differ in enum support, JSON handling, full-text search, decimal behavior, and indexing. Keeping them separate avoids compromises on either side. Keep models aligned where practical, but let them diverge where needed.

Initial SQLite schema:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/client"
}

model LocalUser {
  id        String   @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  accounts     Account[]
  transactions Transaction[]
}

model Account {
  id              String   @id
  userId          String
  name            String
  type            String
  institutionName String?
  currentBalance  Float?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user         LocalUser     @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]
}

model Transaction {
  id           String   @id
  userId       String
  accountId    String?
  date         DateTime
  amount       Float
  merchantName String?
  description  String?
  categoryName String?
  pending      Int      @default(0)
  source       String   @default("manual")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user    LocalUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  account Account?  @relation(fields: [accountId], references: [id], onDelete: SetNull)
}
```

Note: SQLite has no native `Boolean` or `Decimal`. Use `Int` (0/1) for booleans and `Float` for decimals. Map to proper TypeScript types in repository mapper functions.

Do not attempt to fully mirror the cloud schema yet.

---

## 4. Migrations

Add a migration workflow for local SQLite.

The app should be able to:

```txt
1. Create the DB file if missing
2. Run migrations
3. Seed a default local user if missing
```

Default local user:

```txt
id = "local-user"
```

Use the simplest reliable approach compatible with Electron packaging.

Document any Prisma/Electron packaging caveats discovered.

---

## 5. Desktop App Startup

In `apps/desktop`, initialize the local database from the Electron main process.

Startup flow:

```txt
Electron app ready
  ↓
resolve local DB path via app.getPath('userData')
  ↓
ensure local app data directory exists
  ↓
set DATABASE_URL env var to resolved path
  ↓
initialize Prisma SQLite client
  ↓
run migrations (prisma migrate deploy)
  ↓
seed local user if missing
  ↓
construct AppContext with SQLite repositories
  ↓
open window
```

The `AppContext` passed to domain service calls must contain the SQLite repository implementations:

```ts
const db = createSqliteClient(dbPath);

const ctx: AppContext = {
  userId: "local-user",
  repositories: {
    transactions: new SqliteTransactionRepository(db),
    accounts: new SqliteAccountRepository(db),
    dashboard: new SqliteDashboardRepository(db),
  },
};
```

Do not expose the Prisma client or `AppContext` to the renderer.

---

## 6. Add Minimal IPC Health Check

Expose a narrow desktop API:

```ts
window.moatDesktop.localDb.getStatus()
```

Return:

```ts
{
  ok: boolean;
  dbPath: string;
  hasLocalUser: boolean;
}
```

This is only for development/debugging.

Use the preload bridge.

Do not expose arbitrary DB access.

---

## 7. Settings Page UI

Update the desktop Settings page to call:

```ts
window.moatDesktop.localDb.getStatus()
```

Display:

```txt
Local database: Ready
Path: [db path]
Local user: Created
```

Keep it simple.

---

## 8. First Real Local Query

Add a minimal query through the repository layer to confirm the full stack works end to end:

```ts
// Through IPC
const counts = await window.moatDesktop.localDb.getCounts();
// { users: 1, accounts: 0, transactions: 0 }
```

The IPC handler should call through the repository (not Prisma directly) so the path `AppContext → repository → Prisma SQLite` is exercised. Do not build full dashboard functionality yet.

---

## 9. Security

Keep Electron security settings:

```txt
contextIsolation: true
nodeIntegration: false
sandbox: true if compatible
minimal preload API
```

Renderer must not import:

```txt
fs
path
prisma
electron main modules
```

---

## 10. Acceptance Criteria

Must satisfy:

```txt
- packages/db-sqlite exists with its own Prisma schema (provider = "sqlite")
- packages/db-sqlite implements at least TransactionRepository and AccountRepository from packages/data-access
- Domain service calls in packages/domain go through ctx.repositories.*, not prisma.*
- Desktop app creates local app data directory on first launch
- Desktop app creates or opens moat.db at the OS app data path
- Migrations run successfully on first launch
- Default local user "local-user" is created if missing
- AppContext is constructed with SQLite repositories and passed to domain services
- Desktop Settings page shows DB status
- Renderer has no direct filesystem, Prisma, or raw IPC access
- TypeScript passes for packages/db-sqlite and apps/desktop
- Desktop dev app runs
```

---

## 11. Do Not Implement

```txt
- Plaid
- CSV import
- encryption at rest
- transaction import UI
- full dashboard replacement (Phase 6)
- auto-updates
- app signing / notarization
- secure API key storage (Phase 3)
```
