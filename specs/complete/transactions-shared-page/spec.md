# Shared Transactions Page

## Status

Draft. Created May 30, 2026 after reviewing the current web transactions page, desktop transactions renderer page, desktop IPC transaction handlers, shared `FinApiClient` contract, `packages/features` extraction pattern, and the existing shared spending page spec.

## Goal

Move the mature web transactions workflow into a shared `@moat/features` module so both `apps/web` and `apps/desktop` render the same user-facing transactions page, while preserving each app's transport and data boundary.

The web implementation is the source of truth for the product experience. It is already modular, store-driven, and feature-rich: filters, infinite table, summary cards, inline category and hashtag edits, edit dialog, split handling, bulk actions, rule prompts, retail sync banner, and rule builder integration. The desktop implementation is useful but simpler, and it should consume the same shared workflow instead of continuing as a fork.

Success means:

- `apps/web` and `apps/desktop` consume a shared `TransactionsPage` from `packages/features`.
- Shared transaction UI depends on `FinApiClient`, host-injected adapters, and `@moat/ui`, not `@moat/client-ts`, Next.js APIs, Electron IPC, or app-local component aliases.
- The web route remains visually and behaviorally equivalent to the current web implementation.
- The desktop route gains the web-grade transactions workflow without bypassing typed IPC, AppRuntime repositories, or SQLite data safety.
- Shared state uses the same focused Zustand selector pattern currently used by web.
- Desktop and web transaction contracts are aligned enough that shared components do not need broad host-specific branches for normal rendering.

## Product Context

Transactions are where users teach Moat Finance how their financial life should be interpreted. Categorization accuracy affects budgets, spending analysis, forecasts, rules, reports, and local agent answers. A weaker desktop transactions page makes the local-first product feel less trustworthy and gives agents less complete context.

Moat Finance's desktop app is intended to become a local-first financial context OS. For that to feel coherent, desktop should not maintain a simplified transaction review surface while web has the better workflow. Sharing the web implementation through `packages/features` lets both apps improve together while still respecting their different transports:

- Web uses generated HTTP APIs from `@moat/client-ts` behind `httpApiClient`.
- Desktop uses `window.moatDesktop.*` IPC behind `ipcApiClient`.
- Shared features call only the runtime-agnostic `FinApiClient` and host-provided adapters.

## Current Repo Context

### Web Source Implementation

Primary files:

- `apps/web/src/app/(dashboard)/transactions/page.tsx`
- `apps/web/src/app/(dashboard)/transactions/transactions-store.ts`
- `apps/web/src/app/(dashboard)/transactions/use-transaction-mutations.ts`
- `apps/web/src/app/(dashboard)/transactions/use-edit-transaction-dialog.tsx`
- `apps/web/src/app/(dashboard)/transactions/transaction-table.tsx`
- `apps/web/src/app/(dashboard)/transactions/edit-transaction-dialog.tsx`
- `apps/web/src/app/(dashboard)/transactions/bulk-action-bar.tsx`
- `apps/web/src/app/(dashboard)/transactions/category-editor.tsx`
- `apps/web/src/app/(dashboard)/transactions/hashtag.tsx`
- `apps/web/src/app/(dashboard)/transactions/transaction-context-menu.tsx`
- `apps/web/src/app/(dashboard)/transactions/transaction-summary.tsx`
- `apps/web/src/app/(dashboard)/transactions/retail-sync-banner.tsx`
- `apps/web/src/app/(dashboard)/transactions/filters/*`

Current web behavior:

- URL-backed filters for search, category, hashtag, date range, and sort.
- Infinite transaction list via `getAllTransactions`.
- Count and summary reads via `countTransactions` and `getTransactionSummary`.
- Reference data reads via `listTransactionCategories` and `listHashtags`.
- Retail transaction detection banner via `detectRetailTransactions`.
- Amazon retail sync flow via extension/web handoff and `runRetailMatching`.
- Inline category editor with fuzzy suggestions and create-new category option.
- Inline hashtag editor with add/remove behavior and fuzzy suggestions.
- Row selection and bulk action bar.
- Bulk category update.
- Bulk hashtag add.
- Bulk hide.
- Edit dialog for description, amount, type, category, hashtags, split, unsplit, hide, and rule creation/update.
- Split transaction workflow through `splitTransaction` and `unsplitTransaction`.
- Post-save toast that detects meaningful edits and offers `Create Rule` or `Update Rule`.
- Rule prefill from transaction fields and changed actions.
- Rule builder integration with `RuleBuilderDialog`, including `editingRule`, `rulePrefill`, and `transactionIdToLink`.

Important implementation detail:

- The current web files import `@moat/client-ts`, `~/components/ui/*`, `~/lib/utils`, Next.js routing hooks, and the web-only `RuleBuilderDialog`. Those imports must not move into `packages/features` as-is.

### Desktop Current Implementation

Primary files:

- `apps/desktop/src/renderer/src/pages/transactions/index.tsx`
- `apps/desktop/src/renderer/src/pages/transactions/edit-transaction-dialog.tsx`
- `apps/desktop/src/renderer/src/pages/transactions/transaction-context-menu.tsx`
- `apps/desktop/src/renderer/src/lib/ipc-api-client.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/main/ipc/transactions.ts`
- `packages/contracts/src/ipc/transactions.ts`
- `packages/db-sqlite/src/repositories/SqliteTransactionRepository.ts`
- `packages/data-access/src/repositories/TransactionRepository.ts`

Current desktop behavior:

- Uses `useApiClient()` and React Query.
- Lists transactions through IPC.
- Supports search, category, date, type, and sort filters.
- Reads count and summary through IPC.
- Reads categories and hashtags through IPC.
- Updates transaction fields, category by name, and hashtags through the desktop repository.
- Supports hide as a soft-hide IPC channel.
- Supports delete and bulk delete as hard deletes.
- Renders a simplified table with inline category selection and hashtag display.
- Renders a simplified edit dialog for description, amount, type, category, and comma-separated hashtags.
- Offers a context menu with edit, change category, add hashtags, add/update rule placeholder, and hide.
- Has a desktop-only retail sync launcher that opens web sync in the browser.

Current desktop gaps versus web:

- No shared Zustand transactions store.
- No mobile/desktop filter component parity.
- No web-grade active filter badges.
- No inline hashtag editor parity.
- No category create affordance parity in inline edit.
- No split or unsplit APIs in IPC/repository.
- No applied rule id on transaction list items.
- No split group metadata on transaction list items.
- No transaction source metadata, so the web's Plaid amount-edit guard cannot be preserved.
- No category object metadata such as hidden/default state on transaction rows.
- No shared rule prompt flow after category, hashtag, or edit-dialog changes.
- No shared rule builder dialog in `packages/features`.
- No desktop local equivalent for previewing or applying rules historically from the builder.
- No bulk category update IPC operation.
- No bulk hashtag add/set IPC operation.
- Bulk delete currently hard-deletes in desktop while web's visible transaction removal action is framed as hide.
- Desktop has no `sonner` dependency or shared notification abstraction, while web transaction logic uses `toast` heavily.

### Existing Shared Package Pattern

`packages/features` already hosts shared feature pages and providers:

- `OverviewDashboard`
- `BudgetPage`
- `CategoriesPage`
- `FinancialProfilePage`
- `PromptLibraryPage`
- `ScenariosPage`
- `SpendingPage`
- `WhatIfPage`
- `ApiClientProvider`
- `NavigationProvider`
- `ForecastProvider`

The transactions extraction should follow this same model:

- Shared UI lives under `packages/features/src/transactions/`.
- Package root exports `TransactionsPage`.
- `packages/features/package.json` exposes `./transactions`.
- Web and desktop provide data through their existing `ApiClientProvider` wrappers.
- Host-only integrations are injected through small adapters or optional props.

## Recommendation

Share this workflow, but do it in phases. The plan should not copy the current web files directly into `packages/features` because several pieces are host-bound today. The right move is to extract the web design and store architecture into a runtime-agnostic feature module, then make web and desktop adapters satisfy the same contract.

Reasons this should still be shared:

- The transactions workflow has a real second consumer now.
- `packages/features` already exists for exactly this kind of cross-surface UI.
- The desktop app already injects `ipcApiClient` through `ApiClientProvider`.
- Most desktop missing capabilities are contract/repository gaps, not UX reasons to maintain a fork.
- Keeping two separate transaction pages will make rule, split, hashtag, and retail sync behavior drift quickly.

Issues to address before or during sharing:

- Notifications need a shared abstraction or desktop must adopt the same toaster provider. `packages/features` should not import `sonner` directly unless desktop also standardizes on it.
- Rule builder must be shared or injected. The web builder imports `@moat/client-ts` and web-local UI, so transactions cannot depend on it as-is.
- Retail sync must be host-injected. Web can run the current Amazon extension/API flow; desktop can open the web sync handoff or disable the banner until local retail matching exists.
- Desktop must expose more transaction metadata before the web table and edit dialog can work unchanged.
- Hide and delete semantics must be named carefully. Shared UI should call `hideTransaction` for the normal remove-from-view action and reserve hard delete for explicit destructive flows.

## Target Architecture

### Shared Feature Module

Create a new package module:

```text
packages/features/src/transactions/
  index.ts
  transactions-page.tsx
  transactions-store.ts
  transaction-queries.ts
  transaction-mutations.ts
  transaction-types.ts
  transaction-utils.ts
  notification-context.tsx
  retail-sync-adapter.ts
  rule-builder-adapter.ts
  components/
    transaction-page-header.tsx
    transaction-summary.tsx
    transaction-table.tsx
    transaction-row.tsx
    transaction-mobile-row.tsx
    transaction-context-menu.tsx
    edit-transaction-dialog.tsx
    bulk-action-bar.tsx
    bulk-category-popover.tsx
    bulk-hashtag-popover.tsx
    category-cell.tsx
    category-input.tsx
    hashtag-cell.tsx
    retail-sync-banner.tsx
    rule-prompt-toast.tsx
  filters/
    index.tsx
    transaction-filters.tsx
    active-filters.tsx
    category-filter.tsx
    date-range-picker.tsx
    hashtag-filter.tsx
    mobile-filter-popover.tsx
    search-input.tsx
    sort-select.tsx
    type-filter-select.tsx
```

The exact split can change during implementation, but the final shape should keep the same modularity the web app has now. Avoid one large `transactions-page.tsx` file. Components should remain focused enough that the page orchestration reads like the current web page.

### Runtime Boundary

The shared transactions module may import:

- `useApiClient()` from `packages/features/src/api-client-context.tsx`.
- `useFinNavigation()` from `packages/features/src/navigation-context.tsx` for URL/search-param behavior.
- Types from `@moat/contracts`.
- UI primitives from `@moat/ui`.
- React Query.
- Zustand and `useShallow`.
- `date-fns`, `lucide-react`, and other dependencies already allowed in `packages/features`.

The shared transactions module must not import:

- `@moat/client-ts`.
- `~/components/*` or any app-local alias.
- Next.js routing, session, server actions, or App Router APIs.
- Electron `window.moatDesktop`, `ipcRenderer`, or preload types.
- `apps/api` files, Prisma, or AppRuntime.
- Web-only analytics/session/demo providers.

### Host Adapters

Use small host adapters where the behavior is genuinely host-specific.

#### Notifications

Introduce one of these patterns:

- Preferred: `NotificationProvider` in `packages/features`, with a minimal interface:

```ts
type FeatureNotifications = {
  success(message: string): void;
  error(message: string): void;
  showAction(input: {
    message: string;
    actionLabel: string;
    onAction: () => void;
    durationMs?: number;
  }): void;
  dismissAll?(): void;
};
```

- Acceptable: `TransactionsPage` receives a `notifications` prop.

Web can implement this with `sonner`. Desktop can either add a shared toaster or implement lightweight in-app notifications. Do not make the shared feature depend directly on web's `toast` import.

#### Retail Sync

Add an optional transactions page prop or context:

```ts
type RetailSyncAdapter = {
  detect(input: TransactionFilterInput): Promise<RetailTransactionDetection | null>;
  run(input: { retailer: "amazon" | "walmart" | "target" }): Promise<RetailSyncResult>;
};
```

Web adapter behavior:

- Calls existing retail detection API.
- Runs the current Amazon sync trigger.
- Calls retail matching when sync succeeds.

Desktop adapter behavior:

- Phase 1 can omit detection and hide the banner, or provide heuristic detection from local transactions.
- Run action can call `window.moatDesktop.retailSync.openAmazonWebSync()` through a desktop-only wrapper outside the shared package.
- Do not expose `window.moatDesktop` inside `packages/features`.

If a local retail matching pipeline is added later, implement it behind desktop IPC and keep the shared adapter unchanged.

#### Rule Builder

Transactions need a shared or injected rule builder. There are two viable paths:

1. Extract a shared `RuleBuilderDialog` into `packages/features/src/rules/` first, then import it from the transactions module.
2. Keep the builder host-injected with a `TransactionsRuleBuilderAdapter` while the extraction is in progress.

Preferred target:

```text
packages/features/src/rules/
  index.ts
  rule-builder-dialog.tsx
  rule-builder-store.ts
  rule-builder-types.ts
  rule-builder-utils.ts
  components/*
```

The shared rule builder should call `FinApiClient` methods only. It should not call `@moat/client-ts` directly.

The transaction store should hold rule dialog state in a transport-neutral format:

```ts
type RulePrefill = {
  conditions?: RuleConditionDraft[];
  actions?: RuleActionDraft[];
};
```

## Data And Contract Requirements

### Extend Shared Transaction Types

Current `FinApiClient.Transaction` is too small for the web workflow. Extend `packages/contracts/src/api-client.ts` so the shared table and dialog have the fields they need.

Target shape:

```ts
type Transaction = {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  categoryRef?: {
    id?: string | null;
    name: string;
    isHidden?: boolean;
    isDefault?: boolean;
  } | null;
  account: string | null;
  accountId?: string | null;
  hashtags: TransactionHashtag[];
  appliedRuleId?: string | null;
  splitGroupId?: string | null;
  splitParentId?: string | null;
  hidden?: boolean;
  source?: string | null;
};

type TransactionHashtag = {
  hashtag: {
    name: string;
    normalizedName: string;
  };
};
```

The current desktop adapter returns `hashtags?: string[]`. To avoid every shared component branching on two hashtag shapes, normalize desktop responses in `ipcApiClient` to the shared `TransactionHashtag[]` shape, or revise the shared shape to a simpler string array and update web mapping accordingly. The recommended path is the richer object shape because it matches the current web table and editor behavior.

### Extend `FinApiClient` Transaction Methods

Add methods needed by the shared workflow:

```ts
type UpdateTransactionFieldsInput = {
  id: string;
  description?: string;
  amount?: number;
  type?: "INCOME" | "EXPENSE";
};

type UpdateTransactionCategoryInput = {
  id: string;
  categoryName: string;
};

type SetTransactionHashtagsInput = {
  transactionId: string;
  hashtags: string[];
};

type SplitTransactionInput = {
  id: string;
  description?: string;
  originalAmount: number;
  splitAmount: number;
  type: "INCOME" | "EXPENSE";
  originalCategoryName: string;
  splitCategoryName: string;
  hashtags: string[];
};

interface FinApiClient {
  listTransactions(input: TransactionListInput): Promise<TransactionListResponse>;
  countTransactions(input: TransactionCountInput): Promise<number>;
  getTransactionSummary(input: TransactionSummaryInput): Promise<TransactionSummaryResponse>;
  updateTransaction(input: UpdateTransactionInput): Promise<void>;
  updateTransactionFields?(input: UpdateTransactionFieldsInput): Promise<Transaction>;
  updateTransactionCategory(input: UpdateTransactionCategoryInput): Promise<{ categoryName: string }>;
  setTransactionHashtags(input: SetTransactionHashtagsInput): Promise<void>;
  splitTransaction(input: SplitTransactionInput): Promise<void>;
  unsplitTransaction(input: { id: string }): Promise<void>;
  hideTransaction(id: string): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  bulkHideTransactions(ids: string[]): Promise<void>;
  bulkUpdateTransactionCategory(input: { ids: string[]; categoryName: string }): Promise<void>;
  bulkAddTransactionHashtag(input: { ids: string[]; hashtag: string }): Promise<void>;
  listHashtags(): Promise<string[]>;
  listTransactionCategories(): Promise<string[]>;
}
```

Notes:

- `updateTransaction(input)` can remain as a convenience method, but the shared workflow benefits from explicit methods because web currently calls separate endpoints for fields, category, and hashtags.
- `bulkHideTransactions` should represent web's current bulk removal behavior. Desktop can implement it through soft hide rather than hard delete.
- Keep `deleteTransaction` for explicit destructive delete flows only.

### Rule Methods Needed By Shared Builder

The existing `FinApiClient` rule methods cover list/get/create/update/delete/toggle. The web rule builder also needs methods for preview, historical apply, and transaction linking.

Add or confirm equivalents:

```ts
interface FinApiClient {
  previewRuleConditions(input: RulePreviewInput): Promise<RulePreviewResult>;
  applyRuleHistorical(input: { ruleId: string }): Promise<RuleApplyHistoricalResult>;
  linkRuleToTransaction(input: { ruleId: string; transactionId: string }): Promise<void>;
}
```

Desktop must implement local equivalents behind IPC or the shared rule builder must receive capability flags that hide preview/apply-historical controls when unavailable. Prefer implementing local equivalents so desktop and web teach categorization the same way.

### Desktop IPC And Repository Work

Update `packages/contracts/src/ipc/transactions.ts`:

- Add transaction response fields: `categoryRef`, `accountId`, `appliedRuleId`, `splitGroupId`, `splitParentId`, `hidden`, and `source` where available.
- Allow `sortField: "account"` if shared web filters keep account sorting.
- Add `split`, `unsplit`, `bulkHide`, `bulkUpdateCategory`, and `bulkAddHashtag` channels.
- Keep `delete` and `bulkDelete` as destructive operations.
- Keep `categoryName` as the UI-facing category write input.

Update `apps/desktop/src/preload/index.ts`:

- Expose new typed IPC methods only under `window.moatDesktop.transactions`.
- Do not expose raw database, repository, or AppRuntime access.

Update `apps/desktop/src/main/ipc/transactions.ts`:

- Parse every new channel input with Zod schemas from `@moat/contracts`.
- Route writes through `repositories.transactions` methods.
- Use `hide` for shared page removal actions.
- Add meaningful errors when a repository method is not available.

Update `packages/data-access/src/repositories/TransactionRepository.ts`:

- Add optional methods for split, unsplit, bulk hide, bulk category update, and bulk hashtag add.
- Extend `DashboardTransaction` with the metadata the shared renderer needs.

Update `packages/db-sqlite/src/repositories/SqliteTransactionRepository.ts`:

- Include hashtags, applied rule id, split metadata, hidden flag, source, and account/category ids in list/find queries as needed.
- Implement split and unsplit using local SQLite schema fields if they already exist.
- If local SQLite schema does not have split fields, add a desktop migration rather than faking split state in the renderer.
- Implement bulk hide as `hidden = true`.
- Implement bulk category update by resolving category names to ids server-side/main-side, not in renderer.
- Implement bulk hashtag add by merging with existing tags and preserving normalized names.

### Web HTTP Adapter Work

Update `apps/web/src/lib/http-api-client.ts`:

- Map generated SDK transaction records to the expanded shared `Transaction` type.
- Add explicit methods for category update, hashtag set, split, unsplit, hide, bulk hide, bulk category update, and bulk hashtag add.
- Keep all HTTP calls inside this adapter. Shared feature files should never import `@moat/client-ts` directly.
- Preserve existing query keys where possible or deliberately migrate them in the shared module.

### Desktop IPC Adapter Work

Update `apps/desktop/src/renderer/src/lib/ipc-api-client.ts`:

- Map IPC transaction records to the same expanded shared `Transaction` type that web returns.
- Stop returning simplified `hashtags: string[]` if the shared UI uses the web hashtag shape.
- Route `hideTransaction` to `transactions.hide`.
- Route shared bulk hide to the new soft-hide IPC channel, not `bulkDelete`.
- Add split, unsplit, bulk category update, and bulk hashtag add methods once IPC exists.

## URL And Navigation Requirements

The web page currently owns URL synchronization through Next.js hooks in `page.tsx`. The shared page should move this behavior onto `useFinNavigation()` so both web and desktop can participate without importing Next.

Requirements:

- Preserve web query params: `q`, `sort`, `hashtag`, `category`, `from`, `to`.
- Continue defaulting to `date-desc` when no sort param exists.
- Parse `from` and `to` as local calendar dates, matching current web behavior.
- Do not push URL updates before initial URL hydration completes.
- Desktop can use its current `NavigationProvider` route/search adapter. If desktop does not persist search params in the same way yet, the shared page should still work with in-memory defaults and opt into URL sync once the adapter supports it fully.

## UX Requirements

The shared page should preserve the current web page hierarchy and interaction model.

### Page Shell

- Constrained width: `mx-auto w-full max-w-5xl space-y-6 pb-24` unless an existing shared page layout utility replaces it.
- Title: `Transactions`.
- Subtitle: `Review and correct individual transactions to fix income/expense totals`.
- No extra desktop card wrapper around the whole page.

### Filters

- Search description input.
- Category filter.
- Hashtag filter in active filter/mobile flow if web keeps it there.
- Date range picker.
- Sort selector with date, amount, and account options if the contract supports account sorting.
- Mobile filter popover equivalent to web.
- Active filter badges for category, hashtag, and date range.

### Summary

- Show income, expenses, net gain, and transaction count from `getTransactionSummary` and `countTransactions`, not from only the loaded page.
- Summary should respect all active filters.
- Loading and empty states should not produce misleading zeroes unless the API actually returned zero.

### Table

- Infinite scrolling with an intersection observer sentinel.
- Desktop table layout equivalent to web.
- Mobile row layout equivalent to web.
- Row click opens edit dialog.
- Context menu supports edit, category, hashtags, create/update rule, and hide.
- Row selection supports bulk actions.
- Split transactions are grouped together and marked with the split badge.
- Hidden rows or hidden categories are visually muted when they remain in cache during optimistic updates.
- Do not log descriptions, raw transaction data, or hashtags.

### Inline Category Editing

- Fuzzy category suggestions.
- Keyboard navigation.
- Create category option when input does not match an existing category.
- Optimistic cache patch on success.
- Rule prompt after meaningful category change.

### Inline Hashtag Editing

- Fuzzy hashtag suggestions.
- Add and remove hashtags inline.
- Create hashtag by typing a new tag.
- Keyboard navigation and comma/enter commit behavior.
- Optimistic cache patch on success.
- Rule prompt after adding a hashtag.

### Edit Dialog

- Description edit.
- Amount edit, with Plaid/source guard if source metadata says the amount should not be edited.
- Type edit.
- Category combobox with create-new support.
- Hashtag combobox/editor.
- Split transaction controls.
- Remove split action when applicable.
- Hide transaction action.
- Save button disabled/pending state.
- Validation for positive amounts and required split categories.
- Post-save rule prompt when description, type, category, added hashtags, or editable amount changed.

### Bulk Action Bar

- Fixed bottom action bar as in web.
- Bulk hide.
- Bulk category update.
- Bulk hashtag add.
- Single-selection create/update rule action.
- Clear/cancel selection.
- Pending state while bulk operations run.

### Rule Prompt And Builder

- Inline edits and edit-dialog saves should offer `Create Rule` when no applied rule exists and `Update Rule` when `appliedRuleId` exists.
- Rule prefill should include transaction-derived conditions for description, amount, account, and category when available.
- Rule prefill actions should include changed description, type, category, and newly added hashtags.
- If a rule is saved while launched from the edit dialog, the transaction dialog return behavior should match the current web flow.

### Retail Sync Banner

- Banner component should be shared.
- Detection and run behavior should be host-injected.
- If no retail adapter exists, the banner should not render.
- Web should preserve existing Amazon extension/web sync behavior.
- Desktop should initially open the web sync handoff unless local retail sync becomes available.

## Implementation Plan

### Phase 0 - Contract Audit And Decisions

1. Confirm whether shared transaction hashtag shape should be string array or web's nested hashtag object. Choose one and update both adapters.
2. Confirm local SQLite schema support for split groups, split parent rows, applied rule links, transaction source, and hidden state.
3. Decide whether desktop adopts `sonner` or uses a feature-level notification provider.
4. Decide whether rule builder extraction happens before transaction extraction or as an injected adapter during transition.
5. Decide whether desktop account sorting is required for v1 shared adoption.
6. Document hard delete versus hide semantics in the shared contract names.

Acceptance criteria:

- The chosen shared transaction DTO is documented in `@moat/contracts`.
- Desktop missing schema fields are known before UI extraction begins.
- Notification, rule builder, and retail sync adapter strategy is chosen.

### Phase 1 - Align Transaction Contracts

1. Extend `packages/contracts/src/api-client.ts` transaction types and methods.
2. Extend `packages/data-access` transaction DTOs and repository interface.
3. Extend desktop IPC schemas and channels.
4. Update desktop preload typing and exposed methods.
5. Update desktop main IPC handlers.
6. Update `SqliteTransactionRepository` list/find/update methods to return the expanded transaction shape.
7. Add missing repository methods for soft-hide bulk operations and bulk metadata updates.
8. Add split/unsplit repository methods if SQLite schema supports them; otherwise add the needed local migration first.
9. Update `httpApiClient` and `ipcApiClient` to satisfy the same `FinApiClient` transaction surface.

Acceptance criteria:

- `FinApiClient` can represent every field the web transaction UI currently reads.
- Web and desktop adapters typecheck against the same interface.
- Desktop no longer maps shared remove actions to hard delete.
- Desktop can list, count, summarize, update, hide, bulk hide, set category, set hashtags, split, and unsplit through typed IPC.

### Phase 2 - Extract Shared Transaction Store And Utilities

1. Move `transactions-store.ts` logic into `packages/features/src/transactions/transactions-store.ts`.
2. Replace web-specific imports with shared types and adapters.
3. Keep the selector hook pattern: `useFilterState`, `useSelectionState`, `useTransactionUIState`, `useRuleDialogState`, `useTransactionActions`, `useReferenceData`, `useEditDialogState`, and `useAppliedDateRange`.
4. Move `formatAmountInput`, `parseAmountInput`, `formatAmount`, and `fuzzyScore` into shared transaction utilities or existing shared utility packages.
5. Remove direct `getRuleById` SDK calls from the store; use `useApiClient` through action helpers or a rule adapter.
6. Replace direct `toast` calls with the shared notification adapter.

Acceptance criteria:

- Store module compiles inside `packages/features`.
- Store has no app alias imports.
- Store actions remain focused and selector-based.
- Web behavior remains unchanged when wired to the shared store.

### Phase 3 - Extract Shared Components

1. Move filter components into `packages/features/src/transactions/filters/`.
2. Move table, row, mobile row, and context menu components into `packages/features/src/transactions/components/`.
3. Move category and hashtag cells into shared components and replace app-local UI imports with `@moat/ui` exports.
4. Move edit dialog and bulk action bar into shared components.
5. Move transaction summary and retail banner into shared components.
6. Replace `~/lib/utils` `cn` usage with `cn` from `@moat/ui`.
7. Replace `~/components/ui/*` imports with `@moat/ui`.
8. Ensure needed UI primitives exist in `@moat/ui`; add missing primitives there only when they are genuinely shared.

Acceptance criteria:

- Shared transaction components import only approved shared packages.
- No component file becomes a large multi-component catch-all.
- The current web composition remains easy to read.

### Phase 4 - Shared Queries And Mutations

1. Implement shared React Query hooks or local query blocks that call `useApiClient`.
2. Standardize query keys for transactions, summary, count, categories, hashtags, retail detection, and rules.
3. Port optimistic cache patching to shared code.
4. Update invalidation after update, hide, bulk hide, category, hashtag, split, and unsplit operations.
5. Preserve infinite scroll pagination.
6. Preserve URL hydration and URL sync through `useFinNavigation`.

Acceptance criteria:

- Shared page fetches through `FinApiClient` only.
- Shared page has the same loading/error/empty behavior on web.
- Desktop can render the shared page with IPC-backed data.

### Phase 5 - Rule Builder Strategy

Preferred path:

1. Extract `RuleBuilderDialog` to `packages/features/src/rules/`.
2. Move rule builder local subcomponents into smaller files.
3. Replace generated SDK calls with `FinApiClient` rule methods.
4. Add missing rule preview/apply/link methods to `FinApiClient` and adapters.
5. Add desktop IPC/repository support for preview, apply historical, and link rule to transaction.
6. Use the shared builder from `TransactionsPage` and from any rules page refactor.

Transition path if needed:

1. Keep rule builder host-injected temporarily.
2. Define a `TransactionsRuleBuilderAdapter` that can open a host builder with `editingRule`, `prefill`, `transactionIdToLink`, and `onSaved`.
3. Use web's current builder adapter first.
4. Add desktop builder adapter second.
5. Remove the adapter once a shared rule builder exists.

Acceptance criteria:

- Rule prompt flow works on web after extraction.
- Desktop has either the shared builder or an explicit adapter with no no-op `Add/update rule` menu item.
- No shared transaction code imports the web rule builder directly.

### Phase 6 - Host Route Adoption

Web route target:

```tsx
"use client";

import { TransactionsPage } from "@moat/features/transactions";
import { webRetailSyncAdapter } from "~/lib/transactions/web-retail-sync-adapter";
import { webNotifications } from "~/lib/transactions/web-notifications";

export default function Page() {
  return (
    <TransactionsPage
      notifications={webNotifications}
      retailSyncAdapter={webRetailSyncAdapter}
    />
  );
}
```

Desktop route target:

```tsx
import { TransactionsPage } from "@moat/features/transactions";
import { desktopRetailSyncAdapter } from "../lib/transactions/desktop-retail-sync-adapter";
import { desktopNotifications } from "../lib/transactions/desktop-notifications";

export function DesktopTransactionsPage() {
  return (
    <TransactionsPage
      notifications={desktopNotifications}
      retailSyncAdapter={desktopRetailSyncAdapter}
    />
  );
}
```

If notifications are provided by context instead of props, the route target should be smaller. The examples above show the adapter boundary, not a required final API.

Acceptance criteria:

- `apps/web/src/app/(dashboard)/transactions/page.tsx` becomes a thin wrapper.
- `apps/desktop/src/renderer/src/pages/transactions/index.tsx` becomes a thin wrapper or is removed in favor of rendering the shared page directly from `App.tsx`.
- Both apps remain behind their existing `ApiClientProvider` and `NavigationProvider`.

### Phase 7 - Cleanup And Removal

1. Delete or reduce old web-local transaction components after imports move to `@moat/features`.
2. Delete the old desktop-specific transactions implementation once parity is confirmed.
3. Remove duplicate helpers and types that are now in the shared module.
4. Update package exports:

```json
{
  "exports": {
    "./transactions": "./src/transactions/index.ts"
  }
}
```

5. Export `TransactionsPage` from `packages/features/src/index.ts`.

Acceptance criteria:

- No unused old transaction files remain in web or desktop.
- No duplicate transaction stores exist for the same shared workflow.
- Package exports are consistent with other shared features.

## Testing Plan

### Package Typechecks

- `pnpm --filter @moat/contracts run typecheck` if the contracts package exposes that script.
- `pnpm --filter @moat/data-access run typecheck` if available.
- `pnpm --filter @moat/db-sqlite run typecheck` if available.
- `pnpm --filter @moat/features run typecheck`.
- `pnpm --filter moat-web run typecheck`.
- `pnpm --filter moat-desktop run typecheck`.

### Lint And Format

- `pnpm --filter moat-web run check:write`.
- `pnpm --filter moat-desktop run check:write`.
- Run relevant package checks for `@moat/features`, `@moat/contracts`, and `@moat/db-sqlite` if scripts exist.

### Unit Tests

Add or update tests for:

- Transaction store selectors and actions.
- Date filter URL parse/serialize helpers.
- Amount parse/format helpers.
- Fuzzy category/hashtag suggestion helpers.
- Rule action prefill generation.
- Split amount validation.
- IPC transaction input schemas.
- SQLite repository category-name resolution.
- SQLite repository hashtag set/add behavior.
- SQLite repository soft hide and bulk soft hide.
- SQLite repository split and unsplit behavior.

### Renderer Tests

Add React Testing Library coverage for:

- Shared transactions page initial render with mocked `FinApiClient`.
- Filter changes call the expected query inputs.
- Summary renders server-provided totals.
- Category inline edit updates through `FinApiClient` and shows rule prompt action.
- Hashtag inline edit updates through `FinApiClient` and shows rule prompt action.
- Edit dialog save validates amount and produces rule prefill actions.
- Split flow validates categories and amounts.
- Bulk bar renders only when rows are selected.
- Retail banner hides when adapter/detection is unavailable.

### Desktop IPC Tests

Add tests with mocked repositories for:

- `transactions:list` returns the expanded DTO.
- `transactions:update` resolves `categoryName` and `hashtags` correctly.
- `transactions:hide` soft hides.
- `transactions:bulkHide` soft hides multiple rows.
- `transactions:bulkUpdateCategory` resolves category names to ids.
- `transactions:bulkAddHashtag` merges existing tags.
- `transactions:split` and `transactions:unsplit` preserve totals and ownership.

### Manual Verification

Web:

- Load `/transactions` with no filters.
- Apply search, category, hashtag, date, and sort filters.
- Confirm URL query params round-trip after refresh.
- Infinite scroll loads more rows.
- Inline category edit works and prompts rule creation/update.
- Inline hashtag add/remove works and prompts rule creation/update.
- Edit dialog updates fields and prompts rule creation/update.
- Split and unsplit work.
- Bulk category, bulk hashtag, and bulk hide work.
- Retail sync banner still runs the existing web flow.

Desktop:

- Open Transactions from sidebar.
- Confirm local IPC list/count/summary render correctly.
- Apply the same filters as web.
- Infinite scroll works against local SQLite.
- Inline category and hashtag edits persist after reload.
- Edit dialog updates fields and persists after reload.
- Split and unsplit persist after reload.
- Bulk category, bulk hashtag, and bulk hide work without hard-deleting rows.
- Rule create/update flow is no longer a placeholder.
- Retail banner behavior is either hidden or opens the web sync handoff intentionally.

## Risks And Mitigations

### Risk: The shared page becomes too host-aware

Mitigation: Keep all host-specific behavior behind `FinApiClient`, `NavigationProvider`, notification adapter, retail adapter, and optional rule builder adapter. Do not import app-specific modules into `packages/features`.

### Risk: Desktop local data cannot support split parity yet

Mitigation: Treat split/unsplit as a contract and SQLite migration workstream before enabling the shared edit dialog in desktop. Do not fake split rows only in renderer state.

### Risk: Rule builder extraction is larger than the page extraction

Mitigation: Use a temporary host-injected rule builder adapter if needed. Still define the shared builder as the target so the transaction module does not settle into a permanent host-specific hole.

### Risk: Toasts make the shared package depend on web-only `sonner`

Mitigation: Add a notification abstraction or adopt a shared toaster across both apps. The shared module should not directly import `sonner` unless the repo intentionally standardizes on it for all React surfaces.

### Risk: Hard delete accidentally remains wired to bulk hide

Mitigation: Rename shared UI actions as hide/remove-from-view and route them to `hideTransaction` or `bulkHideTransactions`. Keep destructive delete methods separate and require explicit destructive UI.

### Risk: Transaction response shape changes break existing consumers

Mitigation: Add fields as optional first, update adapters, then tighten component assumptions after both web and desktop return the expected shape. Keep runtime boundary schemas in IPC and HTTP adapter mappings.

### Risk: The shared store leaks state between route instances

Mitigation: The app has one transactions route per renderer, so a module-level Zustand store is acceptable. If future nested transaction surfaces need isolated stores, add a store factory and provider then.

## Non-Goals

- Do not move API handler authorization or database access into shared UI.
- Do not expose raw SQLite, Prisma, or AppRuntime through desktop preload.
- Do not redesign the transactions page while extracting it.
- Do not replace React Query or Zustand.
- Do not add a new state management library.
- Do not implement local retail order parsing in this extraction unless a separate retail sync spec requires it.
- Do not make desktop call the cloud API directly from IPC handlers for transaction UI parity.

## Open Questions

- Does local SQLite already have split group fields compatible with the web split model, or does desktop need a migration?
- Should shared transaction hashtags use the current web nested hashtag shape or simplify both web and desktop to `string[]`?
- Should `@moat/features` introduce a general notification provider for all shared pages, or should transactions accept a local prop first?
- Should rule builder extraction happen in this feature or as a prerequisite `shared-rules-builder` feature?
- Should desktop implement local rule preview and apply-historical in v1, or should those controls be capability-gated until local repositories support them?
- Should retail detection be added to `FinApiClient`, or stay a host-injected transactions adapter because desktop's flow is materially different?
- Should account sorting be supported in desktop IPC now, or hidden until the local query supports it?

## Rollout Strategy

1. Land contract and adapter changes behind existing pages.
2. Extract shared store and pure components without switching routes.
3. Switch web to the shared page first, because web is the source of truth and has complete backend support.
4. Switch desktop after IPC and SQLite parity are verified.
5. Remove old desktop page only after manual local verification confirms no parity regressions.

## Done Definition

- `TransactionsPage` is exported from `@moat/features/transactions` and `@moat/features`.
- Web transactions route renders the shared page and preserves current behavior.
- Desktop transactions route renders the shared page and supports the same core transaction review, edit, bulk, split, hashtag, and rule prompt workflows.
- Shared transactions code has no app-specific imports.
- Desktop transaction writes go through typed IPC and AppRuntime repositories only.
- Web transaction writes go through HTTP APIs only.
- Checks and relevant tests pass for affected packages/apps.
- Manual verification covers web and desktop transaction workflows.