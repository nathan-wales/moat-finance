# Desktop Feature Parity With Web

## Status

Draft. Created May 30, 2026 after a repository assessment of the current web dashboard, Electron desktop renderer, IPC contracts, shared feature packages, and local SQLite repository layer.

## Goal

Bring `apps/desktop` into practical feature parity with the strongest user-facing workflows in `apps/web`, while preserving the desktop app's local-first architecture and avoiding package extraction that would make either surface harder to evolve.

Success means a user can move between web and desktop without losing core Moat Finance workflows: reviewing and teaching transactions, managing categories and rules, modeling cash flow and forecast assumptions, using the financial profile, and asking local agents for insight. When a feature exists on both surfaces, the behavior should feel intentionally consistent, not like a simplified fork.

## Product Principles

- Desktop parity means equivalent capability, not necessarily identical cloud behavior. Local-first desktop can replace cloud sharing, OAuth, or server-session assumptions with local equivalents.
- The web app remains the best reference for mature workflow behavior. Desktop should copy proven behavior before inventing new interaction patterns.
- Shared packages are the preferred home for reusable feature UI and domain logic only when the code can be runtime-agnostic through `FinApiClient`, host-injected navigation, and host-injected actions.
- IPC and SQLite work should be explicit. Do not expose raw Node.js, Prisma, or AppRuntime to the renderer.
- Authorization and data boundaries still matter. Web writes stay server-side through API wrappers; desktop writes stay behind typed IPC handlers and AppRuntime repositories.

## Current Repo Assessment

### Web Dashboard Surface

The web sidebar exposes these authenticated dashboard areas:

- Overview: `apps/web/src/app/(dashboard)/overview/page.tsx`
- Financial profile: `apps/web/src/app/(dashboard)/financial-profile/page.tsx`
- AI reports: `apps/web/src/app/(dashboard)/ai-reports/page.tsx`
- Prompt library: `apps/web/src/app/(dashboard)/ask-ai/page.tsx`
- MCP settings: `apps/web/src/app/(dashboard)/mcp-settings/page.tsx`
- Budget: `apps/web/src/app/(dashboard)/budget/page.tsx`
- Transactions: `apps/web/src/app/(dashboard)/transactions/page.tsx`
- Rules: `apps/web/src/app/(dashboard)/rules/page.tsx`
- Spending: `apps/web/src/app/(dashboard)/spending/page.tsx`
- Categories: `apps/web/src/app/(dashboard)/categories/page.tsx`
- What If calculator: `apps/web/src/app/(dashboard)/what-if/page.tsx`
- Investments: `apps/web/src/app/(dashboard)/investments/page.tsx`
- Scenario modeling: `apps/web/src/app/(dashboard)/scenarios/page.tsx`

### Desktop Surface

The desktop renderer currently exposes these page ids in `apps/desktop/src/renderer/src/App.tsx` and `apps/desktop/src/renderer/src/components/sidebar.tsx`:

- Overview
- Financial profile
- Ask AI
- Budget
- Transactions
- Rules
- Spending
- Investments
- Import
- Settings

The desktop app already uses shared feature packages for:

- `OverviewDashboard` from `packages/features/src/overview`
- `BudgetPage` from `packages/features/src/budget`
- `FinancialProfilePage` from `packages/features/src/financial-profile`
- `PromptLibraryPage` and AI prompt components from `packages/features/src/ask-ai`

That is the right architectural direction. The parity work should continue this pattern for reusable features, while filling local IPC and repository gaps where the shared feature contract expects capability that desktop does not yet provide.

### Missing Or Partial Desktop Pages

| Web Feature | Desktop Status | Parity Decision |
| --- | --- | --- |
| Categories | Missing dedicated page | Add desktop page and shared package candidate after local category APIs exist. |
| What If calculator | Missing | Extract into `packages/features/src/what-if` and add local baseline API. |
| Scenario modeling | Missing UI; local forecast scenario data exists for agent tools | Extract shared scenario UI and add desktop scenario IPC. |
| AI reports | Missing; desktop API client currently stubs/throws | Add local report library only if desktop local MCP can create persistent reports. Defer public sharing. |
| MCP settings | Desktop has local agent settings inside Settings, not a separate nav item | Keep local settings host-specific, but align information architecture and naming. |
| Transactions | Present but simplified | First priority parity workstream. |
| Rules | Present but separate implementation | Needs transaction integration parity and possibly shared builder extraction later. |
| Spending | Present with separate implementation | Align API shape and chart detail after transaction parity. |
| Investments | Present with separate implementation | Align scenario integration and real estate depth after scenario work. |

## Transaction Parity Deep Dive

Transactions are the highest-risk gap because they are where users teach Moat Finance how to classify their financial life. A simplified desktop transaction workflow directly weakens local-first trust and agent context quality.

### Web Behavior To Match

The web transactions workflow includes:

- Infinite transaction list with URL-backed filters for search, category, hashtag, date range, and sort.
- Summary data from `countTransactions` and `getTransactionSummary`.
- Inline category editing with a rule prompt toast.
- Inline hashtag editing with a rule prompt toast.
- Bulk category update.
- Bulk hashtag assignment.
- Bulk delete/hide workflows.
- Edit dialog for description, amount, type, category, hashtags, split, unsplit, hide, and rule creation/update.
- Split transaction flow for separating one transaction into two categories and amounts.
- Post-save toast that detects changed fields and offers `Create Rule` or `Update Rule`.
- Rule prefill actions from prior and new transaction values: description, type, category, and hashtags.
- Rule builder integration through `RuleBuilderDialog` with `transactionIdToLink` and prefilled actions.

The key implementation reference is `apps/web/src/app/(dashboard)/transactions/use-edit-transaction-dialog.tsx`, especially the change detection and `PostSaveToast` workflow.

### Desktop Current Behavior

The desktop transactions implementation is currently split between:

- Renderer page: `apps/desktop/src/renderer/src/pages/transactions/index.tsx`
- Renderer edit dialog: `apps/desktop/src/renderer/src/pages/transactions/edit-transaction-dialog.tsx`
- Renderer context menu: `apps/desktop/src/renderer/src/pages/transactions/transaction-context-menu.tsx`
- IPC handlers: `apps/desktop/src/main/ipc/transactions.ts`
- IPC contracts: `packages/contracts/src/ipc/transactions.ts`
- Local repository: `packages/db-sqlite/src/repositories/SqliteTransactionRepository.ts`
- Runtime-agnostic API bridge: `apps/desktop/src/renderer/src/lib/ipc-api-client.ts`

Desktop currently supports:

- List, count, update, delete, bulk delete, and category listing.
- Search, category, date, and sort filtering.
- Basic summary computed from the currently loaded page set.
- Inline category dropdown.
- Basic edit dialog for description, amount, type, and category.
- Context menu actions for edit, change category, add hashtags, add/update rule, and hide/delete shape.

Desktop currently lacks:

- Hashtag persistence and list APIs in IPC.
- Hashtag rendering and editing in the table/dialog.
- Split and unsplit transaction APIs and UI.
- Soft hide semantics equivalent to web; current desktop delete paths may hard-delete local rows.
- Post-save toast with `Create Rule` / `Update Rule` action.
- Rule prefill from changed transaction values.
- Bulk category update.
- Bulk hashtag assignment.
- Hashtag/date/account filters matching web.
- Server-calculated summary parity; `ipcApiClient.getTransactionSummary` is not implemented.
- Category creation by name during transaction edit.
- Applied rule metadata in the renderer transaction shape.

### Notable Implementation Bug To Fix

`apps/desktop/src/renderer/src/lib/ipc-api-client.ts` maps `UpdateTransactionInput.category` to `categoryId`, but the shared `FinApiClient` transaction type treats `category` as a category name. The IPC schema expects `categoryId`, and `SqliteTransactionRepository.update` writes that value directly to `Transaction.categoryId`.

That means the desktop category edit path can pass a category name into a foreign-key field. The parity work must fix this at the contract boundary rather than piling more UI on top of the mismatch.

Preferred fix:

- Add a desktop transaction update input that accepts `categoryName` for UI-facing calls, or add a repository method that resolves category name to id before update.
- Keep `categoryId` available only for internal/data-layer calls where the caller truly has an id.
- Update `FinApiClient.updateTransaction` and desktop IPC mapping so shared feature UI can use the same category-name contract as web.

## Package Strategy

### Extract To `packages/features` When

Move code into `packages/features` when all of these are true:

- The feature can run through `FinApiClient` instead of importing `@moat/client-ts`, Next.js routing, Electron IPC, or app-specific auth directly.
- Navigation can be host-injected through `FinNavigation` or callback props.
- Host-only actions can be injected, such as Ask AI menu buttons, connect account buttons, report sharing, screenshots, OAuth, or native file dialogs.
- Styling uses `@moat/ui` primitives or already shared chart packages.
- The feature has a real second consumer now, not just a speculative future one.

### Keep App-Specific When

Keep code in the app when it depends on:

- Next.js server components, metadata, middleware, public routes, OAuth consent, or route handlers.
- Electron-only filesystem, native dialogs, local agent gateway lifecycle, local database status, or app update controls.
- Web-only analytics/session behavior or desktop-only local privacy copy.
- A feature whose local data model does not exist yet.

### Candidate Extractions

| Candidate | Recommendation | Rationale |
| --- | --- | --- |
| Transactions workflow | Extract carefully after IPC/data parity | It is high-value but currently too web-coupled through `@moat/client-ts`, `sonner`, rule builder imports, URL params, and web-only types. First standardize contracts. |
| What If calculator | Extract early | Mostly self-contained UI and Zustand state; needs `getWhatIfBaseline` added to `FinApiClient` and desktop implementation. |
| Scenario modeling | Extract early-mid | Web UI is self-contained but depends on scenario HTTP APIs; desktop already has scenario concepts for agent tools. |
| Categories management | Extract after category IPC exists | Useful on both surfaces; needs local CRUD/hide APIs and shared icon taxonomy. |
| AI reports list/detail | Extract only after desktop report persistence exists | Web sharing/public links are cloud-specific; local report browsing can share UI but not behavior. |
| Rules builder | Extract after transaction parity | Rule builder already appears in both apps but integration behavior differs. Extract when prefill and apply-historical semantics are aligned. |
| Spending/investments pages | Defer extraction | Existing pages are separate but functional; parity value is lower than transactions, What If, categories, and scenarios. |

## Required Workstreams

### Phase 0 - Contract Audit And Local Data Safety

1. Create a parity checklist in this spec's issue/PR tracking that maps every web route to desktop status.
2. Fix transaction category identity mismatch:
   - UI-facing input uses category name.
   - IPC/main resolves to category id.
   - Repository writes ids only.
3. Decide soft-hide versus hard-delete semantics for desktop:
   - `hide` should set `hidden = true` or equivalent.
   - `delete` should remain explicit and destructive.
   - Bulk actions should distinguish hide from delete.
4. Add local transaction summary IPC so shared transaction surfaces can call `getTransactionSummary` without stubs.
5. Confirm local SQLite schema has or needs fields for hashtags, split groups, applied rules, hidden categories, scenario records, and report records.

Acceptance criteria:

- Desktop category edits persist correctly by category id after resolving user-facing category names.
- `ipcApiClient.getTransactionSummary` is implemented.
- Desktop delete/hide semantics are named and tested.
- No renderer code receives raw Prisma, AppRuntime, or filesystem access.

### Phase 1 - Desktop Transactions: Web-Grade Editing

Build desktop transaction parity before adding the larger missing pages.

Required capabilities:

- Edit description, amount, type, category, and hashtags in one dialog.
- Use a category combobox that can search existing categories and create a category when allowed.
- Use a hashtag combobox that can list existing hashtags and create new tags.
- Show split state in the table.
- Split a transaction into original and child rows with separate category and amount.
- Remove an existing split.
- Hide a transaction from the edit dialog and context menu.
- Keep delete available as a separate destructive action.
- Add post-save toast after meaningful edits.
- Offer `Create Rule` when no linked/applied rule exists.
- Offer `Update Rule` when a linked/applied rule exists.
- Pre-fill rule actions from original values to new values for description, type, category, and added hashtags.
- Add bulk category assignment.
- Add bulk hashtag assignment.
- Keep bulk delete/hide behavior explicit.

IPC and repository additions:

- `transactions:setHashtags`
- `transactions:listHashtags`
- `transactions:split`
- `transactions:unsplit`
- `transactions:hide`
- `transactions:bulkUpdateCategory`
- `transactions:bulkSetHashtags` or `transactions:bulkAddHashtags`
- `transactions:getSummary`
- optional `transactions:updateByNames` if category/hashtag name resolution is intentionally kept at the IPC boundary

Shared contract additions:

- Extend `packages/contracts/src/api-client.ts` so transaction records can carry enough metadata for shared UI:
  - `hashtags`
  - `splitGroupId`
  - `splitParentId`
  - `appliedRuleId`
  - `pending`
  - `source`
  - `categoryRef` or a stable category object if the UI needs hidden/default metadata
- Extend IPC transaction schemas in `packages/contracts/src/ipc/transactions.ts` with the same fields where desktop can support them.

Testing expectations:

- Repository unit tests for category-name resolution, hashtag mutation, split, unsplit, hide, and summary.
- IPC handler tests with mocked AppRuntime repositories.
- Renderer tests for edit dialog save behavior and rule prompt generation.
- A manual Electron pass covering edit, split, hide, rule prompt, and bulk actions.

### Phase 2 - Shared What If Calculator

The What If calculator is completely absent from desktop and should be the first missing page added after transaction parity.

Current web implementation:

- Page and UI: `apps/web/src/app/(dashboard)/what-if/`
- Calculator/domain logic: `apps/web/src/lib/what-if-calculator.ts`
- Baseline API: `apps/api/src/server/handlers/budget.ts` `getWhatIfBaseline`

Package approach:

- Move calculator logic to a runtime-agnostic package, preferably `packages/domain` if it is pure calculation or `packages/features/src/what-if` if coupled to UI state.
- Move reusable UI to `packages/features/src/what-if`.
- Add `getWhatIfBaseline()` to `FinApiClient`.
- Implement web `HttpApiClient.getWhatIfBaseline()` through the existing API client.
- Implement desktop `IpcApiClient.getWhatIfBaseline()` through a new local budget/transactions IPC handler.
- Keep analytics host-specific; web can keep `what_if_viewed`, desktop can omit or use a local-safe event only if a local analytics policy exists.

Desktop acceptance criteria:

- Sidebar includes `What If` under Budget.
- Desktop loads baseline monthly income, expenses, savings/debt categories, and budget targets from local SQLite.
- User can edit hypothetical monthly items and see the same surplus/deficit calculations as web.
- No scenario changes are persisted unless the shared web feature also persists them.

### Phase 3 - Scenario Modeling Parity

Scenario modeling is absent from desktop UI even though desktop agent tools reference forecast scenarios.

Current web implementation:

- Page: `apps/web/src/app/(dashboard)/scenarios/page.tsx`
- Presets and forecast logic: `apps/web/src/lib/forecasting.ts`
- Scenario CRUD APIs from `@moat/client-ts`

Package approach:

- Move reusable scenario presets and pure forecast helpers to `packages/domain` or `packages/shared` if not already there.
- Move scenario page UI to `packages/features/src/scenarios` after it depends only on `FinApiClient`.
- Add scenario methods to `FinApiClient`:
  - `listScenarios`
  - `seedDefaultScenarios`
  - `createScenario`
  - `updateScenario`
  - `deleteScenario`
  - `setActiveScenario`
- Add desktop IPC and SQLite repository support for the same operations.
- Ensure `ForecastProvider`, overview charts, investment pages, and local MCP forecast tools read the same active scenario source.

Desktop acceptance criteria:

- Sidebar includes `Scenarios` under Wealth Management.
- Desktop can create, delete, rename, and activate scenarios.
- Active scenario affects local forecast overlays wherever web currently uses it.
- Local MCP forecast tools and desktop UI agree on the active scenario.

### Phase 4 - Categories Management Parity

The web categories page is a mature category management surface. Desktop currently has only category listing/editing inside transaction flows.

Required capabilities:

- Dedicated `Categories` desktop page under Budget.
- Create user category.
- Rename user category.
- Delete user category when safe, with clear fallback/reassignment behavior.
- Hide/unhide category.
- Display default and user categories grouped with icons.
- Keep hidden categories out of spending/budget/transaction defaults where web does.

Package approach:

- Add category methods to `FinApiClient` or a category-specific shared contract if the interface becomes too large.
- Add IPC contracts under `packages/contracts/src/ipc/categories.ts` or extend an existing budget/category contract.
- Move reusable categories UI to `packages/features/src/categories` once both web and desktop clients implement the methods.

Desktop acceptance criteria:

- Sidebar includes `Categories`.
- Hidden categories affect desktop transaction/spending/budget surfaces consistently.
- Category changes are reflected in transaction edit and filters without restarting the app.

### Phase 5 - AI Reports And AI Access Alignment

AI reports are web-first today. Desktop has a local agent gateway, but `ipcApiClient` currently returns an empty report list and throws for report detail/create/share/update operations.

Decision:

- Do not chase cloud report sharing parity in desktop unless local reports can be created and persisted by local MCP tools.
- Treat public report sharing (`/r/[shareSlug]`) as web-only.
- Add local report library only when there is a local report storage model and local report creation path.

Possible desktop behavior:

- `Reports` page lists locally generated reports from SQLite.
- Report detail opens in-app rather than a public web route.
- Export/share means local export, not public link, unless explicitly synced through cloud later.
- Settings keeps local agent gateway controls, but nav naming should align with web enough that users can find MCP/agent setup.

Acceptance criteria if implemented:

- Desktop report list is not a fake empty state when local reports exist.
- Report APIs in `FinApiClient` have a clear capability model for unsupported operations.
- No public sharing UX appears without cloud sync and explicit user consent.

### Phase 6 - Secondary Parity Polish

After the major gaps are closed, align these surfaces:

- Spending page chart density, trend behavior, recurring expenses, anomalies, and transaction drill-through links.
- Investments page tabs, manual investment editing, real estate support, and scenario-aware forecast controls.
- Rules page builder UI and apply-historical behavior.
- Settings page naming, local database status, connected Plaid items, feedback, and agent gateway affordances.
- Import page integration with post-import rules and transaction review.

## Data And Contract Guidelines

- Prefer `FinApiClient` as the shared feature boundary. If a feature cannot use it cleanly, improve the boundary before extracting UI.
- Keep generated web HTTP clients and desktop IPC clients as host adapters, not places for business logic.
- Shared UI should consume category names for user-visible controls and stable ids only where the UI truly needs ids.
- Desktop IPC handlers should validate with Zod schemas from `packages/contracts`.
- AppRuntime repositories should own local persistence operations; IPC handlers should not contain complex Prisma queries beyond orchestration.
- Normalize shared domain logic into `packages/domain` when it is pure calculation or transformation.
- Keep UI state in Zustand where the current web feature already uses it and the state is client-only.

## Analytics, Logging, And Privacy

- Web analytics should keep following PostHog rules: snake_case events and no PII.
- Desktop should not add cloud analytics for local-only actions without an explicit product decision.
- Never log transaction descriptions, account numbers, raw merchant names, tokens, or full rule payloads.
- Desktop local agent and report features should respect local privacy copy and local storage expectations.
- Public sharing remains cloud-only unless a future desktop-cloud sync spec explicitly enables it.

## Rollout Plan

1. Land transaction contract/data fixes first, especially category identity and summary APIs.
2. Add desktop transaction edit parity using existing desktop pages before extracting shared transaction UI.
3. Extract and ship What If through `packages/features` with `FinApiClient.getWhatIfBaseline`.
4. Extract and ship Scenarios with shared scenario contracts and desktop SQLite persistence.
5. Add Categories after local category CRUD/hide APIs are stable.
6. Revisit transaction UI extraction once both apps have equivalent APIs and behavior.
7. Decide whether AI Reports should be local desktop functionality or remain cloud-only.

## Acceptance Checklist

Desktop reaches parity for this initiative when:

- The desktop sidebar includes every applicable web dashboard workflow: Overview, Profile, Reports if supported, Prompts, MCP/Agent settings, Budget, Transactions, Rules, Spending, Categories, What If, Investments, and Scenarios.
- Transaction editing in desktop supports the same meaningful edits and teaching loop as web.
- Saving a changed desktop transaction can prompt rule creation/update from prior and new values.
- Rules created from desktop transaction edits persist locally and apply to future imports/syncs.
- What If works from local data.
- Scenario modeling works from local data and affects local forecasts and local MCP explanations.
- Category management works locally and is reflected across budget, spending, rules, and transactions.
- Shared feature packages are used where they reduce drift, and app-specific code remains where platform behavior differs.
- IPC contracts, AppRuntime repositories, and SQLite persistence have tests for each new write path.

## Open Questions

- Should desktop AI reports be purely local, synced to cloud, or out of scope until local MCP report generation is first-class?
- Should transaction delete in desktop become soft hide by default, matching the less destructive web UX, with hard delete hidden behind confirmation?
- Should shared transaction UI live in `packages/features/src/transactions`, or should the shared package start smaller with hooks and utilities first?
- Do desktop scenarios need cloud sync later, or are they intentionally local planning assumptions?
- Should category icons be stored as part of the category model or remain a deterministic UI mapping by name/group?

## Related Files

- `apps/web/src/app/(dashboard)/transactions/use-edit-transaction-dialog.tsx`
- `apps/web/src/app/(dashboard)/transactions/edit-transaction-dialog.tsx`
- `apps/web/src/app/(dashboard)/transactions/page.tsx`
- `apps/web/src/app/(dashboard)/what-if/page.tsx`
- `apps/web/src/app/(dashboard)/scenarios/page.tsx`
- `apps/web/src/app/(dashboard)/categories/page.tsx`
- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/renderer/src/components/sidebar.tsx`
- `apps/desktop/src/renderer/src/pages/transactions/index.tsx`
- `apps/desktop/src/renderer/src/pages/transactions/edit-transaction-dialog.tsx`
- `apps/desktop/src/main/ipc/transactions.ts`
- `apps/desktop/src/renderer/src/lib/ipc-api-client.ts`
- `packages/contracts/src/api-client.ts`
- `packages/contracts/src/ipc/transactions.ts`
- `packages/db-sqlite/src/repositories/SqliteTransactionRepository.ts`
- `packages/features/src/index.ts`
