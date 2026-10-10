# iOS Onboarding Step 3 — Portfolio Allocation + Multi-Institution Connect

## Status

Draft. Created June 22, 2026 after reviewing iOS onboarding step 3 (`apps/ios/Moat/Features/Onboarding/`), the dashboard portfolio allocation card, `InstitutionLogoView`, and the shared onboarding connect-accounts direction in [shared-onboarding](../../complete/shared-onboarding/spec.md).

## Goal

Redesign iOS onboarding **Step 3 of 5** (`OnboardingStep.profile`) so the primary payoff is a live portfolio allocation preview at the top, with a simple multi-institution connected-accounts list and an always-available "add more" action below.

Success means:

- The top of the step shows a **portfolio allocation chart** that starts empty and fills in as accounts sync.
- Users can connect **more than one institution** during onboarding; each appears as its own row.
- Each connected row shows the institution logo (Logo.dev), name, and account count in a compact single-line format: `Robinhood · 3 accounts connected`.
- Connecting an additional institution does not replace or hide prior connections.
- Profile inputs (age, retirement age, invest toggle) remain on this step but are secondary to the allocation + connect experience.

## Product Context

Step 3 is the first moment an iOS user sees what their Moat dashboard will look like once data is connected. Today the step shows a single green "Account connected" banner after one Plaid link — there is no allocation preview and no list of connected institutions.

The redesigned step should answer: *"What will my money look like in Moat, and which institutions have I linked so far?"*

This aligns with web/desktop onboarding direction (portfolio allocation above account connect) but adapts to iOS single-column layout and native SwiftUI patterns.

## Current Repo Context

### iOS onboarding step 3 today

| File | Role |
|------|------|
| `apps/ios/Moat/Features/Onboarding/Views/onboarding-view.swift` | `profileStep` — profile card + single connect card |
| `apps/ios/Moat/Features/Onboarding/ViewModels/onboarding-view-model.swift` | `plaidConnected: Bool`, `connectionMessage: String?` — single-connection model |
| `apps/ios/Moat/Features/Onboarding/Models/onboarding-models.swift` | `OnboardingStep.profile` — title "Shape your plan" |
| `apps/ios/Moat/Features/FinancialConnections/Views/connect-institution-sheet.swift` | Reusable connect sheet (Plaid / MX / Finicity / Apple Wallet) |

**Current connect UX problems:**

1. `plaidConnected` is a boolean — only one connection state is tracked in the view model.
2. After the first connect, the primary CTA disappears; there is no obvious way to add another institution.
3. Success is a generic green label, not a per-institution list.
4. No portfolio allocation preview on this step.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Portfolio allocation API | `GET /api/v1/investment/getPortfolioAllocation` | Already used by `DashboardService.fetchPortfolioAllocation()` |
| Connected institutions API | `GET /api/v1/plaid/getConnectedInstitutions` | Returns `[PlaidInstitution]` with nested `accounts` |
| Dashboard allocation UI | `DashboardView.swift` → `PortfolioAllocationCard`, `AllocationBreakdownBar`, `AllocationRow` | Private structs; candidate for extraction |
| Institution logos | `InstitutionLogoView` + `InstitutionLogoURL` | Logo.dev CDN; name-based fallback when domain unknown |
| Connect sheet | `ConnectInstitutionSheet` | Already wired in onboarding; `onSuccess` callback today sets boolean |

### Data models

`PlaidInstitution` (`accounts-models.swift`):

- `institutionName: String`
- `accounts: [PlaidAccount]` — use `activeAccounts.count` for display count
- No `website` / `logoUrl` on the model today — logo resolution uses institution **name** via Logo.dev `/name/{encodedName}`

## Target Experience

### Step 3 layout (top → bottom)

```
┌─────────────────────────────────────────┐
│  Step 3 of 5                     [Skip] │
│  ████████░░░░░░░░░░  progress bar       │
├─────────────────────────────────────────┤
│  Shape your plan                        │
│  These details help Moat tune…          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Portfolio allocation             │  │  ← TOP: allocation chart
│  │  [empty state OR breakdown bar]   │  │
│  │  [section rows when data exists]  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  [logo] Robinhood · 3 accounts    │  │  ← connected rows
│  │         connected                 │  │
│  │  [logo] Chase · 2 accounts        │  │
│  │         connected                 │  │
│  │                                   │  │
│  │  [ Connect bank ]                 │  │  ← always visible CTA
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Current age / Retirement age     │  │  ← profile inputs (unchanged)
│  │  Invest toggle                    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [ Back ]              [ Continue ]     │
└─────────────────────────────────────────┘
```

### 1. Portfolio allocation chart (top card)

**Component:** Extract or mirror `PortfolioAllocationCard` from `DashboardView.swift` into a shared SwiftUI view (e.g. `PortfolioAllocationChartView`) usable by dashboard and onboarding.

**States:**

| State | Condition | UI |
|-------|-----------|-----|
| Empty | `sections` empty or total value == 0 | Muted card with headline "Portfolio allocation" and body copy: "Connect accounts to see your allocation." Optional subtle chart-placeholder silhouette (no fake data). |
| Loading | Initial fetch or post-connect refresh | Skeleton or inline `ProgressView` inside the card header area. |
| Populated | `sections` with positive total | Same visual as dashboard: breakdown bar, total value, expandable section rows with labels and compact currency amounts. |

**Data source:** `DashboardService.fetchPortfolioAllocation()` (or thin wrapper in `OnboardingService`).

**Refresh rules:**

- Fetch on step appear (`onboarding-view-model` when `currentStep == .profile`).
- Refetch after each successful `ConnectInstitutionSheet` completion.
- After connect, poll allocation every ~3s for up to ~30s (mirror web onboarding delayed invalidation for Plaid sync latency). Stop polling once sections have data or timeout reached.
- Do not block Continue on allocation being populated — sync may still be running.

### 2. Connected institutions list (middle card)

**Purpose:** Show every linked institution as a compact row. Support N institutions, not one.

**Row format (single line, secondary subline optional):**

```
[InstitutionLogoView 28×28]  Robinhood · 3 accounts connected
```

**Copy rules:**

- Institution name: `PlaidInstitution.institutionName`
- Account count: `institution.activeAccounts.count`
- Pluralization: `1 account connected` vs `3 accounts connected`
- Middle dot separator: ` · ` (thin space optional; use U+00B7)
- No balances, sync timestamps, reconnect actions, or expand/collapse on this step — keep onboarding minimal.

**Logo rules:**

- Use existing `InstitutionLogoView(name: institution.institutionName, size: 28)`.
- Logo.dev resolves via publishable key in xcconfig (`Environment.logoDevPublishableKey`).
- Fallback: first-letter avatar (existing behavior in `InstitutionLogoView`).

**Empty state (no institutions):**

- No rows.
- Card shows short description: "Connect your banks to sync balances, transactions, and investments."
- Primary CTA: **Connect bank** (full-width, `.moatPrimary`).

**Populated state:**

- List rows in connection order (API order or `createdAt` ascending — match Accounts tab).
- **Connect bank** button remains below the list (secondary styling or primary — product preference: primary outline or secondary full-width so adding more is always obvious).

**Apple Wallet:** If FinanceKit-connected accounts appear in `getConnectedInstitutions` (or a separate Apple Wallet institution row is needed), include them in the same list format with appropriate institution name (e.g. "Apple Wallet").

### 3. Connect flow (add more)

- Tapping **Connect bank** presents existing `ConnectInstitutionSheet`.
- On success:
  1. Dismiss sheet.
  2. Refetch `getConnectedInstitutions`.
  3. Trigger allocation fetch + poll loop.
  4. Do **not** set a single `plaidConnected = true` flag — append/replace from API response.
- User may open the sheet multiple times during step 3 without leaving onboarding.
- Step remains skippable via toolbar **Skip** (unchanged).

### 4. Profile inputs (bottom card)

Keep existing fields unchanged:

- Current age (optional)
- Retirement age (optional)
- Toggle: "I invest or want to start investing"

Persist via existing `saveProfile` on Continue (unchanged).

## View Model Changes

Replace single-connection state in `OnboardingViewModel`:

```swift
// Remove
@Published var plaidConnected = false
@Published var connectionMessage: String?

// Add
@Published private(set) var connectedInstitutions: [PlaidInstitution] = []
@Published private(set) var allocationSections: [DashboardPortfolioAllocationSection] = []
@Published private(set) var isLoadingAllocation = false
@Published private(set) var isLoadingInstitutions = false
```

**New methods:**

- `loadConnectAccountsData()` — parallel fetch institutions + allocation
- `refreshAfterConnection()` — called from `ConnectInstitutionSheet.onSuccess`
- `startAllocationPolling()` — timed retry after connect

**Completion metadata:** `OnboardingService.complete(...)` currently accepts `plaidConnected: Bool`. Change to `connectedInstitutionCount: Int` or derive from fetched institutions at complete time. Avoid persisting stale boolean.

## Suggested File Layout

```text
apps/ios/Moat/Features/Onboarding/
├── Views/
│   ├── onboarding-view.swift                    ← restructure profileStep
│   ├── onboarding-allocation-card.swift         ← NEW (extracted chart)
│   └── onboarding-connected-institution-row.swift ← NEW (logo + name + count)
├── ViewModels/
│   └── onboarding-view-model.swift              ← multi-institution + allocation state
└── Services/
    └── onboarding-service.swift                 ← optional: wrap institution/allocation fetch

apps/ios/Moat/Features/Dashboard/Views/
└── portfolio-allocation-chart-view.swift        ← NEW shared component (dashboard + onboarding)
```

Prefer extracting shared allocation UI from `DashboardView.swift` private structs rather than duplicating layout logic.

## Copy Guidelines

| Surface | Copy |
|---------|------|
| Allocation empty | "Connect accounts to see your allocation." |
| Connect card description (empty) | "Connect your banks to sync balances, transactions, and investments." |
| Row subtitle | `{name} · {n} account(s) connected` |
| Connect CTA | "Connect bank" |
| Step title | Keep "Shape your plan" OR update to "Connect your accounts" — **open question** |

Avoid:

- "Account connected" singular banner (replaced by per-institution rows).
- Hiding the connect CTA after the first link.

## Analytics (PostHog)

If events are added:

| Event | When | Properties |
|-------|------|------------|
| `onboarding_allocation_viewed` | Step 3 appears | `{ userId, hasAllocation: boolean, institutionCount: number }` |
| `onboarding_institution_connected` | Connect sheet success | `{ userId, institutionCount: number }` |

Never send institution names, account names, or balances in analytics payloads.

## Implementation Plan

### Phase 1 — View model + data fetching

1. Add institution list and allocation state to `OnboardingViewModel`.
2. Fetch both endpoints when entering step 3 (and on load if resuming on step 3).
3. Replace `markAccountConnected(_:)` with `refreshAfterConnection()`.
4. Update `complete()` to pass institution count instead of boolean.

### Phase 2 — UI components

1. Extract `PortfolioAllocationChartView` from dashboard private structs.
2. Build `OnboardingConnectedInstitutionRow` using `InstitutionLogoView`.
3. Restructure `profileStep` in `onboarding-view.swift` — allocation card on top, connect list in middle, profile card on bottom.

### Phase 3 — Post-connect polling

1. After connect success, poll allocation for up to ~30s.
2. Show loading indicator on allocation card during poll.
3. Institutions list updates immediately from `getConnectedInstitutions` (does not wait for allocation).

## Acceptance Criteria

- [ ] Step 3 shows portfolio allocation card at the top of the scroll content.
- [ ] Allocation card shows empty state before any investment/cash data exists.
- [ ] Allocation card populates after account sync without leaving onboarding.
- [ ] User can connect two or more institutions; each appears as its own row.
- [ ] Each row shows Logo.dev logo (or letter fallback), institution name, and account count.
- [ ] **Connect bank** remains available after one or more connections.
- [ ] Profile inputs still save on Continue.
- [ ] No regression to connect sheet, Skip, Back, or step persistence.
- [ ] Continue is not blocked when allocation is still empty (sync in progress).

## Non-Goals

- Net worth or monthly net gains charts on iOS onboarding (web/desktop only for now).
- Institution disconnect, reconnect, or sync actions on this step.
- Expandable account detail rows.
- Manual investment or real estate entry during onboarding.
- Web or desktop onboarding changes (separate specs).
- New API endpoints — reuse existing allocation and institutions handlers.

## Open Questions

1. Should step title/subtitle change from "Shape your plan" to connect-focused copy now that allocation is the hero?
2. Should profile inputs move to a different step to reduce vertical scroll, or stay on step 3 below connect?
3. Should **Connect bank** use primary or secondary button styling when institutions already exist?
4. Do Apple Wallet / FinanceKit connections surface through `getConnectedInstitutions` today, or does onboarding need a separate row source?
5. Should we add `website` or `logoUrl` to the Plaid institutions API response to improve Logo.dev hit rate vs name-only lookup?

## Related Specs

- [Shared Onboarding — Desktop Privacy + Connect Accounts](../../complete/shared-onboarding/spec.md) — web/desktop allocation-above-connect pattern
- [Logo.dev JIT Fetch](../../complete/logo-dev-jit-fetch.spec.md) — CDN URL construction and publishable key rules
- [Onboarding Invite Code Guessing Game](../onboarding-invite-code-guessing-game.spec.md) — step 1 iOS onboarding

## Suggested Commit Message

```text
docs (ios): adds onboarding connect accounts spec
```
