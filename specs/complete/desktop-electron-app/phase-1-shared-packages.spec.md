# Phase 1: Shared Package Extraction

## Goal

Extract business logic from `apps/api` into shared packages so the same code can run in both the cloud API and the desktop app. This is the prerequisite for everything else — the desktop SQLite layer, AI portability, and testability all depend on it.

---

## Mental Model

> **Don't make Prisma portable. Make your business logic portable.**

Right now, `apps/api` handlers call Prisma directly. The goal is to insert a layer between domain logic and the database:

```txt
Before:
apps/api handler → Prisma → Postgres

After:
apps/api handler
  ↓
packages/domain service function
  ↓
packages/data-access repository interface
  ↓
packages/db-postgres implementation
  ↓
Prisma → Postgres
```

Once this layer exists, `apps/desktop` can plug in `packages/db-sqlite` instead and the domain logic is unchanged.

---

## New Packages

### `packages/data-access`

Repository interfaces only. No Prisma. No runtime dependencies. Pure TypeScript types.

```txt
packages/data-access/
  package.json
  tsconfig.json
  src/
    index.ts
    repositories/
      TransactionRepository.ts
      AccountRepository.ts
      DashboardRepository.ts
      BudgetRepository.ts
      RuleRepository.ts
      ForecastRepository.ts
```

Example interface:

```ts
export interface TransactionRepository {
  listForDashboard(input: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<DashboardTransaction[]>;

  findById(input: {
    userId: string;
    transactionId: string;
  }): Promise<Transaction | null>;

  update(input: {
    userId: string;
    transactionId: string;
    patch: Partial<TransactionPatch>;
  }): Promise<Transaction>;
}
```

Domain code calls these. Postgres and SQLite implement them separately.

### `packages/domain`

Pure business logic: calculations, transformations, service functions. No HTTP. No Electron. No Prisma. No framework.

```txt
packages/domain/
  package.json
  tsconfig.json
  src/
    index.ts
    context.ts         ← AppContext type (holds userId + repositories)
    dashboard/
      getDashboardSummary.ts
      calculateNetWorth.ts
      calculateMonthlyTotals.ts
    transactions/
      listTransactions.ts
      updateTransactionCategory.ts
    rules/
      applyRules.ts
      evaluateRule.ts
    budgets/
      getBudgetStatus.ts
      calculateBudgetProgress.ts
    forecasts/
      getForecast.ts
      buildForecastScenario.ts
```

Service functions accept `AppContext` and call repository methods through it:

```ts
export type AppContext = {
  userId: string;
  repositories: {
    transactions: TransactionRepository;
    accounts: AccountRepository;
    dashboard: DashboardRepository;
    budgets: BudgetRepository;
    rules: RuleRepository;
    forecasts: ForecastRepository;
  };
};

export async function getDashboardSummary(
  ctx: AppContext,
  input: GetDashboardSummaryInput
): Promise<DashboardSummary> {
  const accounts = await ctx.repositories.accounts.listForSummary({ userId: ctx.userId });
  const transactions = await ctx.repositories.transactions.listForDashboard({
    userId: ctx.userId,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  return calculateDashboardSummary({ accounts, transactions });
}
```

### `packages/db-postgres`

Implements `packages/data-access` interfaces using the existing Prisma Postgres client.

```txt
packages/db-postgres/
  package.json
  tsconfig.json
  src/
    index.ts
    createPostgresRepositories.ts
    repositories/
      PostgresTransactionRepository.ts
      PostgresAccountRepository.ts
      PostgresDashboardRepository.ts
      PostgresBudgetRepository.ts
      PostgresRuleRepository.ts
    mappers/
      transactionMappers.ts
      accountMappers.ts
```

This wraps the existing Prisma client. The Prisma client itself stays in `apps/api` or a shared `packages/db-postgres` — it does not move to `packages/domain`.

---

## Migration Order

Migrate domain slices in order. Each slice is independently deployable — completing one does not block the next, but each one makes the desktop app more capable.

```txt
1. Dashboard summary
2. Transactions list/edit
3. Rules engine
4. Forecasting/scenarios
5. Budgets
6. Investments
7. Imports
8. AI assistant workflows (Phase 3)
```

---

## Per-Slice Pattern

For each domain slice:

```txt
Step 1: Read the existing API handler(s) for the slice
Step 2: Identify what data it fetches (Prisma queries)
Step 3: Define repository interface(s) in packages/data-access
Step 4: Define shared domain types in packages/domain (if not existing)
Step 5: Extract the business logic into packages/domain service function(s)
Step 6: Implement Postgres repository in packages/db-postgres
Step 7: Update apps/api handler to:
          - construct AppContext with Postgres repositories
          - call the shared domain service
          - return the result
Step 8: Verify apps/api behavior is unchanged (manual + existing tests)
Step 9: Add unit tests for the domain service (pure logic, mock repositories)
```

---

## Slice 1: Dashboard Summary (Starting Point)

This is the recommended first slice because it's the most visible and provides the pattern for all others.

Current state in `apps/api`:

```txt
GET /api/dashboard/summary
  → handler calls Prisma queries directly
  → handler returns DashboardSummary
```

Target state:

```txt
GET /api/dashboard/summary
  → handler constructs AppContext with PostgresDashboardRepository
  → handler calls getDashboardSummary(ctx, input)
  → getDashboardSummary calls ctx.repositories.dashboard.*
  → returns DashboardSummary
```

Files to create:

```txt
packages/data-access/src/repositories/DashboardRepository.ts
packages/domain/src/dashboard/getDashboardSummary.ts
packages/domain/src/dashboard/calculateDashboardSummary.ts
packages/db-postgres/src/repositories/PostgresDashboardRepository.ts
```

Files to update:

```txt
apps/api/src/server/handlers/dashboard.ts (or equivalent)
```

---

## AppContext Construction in `apps/api`

Each API handler that calls a domain service needs to construct `AppContext`. This should happen in a shared location, not in every handler:

```ts
// apps/api/src/server/createApiAppContext.ts

export function createApiAppContext(userId: string): AppContext {
  return {
    userId,
    repositories: {
      transactions: new PostgresTransactionRepository(prisma),
      accounts: new PostgresAccountRepository(prisma),
      dashboard: new PostgresDashboardRepository(prisma),
      budgets: new PostgresBudgetRepository(prisma),
      rules: new PostgresRuleRepository(prisma),
      forecasts: new PostgresForecastRepository(prisma),
    },
  };
}
```

Handler usage:

```ts
export const dashboardHandler = withAuth(async (req, res, ctx) => {
  const appCtx = createApiAppContext(ctx.userId);
  const summary = await getDashboardSummary(appCtx, { forecastMonths: 12 });
  return res.json(summary);
});
```

---

## Boundaries

### `packages/domain` must NOT import:
- Prisma
- `apps/api`
- `apps/desktop`
- Express, Next.js, Electron
- Any HTTP or IPC framework

### `packages/data-access` must NOT import:
- Prisma
- Any database driver
- Any framework

### `packages/db-postgres` may import:
- Prisma Postgres client
- `packages/data-access` interfaces
- `packages/domain` types (for mappers)

---

## Acceptance Criteria

```txt
- packages/data-access exists with repository interfaces for at least TransactionRepository, AccountRepository, and DashboardRepository
- packages/domain exists with getDashboardSummary and at least one other service function migrated
- packages/db-postgres exists with Postgres implementations of the above interfaces
- apps/api handlers for migrated slices call packages/domain services, not Prisma directly
- apps/api behavior is unchanged (same API responses)
- packages/domain has no Prisma imports
- packages/data-access has no Prisma imports
- TypeScript passes for all new packages
- apps/api TypeScript passes
```

---

## Do Not Implement in This Phase

```txt
- SQLite repositories (Phase 2)
- Electron / desktop app changes (Phase 2)
- AI assistant workflows (Phase 3)
- Changing API response shapes
- Adding new API endpoints
- Import / sync features
```
