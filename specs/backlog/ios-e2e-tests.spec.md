# Spec: iOS End-to-End Testing Foundation with XCUITest

## Goal

Implement a durable, scalable iOS end-to-end testing system for the Moat iOS app.

The app is large, so this should be done in phases:

1. **Phase 1 — Prepare the app for reliable UI/E2E testing**

   * Add accessibility identifiers / test IDs.
   * Add deterministic launch modes.
   * Add mock/test data support.
   * Add test-only app reset behavior.
   * Add page-object-style test helpers.
   * Make authentication, onboarding, permissions, and sync states testable.

2. **Phase 2 — Implement foundational user-path E2E tests**

   * App launch.
   * Logged-out state.
   * Login.
   * Login persistence.
   * Face ID / biometric gate behavior.
   * Onboarding.
   * Main tab navigation.
   * Empty dashboard state.
   * Connected-account dashboard state.
   * Basic transaction list.
   * Basic account list.
   * Apple Wallet / FinanceKit entry point states.
   * Error/retry states.

3. **Phase 3 — Expand into non-foundational feature coverage**

   * Insights.
   * Spending.
   * Income.
   * Net income.
   * Recurring transactions.
   * Account detail.
   * Transaction detail.
   * Search/filter.
   * Settings.
   * Connection management.
   * Sync status.
   * Edge cases.
   * Regression flows.

## Framework Decision

Use **XCUITest** as the primary iOS E2E framework.

Reasoning:

* XCUITest is Apple-native and integrates with Xcode, XCTest, simulators, and CI.
* UI tests are different from unit/integration tests because they do not call app code directly; they interact with the app’s UI controls and verify the user can complete tasks.
* `XCUIApplication` can launch, monitor, terminate, and wait for the app under test.
* Xcode test plans support launch arguments and environment variables for configuring test runs.
* This should be the default for a Swift/SwiftUI native iOS app.

Optional future addition:

* Add **Appium + XCUITest driver** later only if we specifically want cross-platform or TypeScript/WebDriver-style tests. Appium’s iOS driver uses Apple’s XCUITest under the hood and supports native, hybrid, and WebKit apps on simulators and real devices. It should not be the first choice unless we need external black-box automation or shared mobile test infrastructure.

## Non-Goals

Do not attempt to use Playwright to automate the compiled native iOS app. Playwright can test web/browser surfaces, but the native iOS app should use XCUITest or Appium.

Do not start by trying to test every feature. The first priority is to make the app testable and then cover the foundational user paths.

Do not write brittle tests that rely on visible text when a stable accessibility identifier can be used.

Do not use production user accounts, production bank connections, or real financial data in automated E2E tests.

Do not make tests depend on real Apple Wallet / FinanceKit permissions, real Plaid/MX providers, real network timing, or real financial institutions for normal CI runs.

---

# Phase 1 — Prepare the iOS App for Reliable E2E Testing

## 1. Add UI Test Target

Create or verify an XCUITest target exists.

Expected target naming:

```txt
MoatUITests
```

Expected directory:

```txt
ios/
  Moat/
  MoatTests/
  MoatUITests/
```

Add initial files:

```txt
MoatUITests/
  MoatUITests.swift
  Support/
    AppLauncher.swift
    TestEnvironment.swift
    TestCredentials.swift
    WaitHelpers.swift
    ScreenshotHelpers.swift
  Screens/
    LaunchScreen.swift
    LoginScreen.swift
    OnboardingScreen.swift
    BiometricGateScreen.swift
    DashboardScreen.swift
    AccountsScreen.swift
    TransactionsScreen.swift
    SettingsScreen.swift
    AppleWalletConnectScreen.swift
```

Use a page/screen object pattern from the beginning. Avoid putting raw selectors directly inside every test file.

---

## 2. Add Stable Accessibility Identifiers / Test IDs

Every interactive or asserted UI element used by tests needs a stable `accessibilityIdentifier`.

This is the iOS equivalent of using `data-testid` in web testing.

Create a centralized enum or constants file in the app target:

```swift
enum A11yID {
    enum Root {
        static let appRoot = "root.app"
        static let loading = "root.loading"
        static let offlineBanner = "root.offlineBanner"
        static let errorBanner = "root.errorBanner"
    }

    enum Auth {
        static let loginButton = "auth.login.button"
        static let logoutButton = "auth.logout.button"
        static let emailField = "auth.email.field"
        static let passwordField = "auth.password.field"
        static let continueButton = "auth.continue.button"
        static let googleSignInButton = "auth.google.button"
        static let appleSignInButton = "auth.apple.button"
        static let errorMessage = "auth.error.message"
    }

    enum Biometric {
        static let gate = "biometric.gate"
        static let unlockButton = "biometric.unlock.button"
        static let fallbackButton = "biometric.fallback.button"
        static let disabledNotice = "biometric.disabled.notice"
    }

    enum Onboarding {
        static let container = "onboarding.container"
        static let nextButton = "onboarding.next.button"
        static let skipButton = "onboarding.skip.button"
        static let finishButton = "onboarding.finish.button"
        static let connectAccountButton = "onboarding.connectAccount.button"
    }

    enum Tabs {
        static let dashboard = "tab.dashboard"
        static let accounts = "tab.accounts"
        static let transactions = "tab.transactions"
        static let insights = "tab.insights"
        static let settings = "tab.settings"
    }

    enum Dashboard {
        static let screen = "dashboard.screen"
        static let netWorthCard = "dashboard.netWorth.card"
        static let cashFlowCard = "dashboard.cashFlow.card"
        static let spendingCard = "dashboard.spending.card"
        static let emptyState = "dashboard.emptyState"
        static let connectAccountCTA = "dashboard.connectAccount.cta"
        static let syncStatus = "dashboard.syncStatus"
    }

    enum Accounts {
        static let screen = "accounts.screen"
        static let list = "accounts.list"
        static let emptyState = "accounts.emptyState"
        static let addAccountButton = "accounts.add.button"
        static let accountCellPrefix = "accounts.cell."
        static let accountBalancePrefix = "accounts.balance."
    }

    enum Transactions {
        static let screen = "transactions.screen"
        static let list = "transactions.list"
        static let emptyState = "transactions.emptyState"
        static let searchField = "transactions.search.field"
        static let filterButton = "transactions.filter.button"
        static let transactionCellPrefix = "transactions.cell."
        static let transactionMerchantPrefix = "transactions.merchant."
        static let transactionAmountPrefix = "transactions.amount."
        static let transactionCategoryPrefix = "transactions.category."
    }

    enum AppleWallet {
        static let connectEntryPoint = "appleWallet.connect.entryPoint"
        static let permissionIntro = "appleWallet.permissionIntro"
        static let continueButton = "appleWallet.continue.button"
        static let unavailableState = "appleWallet.unavailable"
        static let deniedState = "appleWallet.denied"
        static let successState = "appleWallet.success"
        static let retryButton = "appleWallet.retry.button"
    }

    enum Settings {
        static let screen = "settings.screen"
        static let profileRow = "settings.profile.row"
        static let securityRow = "settings.security.row"
        static let accountsRow = "settings.accounts.row"
        static let logoutButton = "settings.logout.button"
    }
}
```

Implementation rule:

Every SwiftUI view that is important for test navigation or assertion should use:

```swift
.accessibilityIdentifier(A11yID.Dashboard.screen)
```

For repeated cells, use deterministic IDs based on stable fixture IDs, not array indexes:

```swift
.accessibilityIdentifier("\(A11yID.Transactions.transactionCellPrefix)\(transaction.id)")
```

Avoid index-based identifiers like:

```swift
transactions.cell.0
```

Prefer:

```swift
transactions.cell.txn_coffee_001
```

Acceptance criteria:

* The foundational user paths can be completed using identifiers, not visual text.
* Lists have stable item identifiers based on fixture IDs.
* Major screens expose a single screen-level identifier.
* Primary CTAs expose identifiers.
* Error, loading, empty, and success states expose identifiers.

---

## 3. Add Test Launch Arguments and Environment Support

Add a test environment layer in the app that reads launch arguments and launch environment variables when running under UI tests.

XCUITest should launch the app like this:

```swift
let app = XCUIApplication()
app.launchArguments += ["--ui-testing"]
app.launchEnvironment["MOAT_TEST_SCENARIO"] = "loggedOut"
app.launch()
```

The app should detect:

```swift
ProcessInfo.processInfo.arguments.contains("--ui-testing")
```

Add support for these launch arguments:

```txt
--ui-testing
--reset-app-state
--disable-animations
--mock-network
--mock-auth
--mock-financekit
--mock-biometrics
--skip-onboarding
--force-onboarding
--logged-in
--logged-out
```

Add support for these launch environment variables:

```txt
MOAT_TEST_SCENARIO
MOAT_TEST_USER_ID
MOAT_TEST_FIXTURE
MOAT_TEST_AUTH_STATE
MOAT_TEST_BIOMETRIC_STATE
MOAT_TEST_FINANCEKIT_STATE
MOAT_TEST_NETWORK_STATE
MOAT_TEST_SYNC_STATE
MOAT_API_BASE_URL
```

Example scenarios:

```txt
loggedOut
loggedInEmpty
loggedInWithAccounts
loggedInWithTransactions
onboardingRequired
biometricLocked
biometricUnlocked
financeKitUnavailable
financeKitDenied
financeKitConnected
networkOffline
syncFailure
syncSuccess
```

Acceptance criteria:

* UI tests can launch the app into deterministic states.
* Tests do not depend on previously cached simulator state.
* Tests can force logged-in/logged-out/onboarding/biometric/mock-network states.
* The app can reset local storage before each test.

---

## 4. Add App State Reset for Tests

When launched with:

```txt
--ui-testing --reset-app-state
```

The app should clear test-relevant state:

* Auth token/keychain test values.
* UserDefaults.
* Local database cache.
* In-memory stores.
* Persisted onboarding flags.
* Mock sync state.
* Mock account/transaction fixtures.
* Biometric-gate lock state.

Important:

Do not clear real production data unless `--ui-testing` is present.

Implementation idea:

```swift
struct UITestStateResetter {
    static func resetIfNeeded() {
        let args = ProcessInfo.processInfo.arguments
        guard args.contains("--ui-testing"),
              args.contains("--reset-app-state") else {
            return
        }

        // Clear UserDefaults test domain
        // Clear local cache
        // Clear mock stores
        // Clear keychain test entries
    }
}
```

Call this early in app startup before the root view decides auth/onboarding state.

Acceptance criteria:

* Every UI test starts from a clean state unless explicitly preserving state.
* Tests can be run individually or in a suite with the same result.
* Re-running a failed test does not depend on prior app state.

---

## 5. Add Mock Auth Layer

Create a test-only auth path that can simulate logged-in/logged-out states without hitting Google, Apple, Firebase, or the real backend.

When launched with:

```txt
--ui-testing --mock-auth
```

The app should use a mock auth provider.

Supported mock states:

```txt
MOAT_TEST_AUTH_STATE=loggedOut
MOAT_TEST_AUTH_STATE=loggedIn
MOAT_TEST_AUTH_STATE=expiredSession
MOAT_TEST_AUTH_STATE=invalidCredentials
```

Mock user:

```json
{
  "id": "test_user_001",
  "email": "ui-test@moat.test",
  "name": "UI Test User"
}
```

Acceptance criteria:

* Tests can validate the login screen without real auth.
* Tests can validate the logged-in app shell without real auth.
* Tests can simulate expired sessions.
* Tests can simulate login errors.
* Tests can simulate persistence across app relaunch.

---

## 6. Add Mock Backend / Fixture Data Layer

Add a mock network layer for UI tests.

When launched with:

```txt
--ui-testing --mock-network
```

The app should not call production APIs.

It should serve deterministic fixtures for:

* User profile.
* Accounts.
* Balances.
* Transactions.
* Categories.
* Spending summaries.
* Income summaries.
* Net income summaries.
* Recurring transactions.
* Sync state.
* Errors.

Fixture names:

```txt
empty
basicAccounts
basicTransactions
largeTransactions
cashFlowPositive
cashFlowNegative
recurringBills
syncFailure
partialData
```

Example launch:

```swift
app.launchEnvironment["MOAT_TEST_FIXTURE"] = "basicTransactions"
```

Acceptance criteria:

* Tests are deterministic.
* Tests do not require production services.
* Tests can run offline in CI.
* Fixtures are version-controlled.
* Fixture IDs are stable and match accessibility identifiers.

---

## 7. Add FinanceKit / Apple Wallet Mocking

FinanceKit and Apple Wallet authorization should be mockable.

When launched with:

```txt
--ui-testing --mock-financekit
```

Support these states:

```txt
MOAT_TEST_FINANCEKIT_STATE=unavailable
MOAT_TEST_FINANCEKIT_STATE=notDetermined
MOAT_TEST_FINANCEKIT_STATE=authorized
MOAT_TEST_FINANCEKIT_STATE=denied
MOAT_TEST_FINANCEKIT_STATE=restricted
MOAT_TEST_FINANCEKIT_STATE=noAccounts
MOAT_TEST_FINANCEKIT_STATE=hasAccounts
MOAT_TEST_FINANCEKIT_STATE=syncFailure
MOAT_TEST_FINANCEKIT_STATE=syncSuccess
```

The app should expose testable UI states for:

* Apple Wallet connect entry point.
* Permission intro.
* Continue/authorize button.
* Unavailable message.
* Denied permission message.
* No accounts found.
* Sync success.
* Sync failure.
* Retry.

Acceptance criteria:

* Tests can cover Apple Wallet UI without real Apple Wallet data.
* CI does not depend on FinanceKit entitlement behavior.
* Real FinanceKit remains used in normal app runs.

---

## 8. Add Biometric / Face ID Test Handling

Biometric behavior is tricky in automated tests. Do not make every test rely on system Face ID prompts.

Create test modes:

```txt
MOAT_TEST_BIOMETRIC_STATE=disabled
MOAT_TEST_BIOMETRIC_STATE=locked
MOAT_TEST_BIOMETRIC_STATE=unlocked
MOAT_TEST_BIOMETRIC_STATE=failed
MOAT_TEST_BIOMETRIC_STATE=fallbackRequired
```

When `--mock-biometrics` is present, use an injectable biometric service rather than directly calling `LAContext`.

Acceptance criteria:

* Tests can verify biometric-gate UI.
* Tests can verify fallback behavior.
* Tests can verify that app content is hidden while locked.
* Most foundational tests can bypass biometrics with `unlocked`.
* A small number of dedicated tests can run locked/failure flows.

---

## 9. Disable Animations in UI Tests

When launched with:

```txt
--disable-animations
```

Disable or reduce animations.

For SwiftUI:

```swift
UIView.setAnimationsEnabled(false)
```

Also ensure app-level animation wrappers respect test mode where possible.

Acceptance criteria:

* UI tests do not fail because a transition is mid-animation.
* Waits are based on existence/hittability, not arbitrary sleeps.

---

## 10. Add Page Object / Screen Object Test Architecture

Create screen wrappers so tests read like user journeys.

Example:

```swift
final class LoginScreen {
    let app: XCUIApplication

    init(_ app: XCUIApplication) {
        self.app = app
    }

    var emailField: XCUIElement {
        app.textFields[A11yID.Auth.emailField]
    }

    var passwordField: XCUIElement {
        app.secureTextFields[A11yID.Auth.passwordField]
    }

    var continueButton: XCUIElement {
        app.buttons[A11yID.Auth.continueButton]
    }

    func login(email: String, password: String) {
        emailField.tap()
        emailField.typeText(email)
        passwordField.tap()
        passwordField.typeText(password)
        continueButton.tap()
    }
}
```

Acceptance criteria:

* Raw selectors mostly live in screen objects.
* Tests express intent, not implementation details.
* Screen objects expose waits for screen-loaded state.
* Shared interactions are reusable.

---

## 11. Add Wait Helpers

Create standard wait helpers:

```swift
extension XCUIElement {
    func waitUntilExists(timeout: TimeInterval = 5) -> Bool {
        waitForExistence(timeout: timeout)
    }

    func waitUntilHittable(timeout: TimeInterval = 5) -> Bool {
        let predicate = NSPredicate(format: "hittable == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: self)
        return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
    }
}
```

Rules:

* Do not use arbitrary `sleep`.
* Use `waitForExistence`.
* Use hittability waits for taps.
* Add screenshot capture on failure.

Acceptance criteria:

* Tests are resilient to normal loading.
* Tests fail with useful diagnostics.
* Tests avoid fixed-time sleeps.

---

## 12. Add Screenshot-on-Failure Support

Configure UI tests to capture screenshots on failure.

Add helper:

```swift
func attachScreenshot(_ app: XCUIApplication, name: String) {
    let screenshot = app.screenshot()
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = name
    attachment.lifetime = .keepAlways
    XCTContext.runActivity(named: "Screenshot: \(name)") { activity in
        activity.add(attachment)
    }
}
```

Acceptance criteria:

* Each failed test includes a screenshot.
* Optional: include screen hierarchy dump in failure logs.

---

## 13. Add Test Plans

Create Xcode test plans:

```txt
MoatUnitTests.xctestplan
MoatUITests-Smoke.xctestplan
MoatUITests-Foundational.xctestplan
MoatUITests-FullRegression.xctestplan
```

Smoke plan:

* Small number of critical tests.
* Runs on every PR.

Foundational plan:

* Core paths.
* Runs on main branch and pre-release.

Full regression plan:

* Broader feature coverage.
* Runs nightly or before TestFlight release.

Each plan should define:

* Launch arguments.
* Environment variables.
* Simulator destination.
* Parallelization where safe.
* Code coverage if useful.
* Retry policy if available in CI.

Acceptance criteria:

* Developers can run smoke/foundational/full plans separately.
* CI can call the right plan for the right workflow.

---

# Phase 2 — Foundational User-Path E2E Tests

## Testing Philosophy

Foundational tests should answer:

“Can a normal user open the app, authenticate, unlock, understand their financial overview, navigate core tabs, and see essential account/transaction data?”

These should be stable, fast, and mandatory.

## 2.1 App Launch Tests

File:

```txt
MoatUITests/Tests/AppLaunchUITests.swift
```

Tests:

```txt
test_appLaunches_toLoggedOutState()
test_appLaunches_toLoggedInDashboardState()
test_appLaunches_toLoadingThenDashboard()
test_appLaunches_withOfflineBanner()
```

Coverage:

* App can launch.
* Root view appears.
* Loading state resolves.
* Offline state is visible when mocked.

Acceptance criteria:

* App launches without crash.
* Correct root screen appears for scenario.
* Loading indicator does not hang indefinitely.

---

## 2.2 Logged-Out / Auth Screen Tests

File:

```txt
AuthUITests.swift
```

Tests:

```txt
test_loggedOutUser_seesLoginOptions()
test_loginForm_validatesRequiredFields()
test_loginForm_showsInvalidCredentialsError()
test_mockLogin_success_navigatesToDashboard()
test_expiredSession_returnsUserToLogin()
```

Scenario setup:

```txt
MOAT_TEST_SCENARIO=loggedOut
MOAT_TEST_AUTH_STATE=loggedOut
```

Assertions:

* Login button exists.
* Email/password fields exist if email login is supported.
* Google/Apple sign-in buttons exist if supported.
* Invalid credentials show error.
* Successful mock login navigates to dashboard.

Acceptance criteria:

* Auth screen is navigable and testable.
* Tests do not call real Google/Apple auth.
* Login success changes root app state.

---

## 2.3 Login Persistence Tests

File:

```txt
SessionPersistenceUITests.swift
```

Tests:

```txt
test_loggedInSession_persistsAfterAppRelaunch()
test_logout_clearsSessionAndReturnsToLogin()
test_expiredToken_forcesReauthentication()
```

Implementation pattern:

```swift
func test_loggedInSession_persistsAfterAppRelaunch() {
    let app = AppLauncher.launch(
        scenario: .loggedInWithAccounts,
        resetState: true
    )

    DashboardScreen(app).assertVisible()

    app.terminate()
    app.launch()

    DashboardScreen(app).assertVisible()
}
```

Acceptance criteria:

* Session persistence works.
* Logout clears session.
* Expired session path is handled.

---

## 2.4 Biometric / Face ID Gate Tests

File:

```txt
BiometricGateUITests.swift
```

Tests:

```txt
test_biometricLocked_hidesFinancialData()
test_biometricUnlocked_showsDashboard()
test_biometricFailure_showsFallbackOption()
test_biometricDisabled_doesNotShowGate()
```

Scenarios:

```txt
MOAT_TEST_BIOMETRIC_STATE=locked
MOAT_TEST_BIOMETRIC_STATE=unlocked
MOAT_TEST_BIOMETRIC_STATE=failed
MOAT_TEST_BIOMETRIC_STATE=disabled
```

Assertions:

* Locked state shows biometric gate.
* Dashboard financial cards are not visible while locked.
* Unlock success shows dashboard.
* Failure exposes fallback.

Acceptance criteria:

* Sensitive data is not visible before unlock.
* Tests can bypass biometrics for unrelated flows.
* Dedicated biometric tests cover lock/failure/fallback.

---

## 2.5 Onboarding Tests

File:

```txt
OnboardingUITests.swift
```

Tests:

```txt
test_newUser_seesOnboarding()
test_onboarding_nextThroughSteps_finishesToDashboard()
test_onboarding_connectAccountCTA_opensConnectFlow()
test_existingUser_doesNotSeeOnboarding()
```

Scenarios:

```txt
MOAT_TEST_SCENARIO=onboardingRequired
--force-onboarding
--skip-onboarding
```

Acceptance criteria:

* New user sees onboarding.
* Onboarding can be completed.
* Completed onboarding persists.
* Existing user bypasses onboarding.

---

## 2.6 Main Tab Navigation Tests

File:

```txt
MainNavigationUITests.swift
```

Tests:

```txt
test_mainTabs_areVisibleForLoggedInUser()
test_tappingDashboardTab_showsDashboard()
test_tappingAccountsTab_showsAccounts()
test_tappingTransactionsTab_showsTransactions()
test_tappingInsightsTab_showsInsights()
test_tappingSettingsTab_showsSettings()
```

Assertions:

* Every primary tab exists.
* Tapping each tab shows correct screen identifier.
* Navigation does not crash.
* Tab selection state is correct if exposed.

Acceptance criteria:

* Core app shell works.
* Every main tab is reachable.

---

## 2.7 Dashboard Foundational Tests

File:

```txt
DashboardUITests.swift
```

Tests:

```txt
test_emptyDashboard_showsConnectAccountCTA()
test_dashboardWithAccounts_showsNetWorthCard()
test_dashboardWithAccounts_showsCashFlowCard()
test_dashboardWithAccounts_showsSpendingCard()
test_dashboard_showsSyncStatus()
test_dashboard_syncFailure_showsRetry()
```

Scenarios:

```txt
MOAT_TEST_FIXTURE=empty
MOAT_TEST_FIXTURE=basicAccounts
MOAT_TEST_SYNC_STATE=syncSuccess
MOAT_TEST_SYNC_STATE=syncFailure
```

Acceptance criteria:

* Empty state is clear.
* User can find connect account CTA.
* Financial overview appears with fixture data.
* Sync failure is visible and recoverable.

---

## 2.8 Accounts Foundational Tests

File:

```txt
AccountsUITests.swift
```

Tests:

```txt
test_accountsEmptyState_showsAddAccountCTA()
test_accountsList_showsConnectedAccounts()
test_tappingAccount_opensAccountDetail()
test_accountBalances_areVisible()
test_accountList_handlesHiddenOrClosedAccount()
```

Fixture:

```txt
basicAccounts
```

Suggested fixture accounts:

```json
[
  {
    "id": "acct_checking_001",
    "name": "Moat Checking",
    "type": "checking",
    "balance": 2400.25
  },
  {
    "id": "acct_credit_001",
    "name": "Moat Credit Card",
    "type": "credit",
    "balance": -319.44
  },
  {
    "id": "acct_savings_001",
    "name": "Moat Savings",
    "type": "savings",
    "balance": 12000.00
  }
]
```

Acceptance criteria:

* Accounts screen works with empty and populated states.
* Account detail is reachable.
* Balances render.
* Test IDs use stable account IDs.

---

## 2.9 Transactions Foundational Tests

File:

```txt
TransactionsUITests.swift
```

Tests:

```txt
test_transactionsEmptyState_isVisible()
test_transactionsList_showsRecentTransactions()
test_transactionCell_showsMerchantAmountAndCategory()
test_tappingTransaction_opensTransactionDetail()
test_transactionSearch_filtersResults()
test_transactionFilterButton_opensFilters()
```

Fixture:

```txt
basicTransactions
```

Suggested fixture transactions:

```json
[
  {
    "id": "txn_coffee_001",
    "merchant": "Coffee Shop",
    "amount": -5.75,
    "category": "Food & Drink"
  },
  {
    "id": "txn_payroll_001",
    "merchant": "Payroll",
    "amount": 3200.00,
    "category": "Income"
  },
  {
    "id": "txn_rent_001",
    "merchant": "Rent",
    "amount": -1800.00,
    "category": "Housing"
  }
]
```

Acceptance criteria:

* Transaction list is reachable.
* Rows render core information.
* Detail screen opens.
* Search/filter entry points work.

---

## 2.10 Apple Wallet / FinanceKit Foundational UI Tests

File:

```txt
AppleWalletUITests.swift
```

Tests:

```txt
test_appleWalletEntryPoint_isVisible()
test_appleWalletUnavailable_showsUnavailableState()
test_appleWalletPermissionDenied_showsDeniedState()
test_appleWalletNoAccounts_showsNoAccountsState()
test_appleWalletSyncSuccess_showsSuccessState()
test_appleWalletSyncFailure_showsRetry()
```

Mock states:

```txt
MOAT_TEST_FINANCEKIT_STATE=unavailable
MOAT_TEST_FINANCEKIT_STATE=denied
MOAT_TEST_FINANCEKIT_STATE=noAccounts
MOAT_TEST_FINANCEKIT_STATE=syncSuccess
MOAT_TEST_FINANCEKIT_STATE=syncFailure
```

Acceptance criteria:

* Apple Wallet entry point is testable.
* Permission states are testable.
* Success/failure states are testable.
* Tests do not require real Apple Wallet data.

---

## 2.11 Settings Foundational Tests

File:

```txt
SettingsUITests.swift
```

Tests:

```txt
test_settingsScreen_opens()
test_settingsShowsProfileRow()
test_settingsShowsSecurityRow()
test_settingsShowsAccountsRow()
test_logoutFromSettings_returnsToLogin()
```

Acceptance criteria:

* Settings is reachable.
* Important rows exist.
* Logout works.

---

## 2.12 Foundational Smoke Suite

Create a smoke suite that runs quickly on every PR.

Minimum tests:

```txt
test_appLaunches_toLoggedOutState()
test_mockLogin_success_navigatesToDashboard()
test_loggedInSession_persistsAfterAppRelaunch()
test_mainTabs_areVisibleForLoggedInUser()
test_emptyDashboard_showsConnectAccountCTA()
test_transactionsList_showsRecentTransactions()
test_logoutFromSettings_returnsToLogin()
```

Acceptance criteria:

* Smoke suite runs in CI.
* Target runtime should be short enough to run on every PR.
* Failures block merge.

---

# Phase 3 — Expanded Non-Foundational Feature Coverage

After Phase 2 is stable, add broader coverage.

## 3.1 Insights / Analysis Tests

File:

```txt
InsightsUITests.swift
```

Tests:

```txt
test_insightsDefaultTab_loads()
test_spendingTab_loadsCurrentMonth()
test_incomeTab_loadsCurrentMonth()
test_netIncomeTab_loadsCurrentMonth()
test_timeRangePicker_switchesBetween1And3And6And12Months()
test_spendingChart_handlesNoData()
test_incomeChart_handlesNoData()
test_netIncomeChart_handlesNegativeMonth()
test_chartTapOrSelection_showsDetailIfSupported()
```

Acceptance criteria:

* Insights screen works across tabs.
* Time ranges work.
* Empty states render.
* Negative/positive months render correctly.
* Charts do not crash with sparse data.

---

## 3.2 Spending Tests

File:

```txt
SpendingUITests.swift
```

Tests:

```txt
test_spendingOverview_showsTotalSpend()
test_spendingByCategory_showsTopCategories()
test_spendingByMerchant_showsTopMerchants()
test_spendingTrend_showsMonthlyBarsOrLine()
test_spendingCategoryTap_opensFilteredTransactions()
test_spendingHandlesRefundsCorrectly()
test_spendingHandlesTransfersCorrectly()
```

Fixtures:

```txt
spendingBasic
spendingWithRefunds
spendingWithTransfers
spendingLarge
```

Acceptance criteria:

* Spending summary is correct for fixture data.
* Categories are visible.
* Merchant breakdown is visible.
* Drill-down works if implemented.
* Refund/transfer behavior is sane.

---

## 3.3 Income Tests

File:

```txt
IncomeUITests.swift
```

Tests:

```txt
test_incomeOverview_showsTotalIncome()
test_incomeBySource_showsPayroll()
test_incomeTrend_showsMonthlyIncome()
test_incomeHandlesRefundsNotAsIncome()
test_incomeHandlesTransfersNotAsIncome()
test_incomeHandlesIrregularIncome()
```

Acceptance criteria:

* Income summary renders.
* Payroll/source breakdown renders.
* Transfers are not incorrectly presented as income.
* Irregular income is visible.

---

## 3.4 Net Income Tests

File:

```txt
NetIncomeUITests.swift
```

Tests:

```txt
test_netIncomeOverview_showsPositiveNetIncome()
test_netIncomeOverview_showsNegativeNetIncome()
test_netIncomeTrend_showsMonthlyComparison()
test_netIncomeDetails_showIncomeMinusSpending()
test_netIncomeHandlesEmptyMonth()
```

Acceptance criteria:

* Positive and negative states work.
* Net income math matches fixture.
* Empty months do not crash charts.

---

## 3.5 Recurring Transactions Tests

File:

```txt
RecurringTransactionsUITests.swift
```

Tests:

```txt
test_recurringTransactionsList_showsSubscriptionsAndBills()
test_recurringTransactionDetail_opens()
test_recurringTransactions_showsNextExpectedDate()
test_recurringTransactions_showsAmountChange()
test_recurringTransactions_emptyState()
```

Acceptance criteria:

* Recurring screen/list works.
* Subscription/bill cards render.
* Amount changes are visible.
* Empty state works.

---

## 3.6 Account Detail Tests

File:

```txt
AccountDetailUITests.swift
```

Tests:

```txt
test_accountDetail_showsBalanceAndMetadata()
test_accountDetail_showsRecentTransactions()
test_accountDetail_refreshButtonStartsSync()
test_accountDetail_syncFailureShowsError()
test_accountDetail_hiddenAccountState()
test_accountDetail_removeOrDisconnectEntryPoint()
```

Acceptance criteria:

* Account detail is navigable.
* Recent transactions load.
* Sync states are visible.
* Account management entry points work.

---

## 3.7 Transaction Detail Tests

File:

```txt
TransactionDetailUITests.swift
```

Tests:

```txt
test_transactionDetail_showsMerchantAmountDateCategory()
test_transactionDetail_categoryCanBeChangedIfSupported()
test_transactionDetail_notesCanBeEditedIfSupported()
test_transactionDetail_splitEntryPointVisibleIfSupported()
test_transactionDetail_pendingTransactionState()
test_transactionDetail_transferTransactionState()
```

Acceptance criteria:

* Transaction detail renders.
* Editable fields work if supported.
* Pending/transfer states are clear.

---

## 3.8 Search and Filter Tests

File:

```txt
SearchAndFilterUITests.swift
```

Tests:

```txt
test_searchByMerchant_returnsMatchingTransactions()
test_searchNoResults_showsEmptyState()
test_filterByCategory_returnsMatchingTransactions()
test_filterByAccount_returnsMatchingTransactions()
test_filterByDateRange_returnsMatchingTransactions()
test_clearFilters_restoresFullList()
```

Acceptance criteria:

* Search works.
* No-results state works.
* Filters can be applied and cleared.
* Filtered results match fixture expectations.

---

## 3.9 Connection Management Tests

File:

```txt
ConnectionManagementUITests.swift
```

Tests:

```txt
test_addAccountEntryPoint_opensProviderSelection()
test_providerSelection_showsPlaidOrMxEntryPoints()
test_connectionSuccess_showsConnectedAccount()
test_connectionFailure_showsRetry()
test_reconnectRequired_showsReconnectCTA()
test_disconnectAccount_confirmationFlow()
```

Important:

Do not hit real Plaid/MX in normal CI. Use mocked provider states.

Acceptance criteria:

* Add/reconnect/disconnect flows are testable.
* Error states are visible.
* Tests do not call real financial providers.

---

## 3.10 Sync Status Tests

File:

```txt
SyncStatusUITests.swift
```

Tests:

```txt
test_syncInProgress_showsLoadingState()
test_syncSuccess_showsLastUpdated()
test_syncFailure_showsErrorAndRetry()
test_partialSync_showsPartialDataWarning()
test_manualRefresh_triggersSync()
```

Acceptance criteria:

* Sync status is visible.
* User understands stale/fresh/failing states.
* Retry path works.

---

## 3.11 Error, Empty, and Edge State Tests

File:

```txt
EdgeStateUITests.swift
```

Tests:

```txt
test_globalNetworkOffline_showsOfflineBanner()
test_serverError_showsFriendlyError()
test_emptyAccounts_emptyTransactions_emptyInsights()
test_largeTransactionList_scrollsPerformantly()
test_longMerchantNames_doNotBreakLayout()
test_largeDollarAmounts_doNotBreakLayout()
test_negativeBalances_renderCorrectly()
test_decimalAmounts_renderCorrectly()
```

Acceptance criteria:

* App handles empty data.
* App handles large data.
* App handles long labels.
* App handles error states gracefully.

---

# CI Integration

## Recommended CI Strategy

Use three levels:

```txt
PR:
  - Unit tests
  - Small XCUITest smoke suite

Main branch:
  - Unit tests
  - Integration tests
  - Foundational XCUITest suite

Nightly or pre-TestFlight:
  - Full regression XCUITest suite
```

Possible execution environments:

* Local Xcode.
* GitHub Actions on macOS runner.
* Xcode Cloud.
* Later: device farm if needed.

Xcode Cloud is Apple’s CI/CD system for Apple developers and can build apps, run automated tests in parallel, deliver to testers, and surface feedback. Use it if it fits the project workflow. GitHub Actions is also fine if the project already uses it.

## Example GitHub Actions Shape

The coding agent should adapt this to the actual scheme/workspace names.

```yaml
name: iOS UI Tests

on:
  pull_request:
    paths:
      - "ios/**"
      - ".github/workflows/ios-ui-tests.yml"

jobs:
  ui-tests:
    runs-on: macos-latest

    steps:
      - uses: actions/checkout@v4

      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode.app

      - name: Run smoke UI tests
        run: |
          xcodebuild test \
            -workspace ios/Moat.xcworkspace \
            -scheme Moat \
            -testPlan MoatUITests-Smoke \
            -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
            -resultBundlePath TestResults/MoatUITests-Smoke.xcresult
```

Acceptance criteria:

* UI smoke tests run in CI.
* Test artifacts are preserved.
* Screenshots are available on failure.
* CI does not require production secrets for normal mock-mode tests.

---

# Test Data and Fixture Requirements

Create fixture files or fixture builders for these states:

```txt
empty
basicAccounts
basicTransactions
largeTransactions
spendingBasic
spendingWithRefunds
spendingWithTransfers
incomeBasic
incomeIrregular
netIncomePositive
netIncomeNegative
recurringBills
syncFailure
partialData
financeKitConnected
financeKitDenied
financeKitUnavailable
```

Fixture rules:

* Use stable IDs.
* Keep amounts deterministic.
* Include both income and expenses.
* Include transfers.
* Include pending transactions.
* Include refunds.
* Include credit card and checking accounts.
* Include at least one Apple Wallet-style account.
* Include edge cases:

  * Long merchant name.
  * Large amount.
  * Negative balance.
  * Zero-dollar or pending authorization if app supports it.
  * Duplicate-looking transactions.

---

# Accessibility Identifier Coverage Checklist

The coding agent should audit and add identifiers for:

## Root

```txt
root.app
root.loading
root.offlineBanner
root.errorBanner
```

## Auth

```txt
auth.login.button
auth.logout.button
auth.email.field
auth.password.field
auth.continue.button
auth.google.button
auth.apple.button
auth.error.message
```

## Onboarding

```txt
onboarding.container
onboarding.next.button
onboarding.skip.button
onboarding.finish.button
onboarding.connectAccount.button
```

## Biometric

```txt
biometric.gate
biometric.unlock.button
biometric.fallback.button
biometric.disabled.notice
```

## Tabs

```txt
tab.dashboard
tab.accounts
tab.transactions
tab.insights
tab.settings
```

## Dashboard

```txt
dashboard.screen
dashboard.netWorth.card
dashboard.cashFlow.card
dashboard.spending.card
dashboard.emptyState
dashboard.connectAccount.cta
dashboard.syncStatus
```

## Accounts

```txt
accounts.screen
accounts.list
accounts.emptyState
accounts.add.button
accounts.cell.<accountId>
accounts.balance.<accountId>
```

## Transactions

```txt
transactions.screen
transactions.list
transactions.emptyState
transactions.search.field
transactions.filter.button
transactions.cell.<transactionId>
transactions.merchant.<transactionId>
transactions.amount.<transactionId>
transactions.category.<transactionId>
```

## Apple Wallet

```txt
appleWallet.connect.entryPoint
appleWallet.permissionIntro
appleWallet.continue.button
appleWallet.unavailable
appleWallet.denied
appleWallet.success
appleWallet.retry.button
```

## Settings

```txt
settings.screen
settings.profile.row
settings.security.row
settings.accounts.row
settings.logout.button
```

---

# Implementation Order

## Step 1 — Create Test Target and Skeleton

* Add `MoatUITests`.
* Add basic launch test.
* Add app launcher helper.
* Add smoke test plan.
* Verify it runs locally.

Deliverable:

```txt
A passing test that launches the app and asserts a root identifier exists.
```

## Step 2 — Add Test Mode Infrastructure

* Add `--ui-testing`.
* Add `--reset-app-state`.
* Add `--disable-animations`.
* Add test environment parser.
* Add state resetter.

Deliverable:

```txt
Tests can launch the app into a clean deterministic state.
```

## Step 3 — Add Accessibility Identifiers

* Add centralized identifier constants.
* Add identifiers to foundational screens.
* Add identifiers to tabs, auth, dashboard, accounts, transactions, settings.

Deliverable:

```txt
Foundational screens are selectable by stable identifiers.
```

## Step 4 — Add Mock Auth

* Add injectable auth service.
* Add mock auth provider for UI tests.
* Support logged-in, logged-out, expired, invalid credentials.

Deliverable:

```txt
Auth UI tests can pass without real auth.
```

## Step 5 — Add Mock Backend Fixtures

* Add mock network/data provider.
* Add fixture selection via launch environment.
* Add empty/basicAccounts/basicTransactions fixtures.

Deliverable:

```txt
Dashboard, accounts, and transactions can load deterministic data.
```

## Step 6 — Add Foundational Screen Objects

* LoginScreen.
* DashboardScreen.
* AccountsScreen.
* TransactionsScreen.
* SettingsScreen.
* OnboardingScreen.
* BiometricGateScreen.
* AppleWalletConnectScreen.

Deliverable:

```txt
Tests use screen objects instead of raw selectors.
```

## Step 7 — Add Phase 2 Foundational Tests

Implement:

* AppLaunchUITests.
* AuthUITests.
* SessionPersistenceUITests.
* BiometricGateUITests.
* OnboardingUITests.
* MainNavigationUITests.
* DashboardUITests.
* AccountsUITests.
* TransactionsUITests.
* AppleWalletUITests.
* SettingsUITests.

Deliverable:

```txt
Foundational XCUITest suite passing locally.
```

## Step 8 — Add CI Smoke Suite

* Add GitHub Actions or Xcode Cloud config.
* Run smoke suite on PR.
* Preserve xcresult artifacts.

Deliverable:

```txt
PRs run iOS UI smoke tests automatically.
```

## Step 9 — Expand into Phase 3

Implement feature suites after Phase 2 is stable.

Deliverable:

```txt
Full regression suite covering non-foundational user paths.
```

---

# Definition of Done

Phase 1 is done when:

* UI test target exists.
* App supports UI test launch mode.
* App supports reset state.
* App supports mock auth.
* App supports mock network fixtures.
* App supports mock FinanceKit states.
* App supports mock biometric states.
* Foundational screens have stable accessibility identifiers.
* Test plans exist.
* At least one launch test passes.

Phase 2 is done when:

* Foundational user paths are covered.
* Smoke suite passes locally.
* Foundational suite passes locally.
* CI runs smoke suite.
* Tests are deterministic.
* No production services are required.
* No real financial accounts are required.
* No real Apple Wallet data is required.

Phase 3 is done when:

* Major feature areas have UI coverage.
* Empty/error/loading/success states are covered.
* Search/filter/detail flows are covered.
* Regression suite can run before TestFlight releases.
* Test failures include screenshots/artifacts.

---

# Coding Agent Instructions

Please implement this incrementally.

Start with Phase 1. Do not jump directly into writing dozens of brittle tests before the app has deterministic test-mode support.

Use XCUITest as the primary framework.

Use accessibility identifiers as the stable selector strategy.

Use launch arguments and environment variables to control app state.

Use mock services for auth, network, FinanceKit, and biometrics.

Do not use production data or production financial providers in automated tests.

After Phase 1 is complete, implement Phase 2 foundational user-path tests.

After Phase 2 is stable and running in CI, proceed to Phase 3 expanded feature coverage.

At each phase, update or create documentation explaining:

* How to run the tests locally.
* How to run the smoke suite.
* How to run the full suite.
* How to add a new screen object.
* How to add a new fixture.
* How to add a new accessibility identifier.
