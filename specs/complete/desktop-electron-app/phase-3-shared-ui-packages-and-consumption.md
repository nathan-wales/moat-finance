# Phase 3: Shared UI between web app and desktop app

## Prerequisite

**Phases 1, 1.5, and 2 are already completed.**

This spec assumes the following are in place:

- `packages/domain` — shared business logic
- `packages/data-access` — repository interfaces
- `packages/db-sqlite` — SQLite repository implementations
- `packages/contracts` — IPC + domain DTO Zod schemas
- `packages/runtime` — `AppRuntime` composition layer
- `packages/events` — event bus
- `apps/desktop` — Electron shell with main/preload/renderer structure and working SQLite IPC

---

## Goal

Extract the React UI out of `apps/web` into shared packages so the same components, hooks, and Zustand stores work in both the web app (Next.js) and the desktop app (Electron renderer). The desktop app becomes a different *shell* and *data transport*, not a different frontend.

The core insight: the web app already uses client-side React Query + `@moat/client-ts` for all data fetching. The transport (`@moat/client-ts` HTTP calls) is the only thing that needs to change for the desktop. Everything else — components, hooks, stores, charts — is already portable.

---

## Architecture After Phase 3

```txt
apps/web
  Next.js shell (routing, auth, SSR metadata)
  Provides: HttpApiClient → @moat/client-ts

apps/desktop
  Electron shell (window, IPC, native OS)
  Provides: IpcApiClient → window.moatDesktop IPC

packages/ui
  Pure presentational components (no API calls, no Next.js imports)
  shadcn/ui wrappers, layout primitives, typography

packages/charts
  Recharts wrappers (NetWorthChart, CashFlowSankey, etc.)
  Accept data as props only

packages/features
  Smart feature modules — hooks, state, UI composition
  Call a FinApiClient interface; never import @moat/client-ts directly

packages/state
  Shared Zustand stores
  Runtime-agnostic; no Next.js router dependency

packages/contracts (existing)
  DTOs and Zod schemas

packages/domain (existing)
  Business logic
```

---

## The Transport Abstraction (Central Pattern)

The key unlock is a `FinApiClient` interface that all feature hooks call. Web injects an HTTP implementation; desktop injects an IPC implementation.

### Define in `packages/contracts`

```ts
// packages/contracts/src/api-client.ts

export interface FinApiClient {
  // Transactions
  listTransactions(input: TransactionListInput): Promise<TransactionListResponse>;
  countTransactions(input: TransactionCountInput): Promise<number>;
  getTransactionSummary(input: TransactionSummaryInput): Promise<TransactionSummaryResponse>;
  getMonthlyAggregates(input: { months: number }): Promise<MonthlyAggregatesResponse>;
  updateTransaction(input: UpdateTransactionInput): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  bulkDeleteTransactions(ids: string[]): Promise<void>;
  listHashtags(): Promise<string[]>;
  listTransactionCategories(): Promise<string[]>;

  // Budget
  getBudgetPageData(): Promise<BudgetPageData>;
  updateCategoryBudget(input: UpdateCategoryBudgetInput): Promise<void>;

  // Spending
  getSpendingCategoryBreakdown(input: SpendingInput): Promise<SpendingBreakdownResponse>;
  getSpendingCategoryTrends(input: SpendingInput): Promise<SpendingTrendsResponse>;
  getSpendingAnomalies(): Promise<SpendingAnomaliesResponse>;
  getRecurringExpenses(): Promise<RecurringExpensesResponse>;

  // Overview / Dashboard
  getSummaryMetrics(): Promise<SummaryMetricsResponse>;
  getPortfolioAllocation(): Promise<PortfolioAllocationResponse>;

  // Rules
  listRules(): Promise<TransactionRule[]>;
  createRule(input: CreateRuleInput): Promise<TransactionRule>;
  updateRule(id: string, input: UpdateRuleInput): Promise<TransactionRule>;
  deleteRule(id: string): Promise<void>;
  toggleRuleActive(id: string): Promise<void>;

  // Accounts
  listAccounts(): Promise<AccountSummary[]>;

  // Investments
  listInvestments(): Promise<InvestmentAccount[]>;

  // Scenarios / What-if
  listScenarios(): Promise<Scenario[]>;
  createScenario(input: CreateScenarioInput): Promise<Scenario>;
  deleteScenario(id: string): Promise<void>;

  // Settings / Profile
  getFinancialProfile(): Promise<FinancialProfile>;
  updateFinancialProfile(input: UpdateFinancialProfileInput): Promise<void>;
}
```

All types used in `FinApiClient` must be defined in `packages/contracts/src/domain/` as Zod-inferred types so they are validated at both the HTTP and IPC boundary.

### Web Implementation

```ts
// apps/web/src/lib/api-client.ts
import * as generated from "@moat/client-ts";
import type { FinApiClient } from "@moat/contracts";

export const httpApiClient: FinApiClient = {
  listTransactions: (input) => generated.getAllTransactions(input).then(unwrap),
  // ... thin adapters over the Orval-generated functions
};
```

### Desktop Implementation

```ts
// apps/desktop/src/renderer/src/lib/api-client.ts
import type { FinApiClient } from "@moat/contracts";

export const ipcApiClient: FinApiClient = {
  listTransactions: (input) => window.moatDesktop.transactions.list(input),
  // ... maps to IPC channels registered in main process
};
```

### Injection via React Context

```ts
// packages/features/src/api-client-context.tsx
const ApiClientContext = createContext<FinApiClient | null>(null);

export function ApiClientProvider({ client, children }: { client: FinApiClient; children: React.ReactNode }) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): FinApiClient {
  const client = useContext(ApiClientContext);
  if (!client) throw new Error("useApiClient must be used inside <ApiClientProvider>");
  return client;
}
```

Web root wraps with `<ApiClientProvider client={httpApiClient}>`.
Desktop root wraps with `<ApiClientProvider client={ipcApiClient}>`.
Feature hooks call `useApiClient()` — never `@moat/client-ts` directly.

---

## New Packages

### `packages/ui`

Pure presentational components. **No API calls. No Next.js imports. No Zustand.**

```txt
packages/ui/
  package.json          (@moat/ui)
  tsconfig.json
  src/
    index.ts
    primitives/         ← re-exports from shadcn/ui (button, card, dialog, etc.)
    layout/
      page-header.tsx   ← <PageHeader title= description= actions= />
      section.tsx       ← <Section title= children= />
      empty-state.tsx
    typography/
      currency.tsx      ← <Currency value= /> with consistent formatting
      percent.tsx
    feedback/
      loading-skeleton.tsx
      error-boundary.tsx
```

Rules:
- Must compile without `next` in `devDependencies`
- All Tailwind classes must be present literally (no dynamic string construction) so the Tailwind content scan in `apps/desktop` picks them up
- No `"use client"` directives — consuming apps apply their own directives

---

### `packages/charts`

Recharts wrappers that accept data as props.

```txt
packages/charts/
  package.json          (@moat/charts)
  tsconfig.json
  src/
    index.ts
    net-worth-chart.tsx
    cash-flow-sankey.tsx
    monthly-net-gains-chart.tsx
    spending-bar-chart.tsx
    portfolio-allocation-chart.tsx
    investment-growth-chart.tsx
    real-estate-roi-chart.tsx
    forecast-selector.tsx
```

Rules:
- No API calls — all data via props
- No Next.js imports
- Recharts is a peer dependency (both `apps/web` and `apps/desktop` install it)

Migration from `apps/web/src/components/charts/`: each file moves verbatim; the `import` paths to `~/components/ui/` become `@moat/ui`.

---

### `packages/features`

Smart feature modules. Each feature owns its hooks, Zustand store, and UI composition. Calls `useApiClient()` for data — never imports `@moat/client-ts` directly.

```txt
packages/features/
  package.json          (@moat/features)
  tsconfig.json
  src/
    index.ts
    api-client-context.tsx    ← useApiClient() + ApiClientProvider
    transactions/
      index.ts
      components/
        transaction-table.tsx
        transaction-filters.tsx
        edit-transaction-dialog.tsx
        bulk-action-bar.tsx
        transaction-summary.tsx
        category-input.tsx
        hashtag.tsx
        rule-prompt-toast.tsx
      hooks/
        use-transactions.ts      ← useInfiniteQuery over useApiClient().listTransactions
        use-transaction-mutations.ts
      store/
        transactions-store.ts    ← Zustand store (no next/navigation)
      types.ts
      utils.ts
    budget/
      index.ts
      components/
        category-budgets-table.tsx
        month-overview-card.tsx
      hooks/
        use-budget.ts
    spending/
      index.ts
      components/
        spending-breakdown.tsx
        spending-trends.tsx
        recurring-expenses.tsx
        spending-anomalies.tsx
      hooks/
        use-spending.ts
    overview/
      index.ts
      components/
        overview-dashboard.tsx
      hooks/
        use-overview.ts
    rules/
      index.ts
      components/
        rule-builder-dialog/
          index.tsx
          category-input.tsx
          condition-row.tsx
          action-row.tsx
          preview-row.tsx
        rules-list.tsx
      hooks/
        use-rules.ts
    accounts/
      index.ts
      components/
        accounts-list.tsx
      hooks/
        use-accounts.ts
    investments/
      index.ts
      components/
        portfolio-allocation-chart.tsx
        investment-card.tsx
      hooks/
        use-investments.ts
    settings/
      index.ts
      components/
        financial-profile-form.tsx
      hooks/
        use-settings.ts
```

Rules:
- No `next/navigation` — use a navigation abstraction (see below)
- No `next/image`, `next/link` — use a link abstraction or plain `<a>`
- No `"use server"` or Server Actions
- Zustand stores must not import from Next.js
- React Query `queryFn` must call `useApiClient()` result only

---

### `packages/state`

Zustand stores that are shared across features and not feature-specific.

```txt
packages/state/
  package.json          (@moat/state)
  tsconfig.json
  src/
    index.ts
    sidebar-store.ts        ← mobile sidebar open/close state
    onboarding-store.ts     ← onboarding wizard state
```

Existing per-feature stores (e.g., `transactions-store.ts`) stay inside `packages/features/transactions/store/` — not here. This package is for app-level UI state only.

---

## Navigation Abstraction

The transactions page uses `useRouter`, `useSearchParams`, and `usePathname` from `next/navigation` to sync filters to the URL. This is a Next.js-specific concern and cannot be in `packages/features`.

**Solution:** inject a navigation adapter.

```ts
// packages/features/src/navigation-context.tsx

export interface FinNavigation {
  push(path: string): void;
  replace(path: string): void;
  getSearchParam(key: string): string | null;
  setSearchParam(key: string, value: string): void;
  removeSearchParam(key: string): void;
}

const NavigationContext = createContext<FinNavigation | null>(null);

export function NavigationProvider({ nav, children }: { nav: FinNavigation; children: React.ReactNode }) {
  return <NavigationContext.Provider value={nav}>{children}</NavigationContext.Provider>;
}

export function useFinNavigation(): FinNavigation {
  const nav = useContext(NavigationContext);
  if (!nav) throw new Error("useFinNavigation must be used inside <NavigationProvider>");
  return nav;
}
```

**Web implementation** (in `apps/web`):

```ts
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function useNextNavigation(): FinNavigation {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // ... adapts next/navigation to FinNavigation
}
```

**Desktop implementation** (in `apps/desktop`):

```ts
// Desktop has no URL bar — use in-memory state
export function useMemoryNavigation(): FinNavigation {
  // Simple in-memory implementation, no URL sync needed
}
```

Feature components call `useFinNavigation()` instead of `useRouter()` / `useSearchParams()`.

---

## Tailwind Setup

`apps/desktop` must scan shared packages for Tailwind class names.

In `apps/desktop/tailwind.config.js` (or equivalent for the Vite+Electron setup):

```js
content: [
  "./src/**/*.{ts,tsx}",
  "../../packages/ui/src/**/*.{ts,tsx}",
  "../../packages/charts/src/**/*.{ts,tsx}",
  "../../packages/features/src/**/*.{ts,tsx}",
],
```

The shadcn/ui `components.json` in the desktop app should point to the local `packages/ui` primitives rather than generating new components.

---

## IPC Expansion for Desktop

The current `ElectronAPI` in `preload/index.ts` only exposes `localDb.getStatus()` and `localDb.getCounts()`. Phase 3 requires expanding it to cover all `FinApiClient` methods.

Expand the IPC surface in phases matching the features being ported:

### Main process IPC handlers (to add in `apps/desktop/src/main/ipc/`)

```txt
ipc/
  local-db.ts        ← existing
  transactions.ts    ← new: list, count, summary, monthly aggregates, update, delete, bulk-delete, hashtags, categories
  budget.ts          ← new: get page data, update category budget
  spending.ts        ← new: breakdown, trends, anomalies, recurring
  overview.ts        ← new: summary metrics, portfolio allocation
  rules.ts           ← new: list, create, update, delete, toggle
  accounts.ts        ← new: list
  investments.ts     ← new: list
  settings.ts        ← new: get profile, update profile
```

Each IPC handler calls the same `packages/domain` service functions that `apps/api` calls — the AppRuntime context is passed in the same way.

### Preload bridge expansion

```ts
export type ElectronAPI = {
  localDb: { ... };      // existing
  transactions: { list(...): Promise<...>; ... };
  budget: { getPageData(): Promise<...>; ... };
  spending: { getBreakdown(...): Promise<...>; ... };
  overview: { getSummaryMetrics(): Promise<...>; ... };
  rules: { list(): Promise<...>; ... };
  accounts: { list(): Promise<...>; ... };
  investments: { list(): Promise<...>; ... };
  settings: { getProfile(): Promise<...>; ... };
};
```

---

## Migration Plan

This is a large change. To avoid breaking the web app, migrate one feature at a time using the following order (lowest risk first):

### Step 1 — Create packages and plumbing (no web app changes yet)

1. Create `packages/ui` with shadcn/ui re-exports and layout primitives
2. Create `packages/charts` by moving `apps/web/src/components/charts/` — update internal imports to `@moat/ui`
3. Create `packages/features` skeleton with `ApiClientProvider`, `NavigationProvider`, and an empty feature index
4. Add `FinApiClient` interface to `packages/contracts`
5. Wire up `pnpm-workspace.yaml` with the new packages (already covers all packages by glob)
6. Add `@moat/ui`, `@moat/charts`, `@moat/features`, `@moat/state` to `apps/desktop/package.json`

### Step 2 — Port the Overview feature

1. Create `packages/features/src/overview/hooks/use-overview.ts` using `useApiClient()`
2. Create `packages/features/src/overview/components/overview-dashboard.tsx` (lifted from `apps/web/src/app/(dashboard)/overview/overview-dashboard-client.tsx`)
3. In `apps/web`: replace the inline `overview-dashboard-client.tsx` with a thin wrapper importing from `@moat/features`
4. Add `<ApiClientProvider client={httpApiClient}>` to the web root
5. Run `pnpm --filter moat-web run typecheck` — must pass
6. In `apps/desktop/src/renderer/src/App.tsx`: add an Overview page using `<ApiClientProvider client={ipcApiClient}>`
7. Expand IPC: add `overview.ts` handler in main + `overview` on `ElectronAPI`

### Step 3 — Port Transactions

1. Move `transactions-store.ts` to `packages/features/src/transactions/store/` — replace `useRouter`/`useSearchParams`/`usePathname` with `useFinNavigation()`
2. Move transaction components to `packages/features/src/transactions/components/`
3. Replace direct `@moat/client-ts` calls in hooks with `useApiClient()`
4. Update `apps/web` page to import from `@moat/features` and provide a `<NavigationProvider>`
5. Expand IPC: add `transactions.ts` handler + `ElectronAPI.transactions`
6. Add Transactions page in `apps/desktop`

### Step 4 — Port Budget, Spending, Rules

Same pattern as Step 3 for each feature.

### Step 5 — Port Settings, Accounts, Investments

Final features. By this point all shared packages are stable.

---

## What Stays in `apps/web`

The following are **not** moved to shared packages:

| Concern | Why it stays in web |
|---|---|
| `src/app/**/layout.tsx` | Next.js-specific routing |
| `src/app/**/page.tsx` | Next.js-specific routing; becomes a thin 1-line wrapper |
| `src/middleware.ts` | Next.js middleware |
| `src/app/api/**` | Next.js Route Handlers |
| `src/context/` | Next.js auth/session providers |
| `src/components/auth/` | NextAuth UI |
| `src/components/plaid/` | Plaid Link (web-only SDK) |
| `src/components/billing/` | Stripe (web-only) |
| `src/components/onboarding/` | Next.js-specific multi-step flow |
| `src/lib/server-api.ts` | Server-only auth/session access |
| `next.config.js`, `middleware.ts` | Web runtime config |

The Next.js `page.tsx` files become thin wrappers:

```tsx
// apps/web/src/app/(dashboard)/overview/page.tsx
import { OverviewDashboard } from "@moat/features/overview";
export default function Page() { return <OverviewDashboard />; }
```

---

## What Stays in `apps/desktop`

| Concern | Why it stays in desktop |
|---|---|
| `src/main/` | Electron main process (Node.js) |
| `src/preload/index.ts` | Electron preload bridge |
| `src/renderer/src/App.tsx` | Desktop shell (routing, nav) |
| `src/renderer/src/lib/api-client.ts` | `ipcApiClient` implementation |
| `src/main/ipc/` | IPC channel handlers calling domain services |

---

## `apps/web` Root Provider Wrapper

After migration, the web app root layout needs:

```tsx
// apps/web/src/components/layout/dashboard-providers.tsx (updated)
<ApiClientProvider client={httpApiClient}>
  <NavigationProvider nav={nextNavAdapter}>
    {children}
  </NavigationProvider>
</ApiClientProvider>
```

The existing `dashboard-providers.tsx` is the right place to add these — it already wraps the dashboard layout.

---

## Testing Expectations

Each new package must compile cleanly:

```sh
pnpm --filter @moat/ui run typecheck
pnpm --filter @moat/charts run typecheck
pnpm --filter @moat/features run typecheck
pnpm --filter @moat/state run typecheck
```

After each feature migration step:

```sh
pnpm --filter moat-web run typecheck
pnpm --filter moat-web run check:write
pnpm --filter moat-desktop run typecheck
pnpm --filter moat-desktop run check:write
```

The web app must not have any functional regression — the component output is identical, only the import path changes.

---

## Anti-Patterns to Avoid

- **Do not import `next/navigation` in `packages/features`** — use `useFinNavigation()`
- **Do not import `@moat/client-ts` in `packages/features`** — use `useApiClient()`
- **Do not put IPC logic in `packages/features`** — IPC stays in `apps/desktop`
- **Do not add Prisma to the renderer** — Prisma only runs in the main process
- **Do not load the Next.js app inside Electron** — Electron renders its own React app
- **Do not put Server Components in shared packages** — shared packages are client-side React only
- **Do not create a separate copy of shadcn/ui in `apps/desktop`** — use `packages/ui`
- **Do not add `"use client"` to package source files** — consuming apps apply their own directives per their framework conventions

---

## Commit Sequence (Suggested)

```
feat (packages): add @moat/ui, @moat/charts skeleton packages
feat (packages): add FinApiClient interface to @moat/contracts
feat (packages): add ApiClientProvider and NavigationProvider to @moat/features
feat (packages): port overview feature to @moat/features
feat (web): consume @moat/features overview, wire HttpApiClient
feat (desktop): add overview page with IpcApiClient
feat (packages): port transactions feature to @moat/features
feat (web): consume @moat/features transactions
feat (desktop): add transactions page with IPC handlers
feat (packages): port budget, spending, rules features
feat (web): consume remaining shared features
feat (desktop): add budget, spending, rules pages
```

---

## Next: Phase 4

Once Phase 3 feature ports are underway (or in parallel with IPC work), continue with [phase-4-desktop-v1-beta.spec.md](phase-4-desktop-v1-beta.spec.md) for import, write repositories, packaging, and distribution.
