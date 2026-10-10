Implement Apple Wallet / Apple Card sync in apps/ios using Apple FinanceKit.

Context:
- This repo is Moat Finance, a personal finance app.
- apps/ios already exists and has app/auth/API functionality built out.
- The goal is to let iOS users connect Apple Wallet financial accounts, especially Apple Card, Apple Cash, and Savings, then sync balances + transactions into Moat Finance.
- This is NOT Plaid. This should be treated as a separate integration source: APPLE_FINANCEKIT.
- FinanceKit requires iOS 17.4+ in the US for Apple Card / Apple Cash / Savings.
- Apple requires an organization-level Apple Developer account, the FinanceKit managed entitlement, and NSFinancialDataUsageDescription in Info.plist.

Important Apple requirements:
- Add FinanceKit framework usage.
- Add the managed entitlement:
  com.apple.developer.financekit = true
- Add Info.plist usage description:
  NSFinancialDataUsageDescription = "Moat Finance uses your Wallet financial data to import accounts, balances, and transactions into your financial dashboard."
- Guard all FinanceKit code behind iOS availability checks.
- If FinanceKit is unavailable, show a clear unsupported state.

Build the feature in phases.

Phase 1: iOS FinanceKit foundation
1. Create an AppleFinanceKitService responsible for:
   - checking FinanceKit availability
   - requesting/refreshing user authorization
   - listing eligible Wallet financial accounts
   - reading balances
   - reading transactions for a selected date range
2. Keep all raw FinanceKit types inside the iOS layer.
3. Normalize FinanceKit data into app-owned DTOs:
   - ExternalAccountDTO
   - ExternalBalanceDTO
   - ExternalTransactionDTO
4. Include stable external IDs where possible so the backend can dedupe.

Phase 2: UI flow
Create a native iOS “Connect Apple Wallet” flow:
1. Entry point from Accounts / Connected Institutions.
2. Explain:
   - Apple Card connects through Apple Wallet, not Plaid.
   - User controls which accounts and date ranges are shared.
   - Data comes from on-device Wallet data.
3. Button: “Connect Apple Wallet”
4. Trigger FinanceKit authorization UI.
5. After authorization:
   - show available accounts
   - allow user to select accounts
   - run initial sync
6. Show sync states:
   - unsupported device/iOS
   - permission denied
   - no eligible Wallet accounts
   - syncing
   - success
   - failure with retry

Phase 3: API contract
Add or reuse API endpoints for non-Plaid imported accounts.

Create endpoints similar to:

POST /integrations/apple-financekit/accounts
- Upserts Apple Wallet accounts.
- Body:
  - source: "APPLE_FINANCEKIT"
  - externalAccountId
  - displayName
  - institutionName: "Apple Wallet"
  - accountType
  - accountSubtype
  - currency
  - currentBalance
  - availableBalance
  - lastSyncedAt

POST /integrations/apple-financekit/transactions/bulk
- Bulk upserts transactions.
- Body:
  - accountExternalId
  - transactions[]
    - externalTransactionId
    - date
    - authorizedDate?
    - amount
    - currency
    - merchantName?
    - description
    - pending
    - category?
    - rawSourceData?

Backend requirements:
- Add APPLE_FINANCEKIT as a transaction/account source enum.
- Do not assume every synced account has a Plaid item.
- Dedupe transactions by userId + source + externalTransactionId.
- Dedupe accounts by userId + source + externalAccountId.
- Store enough raw metadata for debugging, but avoid storing unnecessary sensitive fields.
- Apply existing categorization/rules pipeline after Apple transactions are imported.
- Ensure Apple FinanceKit transactions appear everywhere normal transactions appear.

Phase 4: Sync behavior
1. Initial sync:
   - Pull transactions for a reasonable default range, ideally last 12-24 months if available/authorized.
2. Manual refresh:
   - Add “Sync now” for Apple Wallet accounts.
3. Incremental sync:
   - Use FinanceKit's change stream (`transactionHistory(forAccountID:since:)`) with a persisted `HistoryToken`, not a `lastSyncedAt` date window. The token yields inserted/updated/deleted diffs directly.
   - Keep the bounded 365-day snapshot only as a first-sync and token-invalidation fallback.
4. Deduplication must make repeated syncs safe.
5. Automatic sync:
   - Foreground staleness sync on iOS 17.4+, plus iOS 26 background delivery. There is no server-side path — see [specs/features/apple-wallet-background-sync/spec.md](../specs/features/apple-wallet-background-sync/spec.md).

Phase 5: Product polish
- In the web app, if user tries to add Apple Card, explain:
  “Apple Card connects through the Moat Finance iOS app using Apple Wallet.”
- Add account source badges:
  - Plaid
  - Apple Wallet
  - Manual
- Add observability logs around:
  - authorization start/success/failure
  - account count
  - transaction count
  - API sync success/failure
- Never log full transaction descriptions or raw financial payloads in production logs.

Deliverables:
1. iOS FinanceKit service.
2. iOS connect/sync UI.
3. API endpoints and schema changes.
4. Prisma migration if needed.
5. Transaction/account normalization.
6. Safe dedupe behavior.
7. Basic tests for backend upsert/dedupe.
8. Graceful unsupported-state UX.

Do not build a Plaid workaround for Apple Card. This is a first-class Apple FinanceKit integration.