# Extension First-Run Retail Sync Tour

## Status

Approved. Created 2026-09-10 after reviewing the Retail Sync side panel (`apps/extension/components/retail-sync-home.tsx`), extension auth (`apps/api/src/server/handlers/extension-auth.ts`), and `UserSettings` persistence.

## Goal

The first time a Moat account signs into the Retail Sync Chrome extension, show a short cinematic tour of what item-level import does — then never show it again on that account.

Success means:

- First sign-in shows the tour; Continue, Skip, or Let’s go lands on the retailer home.
- Reopen, sign-out/in, reinstall, and a second browser skip the tour after completion.
- Existing retail users (already connected or imported) are not shown the tour on ship.

## Product Context

Bank charges look like “Amazon $110.53.” The extension exists to turn that into real purchases. The tour is that one-line job, then how Sync works — not a Chrome Web Store listing recap.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Home after auth | `apps/extension/components/retail-sync-home.tsx` | Loading → SignInGate → header + retailer cards |
| Profile fetch | `GET /api/v1/extensionAuth/me` via `syncMoatAccountProfile` | Already awaited after sign-in |
| Chrome state | `apps/extension/lib/chrome-storage.ts` | Device-local; wrong source of truth for “once ever” |
| User flags | `UserSettings` in `apps/api/prisma/schema.prisma` | Web onboarding uses typed columns; this tour uses `extensionMetadata` JSON |
| Primary surface | Side panel (`openPanelOnActionClick`) | Popup CSS is shared |

## Target Experience

Quiet full-bleed canvas. No wizard chrome.

1. Welcome: `Welcome to the Moat Finance Chrome extension` with **Learn more →**. Quiet **Skip** still completes the tour.
2. After the click, staggered fades with longer pauses:
   - muted: `Your bank says “Amazon $110.53.”`
   - a compact checking-statement row for that Amazon debit
   - a 2s pause, then `But with this extension...`
   - a 2s pause, then `You can see more in Moat.`
   - a 1s pause, then the in-app retail order cards cascade in together (lamp, batteries, tumbler — sample data totaling $110.53) using the imported-purchase stagger
   - a 2s pause, then **Continue →** and a quiet **Skip**
3. How it works: `Here's how it works...` alone for 2.5s (no mark), then slower fades with longer pauses:
   - `You click **Connect** and **Sync**`
   - `We open background tabs...`
   - a 2s pause, then the Chrome tab-strip opens Your Orders and then Order Details
   - `We scrape the purchase data`
   - `We hydrate with the real deal`
   - `Ready to get started?` with **Let’s go →** → retailer home

`prefers-reduced-motion`: after Learn more, all remaining beats on the current page are visible immediately.

Skip the tour when `desktopSync=1` is in the URL, or when `/me` fails (unverified) — do not trap the user.

## Architecture / Data Model

`UserSettings.extensionMetadata Json?`:

```ts
{ retailSyncTourCompletedAt?: string; retailSyncTourVersion?: number }
```

Current version is `1`. Completed when `completedAt` is set and `version` equals the current version.

- **Read:** `GET /api/v1/extensionAuth/me` includes `retailSyncTour: { completed: boolean; version: number }`.
- **Write:** `POST /api/v1/extensionAuth/completeRetailSyncTour` — `withAuth`, merge-upsert, idempotent.
- Service: `apps/api/src/server/services/extension-metadata.service.ts` owns Prisma.
- Chrome storage caches `retailSyncTourCompleted` + version to avoid a flash on later opens. DB is canonical.

Migration backfills completion for users with any `RetailConnection` or `RetailOrder`.

## Acceptance Criteria

- [ ] First sign-in with empty `extensionMetadata` shows the tour; Skip or Let’s go shows home.
- [ ] Completing writes DB metadata and local cache; reopen skips the tour.
- [ ] Sign-out/in, reinstall, and a second browser skip after DB complete.
- [ ] Existing retail users (backfill) skip the tour.
- [ ] Desktop ingest URL skips the tour.
- [ ] `/me` failure skips the tour and shows today’s unverified home.
- [ ] Reduced motion shows all copy immediately.
- [ ] Account menu has **Redo onboarding tour**, which replays locally without clearing the DB flag.

## Non-Goals

- PostHog in the extension.
- Privacy / “not affiliated with Amazon” / “more retailers on the way” copy in the tour.

## Open Questions

None.

## Related Specs

- [Retail Sync Extension](../../backlog/retail-sync-extension/spec.md)

## Suggested Commit Message

```text
feat (extension): add first-run retail sync tour
```
