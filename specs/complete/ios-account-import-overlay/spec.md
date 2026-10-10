# iOS Account Import — Full-Screen Sheet Overlay

## Status

Draft. Created June 22, 2026 after reviewing the current `ConnectInstitutionSheet` post-authorization UX on iOS.

Do not implement until this spec is approved.

## Goal

Replace the small inline loading and success indicators in the iOS add-account sheet with a full-screen takeover that clearly communicates import progress, warns users not to interrupt the flow, and celebrates successful completion before returning to the host screen.

Success means:

- After a user selects an institution and completes provider authorization (Plaid Link today), the add-account sheet shows a dedicated full-screen overlay until import finishes.
- The overlay blocks dismissal and interaction with the underlying institution search UI while import is in progress.
- On success, the overlay shows a prominent checkmark and confirmation copy before the user dismisses the sheet.
- The experience is consistent across every entry point that presents `ConnectInstitutionSheet`.
- Users understand that closing or backgrounding the app during import may leave sync incomplete.

## Product Context

Connecting a bank is a high-anxiety moment. Users have just handed credentials to a third-party provider and returned to Moat Finance while server-side work continues: token exchange, account discovery, historical transaction import, and rule application.

Today that work is easy to miss. The sheet shows a small `ProgressView` row ("Starting connection...") and then a footnote-sized success banner. Users can still tap the close button, swipe the sheet down, or navigate away while import is running. That creates support confusion ("I connected my bank but nothing showed up") and can interrupt long-running initial syncs.

The overlay should feel intentional and protective — similar in seriousness to Apple Wallet's sync phase, but as a true full-screen layer inside the existing add-account sheet rather than a compact card in the scroll content.

## Current Repo Context

### Primary files

| Concern | Location |
|---------|----------|
| Add-account sheet UI | `apps/ios/Moat/Features/FinancialConnections/Views/connect-institution-sheet.swift` |
| Connection view model | `apps/ios/Moat/Features/FinancialConnections/ViewModels/connect-institution-view-model.swift` |
| Provider launch + token exchange | `apps/ios/Moat/Features/FinancialConnections/Services/provider-launch-coordinator.swift` |
| Plaid Link presentation | `apps/ios/Moat/Features/Accounts/Services/plaid-link-coordinator.swift` |
| Token exchange API call | `apps/ios/Moat/Features/Accounts/Services/accounts-service.swift` → `exchangePublicToken` |
| Shared loading component | `apps/ios/Moat/Core/DesignSystem/Components/LoadingView.swift` |
| Apple Wallet sync UI (reference pattern) | `apps/ios/Moat/Features/AppleWallet/Views/apple-wallet-connect-view.swift` |

### Entry points

`ConnectInstitutionSheet` is presented from:

- `apps/ios/Moat/Features/Accounts/Views/accounts-view.swift`
- `apps/ios/Moat/Features/Onboarding/Views/onboarding-view.swift`
- `apps/ios/Moat/Features/Shared/Views/my-profile.swift` (`.connectSyncedAccount` sheet)

Each host passes `onSuccess` and `onClose` callbacks. Today, `onChange(of: viewModel.successMessage)` fires `onSuccess` immediately when import completes, which often dismisses the sheet and shows a separate parent-level action message sheet.

### Current post-authorization behavior

1. User selects an institution from search or popular grid.
2. `ConnectInstitutionViewModel.connect()` sets `isConnecting = true`.
3. Inline UI shows a small `HStack` with `ProgressView()` and "Starting connection...".
4. `ProviderLaunchCoordinator.launch()` opens Plaid Link, then calls `exchangePublicToken` (server runs initial sync as part of exchange).
5. On success, `successMessage` is set to copy like: `Connected {institution} with {n} accounts. Initial sync is running.`
6. Inline `ConnectInstitutionBanner` renders a small tinted label.
7. `onSuccess(message)` propagates to the host, which dismisses the sheet and may show another confirmation sheet.

Problems:

- Loading and success states are inline banners in scroll content, not a focused takeover.
- Close (`xmark`) and swipe-to-dismiss remain available during import.
- Success copy mentions sync is running but the UI does not hold the user's attention through completion.
- Parent screens duplicate success messaging in a second sheet.

### Server-side context

Initial import duration depends on transaction volume and DB write performance. See [specs/features/plaid-transaction-import-optimization/spec.md](../plaid-transaction-import-optimization/spec.md). The overlay must tolerate multi-second (sometimes 10–30+ second) waits without feeling broken.

---

## Target Experience

### Visual model

When import begins, the add-account sheet content is covered by a full-screen overlay inside the sheet's `NavigationStack`. The overlay uses the app background, centers content vertically, and hides search, institution list, privacy notice, and toolbar actions that would let the user leave mid-import.

The sheet should expand to `.large` detent while the overlay is visible so the takeover feels full-height on medium/large presentations.

### Phase 1 — Importing (loading)

Display:

- Large `ProgressView` (`.controlSize(.large)`)
- Title: **Please wait**
- Body: **Importing your account data. This may take a moment.**
- Warning callout (secondary text or subtle banner): **Don't close this sheet or leave the app until import finishes.**

Interaction rules:

- Hide or disable the toolbar close button.
- Disable interactive dismiss (`.interactiveDismissDisabled(true)`).
- Disable institution search and selection underneath.
- Do not fire `onSuccess` or `onClose` while this phase is active.

Optional detail line (non-blocking for v1):

- Institution name once known, e.g. "Connecting Chase…"

### Phase 2 — Success

After import completes successfully, transition the overlay (no flicker back to search UI first) to:

- Large checkmark icon (`checkmark.circle.fill`), ~64–72 pt, positive color token
- Title: **Data imported successfully**
- Body (one line, institution-aware when available): e.g. **Chase is connected with 3 accounts.**
- Primary button: **Done**

Interaction rules:

- Close button remains hidden until the user taps **Done**.
- Tapping **Done** calls the host `onSuccess` message (if still needed) and dismisses via `onClose`.
- Auto-dismiss is **not** used — user explicitly confirms.

### Phase 3 — Failure (error)

If token exchange or provider launch fails:

- Dismiss the overlay and return to the search UI **or** show an error state on the overlay with **Try again** (product choice: return to search UI for v1 to minimize new states).
- Show existing error banner pattern (`ConnectInstitutionBanner`) with actionable copy.
- Re-enable close button and interactive dismiss.

Cancellation (user exits Plaid Link):

- No overlay. Return to search UI as today.

---

## Scope

### In scope

- Full-screen overlay inside `ConnectInstitutionSheet` for the Plaid connect path (institution search → Plaid Link → token exchange / initial sync).
- View-model phase enum to replace ad-hoc `isConnecting` + `successMessage` banner combo for this flow.
- Block sheet dismissal during active import.
- Unified success presentation inside the sheet; reduce duplicate parent confirmation sheets where the overlay already confirmed success.
- All three entry points listed above.

### Out of scope for v1

- Redesigning institution search, popular grid, or security sub-screen.
- Apple Wallet connect overlay (separate sheet: `AppleWalletConnectView` already has phase-based cards; may align in a follow-up).
- MX / Finicity external-browser flows (different lifecycle: user leaves app, returns later; overlay semantics differ).
- Plaid reconnect flow (can reuse overlay pattern in a follow-up spec).
- Changing server sync behavior or API contracts.
- Web or desktop connect UX.

---

## State Model

Introduce an explicit overlay phase on `ConnectInstitutionViewModel`:

```swift
enum ConnectInstitutionOverlayPhase: Equatable {
    case none
    case importing(institutionName: String?)
    case succeeded(institutionName: String, accountCount: Int)
    case failed(message: String) // optional v1 — may map to inline banner instead
}
```

Rules:

- `none` — normal search/select UI.
- `importing` — set before `ProviderLaunchCoordinator.launch()` begins; cleared only on terminal success/failure/cancel.
- `succeeded` — set when `ProviderLaunchOutcome.plaidConnected` resolves; waits for user **Done**.
- Plaid cancellation resets to `none` without showing overlay failure UI.

Deprecate for the happy path:

- Inline `isConnecting` row in scroll content.
- Inline success `ConnectInstitutionBanner` when overlay handles success.

Keep:

- `errorMessage` inline banner for non-overlay failures (search errors, demo mode, launch failures that return to search).

---

## Host Screen Updates

Today hosts react to `onSuccess` by immediately dismissing and showing their own sheet:

| Host | Current behavior |
|------|------------------|
| `AccountsView` | Dismiss connect sheet → show `MoatGlassSheet` action message |
| `OnboardingView` | `markAccountConnected(message)` |
| `MyProfileView` | Dismiss → `setActionMessage(title: "Bank connected", …)` |

After this change:

- `onSuccess` should fire when the user taps **Done** on the overlay (not on background import completion).
- Hosts should refresh data on success but **should not** show a second full confirmation sheet for the standard Plaid connect path — the overlay already confirmed success.
- Hosts may still show lightweight feedback for partial failures or reconnect flows outside this spec.

Consider narrowing the callback:

```swift
onSuccess: (ConnectInstitutionSuccess) -> Void

struct ConnectInstitutionSuccess {
    let institutionName: String
    let accountCount: Int
}
```

---

## UI Implementation Notes

- Extract overlay into `connect-institution-import-overlay.swift` (single primary view) to keep `connect-institution-sheet.swift` modular.
- Overlay attaches via `.overlay { … }` or conditional root replacement inside `NavigationStack` — must cover safe areas and toolbar.
- Reuse `MoatTheme` spacing, color tokens, and `.moatPrimary` button style.
- Match typography hierarchy: title `.title2.weight(.semibold)`, body `.subheadline` secondary.
- Warning callout can use `MoatTheme.ColorToken.warning` at reduced emphasis or a shield / hand.raised SF Symbol — avoid alarmist styling.
- VoiceOver: announce phase changes ("Importing account data", then "Data imported successfully").
- Dynamic Type: allow text wrapping; keep icon size fixed.

Reference (Apple Wallet sync card — similar intent, not full-screen today):

```235:247:apps/ios/Moat/Features/AppleWallet/Views/apple-wallet-connect-view.swift
    private func progressCard(title: String, message: String) -> some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            ProgressView()
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.large)
    }
```

Current inline indicators being replaced:

```106:121:apps/ios/Moat/Features/FinancialConnections/Views/connect-institution-sheet.swift
                if let successMessage = viewModel.successMessage {
                    ConnectInstitutionBanner(
                        message: successMessage,
                        systemImage: "checkmark.circle.fill",
                        tint: MoatTheme.ColorToken.positive
                    )
                }

                if viewModel.isConnecting {
                    HStack(spacing: MoatTheme.Spacing.small) {
                        ProgressView()
                        Text("Starting connection...")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
```

---

## Acceptance Criteria

- Selecting an institution and completing Plaid Link shows a full-screen overlay inside the add-account sheet — not inline banners.
- Overlay copy includes **Please wait**, import explanation, and **Don't close this sheet or leave the app until import finishes.**
- User cannot dismiss the sheet via close button or swipe while import is in progress.
- On successful import, overlay shows a large checkmark and **Data imported successfully** with institution summary.
- User taps **Done** to leave; only then does the host receive success callback and dismiss.
- Host screens do not show a redundant second success sheet for the standard Plaid connect path.
- Plaid Link cancel returns to search UI with no overlay stuck on screen.
- Import failure returns to search UI with an error message; sheet is dismissible again.
- Behavior is identical from Accounts, Onboarding, and My Profile entry points.
- No PII (account numbers, tokens, raw transaction data) appears in overlay copy or logs added for this feature.

## Non-Goals

- Do not change Plaid Link itself or provider selection UX.
- Do not add progress percentage or transaction counts during import (server does not stream granular progress today).
- Do not block the entire app — only the add-account sheet.
- Do not share UI with web/desktop packages.

## Follow-Ups (not in v1)

- Apply the same overlay pattern to Apple Wallet initial import inside `AppleWalletConnectView`.
- Apply to Plaid reconnect when user re-authenticates an existing item.
- Evaluate overlay for MX/Finicity return-from-browser completion once deep-link handoff is reliable on iOS.

## Implementation Phases

### Phase 1: View model + overlay UI

- Add `ConnectInstitutionOverlayPhase` to the view model.
- Wire phase transitions through `connect()` and `handleLaunchOutcome`.
- Build `ConnectInstitutionImportOverlay` with importing and success layouts.
- Integrate overlay into `ConnectInstitutionSheet`; disable dismiss while importing.

### Phase 2: Host callback cleanup

- Defer `onSuccess` until **Done**.
- Remove duplicate parent success sheets for Plaid connect in Accounts, Onboarding, and My Profile.
- Trigger data refresh on dismiss.

### Phase 3: Polish

- Accessibility audit.
- Previews for importing, success, and error states.
- Manual test on slow network / large account history.
