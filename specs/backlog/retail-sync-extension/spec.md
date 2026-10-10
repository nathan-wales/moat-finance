# Spec: Retail Sync Extension

## Goal

Let users import retail order and item data from Amazon, Walmart, and Target into Moat Finance via a user-initiated Chrome extension sync, giving retail purchases the same visibility as bank transactions.

## Context / Why now

Bank transactions for retail purchases often show only a merchant name and total (e.g., "AMAZON $127.43"). The extension enriches these with actual order contents — item names, quantities, and prices — giving users a more meaningful view of where their money went.

## Scope

**In scope (v1):**
- Amazon, Walmart, Target order import
- User-initiated sync (explicit click, not silent background)
- Per-retailer permission request (narrow host permissions)
- Popup and side panel UI for managing connections and reviewing synced data
- Normalized order data sent to Moat Finance API
- Extension "home" page: review scraped data by retailer

**Out of scope for v1:**
- Full categorization/editing in extension (belongs in Moat Finance web app)
- Additional retailers beyond Amazon, Walmart, Target
- Automatic / scheduled background sync
- Order history search

## Behavior spec

### User flow

1. User installs extension and signs in with their Moat Finance account
2. User goes to extension popup or side panel
3. User connects a retailer (Amazon, Walmart, or Target) — extension requests narrow host permission for that retailer
4. User clicks "Sync [Retailer]"
5. Extension opens the retailer's orders page in an inactive tab
6. Content script parses the order/item data from the page DOM
7. Parsed data flows back through the background service worker → normalized → sent to Moat Finance API
8. User sees sync results in the extension UI

### Key user experience notes

- Frame this as "browser-assisted purchase import" — not silent background scraping
- Sync is always user-triggered
- Chrome Web Store policy: data use must match disclosed practices and be minimal

### Architecture

```
popup/sidepanel (React UI)
  → messaging.ts
    → background.ts (service worker, orchestration)
      → permissions check
        → opens retailer tab (inactive where possible)
          → content script (amazon/walmart/target.content.ts)
            → packages/retail-sync (parser logic)
              → messaging.ts → background.ts
                → moat-api.ts → apps/api
```

### Extension contexts

- **Service worker** (`background.ts`): orchestration, API calls, storage management. No DOM access. Ephemeral in MV3 — no in-memory state between events.
- **Content scripts**: DOM-only. Parse order data. Send to background via messaging. Never call API directly.
- **Popup / side panel**: React UI. Show status, retailer cards, order previews.

### Storage

All persistent state (auth token, sync results, connection status) lives in Chrome Storage via `chrome-storage.ts`. Never `localStorage`.

### Retailer parsers

Parser logic lives in `packages/retail-sync/` (shared, independently testable):

```
packages/retail-sync/src/retailers/
├── amazon/
│   ├── parser.ts      ← Parses order page HTML
│   ├── selectors.ts   ← DOM selectors (update when retailer layout changes)
│   └── fixtures/      ← Saved HTML snapshots for testing
├── walmart/
└── target/
```

### API

Normalized order data sent to `apps/api` endpoint (existing or new):
```
POST /integrations/retail/orders/bulk
```

### Normalized data shape

```ts
type NormalizedOrder = {
  retailer: "amazon" | "walmart" | "target";
  orderId: string;
  orderDate: string;
  totalAmount: number;
  currency: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    imageUrl?: string;
  }>;
}
```

## Acceptance criteria

- [ ] User can connect Amazon, Walmart, and Target independently
- [ ] Sync is only triggered by explicit user action
- [ ] Content script parses order data from retailer page DOM
- [ ] Parsed data is sent to Moat Finance API and stored
- [ ] Synced orders visible in extension home page view
- [ ] Extension UI shows sync status (syncing / success / error / partial)
- [ ] `chrome-storage.ts` used for all persistent state (not localStorage)
- [ ] Messages routed through `messaging.ts` (no ad-hoc sendMessage calls)
- [ ] `pnpm --filter moat-extension run build` succeeds with no TypeScript errors

## Tech notes

- WXT manages MV3 manifest generation — don't edit `manifest.json` directly
- Service workers are ephemeral: persist anything needed across events to Chrome Storage immediately
- Parser tests live in `packages/retail-sync/` alongside fixture HTML — run them before pushing
- Retailer page structures change — parser selectors should be isolated in `selectors.ts` for easy updates
- Chrome Web Store review: ensure content in popup/store listing matches actual permissions requested

## Open questions

- Should order data be matched to existing Plaid bank transactions (to enrich them), or stored as standalone entries?
- What's the UX when a retailer page layout has changed and parsing fails?
- How do we handle pagination — should the extension scrape multiple pages of order history on first sync?
