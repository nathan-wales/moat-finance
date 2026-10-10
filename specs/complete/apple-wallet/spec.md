# Spec: Apple Wallet Integration via FinanceKit

## Goal

Let eligible iOS users sync supported Wallet financial accounts, including Apple Card, Apple Cash, and Savings with Apple where available, into Moat Finance via Apple FinanceKit, so their complete financial picture is available alongside Plaid/MX-connected accounts.

This should be implemented as a native iOS integration. FinanceKit data should be normalized into Fin’s existing account, balance, transaction, categorization, and dashboard systems without leaking Apple-specific framework types throughout the app.

---

## Context / Why now

Apple Card is not reliably available through Plaid/MX-style financial aggregators, so FinanceKit is the Apple-native path for importing supported Wallet financial data with explicit user consent.

Users with Apple Card, Apple Cash, or Savings with Apple currently have a gap in their Moat Finance dashboard. FinanceKit makes it possible for eligible financial apps to request permission and import supported Wallet financial data directly on iOS.

For v1, this integration should target eligible iOS users with Apple Card, Apple Cash, and/or Savings with Apple where FinanceKit is available. Do not design this as a generic Plaid item clone; Apple Wallet / FinanceKit should be treated as a distinct integration source.

---

## Scope

### In scope

* iOS FinanceKit service layer:

  * FinanceKit availability check
  * Authorization status check
  * Authorization request
  * Account listing
  * Balance reading
  * Transaction reading / transaction history
* Normalization into app-owned DTOs
* UI flow:

  * Connect Apple Wallet entry point
  * Explanation / consent screen
  * FinanceKit authorization
  * Account selection
  * Initial user-initiated sync
  * Sync states and retry
* API endpoints for:

  * Upserting Apple Wallet accounts
  * Bulk-importing Apple Wallet transactions
* `APPLE_FINANCEKIT` as a distinct integration source in Prisma/schema/model layer
* Deduplication for Apple Wallet accounts and transactions
* Applying existing categorization/rules pipeline to imported Apple transactions
* Permission denied / revoked handling
* Apple Wallet disconnect handling
* Imported Apple transactions should appear anywhere normal transactions appear:

  * Dashboard
  * Transactions list
  * Spending summaries
  * Budgets
  * Cash flow
  * Net worth/account views
  * Rules/categorization
  * Exports, if applicable

### Out of scope for v1

* Background sync
* Web-side Apple Wallet connection flow
* Non-iOS connection flow
* Full international FinanceKit/open-banking coverage
* Building a completely separate categorization pipeline for Apple transactions
* Treating Apple Wallet accounts as Plaid items

---

## iOS requirements

* Use Apple’s `FinanceKit` framework.
* Requires Apple-managed entitlement:

  * `com.apple.developer.financekit`
* This entitlement must be approved by Apple and included in the app’s provisioning profile before the integration can work.
* Add Info.plist financial data usage copy:

  * `NSFinancialDataUsageDescription`
  * Suggested copy: `Moat Finance uses your Wallet financial data to import accounts, balances, and transactions into your financial dashboard.`
* All FinanceKit code must be guarded with availability checks:

  * `@available(iOS 17.4, *)`
* Show a clear unsupported state on iOS versions that do not support the required FinanceKit APIs.
* FinanceKit code should be isolated to a native iOS service layer and should not leak raw FinanceKit framework types across the app.

---

## Architecture

Recommended iOS architecture:

```text
AppleFinanceKitService
  → AppleFinanceKitNormalizer
  → AppleFinanceKitSyncService
  → Moat Finance API endpoints
  → Backend import/upsert/categorization pipeline
```

### `AppleFinanceKitService`

Responsibilities:

* Check whether FinanceKit is available on the current device/iOS version.
* Check current FinanceKit authorization status.
* Request user authorization only after the user taps the connect CTA.
* List eligible Wallet financial accounts.
* Read balances for selected accounts.
* Read transactions for selected accounts/date ranges.
* Return clear, typed errors for:

  * Unsupported iOS version
  * FinanceKit unavailable
  * Permission denied
  * Permission revoked
  * No eligible accounts
  * Sync failure

Implementation notes:

* Prefer direct account listing with FinanceKit account query APIs where available, such as `FinanceStore.accounts(query:)`.
* Use transaction/history APIs for transaction import and/or incremental sync.
* Do not assume Plaid-style item/account structure.
* Do not expose raw FinanceKit types outside this service/normalizer boundary.

### `AppleFinanceKitNormalizer`

Responsibilities:

Normalize raw FinanceKit values into Moat Finance-owned DTOs:

```ts
type ExternalAccountDTO = {
  source: "APPLE_FINANCEKIT";
  externalAccountId: string;
  displayName: string;
  institutionName: "Apple Wallet";
  accountType: "credit" | "depository" | "investment" | "other";
  accountSubtype: string;
  currency: string;
};

type ExternalBalanceDTO = {
  source: "APPLE_FINANCEKIT";
  externalAccountId: string;
  currentBalance: number | null;
  availableBalance: number | null;
  currency: string;
  asOf: string;
};

type ExternalTransactionDTO = {
  source: "APPLE_FINANCEKIT";
  externalTransactionId: string;
  externalAccountId: string;
  date: string;
  authorizedDate?: string | null;
  amount: number;
  currency: string;
  merchantName?: string | null;
  description: string;
  pending: boolean;
  category?: string | null;
  rawCategory?: string | null;
  metadata?: Record<string, unknown>;
};
```

Adjust the DTO shapes to match the existing codebase, but keep the boundary principle: Apple/FinanceKit-specific types should be normalized before touching shared app or backend logic.

### `AppleFinanceKitSyncService`

Responsibilities:

* Coordinate authorization state.
* Fetch accounts.
* Let the user select accounts.
* Fetch balances and transactions.
* Call backend import endpoints.
* Handle partial failures.
* Surface sync progress/state to the UI.
* Avoid duplicate imports.
* Store/update last synced timestamp after successful sync.

---

## Connect Apple Wallet flow

Entry point:

```text
Accounts → Connected Institutions → Connect Apple Wallet
```

Flow:

1. Show explanation screen:

   * Moat Finance can import supported Wallet financial accounts.
   * Data may include account names, balances, and transactions.
   * Access requires the user’s explicit permission.
   * User can revoke access later.
   * Data will be used only to power their personal finance dashboard and related financial management features.

2. User taps:

```text
Connect Apple Wallet
```

3. App checks:

   * iOS version support
   * FinanceKit availability
   * Current authorization status

4. App requests FinanceKit authorization.

5. After authorization:

   * Fetch eligible accounts.
   * If no accounts are found, show no-eligible-accounts state.
   * If accounts are found, show selectable account list.

6. User selects accounts to import.

7. App runs initial sync:

   * Upsert selected accounts.
   * Upsert balances.
   * Bulk-import transactions for selected date range.
   * Apply categorization/rules pipeline.
   * Update last synced timestamp.

8. Show result:

   * Success
   * Partial success
   * Failure with retry
   * Permission denied
   * Permission revoked
   * Unsupported device/iOS

---

## UI states

The UI should support these states:

* `unsupported`

  * Device/iOS version does not support required FinanceKit APIs.

* `notAvailable`

  * FinanceKit is unavailable even though the OS version appears supported.

* `notStarted`

  * User has not started connection.

* `explaining`

  * App is explaining what will be shared and why.

* `requestingPermission`

  * FinanceKit authorization request is active.

* `permissionDenied`

  * User denied access.

* `permissionRevoked`

  * User previously granted access but revoked it.

* `noEligibleAccounts`

  * Authorization succeeded, but no eligible Wallet financial accounts are available.

* `selectingAccounts`

  * User is choosing which accounts to import.

* `syncing`

  * Initial sync is running.

* `partialFailure`

  * Some accounts or transactions imported, but some failed.

* `success`

  * Initial import completed.

* `failure`

  * Sync failed and user can retry.

---

## API endpoints

Use endpoint style consistent with the existing app. These are proposed REST-style endpoints; adapt to tRPC/server actions/etc. if that is the current backend pattern.

### Upsert Apple Wallet account

```http
POST /integrations/apple-financekit/accounts
```

Request body:

```json
{
  "source": "APPLE_FINANCEKIT",
  "externalAccountId": "apple_account_id_here",
  "displayName": "Apple Card",
  "institutionName": "Apple Wallet",
  "accountType": "credit",
  "accountSubtype": "credit_card",
  "currency": "USD",
  "currentBalance": 1234.56,
  "availableBalance": 5000.0,
  "lastSyncedAt": "2026-05-25T00:00:00Z"
}
```

Behavior:

* Authenticated user only.
* Upsert by:

  * `userId + source + externalAccountId`
* Should not create duplicate accounts.
* Should update:

  * Display name
  * Balance fields
  * Currency
  * Last synced timestamp
  * Connection status

### Bulk upsert Apple Wallet transactions

```http
POST /integrations/apple-financekit/transactions/bulk
```

Request body:

```json
{
  "source": "APPLE_FINANCEKIT",
  "externalAccountId": "apple_account_id_here",
  "transactions": [
    {
      "externalTransactionId": "apple_transaction_id_here",
      "date": "2026-05-25",
      "authorizedDate": "2026-05-24",
      "amount": -42.18,
      "currency": "USD",
      "merchantName": "Target",
      "description": "Target",
      "pending": false,
      "category": null,
      "rawCategory": null,
      "metadata": {}
    }
  ]
}
```

Behavior:

* Authenticated user only.
* Validate the account belongs to the authenticated user.
* Deduplicate transactions by:

  * `userId + source + externalTransactionId`
* If FinanceKit provides a stable transaction identifier, use that as `externalTransactionId`.
* If a transaction is pending and later posts, update the existing transaction rather than creating a duplicate where possible.
* Imported transactions should run through the existing categorization/rules pipeline.
* Imported transactions should appear everywhere normal transactions appear.

---

## Backend data model changes

### Integration source enum

Add a distinct source value:

```prisma
APPLE_FINANCEKIT
```

Use this anywhere the app currently distinguishes transaction/account source values such as Plaid/MX/manual/etc.

### Account deduplication

Apple Wallet accounts should be unique by:

```text
userId + source + externalAccountId
```

### Transaction deduplication

Apple Wallet transactions should be unique by:

```text
userId + source + externalTransactionId
```

If the current schema does not support these unique constraints cleanly, propose the safest schema migration.

### Account model expectations

Apple Wallet accounts should support:

* External account ID
* Source = `APPLE_FINANCEKIT`
* Display name
* Institution name = `Apple Wallet`
* Account type
* Account subtype
* Currency
* Current balance
* Available balance, if available
* Connection/sync status
* Last synced timestamp
* Optional raw metadata, minimized

### Transaction model expectations

Apple Wallet transactions should support:

* External transaction ID
* External account ID / internal account relation
* Source = `APPLE_FINANCEKIT`
* Date
* Authorized date, if available
* Amount
* Currency
* Merchant name
* Description
* Pending status
* Category / raw category
* Metadata, minimized
* Categorization/rules output

---

## Categorization and rules

Apple Wallet transactions should use the same pipeline as Plaid/MX transactions after normalization.

Requirements:

* Existing user rules should apply to Apple transactions where relevant.
* Apple transactions should appear in existing spending category summaries.
* Apple transactions should appear in budgets.
* Apple transactions should affect cash flow, net worth, account balances, and dashboard metrics as appropriate.
* Do not create a separate Apple-only categorization system unless necessary.
* If Apple category fields differ from Plaid/MX, map them into the app’s internal category system at the normalizer or import layer.

---

## Privacy and security requirements

FinanceKit data is highly sensitive financial data. The implementation must follow these rules:

* Request access only after a clear user action.
* Explain what data will be accessed and why before showing the system prompt.
* Use FinanceKit data only for user-facing personal finance features.
* Do not sell FinanceKit data.
* Do not use FinanceKit data for advertising.
* Do not share FinanceKit data with unrelated third parties.
* Do not store raw FinanceKit framework objects directly.
* Persist only the fields required for product functionality.
* Avoid storing sensitive raw metadata unless needed for debugging or reconciliation.
* If raw metadata is stored, minimize it and ensure it follows existing encryption/retention policies.
* Imported Apple Wallet data should follow the same security, export, and deletion policies as other connected financial data.
* Handle permission revocation gracefully.
* Provide a disconnect path for Apple Wallet accounts.
* Clearly define what disconnect does:

  * Stops future syncs.
  * Optionally lets the user choose whether to keep or delete previously imported data, depending on existing product behavior.
* Never sync Apple Wallet data in the background for v1.

---

## Disconnect behavior

Add a disconnect/manage flow for Apple Wallet accounts.

Minimum v1 behavior:

* User can disconnect Apple Wallet from Moat Finance.
* App stops future user-initiated sync attempts unless the user reconnects.
* Account connection status changes to disconnected.
* UI clearly explains whether previously imported transactions remain or are deleted.
* If the app already has a standard delete-connected-account flow, Apple Wallet should use the same pattern where possible.
* If FinanceKit authorization has been revoked outside the app, show a clear reconnect or permission-revoked state.

---

## Error handling

Handle at least:

* Unsupported iOS version
* Missing entitlement / provisioning issue
* FinanceKit unavailable
* Authorization denied
* Authorization revoked
* No eligible accounts
* Account fetch failed
* Balance fetch failed
* Transaction fetch failed
* Backend account upsert failed
* Backend transaction import failed
* Partial import failure
* Duplicate transaction/account conflicts
* Network failure
* User cancels flow

Do not crash on any FinanceKit failure. Return typed errors from the FinanceKit service layer and map those errors to clear UI states.

---

## Sync strategy for v1

Use user-initiated sync only.

Initial sync:

* After authorization and account selection, fetch selected accounts, balances, and transactions.
* Use a reasonable default transaction lookback period based on existing product expectations.
* Do not import unlimited history without a product decision.
* Store `lastSyncedAt` after successful import.
* Support retry if initial sync fails.

Manual resync:

* Allow user to manually trigger Apple Wallet sync from the connected account/institution screen.
* Rate-limit if needed to prevent repeated accidental sync attempts.
* Use `lastSyncedAt` or a similar cursor/date strategy to avoid re-importing unnecessary history.
* Still rely on transaction deduplication as a safety net.

Background sync:

* Out of scope for v1.
* Do not implement until product/security behavior is defined and FinanceKit background behavior is fully verified.
* **Superseded.** Automatic sync now exists — see [specs/features/apple-wallet-background-sync/spec.md](../../features/apple-wallet-background-sync/spec.md) for foreground staleness sync, incremental history-token deltas, and the remaining iOS 26 background delivery work.

---

## Acceptance criteria

* [ ] Apple-managed FinanceKit entitlement is present in the app’s provisioning profile before testing real integration.
* [ ] `NSFinancialDataUsageDescription` is present with clear user-facing copy.
* [ ] All FinanceKit code is guarded with `@available(iOS 17.4, *)` or equivalent availability checks.
* [ ] Unsupported iOS versions show a clear unsupported state.
* [ ] App checks current authorization status before requesting access where appropriate.
* [ ] App calls FinanceKit authorization request only after user taps the connect CTA.
* [ ] Authorization system prompt is shown and result is handled correctly.
* [ ] Permission denied state is handled without crashing.
* [ ] Permission revoked state is handled without crashing.
* [ ] Account list returns eligible Apple Wallet financial accounts when available.
* [ ] No eligible accounts state is handled clearly.
* [ ] User can select which Apple Wallet accounts to import.
* [ ] Initial sync imports selected accounts correctly.
* [ ] Initial sync imports balances correctly.
* [ ] Initial sync imports transactions correctly.
* [ ] Imported Apple transactions appear in Moat Finance transaction list alongside Plaid/MX transactions.
* [ ] Imported Apple transactions appear in dashboard/spending/cash-flow views as expected.
* [ ] Existing categorization/rules pipeline applies to imported Apple transactions.
* [ ] `APPLE_FINANCEKIT` is added as a distinct integration source in the backend/schema.
* [ ] Account upsert deduplicates by `userId + source + externalAccountId`.
* [ ] Transaction bulk upsert deduplicates by `userId + source + externalTransactionId`.
* [ ] Pending/posted transaction behavior avoids obvious duplicates where possible.
* [ ] FinanceKit framework types do not leak outside the iOS FinanceKit service/normalizer layer.
* [ ] Raw FinanceKit objects are not stored directly.
* [ ] App provides a disconnect/manage path for Apple Wallet accounts.
* [ ] Imported data is not sold, used for ads, or shared for unrelated purposes.
* [ ] Partial sync failure is handled with a useful retry path.
* [ ] Backend validates authenticated ownership of all imported accounts/transactions.
* [ ] Manual resync works after initial connection.
* [ ] TestFlight build can be signed with the FinanceKit entitlement once Apple approves it.

---

## Tech notes

* `APPLE_FINANCEKIT` is a separate integration source from Plaid/MX.
* Do not assume Plaid item structure.
* FinanceKit data should be normalized at the iOS boundary.
* Use stable FinanceKit-provided account/transaction identifiers when available.
* Store enough metadata for debugging/reconciliation, but avoid storing sensitive raw fields unnecessarily.
* Keep v1 sync user-initiated.
* Keep background sync out of v1.
* Reuse existing backend import, categorization, rules, and dashboard systems wherever possible.
* Follow existing app architecture and naming conventions.
* If the app uses tRPC/server actions instead of REST endpoints, implement equivalent mutations rather than adding REST routes unnecessarily.
* Include tests for normalization, deduplication, and backend ownership validation.

---

## Open questions for implementation research

Please inspect the current repo and answer these before coding:

1. What is the current account/source enum structure?
2. What is the current transaction/source enum structure?
3. Are Plaid and MX represented as separate sources today?
4. What unique constraints currently exist for external accounts and transactions?
5. Is there already a generic external account import/upsert path we should reuse?
6. Is there already a generic transaction bulk import path we should reuse?
7. Where does the categorization/rules pipeline currently run?
8. How are pending transactions handled today?
9. What is the current connected institution/account management UI?
10. Is there already a disconnect/delete connected account flow?
11. What is the iOS app architecture for native services?
12. Is the app SwiftUI, React Native, Capacitor, Expo, or another architecture?
13. Where should the FinanceKit entitlement and Info.plist changes live?
14. What is the best initial transaction lookback period based on existing product behavior?
15. What is the safest schema migration path for adding `APPLE_FINANCEKIT`?
16. What tests already exist for connected account imports?
17. What tests should be added for Apple Wallet imports?
18. What should happen to previously imported Apple Wallet data when the user disconnects?

---

## Deliverables

Please produce:

1. A short implementation plan based on the current repo.
2. The required schema/model changes.
3. The iOS FinanceKit service layer.
4. The normalizer layer.
5. The Apple Wallet sync service.
6. The connect/manage Apple Wallet UI.
7. Backend account upsert mutation/endpoint.
8. Backend transaction bulk upsert mutation/endpoint.
9. Integration with the existing categorization/rules pipeline.
10. Disconnect/revocation handling.
11. Tests for:
    * Availability handling
    * Authorization states
    * Normalization
    * Account deduplication
    * Transaction deduplication
    * Ownership validation
    * Categorization pipeline integration
12. Notes on any Apple entitlement/provisioning steps that cannot be completed in code.
