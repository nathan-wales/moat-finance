## Context

Web and desktop share the same mapping, rules, pairing, and visibility logic. They diverge on **where the work runs** (API/Postgres vs Electron/SQLite) and **how the rest of the year arrives** (webhooks vs polling).

---

### Golden path (first connect, success)

1. **User opens Plaid Link** after the app creates a link token (Transactions required, 365 days of history requested, Investments optional so transaction-only banks still appear). Desktop shows a privacy notice first; web launches Link directly.
2. **User authenticates at the bank and picks accounts**, then Plaid returns a short-lived `public_token` plus institution/account metadata.
3. **The app exchanges that token for an access token** and upserts a `PlaidItem` (encrypted token, institution id/name). Web does this in the API (`exchangePublicTokenForItem`); desktop does it in the Electron main process (`connectItem`) against local SQLite.
4. **Already-linked / reconnect matching runs** so a second live Item is not created for the same bank accounts: collapse live duplicates, skip accounts already on a sibling Item, and adopt previously revoked account rows so history stays attached.
5. **Accounts and balances are written** from `/accounts/get` into `PlaidAccount` rows (name, mask, type, subtype, current/available balance). Accounts with `syncEnabled: false` stay out of the transaction map.
6. **Web creates a `FinancialConnection` / `FinancialAccount` identity** for the Item so later webhooks and provider sync can find it; desktop skips this cloud connection model. Both persist which Plaid products the Item actually has.
7. **The first `/transactions/sync` runs with a null cursor.** Plaid typically returns ~30 recent days on this first pass, not the full year yet. Web runs this inside the token-exchange API call; desktop returns from exchange first, then the UI awaits `syncItem`.
8. **Every page is fetched before any writes**, then rows are upserted in chunks keyed by `(userId, Plaid transaction_id)`. Removed ids are soft-deleted (`removedAt`); reconnect overlap watermarks skip re-importing history the user already has.
9. **Each new row is categorized from Plaid Personal Finance Category v2** into a Moat category (for example `FOOD_AND_DRINK_GROCERIES` → Groceries, `TRANSFER_OUT` → Transfer). Existing user-set categories are not overwritten.
10. **Active user rules run on the synced ids** and may change category, description, type, or hashtags after the Plaid seed category is already stored.
11. **Transfer pairing matches opposite-direction, equal-amount legs** (Transfer / credit-card payment, within a 5-day window), hides them (`hidden` + `autoHiddenAsTransfer`), and un-hides auto-hidden pairs that no longer match.
12. **Web takes a net-worth snapshot and records account-balance history** from the synced balances. Loans/mortgages default out of net worth; credit/loan balances count as liabilities. Desktop records local balance history on later scheduled syncs.
13. **The rest of the 365-day window arrives asynchronously.** Web: Plaid webhooks (`INITIAL_UPDATE`, `HISTORICAL_UPDATE`, `SYNC_UPDATES_AVAILABLE`) re-run the same sync engine, while the overlay polls until Plaid reports `HISTORICAL_UPDATE_COMPLETE` and any leftover pages are drained. Desktop has no webhooks, so it retries “product not ready,” then polls `/transactions/sync` with backoff until catch-up adds stop.
14. **The UI unblocks once accounts exist and historical import is treated as complete** (or the overlay times out). React Query caches are invalidated so financial profile, transactions, and investments refetch.
15. **Transactions become visible through query-time filters**, not a later pipeline step: the list includes hidden transfer rows (grayed); spending/budget/cash-flow exclude hidden and `removedAt` rows; hidden categories stay out; hidden/`syncEnabled: false` accounts stay off the profile and out of net worth.

---

### What differs (web vs desktop)

| Step | Web | Desktop |
|------|-----|---------|
| After Link success | One API call: exchange + accounts + first transaction sync | Exchange + accounts only, then a separate `syncItem` |
| Rest of the year | Plaid webhooks + `getImportStatus` probe | Local polling / retry (`catchUpHistoricalTransactions`) |
| Database | Postgres via `apps/api` | SQLite in the Electron main process |
| Ongoing updates | Webhooks | 30-minute scheduler |
| Holdings | Not part of the first exchange; later connection sync | `syncItem` also tries investment holdings after transactions |
| Link token | Attaches the API webhook URL | No webhook (desktop cannot receive Plaid callbacks) |

There is no standalone “reconciliation” or “deduplication” job after sync. Dedupe is the unique Plaid id plus reconnect watermarks during upsert; the closest “reconcile” work is already-linked account matching and transfer-pair cleanup.

## The Plan

Yes. With this architecture, I’d change the testing strategy slightly: don’t build one giant Plaid E2E. Build one canonical “Golden Ledger” scenario and run it through both execution environments. The shared logic should end in the same normalized financial state even though web and desktop get there differently.
The key distinction I’d make is:
deterministic full-app E2E on every PR → mock only the Plaid network boundaryreal Plaid Sandbox E2E nightly/pre-release → prove your adapter still works against Plaid itself
Trying to make Plaid Sandbox responsible for every edge case will eventually make the suite flaky and hard to control.
The Golden Ledger
I’d create one version-controlled financial history specifically designed to exercise your entire pipeline.
Something roughly like:
const goldenLedger = {
  accounts: [
    "checking",
    "savings",
    "creditCard",
    "disabledChecking",
  ],

  initialSync: {
    // roughly recent 30 days
  },

  historicalSync: {
    // remaining ~335 days
  },

  laterSync: {
    added: [],
    modified: [],
    removed: [],
  },
};
Make the data deliberately adversarial:
Case	Expected behavior
Costco purchase	Groceries from Plaid PFC
Rule matching Costco	Rule overrides seed category
User-custom category already present	Rule/Plaid does not incorrectly overwrite it
Checking → savings $1,000	Both stored, paired, auto-hidden
Checking → credit card $2,000	Both stored, paired, auto-hidden
Transfer legs 4 days apart	Still paired
Transfer legs 6 days apart	Not paired
Two real Starbucks purchases, same amount/date	Both survive
Pending → posted/update	One logical transaction
Modified transaction	Existing row updated
Removed transaction	removedAt populated
Transaction from disabled account	Correctly excluded
Reconnect overlap	Old history not duplicated
Duplicate sync page	Idempotent
Duplicate webhook	Idempotent
Same rule applied twice	Same final state
Previously paired transfer changes	Pair removed + auto-hidden rows unhidden
Then create an explicit final expected state:
goldenLedgerExpectedState
That expected state should contain the actual normalized rows, not just counts.

The E2E I would run on every PR
I’d make this the required test.
1. Start from absolutely nothing
For web:
fresh Postgres schema
fresh test user
no PlaidItems
no FinancialConnections
no transactions
For desktop:
fresh Electron profile
fresh SQLite DB
fresh test user
Use Playwright for web and Playwright's Electron support for desktop.
2. Exercise the UI up to the Plaid boundary
Web:
Login
→ Accounts
→ Add Account
→ Plaid flow begins
Desktop:
Launch Electron
→ Accounts
→ Add Account
→ privacy notice appears
→ continue
→ Plaid flow begins
I would assert the privacy-notice difference here.
Then do not automate Plaid Link in the blocking test.
Have a test-only provider adapter return:
{
  publicToken: "golden-public-token",
  institution: ...,
  accounts: ...
}
From that point onward, production code runs unchanged.
This is an important boundary:
TEST CONTROLLED
Plaid HTTP responses
        │
        ▼
PRODUCTION CODE
exchange
accounts
sync
mapping
rules
pairing
visibility
queries
UI
You aren't mocking applyRules(), syncTransactions(), Prisma, SQLite, React Query, IPC, etc.
You're mocking Plaid's server.
That makes the test deterministic while exercising basically everything Moat owns.

Web Golden E2E
I would make the web scenario explicitly follow your actual architecture:
Playwright clicks Connect
        ↓
test Plaid adapter returns public_token
        ↓
exchangePublicTokenForItem()
        ↓
PlaidItem created
        ↓
already-linked matching
        ↓
accounts/get
        ↓
PlaidAccount upserts
        ↓
FinancialConnection/FinancialAccount
        ↓
transactions/sync(null)
        ↓
PAGE 1
PAGE 2
PAGE 3
        ↓
ALL pages collected
        ↓
writes begin
        ↓
PFC mapping
        ↓
rules
        ↓
transfer pairing
        ↓
net worth snapshot
        ↓
balance history
Then stop.
Assert the intermediate state.
That's important because otherwise a later historical update can accidentally hide bugs in the initial sync.
For example:
expect(initialState.transactions).toHaveLength(37);

expect(costco.category).toBe("Groceries");

expect(transfer.hidden).toBe(true);
expect(transfer.autoHiddenAsTransfer).toBe(true);

expect(disabledAccount.syncEnabled).toBe(false);

expect(financialConnection).toExist();
And assert the UI still behaves properly while the historical import is incomplete.

Then simulate the historical phase
Your mocked Plaid adapter now changes state:
INITIAL
→ HISTORICAL AVAILABLE
Trigger your actual webhook route, rather than calling the synchronization function directly.
Something like:
await request.post("/api/plaid/webhook", {
  data: historicalWebhook,
});
That should invoke:
webhook route
→ Item lookup
→ sync engine
→ cursor
→ historical pages
→ mapping
→ rules
→ pairing
Meanwhile Playwright should be sitting on the same import overlay the user sees.
Then:
overlay polls getImportStatus
→ historical complete
→ query invalidation
→ overlay disappears
Now assert the final UI.
That tests an important piece you didn't have in the earlier architecture:
Does the browser correctly discover that the server-side asynchronous import finished?

Desktop runs the exact same ledger differently
This is where your new architecture makes the test especially valuable.
Start with the exact same fixture.
But the expected sequence becomes:
Plaid success
       ↓
connectItem()
       ↓
accounts written
       ↓
exchange returns
       ↓
renderer invokes syncItem()
       ↓
initial ~30 days
       ↓
catchUpHistoricalTransactions()
       ↓
poll
       ↓
poll
       ↓
historical additions
       ↓
poll
       ↓
0 additions / completion condition
No fake webhook.
Your Plaid test adapter should return successive responses based on the number of calls:
syncCall #1 → recent data
syncCall #2 → product not ready
syncCall #3 → historical page 1
syncCall #4 → historical page 2
syncCall #5 → no additional catch-up
Now you're specifically testing your desktop backoff/catch-up mechanism.
At the end:
expect(await dumpWebNormalizedState())
  .toEqual(await dumpDesktopNormalizedState());
That is probably the single strongest regression test I'd add to Moat.
Because the requirement isn't really:
"Did desktop execute exactly the same functions?"
It's:
"Given identical financial data and identical user rules, do web and desktop produce identical financial meaning?"

Create a normalized-state snapshot
Don't compare raw Prisma rows against raw SQLite rows because implementation-specific metadata will differ.
Have each platform expose a test-only function:
getNormalizedFinancialState()
returning something like:
type NormalizedFinancialState = {
  accounts: Array<{
    providerAccountId: string;
    syncEnabled: boolean;
    currentBalance: number;
    availableBalance: number | null;
  }>;

  transactions: Array<{
    providerTransactionId: string;
    accountId: string;
    amount: number;
    date: string;

    category: string;
    description: string;
    type: string;

    hidden: boolean;
    autoHiddenAsTransfer: boolean;
    removed: boolean;

    transferPairId: string | null;

    hashtags: string[];
  }>;

  aggregates: {
    spending: number;
    income: number;
    transfers: number;
    netWorth: number;
  };
};
Sort every array deterministically and snapshot it.
Then:
expect(webState).toEqual(goldenExpectedState);
expect(desktopState).toEqual(goldenExpectedState);
Not merely:
expect(webState).toEqual(desktopState);
because both platforms could have the same bug.
You want:
WEB ────────┐
            ├── equals GOLDEN TRUTH
DESKTOP ────┘

I would also add a "second pass"
Once the golden import is completely finished, do the whole synchronization process again without changing Plaid.
Expected result:
transactions before = 347
transactions after  = 347

rules before = X
rules after  = X

paired transfers before = Y
paired transfers after  = Y

net spending before = Z
net spending after  = Z
Then replay the same historical webhook on web.
Then run the desktop polling loop again.
Nothing should change.
That catches idempotency regressions extremely effectively.

Then mutate the provider
Now make the fake provider's next /transactions/sync produce:
{
  added: [newTransaction],
  modified: [changedTransfer],
  removed: ["oldTransactionId"],
}
This is another E2E phase rather than another test environment.
The interesting one is the transfer change.
Imagine:
Checking: -$2,000
Card:      +$2,000
were paired.
Plaid later changes one amount:
Checking: -$2,000
Card:      +$1,900
After the next sync your test should verify:
pair removed
checking.autoHiddenAsTransfer = false
card.autoHiddenAsTransfer = false
both visible again
You're now exercising your transfer cleanup path, not merely pairing.

Reconnect should be its own Golden scenario
Given your actual architecture, I would consider this mandatory rather than an edge case.
Simulate:
Item A
checking XXXX1234
credit XXXX5678

↓ revoked/disconnected

Item B
same institution
same accounts
new Plaid transaction IDs / overlapping history
Then perform your normal Link success path again.
Assert:
old account identity preserved where intended
revoked rows adopted
no second logical checking account
no duplicate historical spending
overlap watermark respected
one live Item owns the account
Also test this variation:
Item A remains live
Item B contains some already-linked accounts
and verify the sibling Item behavior.
This is exactly the type of thing that's easy to break six months from now while someone is "just cleaning up Plaid connection code."

Add transaction conservation accounting
I still strongly recommend this from my previous answer, but I'd tailor it to your actual pipeline now.
Since there isn't a separate deduplication/reconciliation job, don't invent those stages.
Instead give each sync run an audit result like:
type TransactionSyncAudit = {
  receivedFromPlaid: number;

  added: number;
  modified: number;
  removed: number;

  persistedNew: number;
  persistedUpdated: number;
  markedRemoved: number;

  reconnectOverlapSkipped: number;
  disabledAccountSkipped: number;

  seededCategories: number;
  rulesApplied: number;

  transferPairsCreated: number;
  transferPairsRemoved: number;

  unexplained: number;
};
And the golden test requires:
expect(audit.unexplained).toBe(0);
I'd eventually run that same accounting in production.
It makes a subtle future failure much more visible than "the job completed successfully."

What I would put in CI
I wouldn't make every test equally expensive.
When	Tests
Every PR	shared logic unit tests
Every PR	deterministic web Golden E2E
Every PR	deterministic desktop Golden E2E
Every PR	web state === golden state
Every PR	desktop state === golden state
Every PR	idempotency / second-sync test
Plaid-related PR	reconnect Golden scenario
Nightly	actual Plaid Sandbox web integration
Nightly	actual Plaid Sandbox desktop integration
Nightly	real sandbox Link launch smoke
Release	1-minute manual real-bank test
And I'd use path filtering so an unrelated landing-page copy change doesn't have to wait on a packaged Electron E2E.

One subtle but important change from my earlier recommendation
I would not rely on Plaid Sandbox itself as your Golden fixture.
Use two independent layers:
                ┌───────────────────────────┐
                │ Controlled Plaid Adapter  │
                │ exact deterministic data  │
                └─────────────┬─────────────┘
                              │
                         EVERY PR
                              │
                 full Moat E2E correctness


                ┌───────────────────────────┐
                │ Real Plaid Sandbox        │
                │ actual API behavior       │
                └─────────────┬─────────────┘
                              │
                        NIGHTLY/RELEASE
                              │
                 integration compatibility
They catch different bugs.
If Plaid changes an API shape, Sandbox catches it.
If one of your engineers changes a transfer-pairing rule and causes two legitimate $900 transactions to disappear, the deterministic Golden Ledger catches it.
Trying to use the external provider to accomplish both makes the critical correctness suite dependent on somebody else's behavior.
The bar I'd shoot for
For every commit that touches this pipeline, CI should be able to prove:
Starting with an empty database and this exact 365-day financial history, web and desktop both ingest every provider change, preserve the correct identity/history, apply the expected category and rule state, pair exactly the expected transfers, remove exactly the expected transactions, calculate the expected aggregates, expose exactly the expected rows in each UI, and converge on the same canonical financial state even after retries, duplicate delivery, and reconnects.
That's about as close to bulletproof as I'd want for this part of Moat. The combination of Golden expected state + two independent implementations + idempotency + reconnect + real Plaid nightly smoke is considerably stronger than a conventional Playwright happy-path test.
