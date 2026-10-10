# Plaid Balance Refresh Optimization

## Summary

Decoupled balance refresh from transaction sync to reduce unnecessary Plaid API calls on webhook-triggered syncs. Balance refreshes now only happen during:
1. Initial bank connection
2. Manual sync operations (user-initiated)
3. Reconnect flows
4. Explicit balance refresh calls

**Impact**: Significant reduction in Plaid API usage and costs, especially for accounts with frequent transaction updates.

## What Changed

### Before
Every `SYNC_UPDATES_AVAILABLE` webhook triggered:
1. Plaid `/transactions/sync` call (necessary)
2. Plaid `/accounts/get` call (unnecessary - only needed the account ID map)

### After
- **Webhook-triggered syncs**: Load account ID map from database (no Plaid API call)
- **Manual syncs**: Refresh balances via Plaid `/accounts/get` (user expects fresh data)
- **Initial connection**: Refresh balances via Plaid `/accounts/get` (establishing baseline)
- **Reconnect flows**: Refresh balances via Plaid `/accounts/get` (credentials just verified)

## Files Modified

1. **src/server/plaid/syncTransactions.ts**
   - Added `refreshBalances?: boolean` parameter to `syncTransactionsForItem()`
   - Added `loadAccountMapFromDatabase()` helper function
   - Added logging for balance refresh vs database lookup
   - Added warnings when transactions reference unknown account IDs

2. **src/server/plaid/service.ts**
   - Added `options?: { refreshBalances?: boolean }` parameter to `runSyncForItem()`
   - Updated `runWebhookSyncForItem()` to pass `refreshBalances: false`
   - Updated `runReconnectForItem()` to pass `refreshBalances: true`
   - Updated `exchangePublicTokenForItem()` to pass `refreshBalances: false` (accounts already synced in step 4)

3. **src/server/services/plaidSyncService.ts**
   - Updated `syncAllItemsForUser()` to pass `refreshBalances: true` for each item

4. **src/server/api/routers/plaid.ts**
   - Updated `syncItem` mutation to pass `refreshBalances: true`
   - Updated `syncItemNow` mutation to pass `refreshBalances: true`

## Edge Cases & Fallback Handling

### Edge Case 1: Account Added/Removed at Bank
**Scenario**: User adds or removes an account at their bank, webhook fires for new transactions.

**Behavior**:
- New transactions referencing unknown account IDs will have `plaidAccountId = null`
- Warning logged: `Transaction XXX references unknown account_id YYY - plaidAccountId will be null`
- Transactions are still imported successfully
- Next manual sync will refresh accounts and future transactions will link correctly

**Why this is safe**: Transactions don't require `plaidAccountId` to be valid - it's a convenience field for grouping/filtering. The transaction data is still complete and usable.

### Edge Case 2: No Active Accounts in Database
**Scenario**: All accounts were soft-deleted (isActive=false) or database is stale.

**Behavior**:
- Warning logged: `No active accounts found in DB for item XXX - transactions will have null plaidAccountId`
- Sync continues normally
- All transactions imported with `plaidAccountId = null`

**Why this is safe**: Same as Edge Case 1 - transactions are self-contained.

### Edge Case 3: Database Account Map Out of Sync
**Scenario**: Account metadata changed at bank (renamed, masked changed, etc.) but not yet synced.

**Behavior**:
- Transaction linking still works correctly (uses stable Plaid `account_id`)
- Account metadata (name, mask) may be stale until next manual sync
- Balances are stale but transactions are current

**Why this is safe**: The account ID mapping is stable - Plaid account IDs don't change. Only metadata and balances might be stale.

### Edge Case 4: Race Condition - Account Added During Webhook Processing
**Scenario**: User adds account via Plaid Link while a webhook is being processed.

**Behavior**:
- Advisory lock prevents concurrent modifications to the same item
- If webhook starts first: new account won't be in map, transactions get `plaidAccountId = null`
- If initial sync starts first: webhook waits for lock, sees new accounts in DB
- Next sync (manual or webhook) will link everything correctly

**Why this is safe**: Advisory lock prevents corruption. Worst case is temporary null foreign key, which resolves on next sync.

## Testing Recommendations

### Manual Testing Checklist
- [ ] Initial bank connection creates accounts and syncs transactions
- [ ] Webhook-triggered sync imports transactions without calling /accounts/get
- [ ] Manual sync button refreshes balances
- [ ] Sync all button refreshes balances for all items
- [ ] Reconnect flow refreshes balances
- [ ] Transactions link to correct accounts via plaidAccountId
- [ ] UI displays account balances correctly

### Monitoring
Watch for these log messages in production:
- `[plaid.sync] Refreshed N account balances for item XXX` (should only appear on manual syncs)
- `[plaid.sync] Loaded N account mappings from DB for item XXX` (should appear on webhook syncs)
- `[plaid.sync] Transaction XXX references unknown account_id YYY` (edge case - investigate if frequent)
- `[plaid.sync] No active accounts found in DB for item XXX` (edge case - investigate if frequent)

### Performance Expectations
- **Webhook processing time**: Reduced by ~200-500ms (no /accounts/get call)
- **Plaid API call volume**: Reduced by 50-90% depending on webhook frequency vs manual sync frequency
- **Cost impact**: Significant reduction in Plaid API costs

## Rollback Plan

If issues arise, revert by:

1. Set `refreshBalances: true` for all sync paths temporarily:
   ```typescript
   // In service.ts, change:
   refreshBalances: false  // to:
   refreshBalances: true
   ```

2. Or revert the entire change:
   ```bash
   git revert <commit-hash>
   ```

## Future Enhancements

Potential future optimizations:
1. **Scheduled balance refresh**: Add a daily cron job to refresh balances for all items
2. **Smart refresh**: Track `lastBalanceSyncAt` and only refresh if > 24 hours old
3. **Selective refresh**: Only refresh balances for items with recent transactions
4. **Balance-only webhook**: If Plaid adds balance change webhooks, use those instead of polling

## Related Documentation

- [Plaid Transactions Sync Implementation](./plaid-transactions-sync.md)
- [Plaid Usage-Based Billing](./plaid-integration-usage-based-billing.md)
