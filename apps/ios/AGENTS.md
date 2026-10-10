# apps/ios — Agent Overlay

> **Baseline**: Read [CLAUDE.md](../../CLAUDE.md) first. This file adds iOS-specific context on top of it.

---

## Purpose

`apps/ios` is the native iOS app built with SwiftUI. It surfaces Moat Finance data on iOS and is the home for Apple Wallet / FinanceKit integration. It authenticates against `apps/api` and stores tokens securely in the iOS Keychain.

---

## Toolchain

This app uses Xcode and Swift tooling — not pnpm. There are no JavaScript dependencies.

| Task | How |
|------|-----|
| Open project | Open `apps/ios/Moat.xcodeproj` in Xcode |
| Run on simulator | Xcode → Product → Run |
| Build for release | Xcode → Product → Archive |
| Run tests | Xcode → Product → Test |

---

## Code structure

```
apps/ios/Moat/
├── App/                    ← App entry point (SwiftUI @main)
├── Core/                   ← Shared services: API client, auth, Keychain
├── Features/               ← Feature modules (organized by domain)
│   ├── Auth/
│   ├── Dashboard/
│   ├── Transactions/
│   ├── Accounts/
│   └── ...
└── Resources/              ← Assets, Info.plist, xcconfig files
```

---

## Architecture

### Auth

- Credential login calls `apps/api` auth endpoints to get `accessToken` + `refreshToken`.
- Both tokens are stored in the **iOS Keychain** — never in `UserDefaults`.
- Access token is attached as a `Bearer` header on API requests.
- Refresh token is used to silently rotate the access token when it expires.

### Environment configuration

- API base URL and other environment variables are set via `.xcconfig` files in `Resources/`.
- **Never hardcode API URLs or secrets** in Swift source files. Use xcconfig.
- Local dev points to `http://localhost:3001`; production points to the deployed API.

### Apple Wallet / FinanceKit

- FinanceKit requires iOS 17.4+ (US only) and a managed entitlement (`com.apple.developer.financekit`).
- All FinanceKit code must be guarded behind `@available(iOS 17.4, *)` checks.
- FinanceKit data is normalized into app-owned DTOs (`ExternalAccountDTO`, `ExternalTransactionDTO`) before being sent to the API.
- FinanceKit is treated as a separate integration source (`APPLE_FINANCEKIT`) — not Plaid.
- **There is no server-side Apple Wallet sync.** FinanceKit is device-local, so the phone initiates every sync. Do not add an Apple Wallet cron to `apps/api`.
- **Sync incrementally.** Prefer `fetchTransactionChanges(for:since:)` (FinanceKit change stream) over the 365-day snapshot; the snapshot is only a first-sync and token-invalidation fallback.
- History tokens are opaque `Data` in the Keychain via `AppleFinanceKitHistoryTokenStore` — never `UserDefaults`, and never `FinanceStore.HistoryToken` across a service boundary.
- Background delivery requires iOS 26 plus a shared App Group; guard it with `#if compiler(>=6.2)` so older Xcode toolchains still build.

---

## Design system — toggles

The app root applies `.tint(MoatTheme.ColorToken.ink)`, which makes unstyled SwiftUI `Toggle`s look like a solid white/ink pill when on — especially in dark mode. That is wrong.

**Every `Toggle` must use `.moatToggleStyle()`** (from `Core/DesignSystem/Components/moat-toggle.swift`):

- **ON** → `MoatTheme.ColorToken.toggleOn` (saturated blue in light and dark)
- **OFF** → system empty track (neutral gray / outline)

```swift
Toggle("Show community tips", isOn: $enabled)
    .moatToggleStyle()
```

Do not rely on the app-wide tint, and do not set a custom `.tint(...)` on toggles unless you have a deliberate non-switch control. Prefer `.moatToggleStyle()` over ad-hoc `.tint(MoatTheme.ColorToken.accent)`.

---

## Design system — numeric keyboard dismiss

Number pads (`.numberPad`, `.decimalPad`) have no Return/Done key. **Any screen that presents a numeric keyboard must include the shared dismiss accessory.**

Use `MoatKeyboardDismissToolbar` / `.moatKeyboardDismissToolbar()` from `Core/DesignSystem/Components/moat-keyboard-dismiss.swift`:

```swift
.toolbar {
    ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
    ToolbarItem(placement: .confirmationAction) { Button("Save", action: save) }
    MoatKeyboardDismissToolbar()
}

// Or as a one-liner when there is no existing toolbar block:
.moatKeyboardDismissToolbar()
```

`MoatGlassSheet` / `MoatFittedGlassSheet` already include this toolbar — feature sheets that use them do not need a second copy.

Optional hashtag chips can be passed into `MoatGlassSheet(keyboardSuggestions:onSelectKeyboardSuggestion:)` (or into `MoatKeyboardDismissToolbar` directly). They render as a horizontally scrolling row to the left of the dismiss chevron. Matching helpers live in `Core/Utilities/hashtag-suggestions.swift`.

---

## Design system — chart inspection

Shared Swift Charts live in `Core/DesignSystem/FinancialCharts/`. Inspection (tooltip / crosshair) is **hold-to-inspect**, not immediate-drag:

- Vertical and horizontal scrolling must work on first swipe. Do not use `DragGesture(minimumDistance: 0)` on a chart.
- Inspection starts only after a still hold of `FinancialChartInteraction.holdDuration` (~300ms). Movement beyond `FinancialChartInteraction.movementThreshold` (~10pt) cancels the hold and lets the page scroll.
- After activation, dragging updates the selected value. Releasing exits inspection.
- Date-based charts use `FinancialChartInteractionOverlay`. Charts with a custom x-axis (for example allocation bars) use `FinancialChartHoldToInspectOverlay` and supply their own hit-testing.
- Tune hold duration and movement threshold only in `FinancialChartInteraction` so every chart stays consistent.

```swift
.chartOverlay { proxy in
    GeometryReader { geometry in
        FinancialChartInteractionOverlay(
            proxy: proxy,
            geometry: geometry,
            points: points,
            date: \.date,
            selectedPoint: $selectedPoint
        )
    }
}
```

Do not attach a competing chart drag gesture in feature code. New charts should go through the shared overlay so they inherit this behavior.

---

## Design system — pull-to-refresh

Data-backed `ScrollView` / `List` pages use native SwiftUI `.refreshable`. SwiftUI owns pull resistance, the system spinner, and dismissal. Do not add a custom overlay spinner, drag-distance math, or offset reset.

```swift
ScrollView {
    pageContent
}
.refreshable {
    await viewModel.refresh()
}
```

Rules:

- Await the refresh work inside `.refreshable`. Never wrap it in `Task { }` — that lets SwiftUI dismiss the spinner immediately.
- `refresh()` must refetch the same data as a fresh landing on that page, and must await every network/database call. Independent fetches can use `async let`.
- Keep already-loaded content on screen. Do not flip to `.loading` or show page/section skeletons during pull-to-refresh.
- Attach `.refreshable` to the `ScrollView` or `List`, not an outer loading/error wrapper.
- Do not add an artificial sleep to keep the spinner visible.

Wrong:

```swift
.refreshable {
    Task { await viewModel.refresh() }
}
```

---

## Anti-patterns

- **Don't store tokens in `UserDefaults`** — Keychain only.
- **Don't hardcode API base URLs in Swift source.** Use xcconfig and a config service.
- **Don't import raw FinanceKit types into non-FinanceKit layers.** Normalize at the boundary.
- **Don't assume FinanceKit is available.** Always check availability before calling FinanceKit APIs.
- **Don't call PostHog SDK APIs directly from feature code.** Use `Analytics.capture` / `Analytics.identify` in `Core/Analytics/Analytics.swift`.
- **Don't ship a `Toggle` without `.moatToggleStyle()`.** Unstyled toggles inherit the ink root tint and lose the blue ON / empty OFF states in dark mode.
- **Don't ship a `.numberPad` / `.decimalPad` field without `MoatKeyboardDismissToolbar`.** Numeric pads have no built-in dismiss key.
- **Don't ship a custom pull-to-refresh spinner.** Use native `.refreshable` and await the refetch. Keep loaded content visible; never wrap the closure in `Task { }`.
- **Don't attach `DragGesture(minimumDistance: 0)` to a chart.** Immediate-drag inspection steals vertical scrolling. Use the shared hold-to-inspect overlays.

---

## Analytics (PostHog)

Product analytics go through `Moat/Core/Analytics/Analytics.swift`. Configure `POSTHOG_API_KEY` / `POSTHOG_HOST` via xcconfig / Info.plist. Follow root `AGENTS.md` naming rules. Identify with `userId` as distinct ID and optional account email as a person property. Capture events must not include email or other PII. Session replay and element-interaction autocapture stay off. Event catalog: `docs/security/analytics-events.md`.

---

## Change-type routing table

| When you are doing X… | Read |
|-----------------------|------|
| Adding a new screen or feature module | This file (code structure + architecture sections) |
| Adding or styling a `Toggle` / switch | This file (Design system — toggles) — always `.moatToggleStyle()` |
| Adding a `.numberPad` / `.decimalPad` field | This file (Design system — numeric keyboard dismiss) — use `MoatKeyboardDismissToolbar` |
| Adding pull-to-refresh to a scroll/list page | This file (Design system — pull-to-refresh) — native `.refreshable`, await refetch, no custom spinner |
| Adding or modifying a Swift Chart | This file (Design system — chart inspection) — hold-to-inspect via `FinancialChartInteractionOverlay` / `FinancialChartHoldToInspectOverlay` |
| Changing auth / token handling | This file (Auth section) — Keychain only, never UserDefaults |
| Adding or modifying FinanceKit integration | This file (Apple Wallet section) + `@available(iOS 17.4, *)` guard required |
| Changing API base URL or environment config | This file (xcconfig convention) |
| Adding a new API call | `Core/` API client — normalized DTOs only, no raw FinanceKit types |

