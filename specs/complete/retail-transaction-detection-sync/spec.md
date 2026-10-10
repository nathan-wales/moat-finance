# Retail Transaction Detection And Amazon Sync Trigger

## Status

Draft. Created May 30, 2026 after a repository assessment of the current Chrome extension retail sync flow, Amazon parser, API retail import handler, Postgres retail models, web transactions page, desktop transactions page, IPC contracts, SQLite repository layer, OpenAPI client, and existing backlog retail sync spec.

This spec promotes and narrows part of `specs/backlog/retail-sync-extension/spec.md`. The extension can already import Amazon orders from a browser-triggered sync. This spec defines the missing Moat Finance transaction-page experience, Amazon keyword detection, cross-surface sync trigger, and item-to-bank-transaction linking work.

## Goal

When Moat Finance detects likely Amazon purchases in bank transaction descriptions, the transactions page should make retail enrichment obvious and fast.

A user should see a full-width banner above the transactions table in both web and desktop that says `Retail transactions detected`. The far-right action says `Run sync`. On web, clicking it should ask the Chrome extension to open Amazon orders in a background tab, show extension sync progress immediately, import orders/items into Moat Finance, link imported Amazon items to matching bank transactions, close the Amazon tab on success, and return focus to the transactions page. The user should not be navigated away from Moat Finance.

Success means:

- Amazon-like transaction descriptions are detected consistently across web, desktop, and API services.
- The web transactions page can trigger Amazon sync through the installed Chrome extension without navigating the user away from Moat Finance.
- The extension opens the Amazon orders tab immediately as part of the sync request, not only when the user manually visits Amazon.
- The extension UI visibly enters a syncing state, with the Amazon card at the top showing a spinner/loader while the sync is running.
- Successful sync closes the Amazon tab automatically.
- Imported Amazon retail items are matched to bank transactions through an API service.
- Each Amazon retail order item can reference at most one bank transaction.
- Transaction UI can show a transaction-level Amazon sync/enrichment action when Amazon keywords are detected.
- Missing bridge, persistence, and desktop gaps are explicit before implementation begins.

## Product Context

Moat Finance wants the Chrome extension to make retail order data a first-class financial input alongside bank transactions. Bank feeds usually show only merchant and amount, such as `Amazon.com`, `AMAZON MKTPLACE PMTS`, or `AMAZON MKTPL...`, which is not enough for budgeting, rules, or AI agents to understand what the user actually bought.

The repo already has the first half of this product story: a WXT Chrome extension, Amazon DOM capture, server-side HTML parsing, and Postgres storage for retail orders/items. The missing half is the Moat Finance-owned loop from bank transaction detection to user-visible prompt to extension-triggered import to transaction enrichment.

This feature is intentionally Amazon-only for v1. Walmart and Target remain enabled in shared parser code and extension UI scaffolding but are not part of this transaction-page detection and run-sync workflow until their sync paths are enabled and matching logic is proven.

## Product Boundary

### Phase 1 Builds

- Amazon-only keyword detection for transaction descriptions and merchant names.
- Web transactions-page banner above the table.
- Desktop transactions-page banner above the table, with a defined bridge strategy before implementation.
- Transaction-level Amazon sync affordance for rows or edit/details UI when a likely Amazon transaction is detected.
- Chrome extension external trigger from Moat Finance web to extension background.
- Extension sync state improvements: Amazon card sorted/pinned first while syncing, spinner/loader, and clearer in-progress copy.
- API retail matching service that runs after Amazon imports and can be re-run manually.
- Item-level linkage from `RetailOrderItem` to `Transaction`.
- OpenAPI/client contract updates for detection, sync eligibility, and linked retail items.

### Phase 1 Does Not Build

- Walmart, Target, Venmo, or other retailer detection.
- Automatic scheduled background scraping.
- Browser history scraping without user action.
- Silent sync without a user clicking `Run sync` in Moat Finance or the extension.
- Full order history pagination beyond what the existing Amazon sync flow supports.
- A desktop-native Chrome extension control channel unless the bridge strategy below is selected for Phase 1.
- Manual item reassignment UI beyond a basic unlink/re-run path if matching is wrong.
- MCP exposure of raw item titles unless a separate privacy review defines the agent surface.

## Current Repo Context

### Existing Retail Sync Foundation

The rough retail sync product spec exists only in `specs/backlog/retail-sync-extension/spec.md`. It describes user-initiated Amazon/Walmart/Target order import through the extension, narrow host permissions, DOM parsing, upload to Moat Finance API, and extension UI status.

The shared parser package lives in `packages/retail-sync/src/`:

- `normalized-types.ts` defines `Retailer`, `RetailOrderImport`, `RetailOrderItemImport`, `RetailerPageState`, `RetailerParser`, and `ScrapeResult`.
- `schemas.ts` validates import payloads.
- `retailers/amazon/parser.ts` parses visible Amazon order cards and invoice pages.
- `retailers/walmart/parser.ts` and `retailers/target/parser.ts` exist, but the extension disables those retailers for v1.
- `dedupe.ts` deduplicates imported retail orders.

The extension is `apps/extension` and uses WXT + React + MV3. Current flow:

- `entrypoints/background.ts` listens for `SYNC_RETAILER` runtime messages and delegates to `syncRetailer`.
- `lib/sync-orchestrator.ts` already opens the retailer orders URL in an inactive tab with `browser.tabs.create({ active: false })`.
- It waits for tab load, connects to the content script, captures HTML, uploads to the API, enriches Amazon invoices when needed, and closes the retailer tab on success.
- On parse/login/captcha/failure states it activates and leaves the tab open for inspection.
- `entrypoints/amazon.content.ts` registers HTML capture on Amazon URLs.
- `components/retail-sync-home.tsx` renders popup/sidepanel UI, retailer cards, and recent import snapshots.
- `components/retailer-card.tsx` already knows Amazon/Walmart/Target cards and disables Walmart/Target with `enabledInV1: false` from `lib/retailers.ts`.
- `lib/chrome-storage.ts` persists auth, connection status, import snapshots, and sync runs in Chrome Storage.
- `lib/moat-api.ts` uploads imports to `/api/v1/retail/createImport` and `/api/v1/retail/createImportFromHtml`.

This is the right foundation. The new work should add a Moat Finance-page trigger and better in-progress UX, not reimplement the scraper.

### Existing API Retail Import

Retail API code currently lives in `apps/api/src/server/handlers/retail.ts`.

Current endpoints/actions:

- `retail.listConnections`
- `retail.upsertConnection`
- `retail.disconnectConnection`
- `retail.listImports`
- `retail.getImport`
- `retail.createImport`
- `retail.createImportFromHtml`

Current implementation details:

- All actions use `withAuth`, which is correct for extension writes.
- The handler currently contains Prisma queries and business logic directly. New matching work should move retail persistence and matching logic into `apps/api/src/server/services/retail.service.ts` or similarly named service, then slim the handler down.
- `createImportFromHtml` parses HTML on the server using `linkedom` and `getRetailerParser`.
- Amazon incremental filtering skips already-imported older orders unless the page is an Amazon invoice page.
- `saveRetailImport` upserts `RetailOrder` by `(userId, retailer, externalOrderId)` and recreates items on update.
- Logs use `logger`, but request route logging still has raw `console.*` elsewhere in the generic router. Do not add PII or raw item/title/transaction description logs.

### Existing Database Shape

Postgres Prisma models exist in `apps/api/prisma/schema.prisma`:

- `RetailConnection`
- `RetailOrder`
- `RetailOrderItem`

Current `RetailOrderItem` fields include `retailOrderId`, `externalItemId`, `title`, `quantity`, `unitPrice`, `totalPrice`, `productUrl`, `imageUrl`, `sku`, and `asin`.

Current gap: there is no relation from `RetailOrderItem` or `RetailOrder` to `Transaction`, no matching status, no matched confidence, and no audit trail for why an item was linked.

Recommended Phase 1 model change:

```prisma
model RetailOrderItem {
  id             String   @id @default(cuid())
  retailOrderId  String
  transactionId  String?
  externalItemId String?
  title          String
  quantity       Int?
  unitPrice      Decimal? @db.Decimal(14, 2)
  totalPrice     Decimal? @db.Decimal(14, 2)
  productUrl     String?
  imageUrl       String?
  sku            String?
  asin           String?
  matchStatus    String   @default("unmatched")
  matchConfidence Decimal? @db.Decimal(5, 4)
  matchedAt      DateTime?
  matchReason    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  retailOrder RetailOrder @relation(fields: [retailOrderId], references: [id], onDelete: Cascade)
  transaction Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  @@index([retailOrderId])
  @@index([transactionId])
  @@index([matchStatus])
}
```

Do not make `transactionId` unique in Phase 1. One bank transaction can represent a multi-item Amazon order or shipment. The invariant is item-level ownership: each retail item row can point to zero or one bank transaction. If the product later needs one item split across multiple transactions, add a join table then; do not start with many-to-many complexity.

Optional if auditability is needed in Phase 1:

```prisma
model RetailTransactionMatchRun {
  id           String   @id @default(cuid())
  userId       String
  retailer     String
  trigger      String
  startedAt    DateTime @default(now())
  completedAt  DateTime?
  candidates   Int      @default(0)
  linkedItems  Int      @default(0)
  skippedItems Int      @default(0)
  warnings     Json?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, retailer, startedAt])
}
```

This match-run model is not required for the first UI, but it would make sync/matching failures observable without logging sensitive payloads.

### Existing Transaction Surfaces

Web transactions page:

- Route/client: `apps/web/src/app/(dashboard)/transactions/page.tsx`
- Table: `apps/web/src/app/(dashboard)/transactions/transaction-table.tsx`
- Store: `apps/web/src/app/(dashboard)/transactions/transactions-store.ts`
- Mutations: `apps/web/src/app/(dashboard)/transactions/use-transaction-mutations.ts`

Current web behavior:

- Uses React Query with generated `@moat/client-ts` calls.
- Lists transactions through `getAllTransactions`, counts through `countTransactions`, and summary through `getTransactionSummary`.
- Has URL-backed filters and infinite loading.
- Supports categories, hashtags, bulk actions, split/edit, and rule prompt behavior.

Desktop transactions page:

- Renderer page: `apps/desktop/src/renderer/src/pages/transactions/index.tsx`
- IPC handlers: `apps/desktop/src/main/ipc/transactions.ts`
- IPC contracts: `packages/contracts/src/ipc/transactions.ts`
- API bridge: `apps/desktop/src/renderer/src/lib/ipc-api-client.ts`
- SQLite repository: `packages/db-sqlite/src/repositories/SqliteTransactionRepository.ts`

Current desktop behavior:

- Uses `FinApiClient` through `useApiClient`.
- Lists/counts/summarizes transactions through IPC.
- Has local SQLite transaction, category, and hashtag support.
- Does not have any retail order tables or retail item linkage in SQLite.
- Does not have a browser-extension bridge.

Shared runtime-agnostic transaction contract:

- `packages/contracts/src/api-client.ts` defines a small `Transaction` shape with id, date, description, amount, type, category, account, and hashtags.
- It currently has no retail detection metadata or linked retail items.

Generated web client:

- `packages/client-ts/src/index.ts` has generated transaction types but no retail endpoints in OpenAPI.
- `packages/openapi/api-v1.yaml` currently has no retail operation definitions even though the generic router exposes `/api/v1/retail/*` actions.

This is a contract gap. Web should not hand-write new retail client calls; update OpenAPI and regenerate `packages/client-ts`.

### Existing Desktop Retail Gap

Desktop is local-first. The Chrome extension currently talks to the cloud API with its own extension auth tokens. Desktop stores transactions locally in SQLite and does not have retail order tables.

That creates a real gap for the requested desktop `Run sync` button:

- The desktop renderer cannot call Chrome extension APIs directly.
- Electron should not expose raw Node/browser automation to the renderer.
- The extension currently imports retail orders into cloud Postgres, not desktop SQLite.
- Desktop local transactions will not be enriched by cloud imports unless there is cloud/local transaction sync or a desktop retail import path.

Phase 1 must choose one desktop bridge strategy before implementation. The preferred product-safe approach is documented below.

## UX Requirements

### Detection Banner Placement

On both web and desktop transactions pages:

- Place a full-width component above the transaction table and below filters/summary if the current user has likely Amazon transactions that are not fully enriched.
- The component text is exactly `Retail transactions detected`.
- The far-right action is a button labeled `Run sync`.
- The banner should be visible only when detection returns at least one likely Amazon transaction needing retail sync or when a recent sync failed and there are still unmatched candidates.
- The banner should not replace filters, summary cards, or bulk action bars.
- If the user has selected rows, bulk action UI should keep priority. The retail banner can remain above bulk actions or collapse into a compact row, but should not hide selection actions.
- The banner should show an unobtrusive secondary detail such as `Amazon purchases may be missing item details` only if space allows. Do not add a long explanatory panel.

Web implementation target:

- Add a small component near `TransactionSummary`, `TransactionFilters`, and `TransactionTable` in `apps/web/src/app/(dashboard)/transactions/page.tsx` or a `retail-sync-banner/` subdirectory if it has supporting hooks/components.
- Use shadcn/ui and lucide icons through existing web UI conventions.
- Fetch detection state through React Query from a generated client endpoint.

Desktop implementation target:

- Add an equivalent banner in `apps/desktop/src/renderer/src/pages/transactions/index.tsx` or extract the banner into `packages/features` if both surfaces can consume the same runtime-agnostic contract immediately.
- Desktop must call through typed IPC and `FinApiClient`; do not import API or extension code directly into the renderer.

### Transaction-Level Sync Affordance

When a specific transaction has Amazon keywords and is not linked to retail items:

- Show a compact `Sync` or Amazon item-detail action in the row context menu or transaction edit/details UI.
- It should trigger the same Amazon sync flow as the banner.
- If the transaction already has linked retail items, show item detail entry points instead of repeatedly prompting for sync.
- If matching is ambiguous after sync, show a non-blocking state such as `Item details need review` rather than auto-linking low-confidence items.

This feature should avoid cluttering every row. Do not add a large button to every transaction row in the main table unless the table already has an action-cell pattern at implementation time.

### Extension Sync UX

When Moat Finance web triggers Amazon sync:

- The extension background receives an external sync request and starts `syncRetailer("amazon")`.
- The Amazon tab opens immediately in the background/inactive state where Chrome permits it.
- The extension side panel or extension page should open immediately if Chrome permits programmatic side panel opening from the user gesture.
- The extension UI should show the Amazon card first while syncing.
- The Amazon card should show a spinner/loader and in-progress copy, not only a disabled button.
- The sync run should be persisted through `chrome-storage.ts` before the tab is opened because MV3 service workers are ephemeral.
- On success, the Amazon tab closes automatically.
- On login_required, captcha_or_bot_check, unsupported page, empty_orders, parse_error, or API error, the Amazon tab may remain open for inspection just like the current orchestrator does.
- If the user manually switches to the Amazon tab while sync is running, the extension side panel/page state should already show that sync is active.

Current extension behavior mostly satisfies hidden tab open, upload, and close-on-success. Missing pieces are the external trigger, sidepanel/page auto-open behavior, and richer syncing state display.

### Failure UX

Web and desktop should surface extension/API outcomes without exposing raw Amazon data:

- Extension not installed: `Moat Finance Retail Sync extension is not connected` with a connect/install action where appropriate.
- Extension not authenticated: `Connect Moat Finance in the extension to run sync`.
- Amazon permission missing: `Amazon permission is required` and extension should request narrow Amazon host permission.
- Amazon login required: `Amazon sign-in is needed to finish sync`.
- Captcha/bot check: `Amazon needs review before syncing can continue`.
- API import failed: `Moat Finance could not save the Amazon import`.
- Matching completed but no links created: `Amazon orders synced, but no matching transactions were found`.

Use toast/status patterns already present in each surface. Do not log raw transaction descriptions, Amazon order titles, or product URLs in web/API logs.

## Detection Requirements

### Canonical Detector

Create one shared Amazon transaction detector that all surfaces can use. Recommended location:

- `packages/domain/src/retail/amazon-transaction-detection.ts`, or
- `packages/shared/src/retail/amazon-transaction-detection.ts` if the domain package ownership is not appropriate.

The detector should accept only non-sensitive strings already present in transaction records:

```ts
type RetailTransactionDetectionInput = {
  description?: string | null;
  originalDescription?: string | null;
  merchantName?: string | null;
};

type RetailTransactionDetectionResult = {
  retailer: "amazon";
  matched: boolean;
  matchedKeyword?: string;
  confidence: "high" | "medium" | "low";
};
```

Normalize by:

- Lowercasing.
- Removing punctuation variants that commonly appear in bank feeds.
- Collapsing whitespace.
- Checking description, original description, and merchant name.

Initial Amazon keyword patterns:

- `Amazon.com`
- `AMAZON MKTPLACE PMTS`
- `AMAZON MKTPL*`

The `AMAZON MKTPL*` pattern should be implemented as a normalized prefix match, not as a literal asterisk search. Keep the pattern list as a clearly exported constant and do not bury it in UI code.

False-positive guardrails:

- `whole foods` should not automatically count as Amazon retail item sync; Whole Foods receipts will not necessarily appear in Amazon orders.
- `amazon web services`, `aws`, `amazon pay`, `audible`, `kindle`, and `prime video` should not trigger Phase 1 retail sync unless product explicitly expands the keyword list later.
- Refunds/credits can be detected but should be handled carefully in matching because signs and amounts differ.

### Detection Endpoint

Add an API read action for web cloud mode:

- Suggested route action: `POST /api/v1/retail/detectTransactions`
- Handler wrapper: `withDemoOrAuth` if demo should show the banner with demo data, otherwise `withAuth` if retail sync requires real extension auth. The returned action state should distinguish demo mode from actionable auth mode.
- Request body can mirror transaction filters or use defaults for recent visible transactions.
- Response should include aggregate state and safe transaction ids only.

Suggested response:

```ts
type RetailTransactionDetectionResponse = {
  retailer: "amazon";
  detectedCount: number;
  unlinkedDetectedCount: number;
  linkedItemCount: number;
  hasActionableSync: boolean;
  extensionStatus: "unknown" | "connected" | "not_connected";
  candidates: Array<{
    transactionId: string;
    confidence: "high" | "medium" | "low";
    linkedItemCount: number;
    needsSync: boolean;
  }>;
};
```

Do not return raw descriptions or merchant names from this endpoint just to power the banner. The transaction list already has display data.

### Desktop Detection

Desktop can run the same detector locally against visible/paginated SQLite transactions, but it needs a stronger contract if the banner should reflect all matching transactions, not only loaded rows.

Required desktop additions:

- IPC channel such as `transactions:detectRetailCandidates`, or a broader `retail:detectTransactions` domain if desktop retail tables are added.
- SQLite repository method that scans local transactions by user and optional filters.
- Shared contracts in `packages/contracts/src/ipc/` for request/response.

If Phase 1 does not add local retail tables, desktop detection can only say `Amazon-like transactions exist locally`; it cannot accurately know whether cloud-imported Amazon items are already linked.

## Sync Trigger Architecture

### Web-To-Extension Bridge

The web app needs a real Chrome extension bridge. Current extension code has no Moat Finance web content script and no `externally_connectable` manifest configuration.

Preferred Phase 1 web bridge:

1. Add `externally_connectable.matches` for the Moat Finance web origins in `apps/extension/wxt.config.ts`.
2. Store the production extension ID in web configuration.
3. Add a small web helper that calls `chrome.runtime.sendMessage(extensionId, { type: "MOAT_WEB_SYNC_RETAILER", retailer: "amazon", requestId })` when `Run sync` is clicked.
4. Add `browser.runtime.onMessageExternal` in `entrypoints/background.ts`.
5. Validate sender origin against allowed Moat Finance web origins.
6. Convert the external message into the existing `syncRetailer("amazon")` flow.
7. Return structured sync result or accepted/run id response to web.

Alternative if externally connectable is unreliable in the current deployment environment:

- Add a Moat Finance web content script matched to the Moat Finance web app origin. The web app posts a window message, the content script validates origin and forwards to background through `messaging.ts`.
- This avoids needing the web page to know the extension ID but requires a content script on Moat Finance web pages and host permission for the Moat Finance web origin.

Do not use broad web matches. Only allow local dev and production Moat Finance web origins.

### Extension Auto-Open Behavior

The user specifically wants the extension view to auto-open when the Amazon tab opens, not only if the user manually navigates there.

Required research/implementation check:

- Verify Chrome MV3 `chrome.sidePanel.open({ windowId })` or `chrome.sidePanel.open({ tabId })` can be called from the background in response to a web page user gesture delivered through external messaging.
- If Chrome rejects it because the call no longer counts as a user gesture, use the fallback below.

Preferred behavior:

- On accepted `Run sync`, background opens the side panel in the current window immediately, then starts sync.
- Side panel renders `RetailSyncHome`, with Amazon card first and syncing state active.

Fallback behavior:

- Open a focused extension page/tab such as `chrome.runtime.getURL("popup.html?syncRunId=...")` or a dedicated `sync.html` page, then keep Amazon tab inactive.
- The extension page shows the same Amazon card and spinner.
- On sync success, close only extension-created Amazon tab. Do not automatically close a user-focused Moat Finance transactions tab.

This fallback should be explicit in implementation notes because Chrome side panel programmatic opening has user-gesture constraints.

### Desktop Bridge Strategy

The requested desktop behavior cannot be implemented by simply adding a React button. Choose one of these strategies before coding:

#### Recommended Phase 1: Desktop Detection With Browser Handoff

- Desktop shows the `Retail transactions detected` banner based on local detection.
- `Run sync` opens the Moat Finance web transactions page with a one-time query/deep link such as `/transactions?retailSync=amazon&source=desktop` using Electron `shell.openExternal` through typed IPC.
- Moat Finance web then triggers the installed Chrome extension through the web-to-extension bridge.
- The resulting import/linking updates cloud data, not local SQLite, unless desktop/cloud sync exists.
- Desktop copy should make this clear only when needed; the button can still say `Run sync` if the handoff is immediate.

This is lowest risk and respects Electron isolation, but it does not enrich purely local desktop transactions.

#### Full Desktop Parity: Native Or Local Extension Bridge

To enrich local desktop data without navigating through web, add a real bridge:

- Native messaging host between Chrome extension and Electron app, or
- Localhost bridge from desktop main process plus extension permission for localhost, with user consent and CSRF/origin protection.

This would require:

- Desktop retail SQLite tables mirroring `RetailConnection`, `RetailOrder`, and `RetailOrderItem`.
- Desktop IPC contracts for retail import, detection, matching, and linked item reads.
- Extension API client mode that can upload to local desktop instead of cloud API.
- Explicit security review for localhost/native messaging.

This is larger than the web Phase 1 and should be a separate phase unless product requires local desktop enrichment immediately.

## API Matching Service

### Service Ownership

Add service-layer code under `apps/api/src/server/services/` and keep handlers thin.

Recommended service responsibilities:

- Save retail imports.
- Run Amazon transaction matching after imports.
- Detect Amazon transaction candidates.
- Return linked retail items for transaction UI.
- Unlink/re-run matches when needed.

Suggested files:

- `apps/api/src/server/services/retail-import.service.ts`
- `apps/api/src/server/services/retail-transaction-matching.service.ts`
- `apps/api/src/server/handlers/retail.ts` slimmed down to validation and service calls.

### Matching Trigger Points

Run matching in these cases:

1. After `createImport` successfully upserts Amazon orders/items.
2. After `createImportFromHtml` successfully upserts Amazon orders/items.
3. When a user clicks transaction-level `Sync` and the extension reports sync success.
4. When a user manually calls a `retail/runMatching` endpoint if the initial matching failed or rules were improved.

Suggested endpoint/action:

- `POST /api/v1/retail/runMatching`
- Input: `{ retailer: "amazon", transactionIds?: string[], syncRunId?: string }`
- Wrapper: `withAuth`
- Output: `{ linkedItems: number, candidates: number, skipped: number, warnings: string[] }`

### Matching Algorithm

Phase 1 should be deterministic and explainable. Do not use LLM matching.

Candidate transaction filter:

- Same `userId`.
- Transaction is not hidden and not removed.
- Description/originalDescription/merchantName matches Amazon detector.
- Transaction type is `EXPENSE` for purchases or `INCOME`/negative/refund-specific handling only if refund support is included.
- Date window around Amazon order date, default `orderDate - 7 days` to `orderDate + 14 days` because authorization, shipping, and posting dates can differ.
- Amount window compares bank transaction amount to order total, item total, or shipment/invoice total when available.

Suggested confidence scoring:

- High: exact amount match to order total within one cent and date within 5 days.
- Medium: amount matches sum of currently unmatched item totals or invoice subtotal/tax/shipping pattern and date within 14 days.
- Medium: transaction amount is one of multiple shipment totals parsed from invoice details if available.
- Low: keyword/date match only, no amount match.

Auto-linking rules:

- Auto-link only high-confidence matches.
- Link all unmatched items in the matched order to the transaction when the order total matches the transaction amount and all items are part of that order.
- If the transaction amount matches only one item total, link only that item.
- If multiple transactions could match the same item, leave it unmatched with `matchStatus="ambiguous"`.
- If a retail item already has `transactionId`, do not reassign it automatically unless the new match is for the same transaction or the user explicitly re-runs with overwrite.
- Record `matchStatus`, `matchConfidence`, `matchedAt`, and `matchReason` for observability.

Refunds/returns:

- Detect Amazon credits/refunds but do not auto-link returned items in Phase 1 unless the parser exposes refund-specific order/item data. Mark as detected but `needsReview`.

### Linked Item Read Path

Transaction UI needs linked retail item data.

Options:

1. Extend transaction list response with a small `retail` summary per transaction.
2. Add a separate endpoint to fetch retail items for selected transaction(s).

Recommended Phase 1:

- Add a small summary to transaction list for banner/row state.
- Add detail endpoint for item lists on demand.

Suggested transaction summary shape:

```ts
type TransactionRetailSummary = {
  retailer: "amazon";
  detected: boolean;
  linkedItemCount: number;
  hasUnmatchedCandidate: boolean;
  lastMatchedAt?: string;
};
```

Suggested detail endpoint:

- `POST /api/v1/retail/listItemsForTransactions`
- Input: `{ transactionIds: string[] }`
- Output: safe item fields: title, quantity, totalPrice, orderDate, retailer, imageUrl if allowed.

Product/privacy note: Amazon item titles can be sensitive. Do not include item titles in analytics or logs. Keep MCP exposure separate.

## Contracts And OpenAPI

Update `packages/openapi/api-v1.yaml` for all new/changed cloud endpoints:

- `retail.detectTransactions`
- `retail.runMatching`
- `retail.listItemsForTransactions`
- Existing retail endpoints should also be added if web needs them through generated clients.

Then run OpenAPI generation so `packages/client-ts/src/index.ts` and any generated web hooks stay canonical.

Update `packages/contracts/src/api-client.ts` if the shared `FinApiClient` transaction type needs retail metadata for desktop/shared UI.

Update `packages/contracts/src/ipc/transactions.ts` or add `packages/contracts/src/ipc/retail.ts` for desktop detection and handoff actions.

## Web Implementation Requirements

- Use React Query for detection state and mutation state.
- Keep API calls through generated `@moat/client-ts` functions.
- Do not import extension internals into web.
- The extension bridge helper should be isolated, feature-detected, and resilient when `chrome.runtime` is unavailable.
- The banner should refetch detection after sync/matching completes.
- Add PostHog events only for meaningful aggregate actions, never raw transaction descriptions or item titles.

Potential event names:

- `retail_sync_prompt_viewed`
- `retail_sync_started`
- `retail_sync_completed`
- `retail_match_completed`

Event properties must include `{ userId }` or `{ demoUser: true }`, never both, and only counts/status enums.

## Desktop Implementation Requirements

- Renderer goes through `window.moatDesktop` and typed IPC only.
- If using browser handoff, add a narrow IPC method that calls Electron `shell.openExternal` from main process. Do not expose generic URL open primitives without validation.
- If adding local retail persistence, add SQLite migrations in `packages/db-sqlite/src/migrations.ts`, repository interfaces in `packages/data-access`, and IPC handlers in `apps/desktop/src/main/ipc/`.
- `ipcApiClient` should expose retail detection through `FinApiClient` only if the shared transactions UI consumes it.
- Clearly separate cloud-enrichment state from local-only desktop state.

## Extension Implementation Requirements

- Add an external message type separate from internal `SYNC_RETAILER`, such as `MOAT_WEB_SYNC_RETAILER`.
- Validate external sender origin before doing anything.
- Only allow `retailer: "amazon"` for this feature in Phase 1.
- Keep all persistent state in Chrome Storage through `chrome-storage.ts`.
- Continue using `permissions.ts` to check/request Amazon host permission.
- Continue routing content-script communication through `messaging.ts` and scrape ports.
- Do not call the Moat Finance API from content scripts.
- Make sync status visible before opening the Amazon tab.
- Pin/sort Amazon card first while `busyRetailer === "amazon"` or connection status is `syncing`.
- Add a true spinner/loader to `RetailerCard` or `SyncStatusBadge` for `syncing`.
- Preserve existing success auto-close and failure leave-open behavior.

## Security And Privacy

- User action is required. The trigger is a click on `Run sync`; no scheduled background sync in Phase 1.
- Request only narrow Amazon host permissions.
- Validate all web-to-extension external messages by origin and message schema.
- Do not trust transaction ids from web without server-side `userId` scoping.
- API writes use `withAuth` and server-side user scoping.
- Web visibility is not authorization. All linking writes must be gated in the API service.
- Never log raw transaction descriptions, original descriptions, merchant names, item titles, product URLs, order URLs, account names, or tokens.
- Analytics only sends counts, booleans, and enums.
- Amazon item titles should be treated as user financial context and sensitive purchase data.
- Extension logs should avoid raw HTML, item titles, and URLs beyond sanitized origins/path where needed for diagnostics.

## Gaps To Resolve Before Implementation

1. Web-to-extension trigger mechanism does not exist.
2. Extension side panel auto-open feasibility must be verified against Chrome user-gesture rules.
3. OpenAPI has no retail endpoint definitions even though API handlers exist.
4. Retail API handler currently owns Prisma/business logic directly instead of delegating to services.
5. `RetailOrderItem` has no `transactionId` FK or matching metadata.
6. Transaction list/detail contracts do not expose retail detection or linked item summaries.
7. Desktop has no retail SQLite tables, retail IPC domain, or Chrome extension bridge.
8. Desktop cannot truly run a hidden Chrome extension sync without a browser handoff, native messaging host, or localhost bridge.
9. Existing Amazon sync only imports currently visible orders/invoices; pagination/history depth remains out of scope unless separately specified.
10. Matching refund/return transactions safely requires more parser data than Phase 1 currently has.
11. There is no manual review UI for ambiguous item matches.

## Workstreams

### Phase 0 - Contract And Bridge Decisions

1. Lock the Phase 1 detector to the three approved Amazon patterns and false-positive exclusions.
2. Decide web bridge: `externally_connectable` versus Moat Finance web content script.
3. Decide extension open UI behavior: side panel if permitted, extension page fallback if not.
4. Decide desktop strategy: browser handoff for Phase 1 or full local/native bridge.
5. Decide whether to add `RetailTransactionMatchRun` in Phase 1.

Acceptance criteria:

- Chosen web bridge is documented in the implementation PR.
- Chosen desktop behavior is explicit and does not imply local enrichment if it only enriches cloud data.
- Keyword detector tests can be written before UI work begins.

### Phase 1 - Shared Detection And API Matching

1. Add shared Amazon detector and unit tests.
2. Add Prisma migration for `RetailOrderItem.transactionId` and matching metadata.
3. Move retail import persistence logic into a service.
4. Add API service for candidate detection and item matching.
5. Run matching after successful Amazon imports.
6. Add read endpoints for detection and linked items.
7. Update OpenAPI and regenerate clients.

Acceptance criteria:

- API can detect Amazon-like transactions without returning raw descriptions.
- API can link high-confidence Amazon items to transactions.
- Each item has zero or one `transactionId`.
- Re-running matching is idempotent for already-linked items.
- Service tests cover exact amount/date match, ambiguous match, already-linked item, no keyword, AWS false positive, and refund/credit guardrail.

### Phase 2 - Web Transactions Trigger

1. Add transactions-page retail banner.
2. Add transaction-level sync affordance in row context or edit/details UI.
3. Add web-to-extension bridge helper.
4. Add React Query mutation for `Run sync` and detection refetch after completion.
5. Surface extension-not-installed/auth/permission/login/error states.
6. Add analytics events with safe aggregate properties.

Acceptance criteria:

- Banner appears above the transaction table when unlinked Amazon candidates exist.
- Clicking `Run sync` does not navigate the Moat Finance tab away.
- Extension receives the request and starts Amazon sync.
- Successful sync refreshes detection state and linked item counts.
- Web tests cover banner visibility, extension missing state, and successful trigger callback.

### Phase 3 - Extension Sync UX Polish

1. Add external message listener with origin validation.
2. Persist sync run before opening Amazon tab.
3. Open side panel or extension sync page immediately when allowed.
4. Show Amazon card first while syncing.
5. Add visible spinner/loader for Amazon card.
6. Preserve auto-close on success and leave-open-on-failure behavior.

Acceptance criteria:

- Amazon tab opens immediately from Moat Finance web trigger.
- Extension UI shows syncing state before or at the same time as the Amazon tab opens.
- Amazon tab closes automatically on success.
- Failure states keep tab open only when user review is useful.
- Extension build succeeds.

### Phase 4 - Desktop Surface

Recommended Phase 1 desktop scope:

1. Add local Amazon detection against SQLite transactions.
2. Add desktop banner above the transactions table.
3. Add typed IPC for validated browser handoff to Moat Finance web retail sync deep link.
4. Make copy/status clear when desktop is handing off to cloud web sync.

Full parity follow-up:

1. Add local retail SQLite tables.
2. Add local retail import/matching repositories.
3. Add native messaging or localhost bridge between extension and desktop.
4. Let extension choose cloud API or local desktop target based on trigger.

Acceptance criteria for recommended scope:

- Desktop banner appears for local Amazon-like transactions.
- `Run sync` uses a validated handoff path, not direct renderer browser automation.
- Desktop does not pretend local transactions were enriched if only cloud sync ran.

## Testing Plan

API:

- Unit tests for shared detector keyword/false-positive behavior.
- Service tests for retail import save and matching.
- Service tests for idempotent reruns and item ownership invariant.
- Handler tests for auth, validation, and user scoping.
- Prisma migration validation against Postgres schema.

Web:

- Component tests for banner visible/hidden states.
- Hook tests for extension bridge unavailable, accepted, rejected, and timeout states.
- React Query invalidation test after sync completion.
- Manual Chrome test with extension installed and not installed.

Extension:

- Unit tests for external message schema/origin validation where testable.
- Manual MV3 test for Moat Finance web trigger opening Amazon tab inactive.
- Manual side panel/open fallback test.
- Build: `pnpm --filter moat-extension run build`.

Desktop:

- IPC contract tests for detection/handoff.
- SQLite repository tests for local detection if scanning beyond visible rows.
- Renderer test for banner visible/hidden state.
- Manual Electron test that `Run sync` uses the chosen handoff and never exposes raw Node APIs.

End-to-end manual pass:

1. Seed/import a bank transaction with `AMZN Mktp` description.
2. Open web transactions page.
3. Confirm banner appears above table.
4. Click `Run sync`.
5. Confirm extension UI opens or fallback page appears with Amazon spinner.
6. Confirm Amazon tab opens inactive.
7. Confirm successful import closes Amazon tab.
8. Confirm API creates/updates retail orders/items.
9. Confirm matching links high-confidence items to the transaction.
10. Confirm banner disappears or updates to linked state.
11. Repeat with extension missing, Amazon permission missing, and Amazon login required.

## Open Questions

- Should the banner scan all user transactions or only the currently filtered/visible transaction set?
- Should linked Amazon item titles be visible directly in the transaction table, only in the edit/details dialog, or behind an expandable row?
- Should a transaction with linked retail items allow manual unlink in Phase 1?
- Should matching use order total, item total, invoice/shipment total, or all of them when data is available?
- Should desktop Phase 1 hand off to web, or should this feature wait for a full local extension bridge?
- What should happen for demo users where real extension sync is not possible?
- Is the current Chrome Web Store disclosure broad enough for transaction-page initiated sync, or does listing/privacy copy need an update?

## Suggested Commit Message

```text
feat (specs): adds retail sync trigger spec
```
