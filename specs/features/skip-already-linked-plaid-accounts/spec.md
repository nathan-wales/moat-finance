# Skip already-linked Plaid accounts

## Status

Draft. Created 2026-09-08 after a second live Robinhood Link created duplicate Accounts rows (Credit Card, Roth IRA, individual, Crypto) with different balances and sync times.

## Goal

When a user completes Plaid Link for accounts that are already live in Moat, do not create a second Item or duplicate `PlaidAccount` rows. Show which accounts were skipped. Still persist accounts that are genuinely new at that institution.

Success means:

- Re-linking the same live accounts does not call `itemPublicTokenExchange` and does not add rows to Accounts.
- A mix of already-linked and new accounts persists only the new ones and lists the skipped names.
- Existing live duplicate pairs collapse to one row; an Item with nothing unique left is disconnected so Plaid billing stops.
- Ambiguous fingerprints (two live rows share the same mask+type with no unique name match) are not merged.

## Product Context

Users reconnect an institution they already have — often after Plaid Link offers the same picker again. Plaid `account_id` is unique per Item, not per real-world account, so today's upsert treats the second Link as brand new. Net worth and the Accounts table double-count.

The job of the post-Link overlay is to confirm what Moat did: already in Moat, newly added, or both.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Exchange | `apps/api/src/server/plaid/service.ts` `exchangePublicTokenForItem` | Always exchanges before any overlap check |
| Account upsert | `apps/api/src/server/plaid/syncAccounts.ts` | Upserts by `plaidAccountId` (Plaid `account_id`) |
| Adoption | `apps/api/src/server/plaid/adopt-revoked-accounts.ts` | Mask/type then name/type; **revoked** Items only |
| Desktop matcher | `apps/desktop/src/main/plaid/match-adoptable-accounts.ts` | Same fingerprints; used on relink |
| Disconnect | `apps/api/src/server/plaid/disconnect-item.ts` | `itemRemove`, keep local rows |
| Web Link | `apps/web/src/components/plaid/direct-plaid-connect-launcher.tsx` | Sends institution metadata only |
| Overlay | `apps/web/src/components/financial-connections/connection-import-overlay.tsx` | syncing / background / success |
| OpenAPI | `packages/openapi/api-v1.yaml` `/api/v1/plaid/exchangePublicToken` | No selected-account list |
| Desktop connect | `apps/desktop/src/main/plaid/service.ts` `connectItem` | Parallel SQLite exchange |
| Related spec | `specs/features/plaid-reconnect-transaction-dedupe/spec.md` | Explicit non-goal: blocking a second live Item |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Fingerprints | `adopt-revoked-accounts.ts` / `match-adoptable-accounts.ts` | `mask\|type\|subtype`, `mask\|type`, `name\|type` |
| Institution key | `apps/api/src/server/plaid/access-state.ts` `plaidInstitutionKey` | `id:` then `name:` |
| Overlay shell | `ConnectionImportOverlay` | Add `already_linked` and `partial` phases |

## Target Experience

1. User opens Link and selects Robinhood accounts that are already in Moat.
2. Overlay (not auto-dismissed):

```text
Already in Moat
These Robinhood accounts are already added and were not linked again.

• Robinhood Credit Card **5640
• Robinhood Roth IRA
• Robinhood individual
• Crypto

[Done]
```

3. Mix of old and new: sync the new accounts as today, then:

```text
Connected
Robinhood is connected with 1 new account.

Already in Moat
• Robinhood Credit Card **5640

Added
• New brokerage

[Done]
```

4. First-time connect and disconnect-then-relink adoption are unchanged.

## Architecture / Data Model

No Prisma schema change. `persistent_account_id` is not stored.

`POST /api/v1/plaid/exchangePublicToken` input adds optional Link accounts:

```yaml
metadata:
  institution: { name, institution_id }
  accounts:
    - { id, name, mask, type, subtype }
```

Response adds:

- `outcome`: `connected` | `already_linked` | `partial`
- `alreadyLinkedAccounts` / `addedAccounts`: same shape as existing `accounts`

When `outcome` is `already_linked`, `plaidItemDbId` / `plaidItemId` refer to the existing live Item. `accountCount` and `addedCount` are 0.

### Flow

1. Collapse live fingerprint collisions for the user (also on `getConnectedInstitutions` and financial-profile GET so current duplicates repair without another Link).
2. Classify selected accounts against **live** rows at that institution (same fingerprints; skip when a key has more than one unclaimed candidate).
3. If every selected account uniquely matches: do **not** exchange; return `already_linked`.
4. Otherwise exchange. `/accounts/get` is source of truth. Skip upsert for incoming accounts that uniquely match a live row on **another** Item. Same skip in `syncAccountsForItem` so webhooks cannot recreate duplicates.
5. If exchange happened and zero new accounts remain: `disconnectItem` the new Item immediately.

Desktop `connectItem` + overlay mirror this. iOS keeps working via extra JSON fields; API skip/disconnect still applies if Link metadata accounts are omitted (classify after `/accounts/get`).

## Implementation Plan

### Phase 1 — Spec + matcher
Extract fingerprints; add `matchLiveAccounts` (ambiguous skip); unit tests.

### Phase 2 — API
Classify before exchange; skip persist; collapse; OpenAPI + client generate.

### Phase 3 — Web overlay
Pass `metadata.accounts`; `already_linked` / `partial` phases with Done (no 1.4s auto-dismiss).

### Phase 4 — Desktop
Same classify/skip/collapse and overlay.

## Acceptance Criteria

- [ ] Re-Link of only already-live accounts does not call `itemPublicTokenExchange` when Link metadata includes those accounts.
- [ ] Overlay lists skipped account names; no new Accounts rows.
- [ ] Mixed selection persists only unmatched accounts; overlay lists skipped and added.
- [ ] Ambiguous fingerprints do not skip or collapse the wrong row.
- [ ] Later `syncAccountsForItem` does not upsert a sibling-matched account.
- [ ] Existing live duplicate rows collapse to the most recently synced; empty leftover Items are disconnected.
- [ ] First-time connect and revoked-item adoption still work.
- [ ] Analytics `plaid_link_completed` sends `outcome` and counts only — no account names.

## Non-Goals

- Storing Plaid `persistent_account_id`.
- Plaid update-mode `account_selection_enabled` (add new accounts onto the existing Item to avoid a second billed Item).
- A native iOS already-linked screen (API prevention only for v1).
- Blocking a second live Item when the selected accounts are all new (disjoint) at an already-connected institution.

## Open Questions

None. Mixed new + already-linked should skip duplicates and still add the new accounts.

## Related Specs

- [Plaid reconnect transaction dedupe](../plaid-reconnect-transaction-dedupe/spec.md) — adoption after disconnect; this spec covers a second **live** Item.

## Suggested Commit Message

```text
docs: specifies skip already-linked plaid accounts
```
