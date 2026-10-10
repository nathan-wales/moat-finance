# iOS My Profile Overhaul

## Status

Draft. Created June 9, 2026 to plan a native SwiftUI replacement for the current lightweight iOS profile page.

Do not implement until this spec is approved.

## Goal

Replace the current iOS `FinancialProfileView` remote feature shell with a native SwiftUI `MyProfileView` that mirrors the financial profile functionality available in the web and desktop app.

Success means:

- iOS users can view and manage their full financial profile from one scrollable native screen.
- My Profile becomes the canonical replacement for the current native Accounts page.
- The screen visually matches the web and desktop profile experience while respecting iOS interaction patterns.
- Every edit dialog in web/desktop is represented as an Apple-native slide-up sheet.
- The first pass does not include the horizontal section navbar; the page is a single vertical scroll.
- The implementation uses SwiftUI only. No profile UI or state is shared from `packages/`.
- The file is renamed from `financial-profile-view.swift` to `my-profile.swift`, with the primary view named `MyProfileView`.

## Product Context

Moat Finance is the canonical source of truth for a user's financial life. The profile page is the place where users see and manage the durable context Moat Finance uses for forecasts, planning, agent assistance, and future automation.

The current iOS screen is not acceptable for that role. It delegates to a generic remote feature renderer, shows raw/lightweight data, and does not provide the section-level management flow users already have on web and desktop.

The iOS profile must feel like a first-class native version of the same product, not a debug endpoint viewer.

This feature also replaces the standalone native Accounts page. Account connection, manual account management, synced account status, institution sync actions, account visibility controls, and investment account context all belong inside My Profile after this overhaul.

## Current Repo Context

### iOS

Primary current file:

- `apps/ios/Moat Finance/Features/Shared/Views/financial-profile-view.swift`

Current behavior:

- `FinancialProfileView` only renders `RemoteFeatureView(config: .financialProfile)`.
- `RemoteFeatureConfig.financialProfile` only calls `/api/v1/financialProfile/get`.
- There is no native profile model, service, view model, section UI, edit form, or save flow.

Relevant native patterns:

- iOS service calls should use `APIClient`.
- Screen state should follow existing `@MainActor ObservableObject` view model patterns.
- Scrollable pages should use `ScrollView`, `FinCard`, `FinTheme`, `LoadingView`, `ErrorStateView`, `.refreshable`, and `.sheet` patterns already used by screens such as Accounts.
- Tokens stay in Keychain through existing auth plumbing.

### Web/Desktop Shared Profile

Primary files:

- `packages/features/src/financial-profile/financial-profile-page.tsx`
- `packages/features/src/financial-profile/sections.ts`
- `packages/features/src/financial-profile/components.tsx`
- `packages/features/src/financial-profile/field-options.ts`
- `packages/contracts/src/financial-profile-data.ts`

Current shared behavior:

- Fetch profile data with `getFinancialProfileData`.
- Save the complete `FinancialProfileData` object with `updateFinancialProfileData`.
- Optimistically update local data while saves are pending.
- Roll back and surface errors when a save fails.
- Render section cards with title, icon, description, action, content, loading skeleton, and empty states.
- Use dialogs for add/edit/delete; iOS must replace these with native sheets and confirmation sheets.

## Target User Experience

The iOS page should open to:

- Large title: `My Profile`
- Subtitle: `My entire financial profile in one place for easy agentic access.`
- High-level summary card showing profile completeness, total visible accounts, connected institutions, manual accounts, investment accounts, income sources, assets, liabilities, insurance policies, and planning notes.
- A vertical stack of native section cards.

There should be no top section navbar in the first implementation. Users scroll through the full profile. Section navigation can be revisited after the native content is complete.

Each section card should have:

- SF Symbol icon matching the section's meaning.
- Title and description equivalent to web/desktop.
- Primary action button for add/edit.
- Native mobile presentation for content: cards, rows, compact grids, and badges instead of wide desktop tables.
- Skeleton or redacted placeholders while loading.
- Empty state copy equivalent to web/desktop.
- Last updated labels where the web/desktop section has them.

## Functional Parity Requirements

### Shared Page Behavior

Requirements:

- Load data from `/api/v1/financialProfile/get`.
- Save through the existing update endpoint used by web/desktop.
- Preserve all fields in `FinancialProfileData` on every save, including fields not edited by the current sheet.
- Use a single source of truth in `MyProfileViewModel`.
- Track loading, refreshing, loaded, saving, and error states.
- Support pull-to-refresh.
- Show save progress without blocking the whole page unnecessarily.
- Show a native success or error sheet/toast pattern consistent with the iOS app after saves.
- If a save fails, restore the previous local value or reload from the server.

### Sections

The native page must cover these sections from the web/desktop profile surface:

1. Profile
2. Accounts
3. Income Sources
4. Assets
5. Liabilities
6. Insurance
7. Taxes
8. Assumptions
9. Planning Notes

Investments are part of the Accounts section on iOS. The implementation must decode and preserve `investments`, display investment account context alongside synced and manual accounts, and expose investment editing from the account detail or account action sheet. No iOS save path may drop investments from the payload.

## Section Requirements

### Profile

Description:

`Basic household context used across planning, forecasts, and guidance.`

Display fields:

- Household type
- State / country
- Life stage
- Employment type
- Planning horizon
- Risk tolerance
- Dependents count
- Housing status
- Last updated

Edit sheet:

- Title: `Edit Profile`
- Use native form controls for select values, state picker/autocomplete, number input, and help text.
- Save updates `lastUpdated` to the current date.

### Accounts

Description:

`Connected, manual, and investment accounts that define where money is held, owed, synced, and forecasted.`

Purpose:

The Accounts section replaces the standalone native Accounts page. It must be descriptive and complete enough that users can manage all account-related profile context without leaving My Profile.

Account groups:

- Connected institutions from Plaid or future providers.
- Synced accounts under each institution.
- Manually added accounts that are not tied to a provider connection.
- Investment accounts and investment assumptions tied to accounts.
- Hidden accounts excluded from the primary list but still preserved in data.

Display:

- Visible accounts first; hidden accounts should not appear in the primary list but should be reachable from a secondary management sheet if needed.
- Institution grouping for synced accounts.
- Name
- Institution
- Type
- Balance
- Manual/synced status
- Last synced for synced accounts
- Provider connection health, including reconnect-required state when available.
- Included in net worth badge
- Hidden/excluded state where relevant.
- Investment account indicator when the account type maps to investment categories.
- Linked investment details when present: current value, monthly contribution, expected return, account link, and forecast inclusion.

Summary metrics:

- Total visible account balance.
- Connected institution count.
- Synced account count.
- Manual account count.
- Investment account count.
- Reconnect-needed count.

Actions:

- Connect account from inside My Profile, respecting demo mode behavior from the existing Accounts screen.
- Sync all connected institutions from inside My Profile.
- Sync a single institution from inside My Profile where `plaidItemId` exists.
- Reconnect an institution from inside My Profile when provider status requires it.
- Add manual account sheet.
- Edit manual account sheet.
- Edit investment details sheet for investment accounts.
- Add or update investment assumptions tied to an account.
- Hide account.
- Show/manage hidden accounts from a native sheet.
- Delete account with confirmation sheet.

Provider behavior:

- Demo mode must explain that sample institutions cannot start real Plaid Link flows.
- Plaid Link connection and reconnect flows should be launched from My Profile.
- Provider errors should surface as native action messages or sheets.
- After connect, reconnect, sync, hide, delete, or manual account edits, My Profile should refresh or optimistically update the account section.

Manual account behavior:

- Manual accounts appear alongside synced accounts in the Accounts section.
- Manual accounts use the same account card language as synced accounts, with clear `Manual` source labeling.
- Manual balances can be edited from a native sheet.
- Manual accounts may be included or excluded from net worth.

Investment behavior:

- Investment accounts live in Accounts, not in a standalone iOS Investments section for this feature.
- Investment details should be edited through native slide-up sheets.
- Investment accounts should still participate in account totals, source/status display, and forecast inclusion labels.
- The implementation must preserve both `accounts` and `investments` arrays when saving.

### Income Sources

Description:

`Forward-looking income assumptions separate from transactions.`

Display:

- Name
- Type
- Amount
- Frequency
- Growth assumption
- Start/end dates
- Included in forecast badge

Actions:

- Add income sheet.
- Edit income sheet.
- Delete income with confirmation sheet.

### Assets

Description:

`Things you own, including property, vehicles, businesses, and other valuables.`

Display:

- Name
- Asset type badge/icon
- Estimated value
- Linked liability
- Linked insurance
- Included in net worth badge
- Included in forecast badge

Actions:

- Add asset sheet.
- Edit asset sheet.
- Delete asset with confirmation sheet.
- Link liability options should be filtered by asset domain.
- Link insurance options should be filtered by asset domain.

### Liabilities

Description:

`Debts and obligations Moat Finance should account for in payoff and forecast modeling.`

Display:

- Name
- Type
- Balance
- Interest rate
- Monthly payment
- Linked asset
- Payoff date
- Included in net worth badge
- Included in forecast badge

Actions:

- Add liability sheet.
- Edit liability sheet.
- Delete liability with confirmation sheet.
- Linked asset options should be filtered by liability type.

### Insurance

Cloud description:

`Coverage policies and premiums for property, life, health, and liability. Sensitive claims and full documents belong in Moat Finance Private Desktop.`

Display:

- Safety notice explaining what belongs in Moat Finance Cloud versus Moat Finance Private Desktop.
- Policy display name
- Type
- Provider
- Premium amount
- Premium cadence
- Primary coverage amount
- Renewal date
- Linked asset

Actions:

- Add policy with native multi-step sheet.
- Edit policy with native multi-step sheet.
- Delete policy with confirmation sheet.

Insurance intake steps:

- Type
- Assistance choice
- Basics
- Premium
- People/assets
- Coverage
- Review

Cloud safety requirements:

- iOS must preserve the same cloud-blocking behavior as web/desktop.
- Do not allow sensitive health, dental, vision, disability, long-term care documents, claims, EOBs, prescriptions, insurance cards, medical records, or forbidden/high-local-only data to be saved to Moat Finance Cloud.
- If a policy cannot be saved to cloud, show a native error sheet explaining that the detail belongs in Moat Finance Private Desktop.

### Taxes

Description:

`Basic tax context used for forecasting. This is not full tax planning software.`

Display groups:

- Filing: filing status, tax year, deduction strategy
- Income: total annual income, taxable income estimate
- Rates: federal bracket, state tax rate
- Other: self-employed income badge, rental income badge
- Last updated

Edit sheet:

- Title: `Edit Taxes`
- Save updates `lastUpdated` to the current date.

### Assumptions

Description:

`Global forecast behavior that affects projections throughout Moat Finance.`

Display:

- Notice: assumptions are editable forecast defaults; scenario-specific overrides can adjust these later.
- Inflation rate
- Income growth rate
- Expense growth rate
- Investment return rate
- Real estate appreciation
- Default cash yield
- Retirement age
- Forecast style
- Last updated

Edit sheet:

- Title: `Edit Assumptions`
- Save updates `lastUpdated` to the current date.

### Planning Notes

Description:

`Unstructured context and preferences Moat Finance can use for personalized assistance.`

Display:

- Title
- Optional tag
- Body
- Last updated

Actions:

- Add note sheet.
- Edit note sheet.
- Delete note with confirmation sheet.
- Save updates `lastUpdated` to the current date.

## Native UI Rules

Requirements:

- Use SwiftUI-native `sheet` presentation for all add/edit flows.
- Mirror the full web/desktop view and edit surface; do not reduce fields simply because the screen is native mobile.
- Use native confirmation sheets or confirmation dialogs for destructive actions.
- Prefer mobile cards and compact vertical rows over horizontal tables.
- Use `Form`, `Picker`, `Toggle`, `TextField`, numeric keyboard types, `TextEditor`, and custom card rows where appropriate.
- Keep the page scrollable from top to bottom.
- Do not add the web-style top section navbar in phase one.
- Use SF Symbols, not Lucide icons.
- Use existing `FinTheme` spacing, colors, cards, and page background.
- Keep sheet titles and action labels aligned with web/desktop.
- Help text should be available, but not noisy. Prefer native info rows or compact disclosure text.

## Data Model Plan

Create native Swift models that mirror `FinancialProfileData`:

- `FinancialProfileData`
- `FinancialProfileRecord`
- `ProfileAccount`
- `IncomeSource`
- `ProfileAsset`
- `ProfileLiability`
- `ProfileInvestment`
- `InsurancePolicy`
- `InsurancePolicyV2`
- `TaxProfile`
- `ForecastAssumptions`
- `PlanningNote`

Implementation notes:

- Use `Codable`.
- Preserve unknown or optional fields when possible.
- Model enum values exactly as the API sends them.
- Date-only fields should remain strings where the API contract uses strings.
- Currency and percent values should remain numeric in the model and formatted only in views.
- Insurance requires careful modeling because legacy and v2 policies can both exist.

## Service And View Model Plan

Create:

- `my-profile-service.swift`
- `my-profile-view-model.swift`
- `my-profile-models.swift`

Service responsibilities:

- `loadProfile() async throws -> FinancialProfileData`
- `saveProfile(_ data: FinancialProfileData) async throws -> FinancialProfileData`
- Account connect, reconnect, sync all, sync institution, hide, and delete operations needed to replace the Accounts page.
- Reuse existing native account/Plaid services where possible, but expose the actions through My Profile.

View model responsibilities:

- Own the current `FinancialProfileData`.
- Expose derived counts and summary values.
- Expose section-level upsert/delete/hide methods.
- Generate stable IDs for new manual rows.
- Apply optimistic updates and roll back on save failure.
- Preserve all untouched sections during every mutation.
- Surface user-readable action messages.

## File Rename Plan

Rename:

```text
apps/ios/Moat Finance/Features/Shared/Views/financial-profile-view.swift
```

to:

```text
apps/ios/Moat Finance/Features/Shared/Views/my-profile.swift
```

Primary view:

```swift
struct MyProfileView: View
```

Routing updates:

- Replace any `FinancialProfileView()` references with `MyProfileView()`.
- Keep the tab label as `Profile` unless product decides to rename the tab itself.
- Use `navigationTitle("My Profile")` only if the surrounding shell requires it; the visible page should have its own large title content.
- Remove the standalone Accounts page from user-facing navigation once My Profile reaches account feature parity.

## Implementation Phases

### Phase 1: Native Shell And Data

- Rename the Swift file.
- Add native models.
- Add service and view model.
- Load and refresh `/api/v1/financialProfile/get`.
- Render title, subtitle, loading, error, and empty-safe native section cards.
- Preserve all fields on save.

### Phase 2: Read-Only Section Parity

- Render Profile, Accounts, Income Sources, Assets, Liabilities, Insurance, Taxes, Assumptions, and Planning Notes.
- Render the Accounts section with connected institutions, synced accounts, manual accounts, hidden-account state, reconnect state, and investment account context.
- Replace desktop tables with mobile card/row layouts.
- Add formatting helpers for currency, percentages, dates, badges, and source status.
- Decode and preserve investments, and display investment context inside Accounts.

### Phase 3: Core Edit Sheets

- Add native sheets for Profile, Taxes, Assumptions, and Planning Notes.
- Add optimistic saves and rollback behavior.
- Add delete confirmation sheets for Planning Notes.

### Phase 4: Collections And Linking

- Add sheets for Accounts, Income Sources, Assets, and Liabilities.
- Add hide/delete account behavior.
- Add native account connect, reconnect, sync all, per-institution sync, hidden account management, and investment edit flows inside My Profile.
- Add filtered link option logic for assets, liabilities, and insurance links.
- Remove or de-emphasize the standalone Accounts page after My Profile reaches account feature parity.

### Phase 5: Insurance Parity

- Add native insurance policy list.
- Add cloud safety notice.
- Add native multi-step policy intake and edit sheets.
- Enforce cloud-blocking rules before save.
- Preserve legacy policy display compatibility.

### Phase 6: Polish, Accessibility, And Test Pass

- Audit VoiceOver labels for every action button and sheet.
- Verify dynamic type and small-screen layouts.
- Verify dark mode if the app supports it.
- Add previews for loaded, empty, loading, and error states.
- Test demo mode and authenticated mode.

## Acceptance Criteria

- The old raw remote feature profile UI is gone.
- The profile file is named `my-profile.swift`.
- The main SwiftUI view is named `MyProfileView`.
- The page is a vertical scroll with no section navbar.
- All web/desktop financial profile sections are represented natively.
- All web/desktop add/edit/delete dialog flows have native sheet equivalents.
- My Profile fully replaces the native Accounts page for connected, manual, and investment account management.
- Save flows preserve the full profile payload.
- Loading, refresh, saving, empty, success, and error states are visible and understandable.
- Insurance cloud safety rules match web/desktop behavior.
- Hidden accounts remain hidden in the main Accounts section.
- Manual accounts, synced accounts, and investment accounts all appear in the Accounts section.
- Account connect, reconnect, sync all, per-institution sync, hide, delete, and investment edit actions live inside My Profile.
- Linked asset/liability/insurance options are filtered with equivalent logic to web/desktop.
- The page works in demo mode without attempting real bank connection flows.
- No SwiftUI code imports or reuses package UI from the TypeScript shared feature.

## Non-Goals

- Do not build the top section navbar in the first pass.
- Do not share UI code from `packages/`.
- Do not redesign the API contract unless native parity exposes a missing endpoint.
- Do not store profile data locally as a source of truth.
- Do not add local-private insurance storage to iOS in this feature.
- Do not implement full tax planning beyond the existing tax profile fields.
- Do not change web/desktop behavior as part of this iOS overhaul unless parity gaps require a separate approved spec.

## Product Decisions

- Investments live inside the Accounts section on iOS.
- My Profile should go all-in on the full web/desktop view and edit surface, translated into native SwiftUI cards and slide-up sheets.
- Account connect/sync/reconnect actions live inside My Profile.
- The standalone native Accounts page should be deleted from user-facing navigation after My Profile reaches account feature parity.

