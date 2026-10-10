# apps/extension — Agent Overlay

> **Baseline**: Read [CLAUDE.md](../../CLAUDE.md) first. This file adds extension-specific context on top of it.

---

## Purpose

`apps/extension` is a Manifest V3 Chrome extension that lets users import retail order/purchase data from Amazon, Walmart, and Target into Moat Finance. Users authenticate with their Moat account, connect retailers one at a time, and trigger user-initiated syncs.

---

## Commands

| Task | Command (from repo root) |
|------|--------------------------|
| Dev (watch + hot reload) | `pnpm --filter moat-finance-extension run dev` |
| Build | `pnpm --filter moat-finance-extension run build` |
| Zip for Chrome Web Store (production hosts) | `pnpm --filter moat-finance-extension run zip` |
| Zip with localhost hosts | `pnpm --filter moat-finance-extension run zip:development` |

---

## Code structure

```
apps/extension/
├── wxt.config.ts              ← WXT build configuration
├── entrypoints/
│   ├── background.ts          ← Service worker: orchestration hub
│   ├── popup/                 ← Browser toolbar popup (React)
│   ├── sidepanel/             ← Extension side panel (React)
│   ├── amazon.content.ts      ← Content script: Amazon DOM parser
│   ├── walmart.content.ts     ← Content script: Walmart DOM parser
│   └── target.content.ts      ← Content script: Target DOM parser
├── components/                ← Shared React UI components
└── lib/
    ├── auth.ts                ← Moat auth token management
    ├── chrome-storage.ts      ← Chrome storage API wrapper (use this, not localStorage)
    ├── messaging.ts           ← Inter-context messaging (content ↔ background)
    ├── moat-api.ts            ← Moat API client
    ├── sync-orchestrator.ts   ← Sync flow coordination
    ├── permissions.ts         ← Host permission checks per retailer
    ├── retailers.ts           ← Retailer registry
    └── types.ts               ← Shared extension types
```

Shared parser/domain logic lives in `packages/retail-sync/` so it can be tested independently.

---

## Architecture

### Data flow

```
User clicks Sync
  → popup/sidepanel → messaging.ts → background.ts (service worker)
    → permissions check (permissions.ts)
      → opens retailer tab (or uses active tab)
        → content script parses DOM
          → messaging.ts → background.ts
            → sync-orchestrator.ts → moat-api.ts → apps/api
```

### Context isolation in MV3

Chrome MV3 has three isolated contexts:
1. **Service worker** (`background.ts`) — no DOM, orchestrates everything
2. **Content scripts** — run in page context, can access DOM
3. **Popup / sidepanel** — React UI

**Orchestration belongs in `background.ts`.** Content scripts only parse DOM and return data. UI only renders state.

---

## Key conventions

- **Always route messages through `messaging.ts`**
- **Check permissions via `permissions.ts`** before accessing retailer pages
- **Content scripts must be defensive** — retailer page structures change
- **Frame sync as user-initiated** — no silent background scraping

---

## Anti-patterns

- **Don't use `localStorage`** — use `chrome-storage.ts` instead
- **Don't call the Moat API directly from content scripts**
- **Don't keep state in service worker memory** — persist to Chrome Storage
- **Don't hardcode retailer selectors outside `packages/retail-sync/`**
- **Don't request broad host permissions upfront**

---

## Change-type routing table

| When you are doing X… | Read |
|-----------------------|------|
| Adding a new retailer content script | This file (architecture + data flow sections) |
| Adding messaging between contexts | This file (`messaging.ts` convention) |
| Adding a new API call | `lib/moat-api.ts` |

---

