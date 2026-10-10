# Desktop ↔ Extension Retail Sync (Local Bridge)

## Status

Draft. Created August 18, 2026 after reviewing the desktop retail handoff, Chrome extension sync orchestrator, local agent gateway, SQLite schema, and `specs/complete/retail-transaction-detection-sync/spec.md` Phase 6b.

## Goal

When a user clicks **Run sync** in the desktop app, Amazon order HTML scraped by the Chrome extension is imported into local SQLite over a localhost bridge—never into cloud Postgres—then matched to local bank transactions.

Success means:

- Desktop-initiated Amazon sync enriches local SQLite `RetailOrder` / `RetailOrderItem` rows and links them to local `Transaction` rows.
- Scraped order/item payloads never POST to `/api/v1/retail/*` during a desktop-target sync.
- Web-initiated extension sync continues to use the existing cloud API path unchanged.
- Extension desktop mode authenticates with a short-lived desktop session token only (no Moat cloud auth required for that mode).

## Product Context

Desktop is offline-first. Today's `Run sync` opens the web app (`retail-sync:openAmazonWebSync`), which triggers the extension and writes retail data to Neon. That does not enrich local bank transactions. Users who keep money data on-device need the scrape path to terminate in SQLite.

A cloud “ephemeral relay” was considered and rejected for desktop-initiated sync: order titles, ASINs, and amounts would still transit Moat servers, and delete-after-pull is fragile.

## Current Repo Context

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Amazon HTML capture + orchestrator | `apps/extension/lib/sync-orchestrator.ts` | Opens Amazon tab, streams HTML, uploads |
| Cloud HTML import | `apps/extension/lib/moat-api.ts` → `createImportFromHtml` | Cloud target only today |
| Shared parsers | `packages/retail-sync` | Server/desktop parse HTML; extension stays capture-only |
| Amazon matching | `apps/api/src/server/services/retail-transaction-matching.service.ts` | Port deterministic rules to SQLite |
| Amazon keyword detection | `packages/domain/src/retail/amazon-transaction-detection.ts` | Shared detector |
| Localhost HTTP + Bearer | `apps/desktop/src/main/agent-gateway/index.ts` | Bind `127.0.0.1`, vault gate |
| Desktop retail IPC (handoff) | `packages/contracts/src/ipc/retail-sync.ts` | Expand beyond `openAmazonWebSync` |
| Desktop adapter stub | `apps/desktop/src/renderer/src/pages/transactions/index.tsx` | `detect()` returns null |
| Postgres retail models | `apps/api/prisma/schema.prisma` | Shape to mirror in SQLite with `Float` |

### Known gaps

- No SQLite retail tables or repositories.
- Extension always uploads to cloud.
- Desktop has no localhost retail ingest endpoint.
- Desktop detection is stubbed.

## Target Experience

1. Desktop transactions banner shows when local Amazon-like transactions exist and are unlinked.
2. User clicks **Run sync**.
3. Desktop starts the retail ingest listener, mints a session token, opens the extension trigger URL with `target=desktop`, port, and token.
4. Extension opens Amazon orders (inactive tab), captures HTML, POSTs to `http://127.0.0.1:<port>/retail/import-html`.
5. Desktop parses, upserts, matches, returns ACK.
6. Extension closes the Amazon tab on success; leaves it open on login/captcha/parse failure.
7. Desktop banner refreshes; linked items appear on local transactions.

Failure copy (examples):

- Extension missing / unreachable: `Moat Finance Retail Sync extension is not connected`
- Listener failed: `Could not start local retail sync`
- Amazon login/captcha: existing extension behavior (tab left open)

## Architecture / Data Model

### Localhost ingest (main process)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/retail/health` | Bearer session | Desktop reachable + vault unlocked |
| POST | `/retail/import-html` | Bearer session | `{ retailer, html, sourceUrl, syncRunId }` |

- Bind **`127.0.0.1` only**
- Fixed port (e.g. `3031`) distinct from MCP `3030`
- Session token: short-lived (~15 min or single sync), hashed at rest, vault must be unlocked
- Parse with `@moat/retail-sync`; never log HTML, titles, ASINs, or bank descriptions

### SQLite models

Mirror cloud `RetailConnection`, `RetailOrder`, `RetailOrderItem` with `Float` money fields and `Transaction.retailOrderItems` relation. Migrations: Prisma migration under `packages/db-sqlite` **and** embedded `CREATE TABLE IF NOT EXISTS` in `migrations.ts`.

### Extension sync modes

| Mode | Trigger | Upload | Cloud auth |
|------|---------|--------|------------|
| `cloud` | Extension UI / web `MOAT_WEB_SYNC_RETAILER` | Moat API | Required |
| `desktop` | Desktop trigger URL / message | Localhost ingest | Not required |

Desktop mode must **not** fall back to cloud upload of the same payload.

### IPC channels (expand `RETAIL_SYNC_CHANNELS`)

- `retail-sync:detectAmazon` — local detection summary
- `retail-sync:startDesktopAmazonSync` — start listener + open extension trigger; return status
- `retail-sync:getSyncStatus` — poll session/import status
- Keep `openAmazonWebSync` for optional cloud handoff, but desktop adapter default uses local sync

### Identity

Desktop uses `local-user` (or active profile userId). Retail rows are scoped to that userId. No cloud userId required for desktop-target imports.

## Implementation Plan

### Phase 1 — Spec

This document.

### Phase 2 — SQLite + matching

Retail schema, repos, AppContext wiring, local Amazon matcher + detection.

### Phase 3 — Desktop ingest server

Session lifecycle + `/retail/health` + `/retail/import-html`.

### Phase 4 — Extension desktop target

Orchestrator `target: "desktop"`, host permission for `127.0.0.1`, trigger URL handling.

### Phase 5 — Desktop Run sync UX

Wire detection + adapter to local IPC; replace cloud handoff as default.

### Phase 6 — Tests

Matcher/ingest auth unit tests; manual Amazon E2E checklist in this spec.

## Acceptance Criteria

- [ ] Desktop Amazon sync writes retail orders/items only to SQLite
- [ ] Extension `target=desktop` never calls cloud retail import endpoints for that run
- [ ] Web/cloud sync path unchanged
- [ ] Ingest binds `127.0.0.1`; invalid/missing token → 401; vault locked → reject
- [ ] Local matching links Amazon order totals to expense txs within the existing date window rules
- [ ] Walmart/Target remain disabled (`enabledInV1: false`) but share the same bridge later
- [ ] No PII (titles, ASINs, HTML, descriptions) in logs

## Non-Goals

- Ephemeral cloud staging / delete-after-pull
- Sync while desktop is quit
- Native messaging host
- Walmart/Target parsers or detection
- Full desktop↔cloud transaction sync
- Changing web→cloud Amazon sync

## Threat notes (localhost ingest)

- Binding to loopback limits remote network attackers; still require Bearer session tokens.
- **Every request must include `Origin: chrome-extension://<MOAT_RETAIL_EXTENSION_ID>`.** Missing or mismatched Origin is rejected (403). Web pages cannot spoof that Origin.
- Session tokens are never placed in the `shell.openExternal` URL. Desktop opens the extension with `sessionId` only; the extension claims the token once via `GET /retail/claim` (Origin-gated).
- Pending claim tokens live in memory only (hashed token persisted on disk). Claim is single-use.
- Import calls are rate-limited per session (100 HTML uploads); the extension budgets invoice enrichment under that cap so it does not self-throttle. Each orders/invoice page is still one POST (no multi-page HTML batching).
- `sourceUrl` must be an https retailer host.
- CORS `Access-Control-Allow-Origin` is locked to the configured extension origin.
- Do not expose a generic URL-open IPC; allowlist chrome-extension trigger URLs and Amazon host permission flows already owned by the extension.
- Extension desktop mode must not silently dual-write to cloud.
- Never log order titles, ASINs, raw HTML, or bank descriptions.

## Manual Amazon E2E checklist

1. Unlock desktop vault; ensure Amazon-like local transactions exist.
2. Install/load unpacked extension; grant Amazon host permission when prompted.
3. Click **Run sync** on desktop transactions banner.
4. Confirm Amazon tab opens, side panel shows syncing, tab closes on success.
5. Confirm SQLite has `RetailOrder` / items linked; cloud Postgres unchanged for that user.
6. Repeat with vault locked / extension missing / Amazon logged out and confirm failure UX.

## Open Questions

- None blocking v1: fixed port `3031` and 15-minute session TTL are the defaults.

## Related Specs

- `specs/complete/retail-transaction-detection-sync/spec.md` (Phase 6b full parity)
- `specs/backlog/retail-sync-extension/spec.md`

## Suggested Commit Message

```text
feat (desktop): local extension retail bridge
```
