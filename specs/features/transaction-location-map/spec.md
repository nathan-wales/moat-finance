# Transaction Location Map

## Status

Shipped (Phase 1). Created 2026-08-11. Web list client now forwards `location` into the shared edit dialog (it previously dropped the field even though API/OpenAPI already returned it). iOS MapKit remains Phase 2.

## Goal

When Plaid supplies a physical location for a transaction, Moat persists the full location object and surfaces it on transaction detail with a map and formatted address.

Success means:

- Plaid `location` is stored as a first-class field on `Transaction` (not only inside `raw`)
- Existing rows are backfilled from `raw.location` when present
- Transaction detail shows a map + address only when a usable physical location exists
- Web and desktop shared transaction detail both receive `location` through typed contracts

## Product Context

Plaid’s Transactions API can return a `location` object for in-person purchases (address, city, region, postal code, country, lat/lon, store number). Availability depends mainly on merchant enrichment — large retail chains are far more likely to have it than small local businesses.

Persisting the full object unlocks maps now and future location-aware features (nearby spending, location rules) without re-deriving from `raw`.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Prisma Transaction | `apps/api/prisma/schema.prisma` | No location columns; full Plaid payload in `raw` / `rawProviderPayload` |
| Plaid → DB mapping | `apps/api/src/server/plaid/mapping.ts` | Single source of truth; does not map `location` today |
| Desktop Plaid mapping | `apps/desktop/src/main/plaid/mapping.ts` | SQLite mirror; same gap |
| SQLite Transaction | `packages/db-sqlite/prisma/schema.prisma` | No location column |
| Transaction list API | `apps/api/src/server/handlers/transaction.ts` | `getAll` spreads Prisma rows; no dedicated getById |
| Split copy path | `apps/api/src/server/handlers/transaction.ts` | Copies `merchantName` / `paymentChannel` / `raw` to split child — must also copy `location` |
| OpenAPI Transaction | `packages/openapi/api-v1.yaml` | Missing `location` |
| Contracts Transaction | `packages/contracts/src/api-client.ts` | Missing `location` |
| Shared detail UI | `packages/features/src/transactions/edit-transaction-dialog.tsx` | Used by web + desktop; no location UI |
| Map libraries | none | No Google Maps / Mapbox / Leaflet usage in repo |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Edit dialog metadata block | Account field in edit dialog | Pattern for read-only detail sections |
| Lucide icons | `lucide-react` already in features | Use `MapPin` for address row |
| Plaid types | `plaid` package `Transaction.location` | Canonical field names |

## Target Experience

In **Edit Transaction** (transaction detail), after Account and before Other actions:

1. If the transaction has a mappable location, show a **Location** section.
2. When `lat` + `lon` exist, show an embedded dark-styled map with a gold marker at the coordinates.
3. Below the map (or alone if coords are missing but address text exists), show the formatted address with a map-pin icon.
4. Address is tappable / links out to an external maps URL (`https://maps.google.com/?q=lat,lon` or encoded address).
5. If location is null or all fields empty → section is omitted (no empty state).

Formatted address example: `4801 N University Ave Ste 210, Provo, UT 84604`

### Visibility gate (`hasMappableLocation`)

Show the section when any of:

- `lat` and `lon` are both non-null numbers
- `address` is a non-empty string
- `city` and `region` are both non-empty strings

Do **not** show for `store_number` alone or an all-null Plaid location object.

## Architecture / Data Model

### Prisma (Postgres)

```prisma
/// Plaid Location shape persisted as JSON:
/// { address, city, region, postal_code, country, lat, lon, store_number }
location Json?
```

### SQLite (desktop)

```prisma
location String? // JSON string of the same shape
```

### Normalized TypeScript shape (`@moat/contracts`)

```ts
export type TransactionLocation = {
  address: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  store_number: string | null;
};
```

### Mapping rule

On Plaid create/update, map `tx.location` through a normalizer that returns `null` when every field is null/empty. Otherwise store the full object (snake_case keys matching Plaid: `postal_code`, `store_number`).

### Migration backfill

```sql
UPDATE "Transaction"
SET "location" = "raw"->'location'
WHERE "location" IS NULL
  AND "raw" ? 'location'
  AND "raw"->'location' IS NOT NULL
  AND "raw"->'location' != 'null'::jsonb;
```

(Optionally refine in app code later to null out all-null objects; backfill keeps parity with what Plaid sent.)

### API / contracts

- Add `TransactionLocation` schema + optional `location` on OpenAPI `Transaction`
- Add `location?: TransactionLocation | null` on contracts `Transaction`
- Regenerate `@moat/client-ts`
- Desktop: include `location` on IPC list items + `mapTransaction`

### UI

- `packages/features/src/transactions/location-utils.ts` — format + visibility helpers
- `packages/features/src/transactions/transaction-location-section.tsx` — map + address
- Wire into `edit-transaction-dialog.tsx`

Map implementation: Leaflet loaded client-side only (dynamic `import()`), CartoDB dark tiles, gold `circleMarker` (avoids default marker asset issues). No Google/Mapbox API key required.

## Implementation Plan

### Phase 1 — Persist + show on shared detail

1. Spec (this file)
2. Postgres schema + migration (+ backfill)
3. Plaid mapping + unit tests
4. Split-child copy of `location`
5. OpenAPI + contracts + client-ts
6. SQLite schema/migration + desktop Plaid mapping + IPC/list mapping
7. Shared Location section in edit dialog

**Acceptance criteria:** new Plaid syncs store location; detail shows map/address when present; all-null location hidden.

### Phase 2 — Later (out of this PR)

- iOS `TransactionDetailSheet` + MapKit
- Location-aware rules / nearby spend analytics
- Phone numbers (not provided by Plaid location)

## Acceptance Criteria

- [x] `Transaction.location` exists in Postgres schema with committed migration
- [x] Plaid sync maps and upserts the full location object (or null)
- [x] Existing rows with `raw.location` are backfilled
- [x] OpenAPI, `@moat/contracts`, and `@moat/client-ts` expose `location`
- [x] Split transactions copy `location` onto the child row
- [x] Edit Transaction shows map + address when mappable; hides otherwise
- [x] Desktop SQLite persists `location` and returns it to the shared dialog
- [x] Web `listTransactions` client forwards `location` to the shared dialog
- [x] No address/lat/lon strings in application logs or analytics payloads
- [x] Mapping unit tests cover populated, all-null, and missing location

## Non-Goals

- iOS MapKit UI in this change
- Geocoding when Plaid omits lat/lon
- Storing phone numbers or merchant hours
- Location-based rules, filters, or insights
- Requiring a Google Maps / Mapbox API key
- Parsing `raw` in the client long-term (first-class `location` is the contract)

## Open Questions

- None for v1 — Plaid field names kept as-is (`postal_code`, `store_number`) for fidelity with the provider payload.

## Related Specs

- [specs/complete/transactions-shared-page/spec.md](../../complete/transactions-shared-page/spec.md)
- [specs/complete/plaid-transaction-import-optimization/spec.md](../../complete/plaid-transaction-import-optimization/spec.md)

## Suggested Commit Message

```text
feat: persists plaid transaction locations
```
