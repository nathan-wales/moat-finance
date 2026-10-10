# Plaid historical import completion

## Status

Draft. Created 2026-09-21 after a wiped-account onboarding run showed "Success!" / Done once the first ~30 days landed, while the remaining year only appeared after a later "Sync latest data".

## Goal

When a user first connects a bank, the connect overlay must stay on "syncing" until Moat has actually imported the history Plaid was asked for (`days_requested: 365`), not just the first 30-day batch.

Success means:

- The overlay's Done / Success state is shown only after `GET /api/v1/plaid/getImportStatus` reports `historicalImportComplete: true`.
- That flag is true only when Plaid's `/transactions/sync` probe is `HISTORICAL_UPDATE_COMPLETE` **and** there are no unread pages (`has_more` false, empty added/modified/removed).
- Polling itself drains pending `/transactions/sync` pages, including while Plaid is still `INITIAL_UPDATE_COMPLETE`.
- A timeout shows "Still importing" (background), never Success.
- Reconnect overlap skipping (`shouldSkipHistoricalAddedTransaction`) is unchanged.

## Product Context

Plaid Link requests 365 days, but `/transactions/sync` delivers ~30 recent days first and the rest later. Users judge onboarding by whether the year of activity is already in Moat. Declaring the import done after the first batch makes the app look empty until a manual refresh.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Overlay + timeout | `apps/web/src/components/financial-connections/connection-import-overlay.tsx` | Progress bar; `IMPORT_SYNCING_TIMEOUT_MS` |
| Direct connect | `apps/web/src/components/plaid/direct-plaid-connect-launcher.tsx` | Onboarding "+ Connect account" |
| Search connect | `apps/web/src/components/financial-connections/provider-launch-bridge.tsx` | Must honor timeout the same way |
| Poller | `apps/web/src/lib/plaid-import-status.ts` | `waitForPlaidHistoricalImport` |
| Status API | `apps/api/src/server/plaid/service.ts` `getHistoricalImportStatusForItem` | Probe + drain |
| Probe summary | `apps/api/src/server/plaid/historical-import-status.ts` | Completion + coverage math |
| Sync engine | `apps/api/src/server/plaid/syncTransactions.ts` | Cursor pagination; same engine as "Sync latest data" |
| Job enqueue | `apps/api/src/server/services/provider-sync-job.service.ts` | Must not swallow HISTORICAL_UPDATE while INITIAL_UPDATE is RUNNING |
| Enqueue decision | `apps/api/src/server/services/provider-sync-job-enqueue.ts` | Pure helper |
| Link history | `packages/financial-data-providers/.../link-products.ts` | `PLAID_TRANSACTIONS_DAYS_REQUESTED = 365` |
| Overlap skip | `packages/domain/src/transactions/transaction-sync-watermark.ts` | Reconnect de-dupe, leave alone |

### Bugs this spec replaces

1. The launcher discarded `waitForPlaidHistoricalImport`'s `"timeout"` result and showed Success anyway.
2. Account-polling `onTimeout` (~35s) skipped the historical wait and showed Success.
3. `shouldDrain` was gated on `HISTORICAL_UPDATE_COMPLETE`, so polls never pulled the queued year.
4. `enqueueProviderSyncJob` coalesced a new webhook into a live RUNNING job, so `HISTORICAL_UPDATE` never ran a sync.
5. Daily `runScheduledTransactionFallback` skipped connections with a recent webhook even when transaction sync was stale.

"Sync latest data" already called `syncTransactionsForItem` from the saved cursor with no status gate, which is why a manual refresh appeared to "fix" it.

## Target Experience

1. User finishes Plaid Link. Overlay: "Syncing account..." / "Importing up to a year of transactions."
2. Progress bar uses elapsed time as a floor and `coveredDays / daysRequested` from the status API when present. It never exceeds 99% until real completion.
3. When the server reports `historicalImportComplete: true`, overlay jumps to "Success!" then Done.
4. If the wait hits `IMPORT_SYNCING_TIMEOUT_MS` (300s), overlay becomes "Still importing" with Continue. History keeps draining in the background (webhooks + later polls / app-open / daily fallback). Never Success on timeout.
5. Reconnecting an already-imported account still skips the leftover overlap window. Brand-new connect still imports the full requested window.

## Architecture / Data Model

`GET /api/v1/plaid/getImportStatus?itemId=`

```ts
{
  historicalImportComplete: boolean;
  updateStatus: "NOT_READY" | "INITIAL_UPDATE_COMPLETE" | "HISTORICAL_UPDATE_COMPLETE" | "UNKNOWN" | "MUTATION_DURING_PAGINATION";
  pendingUpdates: boolean;
  transactionCount: number;
  oldestTransactionDate: string | null;
  coveredDays: number;
  daysRequested: number;
}
```

- `shouldDrain` is true whenever the probe has unread pages, regardless of `updateStatus`.
- After a drain, the handler re-probes. Complete requires `HISTORICAL_UPDATE_COMPLETE` and an empty probe.
- Coverage (`coveredDays`) is advisory for the progress bar. Short-lived accounts and institutions that cap history can complete with fewer than 365 days.
- The drain takes the ordinary blocking `withPlaidItemLock`, like every other sync entry point. Clients poll sequentially (each request is awaited before the next is scheduled), so a poll never races itself; one that overlaps a webhook sync waits for it.
- A drain that throws is logged and reported as `pendingUpdates: true` rather than failing the request, so a broken item cannot turn every 3s poll into a 500.

Webhook enqueue:

- Pending job for the same connection+syncType → reuse (and bump `scheduledAt` if future).
- Live RUNNING job → create one follow-up PENDING job. Later events reuse that pending job.
- Duplicate `webhookEventId` still no-ops.

## Acceptance Criteria

- [ ] Overlay Success is shown only after `historicalImportComplete === true`.
- [ ] Overlay timeout shows background / Still importing, not Success.
- [ ] `getImportStatus` drains pending pages while status is `INITIAL_UPDATE_COMPLETE`.
- [ ] `HISTORICAL_UPDATE` arriving during a RUNNING `INITIAL_UPDATE` job creates a follow-up job.
- [ ] Existing golden-ledger suites (node + Playwright) pass unchanged — they already assert the behavior this fix restores.
- [ ] Coverage never gates completion.
- [ ] Reconnect overlap skip is unchanged.
- [ ] Scheduled transaction fallback no longer requires a stale `lastWebhookAt`.

## Non-Goals

- Changing `days_requested` at Link time.
- Calling `/transactions/get` or `/transactions/refresh`.
- Making coverage of 365 days a hard completion requirement.
- Desktop local Plaid (no `getImportStatus`; desktop keeps its own catch-up loop).

## Open Questions

- None. Coverage is advisory; Plaid's historical-complete flag plus an empty cursor is the gate.

## Related Specs

- [Plaid Integration E2E Tests (Golden Ledger)](../plaid-integration-e2e-tests/spec.md)
- [Plaid reconnect transaction dedupe](../plaid-reconnect-transaction-dedupe/spec.md)

## Suggested Commit Message

```text
fix (web): wait for full plaid history
```
