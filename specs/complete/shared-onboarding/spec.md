# Shared Onboarding — Desktop Privacy Step + Connect Accounts

## Status

Draft. Created June 13, 2026 after reviewing the web onboarding flow (`apps/web/src/app/onboarding/onboarding-flow/`), the desktop onboarding flow (`apps/desktop/src/renderer/src/pages/onboarding/`), shared UI packages (`@moat/ui`, `@moat/charts`, `@moat/features`), and the Phase 3 shared-UI architecture spec.

## Goal

Mirror the web app's connect-accounts onboarding experience in the desktop app, with one desktop-only privacy explainer as the first step, and extract the connect-accounts step into a shared package that both `apps/web` and `apps/desktop` consume.

Success means:

- Desktop users see a visually compelling local-first / SQLite privacy screen before anything else in onboarding.
- Web and desktop share the same connect-accounts split layout: accounts on the left, three scrollable charts on the right.
- The right panel adds **portfolio allocation** above the two charts web already shows (net worth, monthly net gains).
- Platform-specific actions (Plaid connect, investment dialogs, profile persistence) stay in each host app — only layout, data hooks, and presentational UI move to shared packages.
- Desktop onboarding version bumps so V1 completers are not auto-shown the old flow.

## Product Context

Moat Finance Desktop is local-first: financial data lives in a SQLite database on the user's device, protected by a local vault unlock. The web app is cloud-backed with the same dashboard metaphors (accounts, net worth, allocation, cash flow). Onboarding is the first moment users understand what Moat does and why they should connect data.

The desktop privacy screen answers: *"Where does my data live, and who can see it?"*

The shared connect-accounts screen answers: *"What will my dashboard look like once I add accounts?"*

These are different jobs. The privacy screen is desktop-only. The connect-accounts screen is the shared payoff moment for both surfaces.

## Current Repo Context

### Web onboarding

Location: `apps/web/src/app/onboarding/onboarding-flow/`

Current 4-step flow:

| Step | Component | Notes |
|------|-----------|-------|
| 1 | `StepGoals` | Goal selection grid |
| 2 | `StepConnectAccounts` | Split layout — **this step is being shared** |
| 3 | `StepReferral` | Referral source |
| 4 | `StepComplete` | Confetti + navigate to dashboard |

Step 2 layout today (`step-connect-accounts/index.tsx`):

- **Left column:** heading, `ProfileInputs`, `AccountList` (Plaid connect, manual investment)
- **Right column:** two charts with blur overlays when no accounts connected
  1. `NetWorthChart` (web-local, fetches via React Query)
  2. `MonthlyNetGainsChart` (web-local, fetches monthly aggregates)

Step 2 fetches data directly via `@moat/client-ts` (`getConnectedInstitutions`, `getAllInvestments`, `listRealEstate`, `getMonthlyAggregates`). It does not use `FinApiClient` or `@moat/features`.

Shell: `OnboardingHeader` + full-height content area (`lg:overflow-hidden` on step 2) + `OnboardingNav`.

### Desktop onboarding

Location: `apps/desktop/src/renderer/src/pages/onboarding/`

Current 4-step flow (all bullet-list explainers):

| Step | Component | Notes |
|------|-----------|-------|
| 1 | `LocalVaultStep` | Local vault copy |
| 2 | `ImportDataStep` | CSV / Plaid import copy |
| 3 | `AgentAccessStep` | MCP agent copy |
| 4 | `CompleteStep` | Finish |

Shell: `OnboardingShell` — centered `max-w-2xl` layout, not suitable for split step 2.

Persistence: `UserMetadata` keys via IPC (`desktop_onboarding_*`), version `DESKTOP_ONBOARDING_VERSION = "1"` in `packages/contracts/src/ipc/onboarding.ts`.

Launch: shown after vault unlock in `desktop-shell.tsx`, not before.

### Shared packages (already in place)

| Package | Relevant exports |
|---------|------------------|
| `@moat/charts` | `PortfolioAllocationChart`, `NetWorthChart`, `MonthlyNetGainsChart` — props-based, no API calls |
| `@moat/features` | `useApiClient()`, `ForecastProvider`, `OverviewDashboard` (reference pattern for chart data fetching) |
| `@moat/ui` | Card, Button, Input, etc. — used by desktop renderer |
| `@moat/contracts` | `FinApiClient` with `getPortfolioAllocation()`, `getBalanceSnapshotHistory()`, `getMonthlyAggregates()`, `listAccounts()` |
| `@moat/state` | `sidebar-store.ts` only — onboarding store not yet extracted |

Phase 3 spec (`specs/complete/desktop-electron-app/phase-3-shared-ui-packages-and-consumption.md`) already envisioned `packages/features/onboarding/` and `packages/state/onboarding-store.ts`. Neither exists yet.

### Contract gaps

Web step 2 uses SDK methods not yet on `FinApiClient`:

- `getConnectedInstitutions()`
- `getAllInvestments()`
- `listRealEstate()`

Desktop has equivalent IPC (`accounts.list()`, `investments.list()`, `realEstate.list()`) but they are not unified behind `FinApiClient` for onboarding.

Web profile save uses `saveOnboardingProfile()` from `@moat/client-ts` — cloud-specific. Desktop should persist age/retirement via local profile or metadata; this stays host-injected.

---

## Target Experience

### Desktop flow (V2)

Onboarding appears after successful local vault unlock (unchanged).

| Step | Screen | Package | Layout |
|------|--------|---------|--------|
| 1 | Local privacy explainer (SQLite, no cloud, vault) | `apps/desktop` only | Centered hero |
| 2 | Connect accounts | `@moat/features/onboarding` | Full-height split |
| 3 | Complete | `apps/desktop` only | Centered |

**V2 scope decision:** Desktop does not mirror web steps 1 (goals), 3 (referral). The privacy screen replaces goals/referral as desktop-specific positioning. Connect accounts is the single actionable step.

Users can skip at any point (existing behavior). Skip and complete both suppress future auto-show for version `2`.

### Web flow (updated)

| Step | Component | Change |
|------|-----------|--------|
| 1 | `StepGoals` | Unchanged (web-local) |
| 2 | `@moat/features/onboarding` `StepConnectAccounts` | **Replace** local `step-connect-accounts/` |
| 3 | `StepReferral` | Unchanged (web-local) |
| 4 | `StepComplete` | Unchanged (web-local) |

### Connect-accounts layout (shared, both platforms)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (step N of M)                              [Skip]       │
├──────────────────────────┬──────────────────────────────────────┤
│  LEFT (scrollable)       │  RIGHT (scrollable)                  │
│                          │                                      │
│  Heading + description   │  ┌─────────────────────────────┐    │
│  ProfileInputs           │  │ PortfolioAllocationChart    │ ← NEW│
│  AccountList             │  └─────────────────────────────┘    │
│    - connected accounts  │  ┌─────────────────────────────┐    │
│    - connect CTA (slot)  │  │ NetWorthChart               │    │
│    - add investment(slot)│  └─────────────────────────────┘    │
│                          │  ┌─────────────────────────────┐    │
│                          │  │ MonthlyNetGainsChart        │    │
│                          │  └─────────────────────────────┘    │
├──────────────────────────┴──────────────────────────────────────┤
│  [Back]                                          [Continue]     │
└─────────────────────────────────────────────────────────────────┘
```

**Right panel rules:**

1. **Three charts, top to bottom:**
   - `PortfolioAllocationChart` — **new addition** to onboarding
   - `NetWorthChart` — existing
   - `MonthlyNetGainsChart` — existing (monthly income / net gains)

2. **Scrollable:** The right column uses `overflow-y-auto` with a max height tied to the viewport (match web's `lg:max-h-[calc(100vh-10rem)]`). All three charts stack vertically with consistent `space-y-3` spacing. Users scroll to see charts below the fold — the column does not try to fit all three charts in one viewport.

3. **Empty state:** When `hasAccounts === false`, each chart is blurred (`pointer-events-none blur-sm`) with a centered overlay message (reuse existing copy patterns):
   - Portfolio: "Connect accounts to see your allocation"
   - Net worth: "Connect accounts to see your net worth"
   - Monthly gains: "Connect accounts to see your cash flow"

4. **Historical net worth only:** `NetWorthChart` shows the last 24 months of history — same as Overview. Do not pass `forecast` / `forecastYears` or wrap the preview in `ForecastProvider`. Profile age inputs stay on the left for later planning; they do not drive this chart.

5. **Data on connect:** When a user connects an account, hosts invalidate React Query keys for portfolio, balance snapshot history, and monthly aggregates so all three charts update. Web already has a delayed re-invalidation loop for Plaid webhook latency; desktop should mirror invalidation (without necessarily copying the exact timing unless Plaid sync timing is equivalent).

---

## Desktop Step 1 — Local Privacy Explainer

**Location:** `apps/desktop/src/renderer/src/pages/onboarding/local-privacy-step.tsx` (replaces `local-vault-step.tsx`)

**Purpose:** Visually explain that Moat Finance Desktop is fully private and uses a local SQLite database. This is not a bullet-list explainer — it should feel like a product moment.

**Content pillars:**

- Financial data is stored in a **local SQLite database** on this device
- **No Moat cloud account** is required to use the desktop app
- **Vault unlock** protects access to local data — it is not cloud login
- Data can be imported via CSV or optionally connected through Plaid, but everything lands in the local database
- Optional forward-looking line: local AI agents (MCP) read from this same local data

**Visual direction:**

- Centered hero layout with `MoatMark` or logo
- Icon-led feature cards or a simple diagram: `Device → SQLite file → Charts` (no server in the path)
- Use `@moat/ui` primitives and desktop design tokens — no new design system
- Subtle background treatment (`bg-muted/40` or gradient) to differentiate from the utilitarian connect-accounts step
- Avoid dense paragraphs; prefer 3–4 scannable callouts with icons (`Shield`, `Database`, `Lock` from lucide)

**Shell:** `OnboardingShell` needs a `layout="centered"` variant (current default). Step 1 uses this.

**Copy should use:**

- "Your data stays on this device"
- "Local SQLite database"
- "Unlock your vault"

**Copy should avoid:**

- "Sign in" / "Log in"
- Implying data is encrypted at rest unless vault encryption is actually implemented (see `desktop-local-vault` spec — be accurate about current security posture)

---

## Shared Module — `@moat/features/onboarding`

### Package structure

```text
packages/features/src/onboarding/
  index.ts
  step-connect-accounts.tsx       ← split-layout orchestrator
  account-list.tsx                ← presentational account rows + action slots
  profile-inputs.tsx              ← age / retirement age inputs
  connect-accounts-preview.tsx    ← right panel: 3 charts, scrollable
  use-connect-accounts-data.ts    ← React Query hook via useApiClient()
  types.ts                        ← OnboardingAccount types, props contracts
```

Add export to `packages/features/package.json`:

```json
"./onboarding": "./src/onboarding/index.ts"
```

### Component API

Shared components accept **slots and callbacks** for platform-specific behavior. They never import `@moat/client-ts`, `next/navigation`, or `window.moatDesktop`.

```ts
type StepConnectAccountsProps = {
  // Injected by host — Plaid button, investment dialog trigger, etc.
  connectAccountAction: React.ReactNode;
  addInvestmentAction: React.ReactNode;
  onAccountConnected: () => void;

  // Profile state — host owns persistence
  currentAge?: number;
  retirementAge?: number;
  onProfileChange: (profile: {
    currentAge?: number;
    retirementAge?: number;
  }) => void;
  onProfileSave?: () => void;
};
```

`AccountList` receives normalized account arrays (not raw Plaid institution shapes). `ProfileInputs` calls `onProfileChange` on change and `onProfileSave` on blur — the host decides whether to call `saveOnboardingProfile()` (web) or update local profile (desktop).

### Data hook — `useConnectAccountsData`

Uses `useApiClient()` and React Query. Returns:

- `plaidAccounts`, `investments`, `realEstate` — for left-panel list
- `hasAccounts` — boolean gate for empty-state overlays
- `portfolioData`, `portfolioLoading` — for `PortfolioAllocationChart`
- `historyData`, `historyLoading` — for `NetWorthChart`
- `monthlyData`, `monthlyLoading` — for `MonthlyNetGainsChart`

Query keys should align with `OverviewDashboard` where possible so invalidation is consistent:

- `["investment", "getPortfolioAllocation"]`
- `["balanceSnapshot", "getHistory", { months: 24 }]`
- `["transaction", "getMonthlyAggregates", { months: 24 }]`

### Charts

All three charts come from `@moat/charts` (props-based). The shared preview panel passes fetched data as props — no chart fetches its own data in the shared module.

| Chart | Data source (`FinApiClient`) |
|-------|------------------------------|
| `PortfolioAllocationChart` | `getPortfolioAllocation()` |
| `NetWorthChart` | `getBalanceSnapshotHistory({ months: 24 })` — historical only |
| `MonthlyNetGainsChart` | `getMonthlyAggregates({ months: 24 })` |

---

## `FinApiClient` Extension

Add one normalized method for the left-panel account list:

```ts
getOnboardingAccountSources(): Promise<{
  plaidAccounts: OnboardingPlaidAccount[];
  investments: OnboardingInvestment[];
  realEstate: OnboardingRealEstateProperty[];
}>;
```

Define `OnboardingPlaidAccount`, `OnboardingInvestment`, `OnboardingRealEstateProperty` in `packages/contracts` with only the fields the account list needs (id, name, balance, institution/type label).

**HTTP implementation** (`apps/web/src/lib/http-api-client.ts`):

- Compose `getConnectedInstitutions()`, `getAllInvestments()`, `listRealEstate()` from `@moat/client-ts`

**IPC implementation** (`apps/desktop/src/renderer/src/lib/ipc-api-client.ts`):

- Compose `window.moatDesktop.accounts.list()`, `investments.list()`, `realEstate.list()`
- Map desktop account shapes to the normalized contract types

---

## Onboarding Store

Move shared profile/flow fields to `packages/state/src/onboarding-store.ts`:

- `currentAge`, `retirementAge` — used by shared step 2 profile inputs
- `setCurrentAge`, `setRetirementAge`

Web-only fields (`goals`, `referralSource`, `plaidConnected`, `isPulsing`, `currentStep`, etc.) can either:

- **Option A (recommended):** Stay in `apps/web/.../onboarding-store.ts` — web imports both stores
- **Option B:** Move entirely to `@moat/state` — desktop imports only the profile slice

Desktop step 2 can use local component state for profile if store extraction is deferred, but `@moat/state` is the target per Phase 3 spec.

---

## Host Integration

### Web (`apps/web`)

**Changes:**

1. Replace `step-connect-accounts/` with a thin wrapper around `@moat/features/onboarding` `StepConnectAccounts`
2. Inject web slots:
   - `connectAccountAction`: existing `ConnectInstitutionButton` from `~/components/plaid/`
   - `addInvestmentAction`: existing `AddInvestmentDialogContent` trigger
3. Wire profile state from web `onboarding-store` (or `@moat/state` after extraction)
4. `onAccountConnected`: keep existing query invalidation + pulse behavior from `OnboardingFlow`
5. Keep step 2 layout classes in `OnboardingFlow` (`lg:overflow-hidden`, `lg:h-full`)

**Delete after migration:**

- `apps/web/src/app/onboarding/onboarding-flow/step-connect-accounts/` (entire directory)

### Desktop (`apps/desktop`)

**Changes:**

1. Replace current 4-step bullet-list flow with V2 3-step flow
2. New `local-privacy-step.tsx` for step 1
3. Thin `desktop-connect-accounts-step.tsx` wrapper injecting:
   - `ConnectInstitutionButton` from `apps/desktop/.../components/plaid/`
   - Desktop investment creation dialog (or reuse from investments page)
4. Keep `complete-step.tsx` for step 3
5. Update `OnboardingShell`:
   - `layout="centered"` — steps 1 and 3
   - `layout="split"` — step 2 (full width, no `max-w-2xl` on main content)
6. Bump `DESKTOP_ONBOARDING_VERSION` from `"1"` to `"2"` in `packages/contracts/src/ipc/onboarding.ts`

**Remove after migration:**

- `local-vault-step.tsx`, `import-data-step.tsx`, `agent-access-step.tsx` (content absorbed into privacy step or deferred to in-app discovery)

**Settings affordance:** Keep ability to reset onboarding metadata for testing/replay (referenced in `desktop-local-vault` spec).

---

## Architecture Diagram

```text
apps/web (OnboardingFlow)                apps/desktop (OnboardingPage)
  │                                        │
  ├─ StepGoals (local)                     ├─ LocalPrivacyStep (local)
  ├─ StepConnectAccounts ─────────────┐    ├─ StepConnectAccounts ─────────┐
  ├─ StepReferral (local)             │    └─ CompleteStep (local)         │
  └─ StepComplete (local)             │                                    │
                                      ▼                                    ▼
                         @moat/features/onboarding
                           ├─ step-connect-accounts.tsx
                           ├─ account-list.tsx
                           ├─ profile-inputs.tsx
                           ├─ connect-accounts-preview.tsx  (3 charts, scrollable)
                           └─ use-connect-accounts-data.ts
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              @moat/charts      @moat/ui         useApiClient()
           (3 chart components)  (primitives)         │
                                                         ▼
                                          ┌──────────────────────────┐
                                          │ FinApiClient             │
                                          ├──────────────────────────┤
                                          │ httpApiClient  (web)     │
                                          │ ipcApiClient   (desktop) │
                                          └──────────────────────────┘
```

---

## Desktop Onboarding Persistence

Unchanged model from `specs/features/desktop-local-vault/spec.md`:

```text
desktop_onboarding_seen_at
desktop_onboarding_completed_at
desktop_onboarding_skipped_at
desktop_onboarding_version = "2"
```

Rules:

- `seen_at` written when onboarding is first shown (existing `markSeen()` on mount)
- `completed_at` when user finishes step 3
- `skipped_at` when user explicitly skips
- Do not auto-show V2 if `completed_at` or `skipped_at` exists for version `2`
- Users who completed/skipped V1 will see V2 because version mismatch triggers `shouldShow`

---

## Implementation Phases

### Phase 0 — Spec alignment (this document)

- [x] Write spec
- [ ] Review open questions below

### Phase 1 — Contract + shared module

1. Add `getOnboardingAccountSources()` and types to `@moat/contracts`
2. Implement in `httpApiClient` and `ipcApiClient`
3. Create `packages/features/src/onboarding/` with all components and hook
4. Right panel: three charts, scrollable, empty-state overlays
5. Export `./onboarding` from `@moat/features`

### Phase 2 — Web migration

1. Thin wrapper in `apps/web` injecting web-specific slots
2. Replace step 2 in `OnboardingFlow`
3. Delete local `step-connect-accounts/` directory
4. Verify Plaid connect → all three charts update

### Phase 3 — Desktop V2

1. Build `local-privacy-step.tsx`
2. Add `layout` variant to `OnboardingShell`
3. Wire 3-step flow in `onboarding/index.tsx`
4. Bump `DESKTOP_ONBOARDING_VERSION` to `"2"`
5. Remove obsolete step components

### Phase 4 — Store extraction (can parallel Phase 2–3)

1. Move shared profile fields to `@moat/state/onboarding-store.ts`
2. Update web store to import shared slice

### Phase 5 — Verification

| Check | Web | Desktop |
|-------|-----|---------|
| Three charts render in scrollable right panel | ✓ | ✓ |
| Portfolio allocation appears above net worth and monthly gains | ✓ | ✓ |
| Empty-state blur overlays on all three charts | ✓ | ✓ |
| Plaid connect refreshes all charts | ✓ | ✓ |
| Net worth chart shows historical values only (no forecast) | ✓ | ✓ |
| Skip / back / progress | existing header/nav | shell footer |
| Typecheck | `moat-web` | `moat-desktop` |
| Lint | `moat-web check:write` | `moat-desktop check:write` |

---

## Testing

| Change | Approach |
|--------|----------|
| `useConnectAccountsData` hook | Unit test with mocked `FinApiClient` |
| `ConnectAccountsPreview` empty states | RTL render with `hasAccounts={false}` |
| `AccountList` | RTL render with sample accounts + slot actions |
| Desktop privacy step | RTL snapshot / content assertions |
| Full desktop flow | Manual: vault unlock → privacy → connect → complete |
| Full web flow | Manual: goals → connect (3 charts) → referral → complete |

---

## Analytics (PostHog)

Event naming: `<domain>_<object>_<action>` (snake_case). No PII.

| Event | When | Properties |
|-------|------|------------|
| `onboarding_privacy_viewed` | Desktop step 1 shown | `{ demoUser }` or `{ userId }` |
| `onboarding_connect_accounts_viewed` | Shared step 2 shown | platform enum |
| `onboarding_account_connected` | Plaid or manual investment added during step 2 | `{ accountCount }` |
| `onboarding_completed` | Flow finished | platform, `stepCount` |
| `onboarding_skipped` | User skips | platform, `stepAtSkip` |

Desktop may not have PostHog wired yet — defer events until desktop analytics exists, but define names now.

---

## Anti-patterns

- **Do not put Plaid Link or IPC calls inside `@moat/features/onboarding`.** Inject via slots.
- **Do not import `next/navigation` in shared packages.** URL step sync stays in web host.
- **Do not duplicate chart components.** Use `@moat/charts` props-based exports only.
- **Do not shrink the right panel to fit three charts without scrolling.** The panel must scroll.
- **Do not remove monthly net gains from onboarding.** Portfolio allocation is additive, not a replacement.

---

## Open Questions

1. **Desktop investment dialog:** Reuse `apps/desktop` investments page dialog or build a minimal inline dialog for onboarding only?
2. **V1 → V2 replay:** Should users who completed V1 automatically see V2, or only new installs? Current version-mismatch logic will show V2 to everyone who hasn't completed V2 — confirm this is intended.
3. **Profile persistence on desktop:** Save age/retirement to `UserSettings`, `FinancialProfile`, or onboarding metadata only?
4. **MCP mention on privacy screen:** Include a one-line MCP forward reference, or keep MCP discovery entirely in-app?
5. **Web chart re-invalidation timing:** Copy web's 3s/8s/20s delayed invalidation loop to desktop Plaid sync, or use a single invalidation?

---

## Related Specs

- [desktop-local-vault/spec.md](../desktop-local-vault/spec.md) — vault unlock, onboarding persistence model, V1 onboarding
- [desktop-electron-app/phase-3-shared-ui-packages-and-consumption.md](../../complete/desktop-electron-app/phase-3-shared-ui-packages-and-consumption.md) — shared package architecture, `FinApiClient` pattern
- [insurance-policy-intake/spec.md](../../complete/insurance-policy-intake/spec.md) — references web onboarding card/nav/store patterns

---

## File Change Summary (implementation reference)

| Area | Action |
|------|--------|
| `specs/features/shared-onboarding/spec.md` | This document |
| `packages/contracts` | Add `getOnboardingAccountSources` + types; bump `DESKTOP_ONBOARDING_VERSION` to `"2"` |
| `packages/features/src/onboarding/` | New shared module |
| `packages/state/src/onboarding-store.ts` | Shared profile fields (optional Phase 4) |
| `apps/web/.../onboarding-flow/` | Consume shared step 2; delete `step-connect-accounts/` |
| `apps/desktop/.../onboarding/` | Privacy step, shell layout variants, 3-step V2 flow |
| `apps/web/src/lib/http-api-client.ts` | Implement `getOnboardingAccountSources` |
| `apps/desktop/.../ipc-api-client.ts` | Implement `getOnboardingAccountSources` |
