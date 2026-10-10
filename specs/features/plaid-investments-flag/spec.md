# Plaid Investments (global optional product)

## Status

Superseded rollout. Originally drafted 2026-08-22 as a PostHog-flagged allowlist. Revised 2026-08-29: Investments is a permanent Moat capability for every user. The `plaid-investments` flag and `PLAID_PRODUCTS` env control are removed.

## Goal

Request Plaid Investments whenever an institution supports it, without filtering transaction-only institutions out of Link, and sync holdings only when the Item actually has Investments billed.

Success means:

- Fresh Link tokens always use `products: ["transactions"]` and `optional_products: ["investments"]`
- Institutions that only support Transactions (e.g. Crew) remain selectable in Link
- Brokerages that support Investments get holdings synced
- Reconnect / update-mode Link can add Investments via `additional_consented_products`
- Holdings sync is capability-based from persisted `/item/get` product arrays — no feature flag
- Account detail shows per-security holdings when rows exist

## Product Context

Brokerage accounts already appear in Moat when Plaid returns `type: "investment"` on `/accounts/get`. That does **not** subscribe the Item to Plaid Investments. Plaid bills by enabled product on the Item (~$0.70/month for Investments Holdings when the product is initialized).

Moat always wants Investments when available. Liabilities is never requested on Link (no consumer endpoint).

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Shared Link products, capabilities, holding rows | `packages/financial-data-providers/src/providers/plaid/investments/` (`@moat/financial-data-providers/plaid-investments`) | Used by API and desktop |
| Link token create (API) | `apps/api/src/server/plaid/link.ts` | Uses resolver; reconnect uses `additional_consented_products` |
| Link token create (desktop) | `apps/desktop/src/main/plaid/service.ts` | Same products; reconnect retries without add-on if Plaid rejects |
| Persist capabilities (API) | `apps/api/src/server/plaid/persist-item-capabilities.ts` | Postgres `String[]` on `PlaidItem` |
| Persist capabilities (desktop) | `apps/desktop/src/main/plaid/persist-item-capabilities.ts` | SQLite JSON text columns (`billedProductsJson`, …) |
| Holdings sync (API) | `apps/api/src/server/plaid/syncHoldings.ts` | `/investments/holdings/get` |
| Holdings sync (desktop) | `apps/desktop/src/main/plaid/sync-holdings.ts` | Same mapping; SQLite `PlaidHolding` |
| Orchestrator | `apps/api/src/server/services/connection-sync-orchestrator.service.ts` | Capability gate + soft-skip on product errors |

## Architecture

```text
createPlaidLinkTokenForUser
  → products: ["transactions"]
  → optional_products: ["investments"]
  → update mode: additional_consented_products: ["investments"]
                 (retried without it if the Item rejects the add-on)

exchangePublicToken
  → itemGet → persist billed/available/consented on PlaidItem
  → transactions sync, then holdings sync when Investments is billed or consented

cached_manual / holdings sync / nightly holdings pass
  → if capabilities known and investments is neither billed nor consented → SKIP
  → if capabilities unknown (legacy empty) → try holdings; soft-skip + persist
  → if investments is billed or consented → holdings get
    (consent alone is enough: Plaid leaves Investments in available_products
     until the first successful /investments/holdings/get)

account detail dialog
  → investment.getHoldings returns stored rows (empty when none)
```

### Link product selection

Plaid AND-filters institutions by required `products`. Investments must never sit in that array — Crew and other transaction-only banks would show “Connectivity not supported.”

`optional_products` requests Investments when supported and omits it otherwise. Update mode uses `additional_consented_products` so existing Transactions-only Items can gain Investments without recreate.

### Holdings storage

`PlaidHolding` stores one row per `(plaidAccountId, securityId)`. Each sync replaces an account's rows outright. Soft-skip codes live in `isPlaidInvestmentsProductUnavailable`.

Postgres stores item product arrays as `String[]`. Desktop SQLite stores the same arrays as JSON text (`billedProductsJson`, `availableProductsJson`, `consentedProductsJson`) because SQLite has no scalar lists.

## Acceptance Criteria

- [x] `products` is always exactly `["transactions"]`
- [x] `optional_products` is always `["investments"]`
- [x] No PostHog `plaid-investments` gate on Link or holdings
- [x] No `PLAID_PRODUCTS` env control of Link products
- [x] `PlaidItem` persists billed / available / consented product arrays
- [x] Holdings sync runs when Investments is billed or consented, and skips without calling Plaid when it is only available
- [x] Holdings errors for a missing Investments product do not fail transaction sync
- [x] Reconnect still requests `additional_consented_products: ["investments"]`
- [x] Liabilities is not requested on Link
- [x] Desktop Link tokens request optional Investments
- [x] Desktop persists holdings in SQLite `PlaidHolding` and shows them in account detail

## Non-Goals

- `/investments/transactions/get` (buy/sell history)
- Plaid Liabilities product
- Cost basis or performance analytics beyond per-position gain

Items whose `consentedProducts` omit Investments still need **one completed reconnect** so Plaid can add consent. Items that already list Investments under `consentedProducts` do not.

## Related Specs

- [Bank sync updates](../../complete/bank-sync-updates.spec.md)
- [Stop provider billing after trial](../stop-provider-billing-after-trial/spec.md)
