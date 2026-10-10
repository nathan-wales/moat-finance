# Desktop Local Vault Unlock, Onboarding, and Installers

## Status

Draft. Created May 30, 2026 after reviewing the desktop app conventions, current Electron startup flow, SQLite package, existing desktop README, packaging docs, `moat-desktop` package configuration, and the supplied platform research.

## Goal

Make Moat Finance Desktop feel like a local-first financial vault that is installed, unlocked, and onboarded as a native app.

Success means:

- The desktop app is gated by a local unlock flow before users can access financial data.
- The feature is framed as `Local Vault Unlock`, not cloud login or Google OAuth.
- macOS uses native Touch ID when available, with a non-biometric fallback.
- Windows and Linux have reliable V1 fallbacks even if platform biometric support is deferred.
- First-run desktop onboarding appears after the first successful unlock and is persisted locally so it is not shown automatically again.
- The desktop app has a clear path to signed, installable macOS, Windows, and Linux distributables.

## Product Context

Moat Finance's desktop app is the local-first surface for private financial context and personal AI agents. The user is not logging into Moat Finance's cloud just to open local data. They are proving presence to their own device so Moat Finance can unlock a local vault.

That product framing matters:

- `Login` implies server-backed identity and OAuth.
- `Unlock` implies local user presence and encrypted local data.
- `Local Vault` communicates that financial data lives on the device and should be protected even when the app is closed.

The implementation should avoid a false sense of security. A native biometric prompt alone is not data protection. The secure target is: local financial data is encrypted, the vault key is stored with OS-backed secure storage, and opening the vault requires user presence or a fallback secret.

## Current Repo Context

Desktop is already an Electron + React app in `apps/desktop` with local SQLite through `@moat/db-sqlite` and `@moat/runtime`.

Relevant current behavior:

- `apps/desktop/src/main/index.ts` initializes the SQLite database before opening the main window.
- `packages/db-sqlite/src/createSqliteAppContext.ts` uses a single local user id: `local-user`.
- `packages/db-sqlite/prisma/schema.prisma` has `LocalUser`, `UserSettings`, financial tables, memory, Plaid, feedback, and profile tables.
- `UserSettings` currently only covers `memoryEnabled`; there is no generic metadata model.
- `apps/desktop/README.md` documents a first-run flow, but it is currently database creation, migration, default category seeding, and then an overview empty state. It is not an onboarding wizard.
- No desktop onboarding, first-run wizard, or onboarding persistence was found in `apps/desktop`.
- No local app unlock, biometric prompt, PIN, password, vault key repository, or lock screen was found in `apps/desktop`.
- `apps/desktop/src/main/plaid/token-storage.ts` already uses Electron `safeStorage` for Plaid token encryption.
- `apps/desktop/package.json` already configures Electron Builder for macOS DMG, Windows NSIS, and Linux AppImage.
- `apps/desktop/package.json` has `dist:mac` and `dist:win` scripts, but no `dist:linux` script.
- `apps/desktop/docs/patterns/packaging.md` covers macOS and Windows packaging/signing, but Linux packaging and CI matrix details need to be expanded.

Important implementation caveat:

The current startup sequence opens or creates the SQLite database before any UI can ask the user to unlock. A true local vault must move the sensitive-data boundary earlier: unlock first, then load/decrypt/open the vault or unwrap the vault key. A renderer-only lock screen would improve UX privacy but would not secure local data.

## Recommendation

Ship this as three related but independently reviewable tracks:

1. Local Vault Unlock
2. Desktop First-Run Onboarding
3. Desktop Installers and Release Pipeline

The first implementation should be conservative. Do not attempt perfect cross-platform biometric support before the vault architecture exists.

Recommended V1:

- macOS: Touch ID with `systemPreferences.promptTouchID()` when available, plus app password/PIN fallback.
- Windows: app password/PIN plus OS secure storage for local secrets; evaluate Windows Hello after the base unlock flow works.
- Linux: app password/PIN plus best-effort OS keyring support through Electron `safeStorage`; do not promise biometric unlock.
- All platforms: store vault secrets with OS-backed secure storage where available.
- Onboarding: show after first successful unlock; persist seen/completed/skipped as local metadata records.
- Installers: keep Electron Builder, add Linux script/targets, add native-runner CI matrix, and add signing/notarization gates before public release.

## Track 1 - Local Vault Unlock

### User Experience

On app launch:

1. Moat Finance starts with a minimal locked state.
2. Moat Finance checks whether local vault unlock is configured.
3. If not configured, Moat Finance guides the user through setting up a local unlock method.
4. If configured, Moat Finance asks the OS or fallback credential to confirm local user presence.
5. After successful unlock, Moat Finance initializes or opens local financial data.
6. If unlock fails, financial UI and local agent access remain unavailable.

Copy should use:

- `Unlock Moat Finance`
- `Unlock local vault`
- `Use Touch ID`
- `Use app password`
- `Set up local vault`

Copy should avoid:

- `Sign in with Google`
- `Log in to Moat Finance`
- `Authenticate with Moat Finance servers`
- Any copy that implies a cloud identity check is happening.

### macOS

Use Electron's macOS Touch ID APIs where available:

- `systemPreferences.canPromptTouchID()`
- `systemPreferences.promptTouchID(reason)`

Recommended macOS behavior:

- If Touch ID is available and the user enabled biometric unlock, show native Touch ID.
- If Touch ID succeeds, continue vault unlock.
- If Touch ID is unavailable, canceled, or fails, offer app password/PIN fallback.
- If biometric unlock has not been enabled, use app password/PIN.

Security note:

`promptTouchID()` is only a presence prompt. It does not encrypt or protect data on its own. The vault key still needs to be stored or unwrapped using OS-backed secure storage.

### Windows

Do not block V1 on Windows Hello.

Recommended Windows V1:

- App password/PIN unlock.
- Store the vault key or wrapped vault key using OS-backed secure storage.
- Use Electron `safeStorage` where it provides reliable DPAPI-backed encryption.
- Add Windows Hello as a later native or WebAuthn investigation once base vault unlock is stable.

Future Windows Hello options:

- WebAuthn/platform authenticator flow if Electron support is reliable enough for packaged desktop.
- Windows-specific native module for Windows Hello credential signing if the maintenance cost is justified.

### Linux

Treat Linux as best effort.

Recommended Linux V1:

- App password/PIN unlock.
- Use Electron `safeStorage` when a supported secret store is available.
- Clearly show a fallback setup path if libsecret/KWallet is unavailable.
- Do not market biometric unlock on Linux V1.

Linux environments vary across GNOME, KDE, window managers, secret-store setup, and distro packaging. The product copy should say `OS keyring support where available`, not `Linux biometric unlock`.

### Vault Key Architecture

Target architecture:

- Financial data remains local in SQLite.
- Sensitive local data is encrypted at rest.
- The database encryption key or field-encryption key is generated locally.
- The key is stored through OS-backed secure storage or wrapped by a user fallback credential.
- The renderer never receives raw long-lived vault keys.
- Main-process IPC refuses financial data requests while the vault is locked.
- The local MCP gateway cannot start or serve tools while the vault is locked.

Open implementation decision:

Prisma with encrypted SQLite is awkward. Before committing to database-level encryption, evaluate:

- SQLCipher or SQLite encryption support compatible with Electron packaging.
- `better-sqlite3-multiple-ciphers` if the desktop data layer can support it.
- Field-level encryption for high-risk fields as an interim step.
- Whether continuing with Prisma for local mode constrains encrypted SQLite too much.

V1 may ship an app-level unlock gate before full encrypted SQLite, but only if the UX and docs are honest that the first phase is an app access gate and not complete at-rest vault encryption.

### IPC and Process Boundaries

Main process owns unlock state.

Required boundaries:

- Renderer calls typed IPC methods to request unlock status and unlock attempts.
- Preload exposes only narrow methods such as `getVaultStatus`, `unlockVault`, `lockVault`, and `setupVaultUnlock`.
- Renderer never imports Electron, Node.js, filesystem APIs, Prisma, AppRuntime, or key storage modules.
- Financial IPC handlers return a typed locked error while vault state is locked.
- Agent gateway startup checks vault unlock state before serving local tools.

Suggested IPC contract area:

```text
packages/contracts/src/ipc/vault.ts
apps/desktop/src/main/ipc/vault.ts
apps/desktop/src/preload/index.ts
apps/desktop/src/renderer/src/lib/ipc/vault-client.ts
```

Suggested renderer UI area:

```text
apps/desktop/src/renderer/src/pages/vault-unlock/
  index.tsx
  setup-local-vault.tsx
  unlock-card.tsx
  fallback-password-form.tsx
  platform-capability-copy.ts
```

### Recovery and Reset

The spec must include a reset path before implementation begins.

V1 reset requirements:

- User can reset local unlock from the locked screen.
- Reset copy clearly explains whether existing local financial data will be deleted, preserved, or become unrecoverable.
- If no recovery key exists and the vault key is lost, the app must not imply data can be recovered.
- The destructive reset confirmation must be explicit and platform-native enough to prevent accidental data loss.

Future recovery options:

- User-held recovery key.
- Cloud sync recovery if the user later opts into cloud account linking.
- Export/import encrypted backup.

## Track 2 - Desktop First-Run Onboarding

### User Experience

Onboarding appears after successful local unlock, not before.

Recommended launch flow:

1. App launches.
2. Local vault unlock appears.
3. User unlocks or sets up the local vault.
4. App checks local onboarding metadata.
5. If desktop onboarding V1 has not been seen, show onboarding.
6. User can complete or skip onboarding.
7. App persists the result locally.
8. App does not automatically show the same onboarding version again.

Onboarding should help the user understand:

- Moat Finance Desktop stores financial context locally.
- They can import CSV transactions or connect Plaid if available.
- They can connect local AI agents through MCP when ready.
- They can manage local vault unlock and reset behavior in settings.

### Persistence Model

Use metadata records instead of one boolean column. Onboarding will evolve, and versioned records allow future onboarding to be shown intentionally without losing the original `do not show V1 again` behavior.

Recommended model for current single-user desktop:

```prisma
model UserMetadata {
  id        String   @id
  userId    String
  key       String
  valueJson String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user LocalUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, key])
  @@index([userId])
}
```

Recommended records:

```text
desktop_onboarding_seen_at = "2026-05-30T00:00:00.000Z"
desktop_onboarding_completed_at = "2026-05-30T00:00:00.000Z" | null
desktop_onboarding_skipped_at = "2026-05-30T00:00:00.000Z" | null
desktop_onboarding_version = "1"
```

Alternative for purely app-global state:

```prisma
model AppMetadata {
  key       String   @id
  valueJson String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Recommendation:

Use `UserMetadata` because the desktop database already has `LocalUser`, all domain data is scoped by `userId`, and future multi-profile support would not require moving onboarding state.

### Metadata Access Pattern

Add a repository abstraction rather than reading Prisma directly from IPC.

Suggested files:

```text
packages/domain/src/repositories/UserMetadataRepository.ts
packages/db-sqlite/src/repositories/SqliteUserMetadataRepository.ts
packages/db-sqlite/src/createSqliteAppContext.ts
packages/db-sqlite/src/migrations.ts
packages/db-sqlite/prisma/schema.prisma
```

Suggested IPC:

```text
packages/contracts/src/ipc/onboarding.ts
apps/desktop/src/main/ipc/onboarding.ts
apps/desktop/src/preload/index.ts
apps/desktop/src/renderer/src/lib/ipc/onboarding-client.ts
```

Suggested renderer UI:

```text
apps/desktop/src/renderer/src/pages/onboarding/
  index.tsx
  onboarding-shell.tsx
  local-vault-step.tsx
  import-data-step.tsx
  agent-access-step.tsx
  complete-step.tsx
```

### Onboarding Completion Semantics

Persist `seen` as soon as the onboarding is shown. Persist `completed` only when the user finishes all steps. Persist `skipped` when the user explicitly skips.

Rules:

- `seen_at` prevents accidental repeat loops if the app crashes mid-flow.
- `completed_at` means the user went through the path.
- `skipped_at` means the user opted out.
- The app should not automatically show onboarding V1 again if either `completed_at` or `skipped_at` exists for version `1`.
- A settings action can reset onboarding metadata for testing or for users who want to revisit it.

## Track 3 - Desktop Installers and Release Pipeline

### Current Packaging State

The app already uses Electron Builder and has configuration for:

- macOS DMG for `x64` and `arm64`.
- Windows NSIS installer for `x64`.
- Linux AppImage.
- GitHub Releases publishing through Electron Builder.

Gaps to close:

- Add a `dist:linux` script.
- Decide whether macOS should ship separate `x64` and `arm64` DMGs or a universal build.
- Decide whether Linux should include `.deb` and `.rpm` in addition to AppImage.
- Add CI builds on native OS runners.
- Add signing and notarization credentials in CI.
- Verify native module rebuild behavior for packaged SQLite across OS targets.

### Expected V1 Distributables

macOS:

- `.dmg` for user install.
- Optional `.zip` if required by the auto-update flow.
- Either separate `arm64` and `x64` artifacts or a universal artifact.
- Developer ID signing and notarization before public distribution.

Windows:

- `.exe` NSIS installer.
- Authenticode signing before public distribution.
- `.msi` can wait unless enterprise install support becomes a product requirement.

Linux:

- `.AppImage` for broad distribution.
- Add `.deb` for Debian/Ubuntu if Linux distribution becomes a public release goal.
- Add `.rpm` later if Fedora/RHEL support becomes important.
- Make keyring behavior explicit because secure storage differs by distro and desktop environment.

### CI Matrix

Use native runners rather than relying on one machine to build everything.

Recommended GitHub Actions matrix:

```text
macos-latest:
  - pnpm install
  - pnpm --filter moat-desktop run typecheck
  - pnpm --filter moat-desktop run check
  - pnpm --filter moat-desktop run dist:mac
  - sign and notarize
  - upload dmg/zip artifacts

windows-latest:
  - pnpm install
  - pnpm --filter moat-desktop run typecheck
  - pnpm --filter moat-desktop run check
  - pnpm --filter moat-desktop run dist:win
  - sign
  - upload exe artifact

ubuntu-latest:
  - pnpm install
  - pnpm --filter moat-desktop run typecheck
  - pnpm --filter moat-desktop run check
  - pnpm --filter moat-desktop run dist:linux
  - upload AppImage/deb artifacts
```

This should be a dedicated desktop release workflow, separate from web/API deploys.

### Signing and Secrets

Required CI secrets:

- Apple Developer ID certificate or base64 `.p12`.
- Apple certificate password.
- `APPLE_ID`.
- `APPLE_APP_SPECIFIC_PASSWORD`.
- `APPLE_TEAM_ID`.
- Windows code signing certificate.
- Windows certificate password.
- GitHub token or release token for artifact publishing.

Rules:

- Never commit signing certificates, passwords, app-specific passwords, or notarization credentials.
- Keep release builds separate from dev builds.
- Do not market public install support until macOS notarization and Windows signing are passing.

## Implementation Plan

### Phase 1 - Spec Alignment and Technical Spike

1. Confirm whether V1 needs true encrypted SQLite before any public desktop release.
2. Spike compatible SQLite encryption options with Electron packaging and current Prisma usage.
3. Decide whether Prisma remains the local data layer for encrypted desktop mode.
4. Confirm exact V1 fallback credential: password, PIN, or passphrase.
5. Confirm product copy: `Local Vault Unlock`.

Acceptance criteria:

- A short architecture note documents the selected vault key approach.
- Known limitations are explicit before UX implementation starts.
- Windows Hello and Linux biometrics are either deferred or scoped with concrete implementation paths.

### Phase 2 - Unlock Foundation

1. Add vault IPC contracts and main-process lock state.
2. Add vault status checks around financial IPC handlers.
3. Prevent local MCP gateway access while locked.
4. Add fallback app password/PIN setup and unlock flow.
5. Add macOS Touch ID prompt when available.
6. Add settings controls for enabling/disabling biometric unlock where supported.
7. Add reset flow with clear data-loss semantics.

Acceptance criteria:

- Desktop opens to a locked/setup state before showing financial data.
- Unlock state is owned by the main process.
- Renderer only uses typed IPC.
- macOS Touch ID is used only when available and enabled.
- Windows and Linux have working fallback unlock.
- Financial IPC and MCP tool calls fail closed while locked.

### Phase 3 - Onboarding Metadata and UI

1. Add `UserMetadata` to the SQLite Prisma schema.
2. Add idempotent migration SQL in `runMigrations`.
3. Add `SqliteUserMetadataRepository`.
4. Add onboarding IPC contracts and handlers.
5. Add desktop onboarding UI after unlock.
6. Persist `seen`, `completed`, `skipped`, and `version`.
7. Add a settings affordance to reset onboarding for testing or replay.

Acceptance criteria:

- First-time desktop users see onboarding after unlock.
- Users can skip or complete onboarding.
- Onboarding V1 does not automatically reappear after skip or completion.
- Metadata is persisted in SQLite and scoped to `local-user`.
- No raw Prisma or DB access is exposed to the renderer.

### Phase 4 - Installer Readiness

1. Add `dist:linux`.
2. Add Linux Builder targets if `.deb` is in V1 scope.
3. Add or update desktop release workflow with macOS, Windows, and Ubuntu runners.
4. Configure signing and notarization secrets.
5. Verify generated artifacts install and launch on each OS.
6. Update packaging docs with artifact names, required secrets, and release checklist.

Acceptance criteria:

- CI can produce macOS, Windows, and Linux desktop artifacts.
- macOS builds are signed and notarized for public release.
- Windows builds are signed for public release.
- Linux AppImage is built and smoke-tested.
- Release docs explain which artifacts users should download.

## Data and Security Requirements

- Do not call this cloud login unless cloud account identity is actually involved.
- Do not store fallback passwords or PINs in plaintext.
- Do not log biometric results, fallback credentials, vault keys, tokens, account numbers, raw transaction descriptions, or sensitive payloads.
- Do not expose vault keys through preload or renderer IPC.
- Do not rely on hiding the Electron window as a security boundary.
- Do not start the local MCP gateway while the vault is locked.
- Do not allow agent tools to access local financial data while locked.
- Use structured error responses for locked states and unlock failures.
- Surface unlock failures to users without leaking sensitive implementation detail.

## Testing Plan

Desktop main and IPC:

- Vault status returns locked before unlock.
- Financial IPC handlers fail closed while locked.
- Unlock succeeds with fallback credential.
- Unlock fails with invalid fallback credential.
- macOS Touch ID capability check handles available and unavailable states.
- MCP gateway start is blocked while locked.
- Reset flow performs the documented data behavior.

SQLite and metadata:

- Migration creates `UserMetadata` on new databases.
- Migration is idempotent for existing databases.
- Metadata upsert updates `updatedAt`.
- Onboarding metadata is scoped by `userId` and `key`.
- Onboarding version checks handle missing, skipped, and completed metadata.

Renderer:

- Locked state renders before the app shell.
- Setup flow renders when no unlock method exists.
- Touch ID option is hidden or disabled when unavailable.
- Fallback unlock form handles loading, success, and error states.
- Onboarding appears after unlock for first-time users.
- Skip and complete both suppress future automatic onboarding for the same version.

Packaging:

- `pnpm --filter moat-desktop run check:write`
- `pnpm --filter moat-desktop run typecheck`
- `pnpm --filter moat-desktop run dist:mac`
- `pnpm --filter moat-desktop run dist:win`
- `pnpm --filter moat-desktop run dist:linux`
- Install and launch smoke test on macOS, Windows, and Linux.

## Non-Goals

- Google OAuth or any cloud identity requirement for local desktop unlock.
- Perfect cross-platform biometric support in V1.
- Windows Hello native-module implementation in the first pass.
- Linux biometric unlock guarantee.
- Multi-user desktop profiles unless a separate product spec prioritizes them.
- Moving all local desktop data away from SQLite without a dedicated data-layer decision.
- Cloud backup or cloud recovery for local vault keys.

## Open Questions

- Should V1 require encrypted SQLite before any beta release, or is an honest app-level unlock acceptable for an internal beta?
- Should the fallback credential be a password, PIN, passphrase, or user-selected option?
- Should Moat Finance create a recovery key during vault setup, or defer recovery until cloud sync/backup exists?
- Should onboarding be a modal over the app shell or a full-screen flow after unlock?
- Should desktop onboarding V1 include MCP setup, or only introduce it and leave configuration in the dedicated MCP page?
- Should macOS ship separate `x64` and `arm64` DMGs or a universal artifact?
- Should Linux V1 include only AppImage or AppImage plus `.deb`?

## Suggested Commit Message

```text
feat (desktop): adds local vault spec
```
