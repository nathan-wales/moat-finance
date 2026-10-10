# Plaid reconnect transaction dedupe

## Status

Draft. Created 2026-08-25 after reviewing Plaid disconnect, adopt-on-relink, and `/transactions/sync`.

## Goal

When a user disconnects a bank and later reconnects the same institution, Moat must not re-import the historical transactions already stored for that user.

Success means:

- Disconnecting an institution stops Plaid billing (`itemRemove`) but keeps local Plaid identity rows and transaction FKs.
- Each linked account stores the latest posted date already accepted (`transactionsSyncedThrough`).
- Re-link adopts the paused account row and skips first-sync `added` transactions dated on or before that watermark.
- Deleting the Moat user account still wipes identity, watermarks, and transactions so a new signup imports up to 12 months.

## Product Context

Plaid issues new `item_id`, `account_id`, and `transaction_id` values after `itemRemove` + a new Link session. The existing unique key `(userId, externalTransactionId)` therefore cannot prevent duplicates. Users hit this after disconnecting from Accounts (or removing a synced account from Financial Profile and linking the bank again).

We must not scan every stored transaction on import. Trust a per-account watermark instead.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Hard-delete disconnect | `apps/api/src/server/plaid/disconnect-item.ts` | `itemRemove`, nulls tx FKs, deletes `PlaidItem` |
| Keep-local revoke | `apps/api/src/server/plaid/revoke-access-keep-local-data.ts` | Trial pause already keeps rows |
| Account adoption | `apps/api/src/server/plaid/adopt-revoked-accounts.ts` | Mask/type then name/type; unused after hard delete |
| Sync engine | `apps/api/src/server/plaid/syncTransactions.ts` | `/transactions/sync` only; cursor null → 365-day dump |
| Visibility | `apps/api/src/server/plaid/access-state.ts` | Hides paused item once a live sibling exists |
| Desktop disconnect | `apps/desktop/src/main/plaid/service.ts` | Hard-deletes SQLite `PlaidItem` |

`/transactions/sync` cannot request “since date X”. A new Item always returns the Link history window. Equivalent outcome: do not persist `added` rows on or before the watermark; still advance the Plaid cursor.

## Target Experience

1. User disconnects Chase. Institution disappears from connected lists (accounts are inactive). History stays.
2. User re-links Chase. Adoption restores the same internal `PlaidAccount.id`. First sync imports only activity after `transactionsSyncedThrough`.
3. User deletes their Moat account. Cascade removes items, accounts, watermarks, and transactions. A new signup imports the full window.

## Architecture / Data Model

```prisma
model PlaidAccount {
  transactionsSyncedThrough DateTime?
  // ...existing fields
}

model FinancialAccount {
  transactionsSyncedThrough DateTime?
  // ...existing fields
}
```

Watermark meaning: latest **posted date** accepted for that account. Updated after each successful transaction sync:

`transactionsSyncedThrough = max(existing, max posted date persisted this run)`

First historical sync (`startingCursor === null`):

- Seed null watermarks from a matching `FinancialAccount.accountFingerprint`, else one `MAX(date) GROUP BY accountFingerprint` query (legacy hard-deletes).
- Skip persisting `added` txs with `date <= watermark` for that account.
- Persist `modified` when the `transaction_id` already exists.
- Do not count skipped rows as `addedCount`.

Brand-new accounts (null watermark) import the full window.

User-disconnected items stay in the DB for adoption but are omitted from connected-item lists unless they still have active accounts (trial pause keeps accounts active, so those cards remain).

## Acceptance Criteria

- [ ] `disconnectItem` does not delete `PlaidItem` / `PlaidAccount` or null transaction FKs.
- [ ] Disconnect still calls `itemRemove`, clears token + cursor, sets `accessRevokedAt`, and deactivates accounts.
- [ ] Re-link adopts the paused account and first sync does not insert txs dated on or before the watermark; later txs are inserted.
- [ ] First-time connect (no watermark) still imports history.
- [ ] User delete cascade still removes identity + txs.
- [ ] Desktop disconnect matches the keep-local behavior.

## Non-Goals

- Changing Financial Profile “Disconnect” to call Plaid `itemRemove` (still prefs-only).
- Blocking a second live Item for the same institution.
- Using `dedupeFingerprint` as an upsert key.
- Switching to `/transactions/get`.
- Storing Plaid `persistent_account_id`.

## Open Questions

None. Plaid IDs are not stable after `itemRemove`; matching uses kept local rows + existing fingerprint adoption.

## Related Specs

- [Stop provider billing after trial](../stop-provider-billing-after-trial/spec.md) — keep-local revoke / adopt-on-relink.
- [Plaid transaction import optimization](../../complete/plaid-transaction-import-optimization/spec.md) — cursor correctness for `/transactions/sync`.

## Suggested Commit Message

```text
docs: specifies plaid reconnect transaction dedupe
```
