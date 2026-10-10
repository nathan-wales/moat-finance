# Desktop Keychain Explainer During Onboarding

## Status

Draft. Created 2026-07-13 after reviewing the desktop shell phase order, vault setup flow, onboarding wizard, Plaid token storage, and the related [desktop vault recovery spec](../desktop-vault-recovery/spec.md).

## Goal

Move first-run local vault setup into desktop onboarding so users see a plain-language explanation before macOS, Windows, or Linux asks Moat to use the system credential store.

Success means:

- First-time desktop users see the local privacy and Keychain explainer screens before any expected OS credential-store prompt.
- Vault setup remains required before entering the main app.
- Returning users with an existing vault continue to see the current unlock screen first.
- The explainer accurately describes why Moat uses the OS credential store without exposing implementation details or creating alarm.

## Product Context

Moat Finance Desktop is local-first and privacy-forward. Users downloading from the marketing site can reasonably be surprised when macOS immediately asks to store something in Keychain before Moat has explained why. That prompt is expected, but the timing makes it feel suspicious.

The onboarding experience should establish trust before the OS prompt appears: Moat stores financial data locally, protects access with a local vault, and uses the operating system's built-in secure storage to protect sensitive connection tokens when a user connects accounts.

## Current Repo Context

### Current startup sequence

| File | Current behavior |
|------|------------------|
| `apps/desktop/src/renderer/src/desktop-shell.tsx` | Starts in `loading`, checks `window.moatDesktop.vault.getStatus()`, routes locked users to `vault`, and only loads onboarding after vault unlock/setup. |
| `apps/desktop/src/renderer/src/pages/vault-unlock/index.tsx` | Shows `SetupLocalVault` when `status.configured` is false; this is the first UI on a clean install. |
| `apps/desktop/src/renderer/src/pages/vault-unlock/setup-local-vault.tsx` | Creates the local vault via `window.moatDesktop.vault.setup()`, optionally enabling Touch ID when available. |
| `apps/desktop/src/renderer/src/pages/onboarding/index.tsx` | Post-unlock wizard with steps for local privacy, recovery email, invite code, connecting accounts, and completion. |
| `apps/desktop/src/renderer/src/pages/onboarding/local-privacy-step.tsx` | Already introduces local-first storage, SQLite, vault unlock, CSV/Plaid import, and MCP. |
| `apps/desktop/src/main/vault/vault-service.ts` | Uses `safeStorage.isEncryptionAvailable()` in `getVaultStatus()` and creates the vault config in `setupVault()`. |
| `apps/desktop/src/main/plaid/token-storage.ts` | Uses Electron `safeStorage.encryptString()` / `decryptString()` for Plaid access token encryption backed by Keychain, Windows DPAPI, or Linux libsecret. |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Onboarding shell | `apps/desktop/src/renderer/src/pages/onboarding/onboarding-shell.tsx` | Step counter, back/next controls, skip onboarding action, centered/split layouts. |
| Local privacy copy style | `apps/desktop/src/renderer/src/pages/onboarding/local-privacy-step.tsx` | Good visual foundation for friendly security education. |
| Vault setup component | `apps/desktop/src/renderer/src/pages/vault-unlock/setup-local-vault.tsx` | Existing password form and biometric option should be reused or moved, not rebuilt from scratch. |
| Vault status contract | `packages/contracts/src/ipc/vault.ts` | `VaultStatus` already reports `configured`, `unlocked`, `biometricAvailable`, `safeStorageAvailable`, and `platform`. |
| Recovery email onboarding step | `apps/desktop/src/renderer/src/pages/onboarding/recovery-email-step.tsx` | Existing pattern for custom step behavior outside normal footer next button. |

## Target Experience

### First launch, no vault configured

```text
Launch desktop app
  -> Loading
  -> Onboarding
       1. Your data stays here
       2. Protecting your data on this computer
       3. Set up local vault
       4. Add a recovery email
       5. Invite code
       6. Connect your accounts
       7. You are set
  -> App
```

The OS credential-store prompt should occur only after the user reaches the setup or account-connection moment that requires it, and after the explainer has already been shown.

### Returning launch, vault configured and locked

```text
Launch desktop app
  -> Loading
  -> Vault unlock
  -> Onboarding only if still required after unlock
  -> App
```

Returning users should not be routed through onboarding just because the vault is locked.

### Explainer step

**Step title:** `Protecting your data on this computer`

**Suggested copy:**

> Moat keeps your financial data on this device. To help protect sensitive connections, Moat may ask your computer to use its built-in secure storage.

**Support copy:**

> On a Mac, that may appear as a Keychain prompt. On Windows, Moat uses Windows Credential Manager. On Linux, Moat uses the system secret store when available.

**Callouts:**

| Title | Description |
|-------|-------------|
| Built into your computer | This is the same system your device uses to protect saved passwords and app credentials. |
| Used for sensitive connections | If you connect bank accounts, Moat encrypts the connection token before saving it locally. |
| Your data stays local | The prompt does not mean Moat is uploading your financial data to the cloud. |

**Primary button:** `Continue`

**Tone guidelines:**

- Say "built-in secure storage" in the primary explanation.
- Mention "Keychain" only as the Mac-specific label users may see.
- Avoid implementation terms like `safeStorage`, `Plaid access token`, `DPAPI`, or `libsecret` in primary copy.
- Avoid saying "Always Allow" as an instruction; let users choose in the OS dialog.

### Vault setup step inside onboarding

**Step title:** `Set up your local vault`

Reuse the existing password form from `SetupLocalVault`, but render it as an onboarding step instead of a standalone pre-onboarding screen for first-run users.

Suggested intro copy:

> Create an app password for this device. This unlocks Moat locally and is not a Moat cloud login.

If Touch ID is available, keep the existing opt-in checkbox:

> Enable Touch ID for unlock

On successful setup:

- `window.moatDesktop.vault.setup()` creates and unlocks the vault.
- Onboarding advances to the recovery email step.
- The main app remains inaccessible until setup succeeds.

### Skip behavior

The current onboarding shell has a global `Skip onboarding` action. For this feature:

- Users must not be able to skip vault setup when no vault is configured.
- Skipping optional onboarding steps after vault setup remains allowed.
- If the user clicks `Skip onboarding` before vault setup is complete, route them to the vault setup step instead of the main app, or hide/disable the global skip action until setup succeeds.

## Architecture / State Model

### Desktop shell phase selection

Update `apps/desktop/src/renderer/src/desktop-shell.tsx` so first-run users are routed to onboarding before the standalone vault screen.

Target state logic:

```text
vaultStatus = await window.moatDesktop.vault.getStatus()

if vaultStatus.configured === false:
  phase = "onboarding"
  onboarding receives initialVaultStatus

else if vaultStatus.unlocked === false:
  phase = "vault"

else:
  loadOnboarding()
```

`loadOnboarding()` should still decide between `onboarding` and `app` for configured/unlocked users based on `window.moatDesktop.onboarding.getState()`.

### Onboarding state

`apps/desktop/src/renderer/src/pages/onboarding/index.tsx` should accept enough vault context to know whether vault setup is required:

```ts
type OnboardingPageProps = {
  onFinished: () => void;
  initialVaultStatus?: VaultStatus;
};
```

The step list can be derived from vault status:

| Condition | Steps |
|-----------|-------|
| `configured === false` | Include Keychain explainer and vault setup before recovery email. |
| `configured === true` | Keep existing post-unlock onboarding steps; do not show setup. |

After setup succeeds, refresh vault status or mark a local onboarding state flag so finish handling can safely enter the app.

### Component organization

Prefer extracting vault setup presentation from the standalone page rather than duplicating the password form:

```text
apps/desktop/src/renderer/src/pages/vault-unlock/
  setup-local-vault.tsx       # existing card can wrap shared content
  setup-local-vault-form.tsx  # reusable form content if needed

apps/desktop/src/renderer/src/pages/onboarding/
  keychain-explainer-step.tsx
  local-vault-setup-step.tsx
```

Keep files kebab-case and avoid adding comments where clearer component names are enough.

### Prompt timing expectations

Continue from the Keychain explainer intentionally probes OS secure storage so the native prompt appears once in context, before vault unlock / Plaid sync later:

- Explain first, then on Continue call `vault.getStatus({ includeSafeStorageAvailability: true })` (hits `safeStorage.isEncryptionAvailable()`).
- Always advance after Allow or Deny; do not block onboarding if the user denies.
- Cold-start / unlock paths keep `includeSafeStorageAvailability: false` so they do not re-prompt every launch.
- Avoid fake prompts, screenshots, or OS-specific instructions that may drift.

## Implementation Plan

### Phase 1 — Restructure first-run routing

1. Update `DesktopShell` phase selection so `configured === false` goes to onboarding.
2. Pass initial vault status into `OnboardingPage`.
3. Ensure configured but locked users still go to `VaultUnlockPage`.

**Acceptance criteria:**

- Clean install opens onboarding, not standalone vault setup.
- Existing install with locked vault opens the vault unlock screen.
- Existing install with unlocked vault preserves current onboarding/app behavior.

### Phase 2 — Add explainer and vault setup steps

1. Add `keychain-explainer-step.tsx` with friendly platform-aware copy.
2. Add a local vault setup onboarding step that reuses the existing setup form behavior.
3. Include both steps only when no vault is configured.
4. Prevent completion or skipping into the app until vault setup succeeds.

**Acceptance criteria:**

- The Keychain explainer appears before vault setup on first launch.
- The app cannot open without a configured and unlocked vault.
- Password and Touch ID setup behavior matches the existing standalone vault setup.

### Phase 3 — Verify account connection prompt order

1. Confirm `DesktopConnectAccountsStep` does not encrypt/store Plaid tokens before the explainer and vault setup steps.
2. If secure storage is first triggered during Plaid connection rather than vault setup on a platform, confirm that onboarding copy still precedes it.
3. Add manual verification notes for macOS Keychain, Windows Credential Manager, and Linux secret store where feasible.

**Acceptance criteria:**

- On macOS, first expected Keychain prompt is preceded by the explainer step.
- Connecting accounts still stores encrypted tokens locally.
- Users who skip account connection during onboarding can still connect later without data loss.

## Acceptance Criteria

- [ ] First-run desktop users see onboarding before standalone vault setup.
- [ ] The new explainer step appears before any onboarding step likely to trigger secure credential storage.
- [ ] The explainer uses user-friendly language and includes Mac Keychain, Windows Credential Manager, and Linux secret store references.
- [ ] Vault setup is part of first-run onboarding and is required before entering the app.
- [ ] Returning locked users with an existing vault still land on the vault unlock screen.
- [ ] Returning unlocked users still respect existing onboarding completion/skipped state.
- [ ] Global onboarding skip cannot bypass required vault setup.
- [ ] Existing recovery email, invite code, account connection, and completion steps continue to work.
- [ ] No raw financial data, tokens, passwords, or emails are logged.
- [ ] Desktop typecheck and lint pass for changed files.

## Non-Goals

- Changing how Electron `safeStorage` encrypts or decrypts tokens.
- Replacing macOS Keychain, Windows Credential Manager, or Linux secret-store behavior.
- Triggering a native credential-store prompt artificially before the user takes an action.
- Redesigning the full onboarding visual system.
- Changing Plaid connection semantics or token storage schema.
- Adding cloud login to desktop vault setup.
- Encrypting the SQLite database at rest.

## Open Questions

- Should the explainer step be shown on every clean install, or only on platforms where `safeStorageAvailable` is true?
- Should `Skip onboarding` be hidden until vault setup is complete, or should it jump directly to the required vault setup step?
- Should the local privacy and Keychain explainer steps be combined into one screen, or kept separate for clarity?
- Should analytics track that the explainer was viewed? If yes, event payload must be enum/count only and avoid sensitive data.

## Related Specs

- [Desktop Local Vault — Recovery Email and Destructive Reset](../desktop-vault-recovery/spec.md)
- [Choose Moat Experience (Pre-Onboarding)](../choose-moat-experience/spec.md)

## Suggested Commit Message

```text
docs (desktop): adds keychain onboarding spec
```
