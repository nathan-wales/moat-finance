# Apple FinanceKit merchant category mapping

## Status

Draft. Created 2026-07-07 after reviewing FinanceKit docs, ISO 18245 MCC references, and repo code in `apps/ios/Moat/Features/AppleWallet/` and `apps/api/src/server/services/apple-financekit-mapping.ts`. Updated 2026-07-07 — **Education**, **Subscriptions**, and **Pets** approved as new global default categories.

**Root cause identified:** iOS already serializes FinanceKit `merchantCategoryCode` into `rawCategory`, but the API mapper treats `rawCategory` as an Apple string enum (e.g. `RESTAURANTS`). FinanceKit actually provides **ISO 18245 numeric MCC codes** (e.g. `5812`, `5411`). Every import therefore falls through to `Uncategorized` unless a user rule overrides it.

## Goal

Map FinanceKit `merchantCategoryCode` (ISO 18245 MCC) into Moat's default category names at import time — including three newly approved categories (**Subscriptions**, **Pets**, **Education**) — so Apple Wallet transactions arrive pre-categorized consistently with Plaid imports.

Success means:

- A FinanceKit transaction with MCC `5812` (restaurants) imports as **Eating Out**.
- A transaction with MCC `5411` (grocery stores) imports as **Groceries**.
- A transaction with MCC `5541` (service stations) imports as **Gas**.
- A transaction with MCC `5815` (digital subscriptions) imports as **Subscriptions**.
- A transaction with MCC `8220` (colleges / universities) imports as **Education**.
- A transaction with MCC `0742` (veterinary services) imports as **Pets**.
- A transaction with no MCC still imports successfully as **Uncategorized**, then user rules may override.
- Raw MCC is preserved for debugging and future remapping without re-syncing from the device.
- Existing user categorization rules still run after import and can override the MCC-derived category.

## Product Context

Apple Wallet is a first-class integration source (`APPLE_FINANCEKIT`) alongside Plaid. Users expect Apple Card transactions to show up in spending summaries, budgets, and cash-flow views with sensible default categories — not uniformly "Uncategorized."

FinanceKit exposes merchant category codes on most card transactions (WWDC24: "Most transactions will provide a merchant category code, conforming to ISO 18245"). This is the primary signal for default categorization; `merchantName` and `transactionDescription` are fallbacks only when MCC is absent.

Moat already has a categorization rules engine that runs post-import. MCC mapping is the **first pass**; rules are the **second pass** and may override for users who have configured them.

## Current Repo Context

### Data flow today

```text
FinanceKit Transaction.merchantCategoryCode (Int?, ISO 18245)
  → apple-finance-kit-service.swift (String via String.init)
  → ExternalTransactionDTO.rawCategory
  → POST bulk-import Apple FinanceKit transactions
  → mapAppleFinanceKitCategory(rawCategory)   ← broken for MCC codes
  → Transaction.category + Transaction.categoryId
  → applyRulesToSyncedTransactions()           ← second pass, unchanged
```

### Key files

| Asset | Location | Notes |
|-------|----------|-------|
| FinanceKit transaction normalization | `apps/ios/Moat/Features/AppleWallet/Services/apple-finance-kit-service.swift` | Line ~267: `rawCategory: transaction.merchantCategoryCode.map(String.init)` — **already correct** |
| DTO normalizer | `apps/ios/Moat/Features/AppleWallet/Services/apple-finance-kit-normalizer.swift` | Passes `rawCategory` through; `category` left `nil` |
| Import payload models | `apps/ios/Moat/Features/AppleWallet/Models/apple-wallet-models.swift` | `ExternalTransactionDTO.rawCategory: String?` |
| Category mapper (needs fix) | `apps/api/src/server/services/apple-financekit-mapping.ts` | Maps string enums like `RESTAURANTS` — wrong input shape |
| Import service | `apps/api/src/server/services/apple-financekit-import.service.ts` | Calls `mapAppleFinanceKitCategory(transaction.rawCategory ?? transaction.category)` at L180–185 |
| Plaid category reference | `apps/api/src/server/plaid/mapping.ts` | Pattern to follow: detailed overrides → primary map → `Uncategorized` |
| Rules on import | `apps/api/src/server/services/transaction-rules-on-import.service.ts` | Runs after import; must remain second pass |
| Mapping tests | `apps/api/src/server/services/apple-financekit-import.service.test.ts` | Tests currently assert enum-style input |
| Default categories | `apps/api/prisma/seed.ts` | Canonical list of Moat category **names** (not enums) |
| Parent integration spec | `specs/complete/apple-wallet/spec.md` | Shipped; says "map Apple category fields into internal category system at normalizer or import layer" |

### Default Moat categories (mapping targets)

All MCC mappings must resolve to one of these seeded names (case-sensitive display names, resolved to `categoryId` via `loadCategoryNameToIdMap`):

| Name | sortOrder |
|------|-----------|
| Salary | 0 |
| Reimbursement | 1 |
| Eating Out | 10 |
| Groceries | 11 |
| Mortgage & Rent | 20 |
| Home | 21 |
| Bills & Utilities | 22 |
| Insurance | 23 |
| Auto & Transport | 30 |
| Gas | 31 |
| Cars | 32 |
| Travel | 40 |
| Flights | 41 |
| Shopping | 50 |
| Clothing | 51 |
| Entertainment | 60 |
| Sports & Fitness | 61 |
| Subscriptions | 62 |
| Health & Medical | 70 |
| Kids | 80 |
| Pets | 82 |
| Education | 85 |
| Gifts & Donations | 90 |
| Business Services | 100 |
| Investments | 110 |
| Loans | 120 |
| Taxes | 130 |
| Fees | 140 |
| Credit card payment | 150 |
| Transfer | 998 |
| Uncategorized | 999 |

**Canonical source:** `apps/api/prisma/seed.ts` is the single source of truth for cloud/web/iOS API imports. This spec adds **Subscriptions**, **Pets**, and **Education** to that seed (they already exist in the desktop SQLite defaults). After implementation, cloud and desktop will converge on these three names.

**Do not use draft enum names** from early planning (`DINING`, `TRANSPORTATION`, etc.). All mappings must resolve to the display names in the table above.

**Plaid alignment:** This spec follows the same patterns as `apps/api/src/server/plaid/mapping.ts` — map to existing Moat names, prefer detailed/exact overrides, default to `Uncategorized`. Examples of cross-provider consistency:

| Signal | Plaid mapping | FinanceKit MCC mapping (this spec) |
|--------|---------------|-------------------------------------|
| Restaurants | `FOOD_AND_DRINK` → Eating Out | 5812 → Eating Out |
| Groceries | `FOOD_AND_DRINK_GROCERIES` → Groceries | 5411 → Groceries |
| Gas | `TRANSPORTATION_GAS` → Gas | 5541 → Gas |
| Flights | `TRAVEL_FLIGHTS` → Flights | 3000–3350 → Flights |
| Mortgage payment | `LOAN_PAYMENTS_MORTGAGE_PAYMENT` → Mortgage & Rent | 6513 → Mortgage & Rent |
| Gyms | `PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS` → Sports & Fitness | 7997 → Sports & Fitness |
| Pet / vet | `GENERAL_MERCHANDISE_PET_SUPPLIES` / `MEDICAL_VETERINARY_SERVICES` → **Pets** (update Plaid mapper) | 0742 / 5995 → Pets |
| Subscriptions | No Plaid primary equivalent | 5815 / 5968 → Subscriptions |
| Education | No Plaid primary equivalent | 8220 → Education |
| Personal care | `PERSONAL_CARE` → Health & Medical | 7230 / 7298 → Health & Medical |
| Donations | `GOVERNMENT_AND_NON_PROFIT_DONATIONS` → Gifts & Donations | 8398 → Gifts & Donations |
| Income | amount sign → Salary | amount sign (not MCC) |

### Known bug

```ts
// apps/api/src/server/services/apple-financekit-mapping.ts (current)
mapAppleFinanceKitCategory("5812")  // → "Uncategorized" (wrong)
mapAppleFinanceKitCategory("RESTAURANTS")  // → "Eating Out" (never sent by iOS)
```

iOS sends `"5812"`, not `"RESTAURANTS"`.

### Default category coverage audit

Every seeded category and its MCC coverage for v1:

| Moat category | MCC coverage | Gap / note |
|---------------|--------------|------------|
| Salary | None (by design) | Income resolved by signed amount, not MCC |
| Reimbursement | None (by design) | User/rules only |
| Eating Out | 5811–5814 | Covered |
| Groceries | 5411, 5422, 5441, 5451, 5462, 5499, 5333 | Covered |
| Mortgage & Rent | **6513** | Rent payments to property managers / landlords |
| Home | 1520, 5021–5261, 5712–5722, 5996 | Covered |
| Bills & Utilities | 4812–4900 | Covered; aligns with Plaid `RENT_AND_UTILITIES` |
| Insurance | 5960, 6300, 6381, 6399 | Covered |
| Auto & Transport | 4011–4789, 5552, 7523–7549 | Covered |
| Gas | 5541, 5542 | Covered |
| Cars | 5531–5533, 7531–7538 | Covered |
| Travel | 4411, 4582, 4722–4723, 7011–7033, 7512–7519 | Covered |
| Flights | 3000–3350, 4511 | Covered |
| Shopping | 5262–5399, 5732–5999 (non-clothing) | Covered |
| Clothing | 5611–5699 | Covered |
| Entertainment | 7832–7999 (excl. 7997), 8411, 9406 | Covered; digital goods moved to Subscriptions |
| Sports & Fitness | 7997 | Covered |
| Subscriptions | 5815–5818, 5968 | Covered |
| Health & Medical | 5122, 5912, 5975–5976, 7210–7298, 8011–8099 | Covered; includes personal care per Plaid |
| Kids | 7295, 8351 | Child care only |
| Pets | 0742, 5995 | Covered |
| Education | 8211, 8220, 8241, 8244, 8249, 8299 | Covered |
| Gifts & Donations | 8398, 8641–8699 | Covered |
| Business Services | 2741, 2791, 5044–5111, 7311–7399, 8111, 8911, 8999 | Covered |
| Investments | 6211, 6760 | Covered |
| Loans | None reliable | Loan disbursements/payments often appear as Transfer MCCs or lack MCC |
| Taxes | 7276, 9211, 9311, 9399, 9400, 9402, 9405 | Covered |
| Fees | 6010–6051, 9222, 9223 | Covered; ATM 6011 → Fees |
| Credit card payment | None reliable | Card payments often classify as Transfer (6532/6533) not this category |
| Transfer | 4829, 6529–6540 | Covered |
| Uncategorized | Ambiguous / unmapped MCCs only | Fallback of last resort |

## Apple / ISO 18245 Reference

### FinanceKit API (verified)

| Field | Type | Notes |
|-------|------|-------|
| `Transaction.merchantCategoryCode` | `MerchantCategoryCode?` | Optional. ISO 18245 MCC when present. |
| `MerchantCategoryCode.rawValue` | `Int` | Numeric code, e.g. `5812`. |
| `Transaction.merchantName` | `String?` | Optional merchant display name. |
| `Transaction.transactionType` | `TransactionType` | e.g. `.pointOfSale`, `.transfer`, `.directDebit`. |
| `Transaction.creditDebitIndicator` | `CreditDebitIndicator` | `.debit` or `.credit`. |

FinanceKit also supports filtering by MCC:

```swift
TransactionQuery.predicate(forMerchantCategoryCodes: [
    MerchantCategoryCode(rawValue: 5411)
])
```

Requirements unchanged from parent spec: iOS 17.4+, US only, `com.apple.developer.financekit` entitlement, `@available(iOS 17.4, *)` guards.

### ISO 18245 MCC structure

MCC is a **4-digit merchant category code**, not an Apple-specific enum. Networks may assign slightly different codes for the same merchant, but major ranges are stable:

| Range | Typical domain |
|-------|----------------|
| 3000–3350 | Airlines (network-specific codes) |
| 3351–3500 | Car rental |
| 3501–3999 | Hotels / lodging |
| 4000–4799 | Transportation |
| 4800–4999 | Utilities / telecom |
| 5000–5599 | Retail |
| 5600–5699 | Clothing / apparel |
| 5700–7299 | Misc stores / personal services |
| 7300–7999 | Business / recreation services |
| 8000–8999 | Professional / education / membership |
| 9000–9999 | Government |

Sources: [Apple Transaction docs](https://developer.apple.com/documentation/financekit/transaction), [Stripe MCC guide](https://stripe.com/guides/merchant-category-codes), [Eesti Pank MCC list](https://www.eestipank.ee/en/list-merchant-category-codes).

## Architecture / Mapping Contract

### Resolution order

Apply in this order during import (API layer only — no iOS categorization logic):

1. **Normalize MCC** — coerce `rawCategory` to 4-digit zero-padded string (`"5812"`, `"412"` → `"0412"`). Non-numeric values fall through to step 4.
2. **Exact MCC match** — lookup in `EXACT_MCC_TO_MOAT_CATEGORY` table.
3. **Range MCC match** — lookup in ordered `RANGE_MCC_TO_MOAT_CATEGORY` rules (first match wins).
4. **Legacy string enum match** — keep existing `APPLE_CATEGORY_TO_APP_CATEGORY` map for backward compatibility if any client ever sends enum strings.
5. **Default** — `Uncategorized`.

Income vs expense is **not** determined by MCC. Continue using `mapAppleFinanceKitTransactionType(signedAmount)` (negative = income, positive = expense). MCC `6011` (ATM) on a credit still maps category; type comes from amount sign.

### Persistence

| Field | What to store |
|-------|---------------|
| `Transaction.category` | Resolved Moat display name (e.g. `"Eating Out"`) |
| `Transaction.categoryId` | FK from `loadCategoryNameToIdMap` |
| `Transaction.raw` (JSON) | Include `merchantCategoryCode` (normalized 4-digit string) when present |

Do **not** overwrite `category` / `categoryId` on re-import when the user has already categorized or split the transaction (existing guard at `apple-financekit-import.service.ts` L230–233 — keep as-is).

### Rules engine (unchanged)

`applyRulesToSyncedTransactions` runs after bulk import. User rules can override MCC-derived categories. Do not skip or reorder this step.

### File layout (implementation)

| File | Change |
|------|--------|
| `apps/api/prisma/seed.ts` | Add `Subscriptions` (62), `Pets` (82), `Education` (85) global defaults |
| `apps/ios/Moat/Features/Categories/Models/category-models.swift` | Add icons; reassign Kids from `graduationcap` → `figure.and.child.holdinghands`, give Education `graduationcap` |
| `packages/features/src/what-if/category-icons.ts` | Add `Subscriptions`, `Pets`, `Education` icons |
| `apps/api/src/server/plaid/mapping.ts` | Update pet/vet detailed overrides → `Pets` |
| `apps/api/src/server/services/apple-financekit-mcc-mapping.ts` | **New.** MCC tables + `normalizeMcc()` + `categoryFromMerchantCategoryCode()` |
| `apps/api/src/server/services/apple-financekit-mapping.ts` | Update `mapAppleFinanceKitCategory()` to delegate to MCC resolver first |
| `apps/api/src/server/services/apple-financekit-import.service.ts` | Store `merchantCategoryCode` in `raw` JSON metadata |
| `apps/api/src/server/services/apple-financekit-import.service.test.ts` | Add MCC mapping test cases |
| iOS FinanceKit files | **No changes required** for v1 — `rawCategory` already carries MCC |

## MCC → Moat Category Mapping

### Normalization

```ts
normalizeMcc("5812")   // → "5812"
normalizeMcc(5812)     // → "5812"
normalizeMcc("581")    // → "0581"
normalizeMcc(null)     // → null
normalizeMcc("FOO")    // → null (triggers legacy enum / Uncategorized fallback)
```

### Exact MCC overrides (high-signal codes)

Exact matches take precedence over range rules. Implement the full table below in `apple-financekit-mcc-mapping.ts`.

#### Food

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 5811 | Eating Out | Caterers |
| 5812 | Eating Out | Restaurants |
| 5813 | Eating Out | Bars / drinking places |
| 5814 | Eating Out | Fast food |
| 5411 | Groceries | Grocery stores / supermarkets |
| 5422 | Groceries | Meat provisioners |
| 5441 | Groceries | Candy / nuts / confectionery |
| 5451 | Groceries | Dairies |
| 5462 | Groceries | Bakeries |
| 5499 | Groceries | Convenience / specialty food |
| 5333 | Groceries | Hypermarkets |

#### Gas / auto / transport

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 5541 | Gas | Service stations |
| 5542 | Gas | Automated fuel dispensers |
| 5552 | Auto & Transport | EV charging |
| 5531 | Cars | Auto stores |
| 5532 | Cars | Tire stores |
| 5533 | Cars | Auto parts |
| 7531 | Cars | Auto body repair |
| 7534 | Cars | Tire repair |
| 7535 | Cars | Auto paint |
| 7538 | Cars | Auto service |
| 7542 | Auto & Transport | Car washes |
| 7549 | Auto & Transport | Towing |
| 7523 | Auto & Transport | Parking |
| 7524 | Auto & Transport | Parking express payment |
| 4011 | Auto & Transport | Railroads |
| 4111 | Auto & Transport | Commuter transport / ferries |
| 4112 | Auto & Transport | Passenger railways |
| 4121 | Auto & Transport | Taxi / limo / rideshare |
| 4131 | Auto & Transport | Bus lines |
| 4784 | Auto & Transport | Tolls / bridges |
| 4789 | Auto & Transport | Transportation services NEC |

#### Travel

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 4511 | Flights | Airlines NEC |
| 4582 | Travel | Airports |
| 4722 | Travel | Travel agencies |
| 4723 | Travel | Package tour operators |
| 4411 | Travel | Cruise lines |
| 7011 | Travel | Hotels / motels / resorts |
| 7012 | Travel | Timeshares |
| 7032 | Travel | Sporting / recreational camps |
| 7033 | Travel | Campgrounds |
| 7512 | Travel | Car rental |
| 7513 | Travel | Truck / trailer rental |
| 7519 | Travel | RV rental |

#### Utilities / telecom

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 4812 | Bills & Utilities | Telecom equipment |
| 4813 | Bills & Utilities | Telecom key-entry |
| 4814 | Bills & Utilities | Telecom services |
| 4815 | Bills & Utilities | Monthly telephone charges |
| 4816 | Bills & Utilities | Computer network / info services |
| 4899 | Bills & Utilities | Cable / pay TV |
| 4900 | Bills & Utilities | Electric / gas / water / sanitary |
| 4821 | Bills & Utilities | Telegraph services |

#### Housing / rent

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 6513 | Mortgage & Rent | Real estate agents / property managers — rentals |

Visa defines 6513 for rental payments, management fees, and rental commissions. Mortgage loan payments use other MCCs (often 6012) and are not reliably distinguishable from general bank fees — leave as Fees unless `transactionType` signaling is added later.

#### Digital goods / subscriptions

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 5815 | Subscriptions | Digital books / movies / music |
| 5816 | Subscriptions | Digital games |
| 5817 | Subscriptions | Digital apps |
| 5818 | Subscriptions | Large digital goods merchant |
| 5968 | Subscriptions | Continuity / subscription merchants |

#### Shopping / retail

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 5262 | Shopping | Online marketplaces |
| 5300 | Shopping | Wholesale clubs |
| 5309 | Shopping | Duty-free |
| 5310 | Shopping | Discount stores |
| 5311 | Shopping | Department stores |
| 5331 | Shopping | Variety stores |
| 5399 | Shopping | Misc general merchandise |
| 5611 | Clothing | Men's / boys clothing |
| 5621 | Clothing | Women's clothing |
| 5631 | Clothing | Women's accessories |
| 5641 | Clothing | Children's clothing |
| 5651 | Clothing | Family clothing |
| 5655 | Clothing | Sports apparel |
| 5661 | Clothing | Shoes |
| 5681 | Clothing | Furriers |
| 5691 | Clothing | Men's / women's clothing |
| 5697 | Clothing | Tailors / alterations |
| 5698 | Clothing | Wigs |
| 5699 | Clothing | Misc apparel |
| 5732 | Shopping | Electronics |
| 5733 | Shopping | Music stores |
| 5734 | Shopping | Software |
| 5735 | Shopping | Record stores |
| 5931 | Shopping | Used merchandise |
| 5932 | Shopping | Antiques |
| 5933 | Shopping | Pawn shops |
| 5941 | Shopping | Sporting goods |
| 5942 | Shopping | Book stores |
| 5943 | Shopping | Stationery / school supplies |
| 5944 | Shopping | Jewelry |
| 5945 | Shopping | Hobby / toy / game shops |
| 5946 | Shopping | Camera shops |
| 5947 | Shopping | Gift / souvenir shops |
| 5948 | Shopping | Luggage |
| 5949 | Shopping | Sewing / fabric |
| 5970 | Shopping | Art supplies |
| 5971 | Shopping | Art dealers |
| 5972 | Shopping | Stamps / coins |
| 5973 | Shopping | Religious goods |
| 5977 | Shopping | Cosmetics |
| 5992 | Shopping | Florists |
| 5994 | Shopping | Newsstands |
| 5999 | Shopping | Misc specialty retail |

#### Home / improvement

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 1520 | Home | General contractors |
| 1711 | Home | HVAC / plumbing |
| 1731 | Home | Electrical contractors |
| 1740 | Home | Masonry / tile / insulation |
| 1750 | Home | Carpentry |
| 1761 | Home | Roofing / siding |
| 1771 | Home | Concrete work |
| 1799 | Home | Special trade contractors |
| 5021 | Home | Office / commercial furniture |
| 5039 | Home | Construction materials |
| 5072 | Home | Hardware equipment / supplies |
| 5074 | Home | Plumbing / heating supplies |
| 5193 | Home | Florist / nursery supplies |
| 5198 | Home | Paints / varnishes |
| 5200 | Home | Home supply warehouse |
| 5211 | Home | Lumber / building materials |
| 5231 | Home | Glass / paint / wallpaper |
| 5251 | Home | Hardware stores |
| 5261 | Home | Lawn / garden / nurseries |
| 5712 | Home | Furniture / home furnishings |
| 5713 | Home | Floor covering |
| 5714 | Home | Drapery / window / upholstery |
| 5718 | Home | Fireplace stores |
| 5719 | Home | Misc home furnishings |
| 5722 | Home | Appliances |
| 5996 | Home | Swimming pools |

#### Health / medical

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 5122 | Health & Medical | Drugs / drug proprietors |
| 5912 | Health & Medical | Pharmacies |
| 5975 | Health & Medical | Hearing aids |
| 5976 | Health & Medical | Orthopedic / prosthetic |
| 8011 | Health & Medical | Doctors |
| 8021 | Health & Medical | Dentists |
| 8031 | Health & Medical | Osteopaths |
| 8041 | Health & Medical | Chiropractors |
| 8042 | Health & Medical | Optometrists / ophthalmologists |
| 8043 | Health & Medical | Opticians |
| 8044 | Health & Medical | Optical goods |
| 8049 | Health & Medical | Podiatrists |
| 8050 | Health & Medical | Nursing / care facilities |
| 8062 | Health & Medical | Hospitals |
| 8071 | Health & Medical | Medical / dental labs |
| 8099 | Health & Medical | Medical services NEC |

#### Beauty / personal care

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 7210 | Health & Medical | Laundry / cleaning / garment |
| 7211 | Health & Medical | Laundry |
| 7216 | Health & Medical | Dry cleaners |
| 7230 | Health & Medical | Barber / beauty shops |
| 7297 | Health & Medical | Massage |
| 7298 | Health & Medical | Health / beauty spas |

#### Kids / pets

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 7295 | Kids | Babysitting |
| 8351 | Kids | Child care |
| 0742 | Pets | Veterinary services |
| 5995 | Pets | Pet shops / pet food / supplies |

#### Entertainment / fitness

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 7832 | Entertainment | Movie theaters |
| 7833 | Entertainment | Movie theater express payment |
| 7841 | Entertainment | Video rental |
| 7911 | Entertainment | Dance halls / studios |
| 7922 | Entertainment | Theater / ticket agencies |
| 7929 | Entertainment | Bands / orchestras |
| 7932 | Entertainment | Billiards / pool |
| 7933 | Entertainment | Bowling |
| 7941 | Entertainment | Commercial sports |
| 7991 | Entertainment | Tourist attractions |
| 7992 | Entertainment | Golf |
| 7993 | Entertainment | Video amusement supplies |
| 7994 | Entertainment | Arcades |
| 7995 | Entertainment | Betting / gambling |
| 7996 | Entertainment | Amusement parks |
| 7997 | Sports & Fitness | Sports / recreation clubs |
| 7998 | Entertainment | Aquariums / zoos |
| 7999 | Entertainment | Recreation services NEC |
| 8411 | Entertainment | Museums |

#### Education

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 8211 | Education | Elementary / secondary schools |
| 8220 | Education | Colleges / universities |
| 8241 | Education | Correspondence schools |
| 8244 | Education | Business / secretarial schools |
| 8249 | Education | Trade / vocational schools |
| 8299 | Education | Education NEC |

All known education MCCs are listed as exact overrides so they do not fall through to the 8000–8999 range rule (`Business Services`).

#### Giving / membership

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 8398 | Gifts & Donations | Charitable / social service orgs |
| 8641 | Gifts & Donations | Civic / social / fraternal associations |
| 8651 | Gifts & Donations | Political organizations |
| 8661 | Gifts & Donations | Religious organizations |
| 8699 | Gifts & Donations | Membership org NEC |

#### Insurance

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 5960 | Insurance | Direct marketing insurance |
| 6300 | Insurance | Insurance sales / premiums |
| 6381 | Insurance | Insurance premiums |
| 6399 | Insurance | Insurance NEC |

#### Financial / transfers

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 4829 | Transfer | Wire transfers / money orders |
| 6010 | Fees | Manual cash disbursement |
| 6011 | Fees | ATM / automated cash disbursement |
| 6012 | Fees | Financial institutions merchandise / services |
| 6050 | Fees | Quasi cash |
| 6051 | Fees | Foreign currency / money orders |
| 6211 | Investments | Securities brokers / dealers |
| 6529 | Transfer | Stored value load |
| 6530 | Transfer | Stored value load merchant |
| 6532 | Transfer | Payment transaction — customer FI |
| 6533 | Transfer | Payment transaction — merchant |
| 6535 | Transfer | Value purchase |
| 6536 | Transfer | MoneySend intracountry |
| 6537 | Transfer | MoneySend intercountry |
| 6538 | Transfer | MoneySend funding |
| 6539 | Transfer | Funding transaction |
| 6540 | Transfer | Stored value card purchase / load |
| 6760 | Investments | Savings bonds |

#### Taxes / legal / government / business

| MCC | Moat category | Description |
|-----|---------------|-------------|
| 7276 | Taxes | Tax prep |
| 8111 | Business Services | Legal services |
| 8931 | Business Services | Accounting / bookkeeping |
| 9211 | Taxes | Court costs / alimony / child support |
| 9222 | Fees | Fines |
| 9223 | Fees | Bail / bond |
| 9311 | Taxes | Tax payments |
| 9399 | Taxes | Government services NEC |
| 9400 | Taxes | Embassy / consulate fees |
| 9402 | Taxes | Government postal services |
| 9405 | Taxes | U.S. federal government |
| 9406 | Entertainment | Government lottery (non-US) |
| 2741 | Business Services | Misc publishing / printing |
| 2791 | Business Services | Typesetting / plate making |
| 5044 | Business Services | Office / photographic / photocopy equipment |
| 5045 | Business Services | Computers / peripherals / software |
| 5046 | Business Services | Commercial equipment NEC |
| 5111 | Business Services | Stationery / office supplies |
| 5192 | Business Services | Books / periodicals / newspapers |
| 7311 | Business Services | Advertising services |
| 7321 | Business Services | Consumer credit reporting |
| 7322 | Business Services | Debt collection |
| 7332 | Business Services | Blueprint / photocopy services |
| 7333 | Business Services | Commercial photography |
| 7338 | Business Services | Quick-copy / reproduction services |
| 7339 | Business Services | Stenographic services |
| 7342 | Business Services | Exterminating / disinfecting |
| 7349 | Business Services | Cleaning / maintenance |
| 7361 | Business Services | Employment / temp agencies |
| 7372 | Business Services | Computer programming / data processing |
| 7375 | Business Services | Information retrieval services |
| 7379 | Business Services | Computer maintenance / repair |
| 7392 | Business Services | Consulting / PR / research |
| 7393 | Business Services | Detective / protective agencies |
| 7394 | Business Services | Equipment / tool rental |
| 7395 | Business Services | Photo developing |
| 7399 | Business Services | Business services NEC |
| 8911 | Business Services | Architectural / engineering / surveying |
| 8999 | Business Services | Professional services NEC |

### Range fallback rules

Applied only when no exact match exists. Ranges are ordered; first match wins.

| From | To | Moat category | Label |
|------|-----|---------------|-------|
| 3000 | 3350 | Flights | Airlines (network-specific codes) |
| 3351 | 3500 | Travel | Car rentals |
| 3501 | 3999 | Travel | Hotels / lodging |
| 4000 | 4799 | Auto & Transport | Transportation |
| 4800 | 4999 | Bills & Utilities | Utilities / telecom |
| 5000 | 5599 | Shopping | Retail |
| 5600 | 5699 | Clothing | Clothing |
| 5700 | 7299 | Shopping | Misc shops / personal services |
| 7300 | 7999 | Business Services | Business / recreation services |
| 8000 | 8999 | Business Services | Professional / education / membership |
| 9000 | 9999 | Taxes | Government |

### Legacy string enum map (keep for compatibility)

Retain the existing `APPLE_CATEGORY_TO_APP_CATEGORY` entries in `apple-financekit-mapping.ts` as step 4 fallback. These were written for a non-existent Apple enum and may be useful if a future client sends human-readable category strings.

### Example merchant → MCC → category

| Merchant (from Wallet) | Likely MCC | Expected Moat category |
|------------------------|------------|------------------------|
| Chipotle | 5812 or 5814 | Eating Out |
| The Home Depot | 5200, 5211, or 5251 | Home |
| Target (grocery run) | 5411 | Groceries |
| Shell / Chevron | 5541 or 5542 | Gas |
| Delta Airlines | 3000–3350 range or 4511 | Flights |
| Marriott | 7011 or 3501–3999 range | Travel |
| Netflix / Spotify | 5815 or 5968 | Subscriptions |
| Property management rent | 6513 | Mortgage & Rent |
| University tuition | 8220 | Education |
| Chewy / vet clinic | 5995 or 0742 | Pets |
| Utah State Parks | 7991 or 9399 | Entertainment or Taxes (depends on MCC) |
| Facebook ads | 7311 | Business Services |
| ATM withdrawal | 6011 | Fees |

## Implementation Plan

### Phase 0 — New default categories (seed + icons + Plaid parity)

1. Add to `apps/api/prisma/seed.ts`:
   ```ts
   { name: "Subscriptions", sortOrder: 62, isDefault: true },
   { name: "Pets", sortOrder: 82, isDefault: true },
   { name: "Education", sortOrder: 85, isDefault: true },
   ```
2. Add icons:
   - iOS `category-models.swift`: `Subscriptions` → `arrow.clockwise`, `Pets` → `pawprint`, `Education` → `graduationcap`; reassign `Kids` → `figure.and.child.holdinghands` (graduationcap was semantically wrong for child care).
   - Web `category-icons.ts`: `Subscriptions` → `Repeat` (or similar), `Pets` → `PawPrint`, `Education` → `GraduationCap`.
3. Update `apps/api/src/server/plaid/mapping.ts` detailed overrides:
   ```ts
   GENERAL_MERCHANDISE_PET_SUPPLIES: "Pets",
   MEDICAL_VETERINARY_SERVICES: "Pets",
   ```
4. Run `pnpm --filter moat-api exec prisma db seed` locally to create global defaults (idempotent — skips existing names).

**Acceptance criteria:** New categories appear in category pickers; Plaid pet/vet imports resolve to `Pets`.

### Phase 1 — MCC mapping module (API)

1. Create `apps/api/src/server/services/apple-financekit-mcc-mapping.ts` with:
   - `normalizeMcc()`
   - `EXACT_MCC_TO_MOAT_CATEGORY` (full table from this spec)
   - `RANGE_MCC_TO_MOAT_CATEGORY` (ordered range rules)
   - `categoryFromMerchantCategoryCode()`
2. Update `mapAppleFinanceKitCategory()` to:
   - Try MCC resolution when input is numeric (after normalization)
   - Fall back to legacy string enum map
   - Default to `Uncategorized`
3. Add unit tests for representative MCCs, range fallbacks, null input, legacy enum input, and non-numeric garbage.

**Acceptance criteria:** All test cases in Acceptance Criteria section pass.

### Phase 2 — Persist raw MCC in import metadata

1. In `bulkImportAppleFinanceKitTransactions`, when `rawCategory` is present, merge `{ merchantCategoryCode: normalizeMcc(rawCategory) }` into `Transaction.raw` on create/update.
2. Do not log raw MCC in error paths as PII-adjacent merchant data — structured logs may include `hasMcc: boolean` only.

**Acceptance criteria:** Re-imported transactions retain MCC in `raw` JSON for debugging.

### Phase 3 — Verification (manual)

1. Sync Apple Card transactions on a device with known merchants (restaurant, grocery, gas, home improvement).
2. Confirm categories in Transactions list and Spending summaries match expected Moat names.
3. Confirm a user rule still overrides MCC-derived category on re-sync.

## Acceptance Criteria

- [ ] `categoryFromMerchantCategoryCode("5812")` returns `"Eating Out"`
- [ ] `categoryFromMerchantCategoryCode("5411")` returns `"Groceries"`
- [ ] `categoryFromMerchantCategoryCode("5541")` returns `"Gas"`
- [ ] `categoryFromMerchantCategoryCode("5200")` returns `"Home"`
- [ ] `categoryFromMerchantCategoryCode("7011")` returns `"Travel"`
- [ ] `categoryFromMerchantCategoryCode("3001")` returns `"Flights"` (airline range)
- [ ] `categoryFromMerchantCategoryCode("6513")` returns `"Mortgage & Rent"`
- [ ] `categoryFromMerchantCategoryCode("5815")` returns `"Subscriptions"`
- [ ] `categoryFromMerchantCategoryCode("8220")` returns `"Education"`
- [ ] `categoryFromMerchantCategoryCode("0742")` returns `"Pets"`
- [ ] `categoryFromMerchantCategoryCode(null)` returns `"Uncategorized"`
- [ ] `seed.ts` includes `Subscriptions`, `Pets`, and `Education` global defaults
- [ ] Plaid `GENERAL_MERCHANDISE_PET_SUPPLIES` and `MEDICAL_VETERINARY_SERVICES` map to `"Pets"`
- [ ] `mapAppleFinanceKitCategory("RESTAURANTS")` still returns `"Eating Out"` (legacy compat)
- [ ] Imported Apple transactions with MCC receive non-Uncategorized categories when a mapping exists
- [ ] Imported Apple transactions without MCC receive `"Uncategorized"`
- [ ] `merchantCategoryCode` is stored in `Transaction.raw` when provided
- [ ] User-modified categories are not overwritten on re-import (existing guard preserved)
- [ ] `applyRulesToSyncedTransactions` still runs after import and can override MCC category
- [ ] No iOS changes required for v1 (rawCategory already populated)
- [ ] No Prisma **schema** migration required (seed-only category additions)

## Non-Goals

- iOS-side category resolution — mapping stays server-side to match Plaid pattern.
- Merchant-name / AI categorization fallback (future enhancement; rules engine covers power users).
- Remapping existing imported Apple transactions in bulk (one-time backfill is optional follow-up).
- Using `TransactionQuery.predicate(forMerchantCategoryCodes:)` for selective sync — continue syncing all transactions.
- Background FinanceKit delivery (iOS 26+) — out of scope per parent spec.

## Approved New Default Categories

Added 2026-07-07. These three categories are part of this feature — not optional follow-up.

| Category | sortOrder | MCCs | iOS icon | Web icon | Plaid update |
|----------|-----------|------|----------|----------|--------------|
| Subscriptions | 62 | 5815–5818, 5968 | `arrow.clockwise` | `Repeat` | None (no Plaid primary) |
| Pets | 82 | 0742, 5995 | `pawprint` | `PawPrint` | `GENERAL_MERCHANDISE_PET_SUPPLIES`, `MEDICAL_VETERINARY_SERVICES` → Pets |
| Education | 85 | 8211, 8220, 8241, 8244, 8249, 8299 | `graduationcap` | `GraduationCap` | None (no Plaid primary) |

**Kids icon change:** `graduationcap` moves from Kids to Education. Kids gets `figure.and.child.holdinghands` to better represent child care (MCCs 7295, 8351).

Categories intentionally **not** added: Personal Care, Beauty, Government — see prior analysis; existing mappings suffice.

## Open Questions

- **Backfill:** Should we run a one-time script to re-derive categories for existing `APPLE_FINANCEKIT` transactions that have `rawCategory` stored but were imported as Uncategorized? Deferred — not required for initial fix.
- **Credit card payments:** FinanceKit transfer MCCs (6532/6533) map to `Transfer`, not `Credit card payment`. Should we use `transactionType` in a future iOS payload to distinguish? Deferred.

## Related Specs

- [specs/complete/apple-wallet/spec.md](../complete/apple-wallet/spec.md) — parent FinanceKit integration (shipped)
- [apps/ios/AGENTS.md](../../apps/ios/AGENTS.md) — FinanceKit boundary rules
- [apps/api/AGENTS.md](../../apps/api/AGENTS.md) — service layer conventions
- Plaid mapping reference: `apps/api/src/server/plaid/mapping.ts`

## Suggested Commit Message

```text
docs (ios): adds education subscriptions pets categories
```
