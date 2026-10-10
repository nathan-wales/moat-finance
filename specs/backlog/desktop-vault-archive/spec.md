# Desktop Password-Wrapped Vault Archive

## Status

Backlog draft. Created September 4, 2026 after reviewing local SQLite encryption, vault key wrapping, cloud backup (push-only), and the “move to a new computer” gap.

Not scheduled. Promote to `specs/features/desktop-vault-archive/spec.md` when this is next to build. Do not implement from this file until then.

## Goal

Let a desktop user move their local vault to another computer with one encrypted file and one passphrase they choose — without relying on OS Keychain/DPAPI, folder copies, or Moat cloud restore.

Success means:

- An unlocked user can export a `.moatvault` archive from Settings.
- A new (or replacement) install can import that archive, unwrap the database key with the export passphrase, and re-wrap the key for the destination machine’s secure storage.
- Copying `moat.db` or `userData` alone still cannot open the vault. The archive cannot be opened without the passphrase.
- Plaid access tokens, cloud session tokens, and local agent tokens do not travel. Banks must be reconnected on the new machine.
- Cross-OS transfer works (Mac ↔ Windows ↔ Linux) because the archive never contains OS-bound ciphertext.

## Product Context

Moat Desktop is local-first. Financial data lives in SQLCipher-encrypted `moat.db`. The 32-byte database key is wrapped in `vault/database-key.bin` with Electron `safeStorage` (Keychain / DPAPI / libsecret), or with the vault password on Linux `basic_text`. That wrap is **machine- and user-bound**.

Moving computers is a real job: new laptop, dual machines, OS reinstall. Today the honest outcome is:

| What the user tries | What happens |
|---------------------|----------------|
| Copy `~/Library/Application Support/moat-finance/` | Encrypted DB arrives; key will not unwrap. Fail-closed (`DATABASE_KEY_MISSING` / `KEY_UNWRAP_FAILED`). |
| Mac Migration Assistant including Keychain | Might work same-OS, undocumented, Plaid tokens still fragile. |
| Cloud Backup | Push-only domain upserts. No restore. Excludes Plaid tokens and vault secrets. |
| Reinstall + Plaid + CSV | Works; rules, budgets, forecasts, and history are rebuilt by hand. |

The encryption spec already records this: “User moves `moat.db` to another machine — key does not travel.” A user-held recovery key was listed as follow-on, not shipped. This feature is the portable-file answer to that gap. It matches the local-first promise in [mission.md](../../mission.md) (ownership and portability) without turning desktop into cloud runtime mode.

This is **not** cloud backup, **not** mode cutover, and **not** a printed 24-word recovery key (related, later).

## Current Repo Context

### Why folder copy cannot be the product

| File | Role | Travels? |
|------|------|----------|
| `moat.db` (+ WAL/SHM) | SQLCipher database | File copies; unreadable without the raw key |
| `vault/database-key.bin` | SQLCipher key wrapped by OS or vault password | OS wrap is useless on another machine |
| `vault/vault-config.json` | App-password scrypt hash, recovery email | Copies, but does not unwrap an OS-wrapped key |
| `PlaidItem.accessTokenEncrypted` | Second `safeStorage` wrap inside SQLite | Machine-bound; decrypt fails on the destination |
| `cloud-token.bin` | Moat account session via `safeStorage` | Re-sign-in |
| `agent-tokens.json` | Local MCP token hashes | Mint new tokens |

Packaged paths: macOS `~/Library/Application Support/moat-finance/`, Windows `%APPDATA%\moat-finance\`, Linux `~/.config/moat-finance/`. Unpackaged `pnpm dev` uses `moat-finance-dev` and must not share ciphertext with packaged builds.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Password wrap of the 32-byte key | `apps/desktop/src/main/vault/database-key-provider.ts` (`wrapWithPassword` / `unwrapWithPassword`, `KIND_PASSWORD`, scrypt + AES-256-GCM, `MDBK` blob) | Linux insecure keyring already uses this. Export should produce the same blob kind with the **export passphrase**, not the vault password. |
| Key persist / OS rewrap | Same file `persistKey` / `getOrCreateKey` | Import must call destination OS wrap (or Linux password wrap with the **new machine’s vault password**). |
| SQLCipher snapshot | `packages/db-sqlite/src/encrypted-sqlite-connection.ts` `trySqlcipherExport` / `sqlcipher_export()` | Use this (or equivalent ATTACH + export) so WAL is not copied live. Already restores `PRAGMA user_version`. |
| Format sidecar | `apps/desktop/src/main/db/database-paths.ts` | Include `moat-db-format.json`. Honor `minAppVersion` on import. |
| Fail-closed DB errors | `packages/contracts/src/ipc/vault.ts` + `map-vault-error.ts` | Do not mint a new key over an existing customer DB. Validate the archive **before** replacing destination files. |
| Encryption threat model | `specs/features/desktop-database-encryption/spec.md` | “User moves `moat.db`…” and recovery-key follow-on. This spec is that follow-on, as a file rather than a printed key. |
| Vault setup / unlock | `apps/desktop/src/renderer/src/pages/vault-unlock/` | Fresh-machine import belongs next to `SetupLocalVault`. |
| Local vault Settings | `apps/desktop/src/renderer/src/pages/settings/local-vault-settings-card.tsx` | Primary export/import entry once unlocked. |
| Local DB Settings | `apps/desktop/src/renderer/src/pages/settings.tsx` `#settings-local-database` | Status/counts only today. Keep diagnostics there; vault move lives on Local vault. |
| Plaid reconnect UI | `apps/desktop/src/renderer/src/components/plaid/institution-row.tsx` | `requiresReconnect` already exists. Export snapshot should null tokens and set this flag. |
| Plaid token wrap | `apps/desktop/src/main/plaid/token-storage.ts` | Do not copy ciphertext. Destination cannot decrypt it. |
| Cloud backup | `specs/features/desktop-cloud-backup/spec.md` | Push-only; restore is a non-goal there. Do not overload it. |
| Destructive reset | `apps/desktop/src/renderer/src/pages/vault-unlock/reset-vault-dialog.tsx` | Import-over-existing should feel as serious as reset. |
| IPC pattern | `apps/desktop/docs/patterns/main-renderer-ipc.md` | New domain in `packages/contracts/src/ipc/`, handler, preload. Renderer never sees the raw key or passphrase logged. |
| Electron save/open dialogs | None in desktop today | First use of `dialog.showSaveDialog` / `showOpenDialog` in **main**. Do not expose raw `fs` to the renderer. |

Do **not** reuse `copySqliteFamily` of the live production files as the export implementation. That races with WAL.

## Target Experience

### Honest copy (Local vault card)

Keep the existing encryption sentence, then add:

> This device’s database cannot be opened on another computer unless you export a vault archive.

Buttons: **Export vault archive…** and **Import vault archive…**

Command palette (`route-command-menu.tsx`): add keywords `export`, `import`, `transfer`, `new computer` on the Local Vault item.

### Export (unlocked, Settings)

1. Click **Export vault archive…**
2. Sheet asks for an **archive passphrase** (create + confirm). This is not the app password and is not auto-filled from it. Minimum **12 characters**. Helper text: “You will need this passphrase to open the archive on another computer. Moat does not keep a copy.”
3. Main process shows a native Save dialog. Default name `moat-vault-YYYY-MM-DD.moatvault`.
4. Progress: “Preparing archive…” (snapshot + strip tokens + wrap key + write).
5. Success: “Archive saved. Bank connections will need to be reconnected on the new computer. Store the file and passphrase separately — for example a USB drive and a password manager.”
6. Failure: no partial file left at the chosen path. Temp files deleted. Typed error, no PII.

Cancel on the save dialog is a no-op, not an error.

### Import — empty machine (vault not configured)

On `SetupLocalVault`, secondary action:

> **Have a vault archive?** Import from another computer

Flow:

1. Native Open dialog, filtered to `.moatvault`.
2. Archive passphrase.
3. **New app password** for this device (existing 8-character vault rules + optional Touch ID). Independent of the archive passphrase.
4. Main validates passphrase against the wrapped key, opens the snapshot, checks `minAppVersion`, then writes destination `moat.db` + sidecar + `database-key.bin` (destination wrap) + `vault-config.json` (new password hash).
5. Unlock and continue into the app. Plaid rows show reconnect. Cloud backup is signed out. Agent gateway has no tokens.

If a `moat.db` already exists on an unconfigured machine (crash leftover), fail closed and point at reset — same rule as encryption migration.

### Import — this device already has a vault

From Settings, unlocked:

1. Warn: “Importing replaces all financial data on this computer. Bank connections on this computer will be removed. This cannot be undone.”
2. Confirm phrase: `REPLACE LOCAL VAULT` (parallel to `RESET LOCAL VAULT`).
3. Passphrase + Open dialog.
4. Validate archive **before** deleting destination files. On failure, existing vault is untouched.
5. Replace DB + key blob. Keep the current vault password / Touch ID / recovery email (this device’s unlock, not the source device’s). Rewrap the imported SQLCipher key with this device’s OS storage (or this device’s vault password on Linux `basic_text`).
6. Restart unlocked services (`closeDesktopDb` → `initDesktopDb`) so Prisma is not holding the old file.

### After import (any path)

Banner or one-shot Settings note:

> Vault imported. Reconnect your banks to resume sync. Sign in to your Moat account if you use cloud backup or Plaid.

Do not auto-start Plaid sync against items with null tokens.

### Errors (user-visible, no SQLite/SQLCipher jargon)

| Situation | Copy direction |
|-----------|----------------|
| Wrong passphrase | That passphrase does not open this archive. The file was not changed. |
| Corrupt / truncated archive | This file is not a valid Moat vault archive. |
| `minAppVersion` newer than running app | This archive was written by a newer Moat Finance. Install the latest version, then import. |
| Destination has data, confirm skipped/failed | Import cancelled. Your current vault was left untouched. |
| Key unwrap / decrypt after passphrase OK but DB won’t open | Moat cannot read the database in this archive. The file on this computer was not replaced. |

## Architecture / Data Model

### What v1 puts in the archive

Recommended container: a zip named `*.moatvault` (not a folder copy of `userData`).

```text
manifest.json
moat.db                 ← SQLCipher snapshot, no WAL/SHM
moat-db-format.json
database-key.bin        ← MDBK v1 KIND_PASSWORD, wrapped with the export passphrase
```

`manifest.json` (version 1):

```ts
{
  version: 1,
  createdAt: string, // ISO
  minAppVersion: string, // from format sidecar
  sourcePlatform: "darwin" | "win32" | "linux" | "other",
  stripped: ["plaid_tokens", "cloud_session", "agent_tokens"],
}
```

Derive types with Zod in `packages/contracts`. Reject unknown `version`.

### What v1 never puts in the archive

- `vault/vault-config.json` (source app password hash, recovery email, `recoveryDeviceId`)
- OS-wrapped `database-key.bin` from the source machine
- `cloud-token.bin`, `cloud-backup-state.json`
- `agent-tokens.json`, agent audit logs, gateway settings
- Live `moat.db-wal` / `moat.db-shm`
- Encryption migration temps (`.safety-copy`, `.legacy-plaintext`, …)
- Appearance, notification delivery history, or other device-local prefs unless a later phase explicitly adds them

Retail orders and connections have no OS-wrapped secrets in SQLite today (`RetailConnection` is status only). They may travel in `moat.db`. Re-auth of the browser extension on the new machine is expected.

### Key handling (do not invent a second wrap format)

**Export**

1. Vault must be unlocked so `DatabaseKeyProvider` can load the raw 32-byte key in memory (never write it plaintext).
2. Snapshot: `sqlcipher_export()` (or the existing ATTACH equivalent) from the live keyed connection to a temp path, **same SQLCipher key**, then `chmod 0600`. Do not `PRAGMA rekey`. Do not copy production files.
3. Open the snapshot with that key. `UPDATE PlaidItem SET accessTokenEncrypted = NULL, requiresReconnect = 1`. Do not touch the live DB. Close snapshot.
4. `wrapWithPassword(rawKey, exportPassphrase)` → `encodeBlob(KIND_PASSWORD, payload)` into the archive’s `database-key.bin`.
5. Zip atomically to the user-chosen path (`tmp` + rename).
6. `finally`: unlink temp snapshot and any zip staging files. Zero the in-memory key the same way other vault paths do (avoid logging hex).

**Import**

1. Unzip to a temp dir (`0600`).
2. Read manifest; check `version` and `minAppVersion`.
3. `unwrapWithPassword` with the export passphrase. Wrong passphrase → typed error, **no** writes under `userData`.
4. Open snapshot with unwrapped key; `SELECT count(*) FROM sqlite_master` (same check as encryption open). Failure → abort.
5. Only then replace destination:
   - `unlinkSqliteFamily` + write snapshot as `moat.db`
   - write format sidecar
   - `persistKey(rawKey, destinationVaultPassword)` so the blob becomes `KIND_OS` on macOS/Windows/Linux-with-keyring, or `KIND_PASSWORD` with the **destination vault password** on insecure Linux
6. Do not leave the archive’s password-wrapped blob as the live `database-key.bin` on macOS/Windows — that would skip Keychain and weaken the on-disk story. The archive blob is transport-only.

Re-wrapping the **existing** SQLCipher key (instead of exporting to a new DB key) is the v1 choice: smaller, faster, and the wrap helpers already exist. Re-exporting under a new key is a later hardening option, not required to ship.

### IPC (new domain)

Add `packages/contracts/src/ipc/vault-archive.ts`. Suggested channels:

| Channel | When | Notes |
|---------|------|--------|
| `vaultArchive:export` | Unlocked | Input: `{ passphrase: string }`. Main shows Save dialog. Result: `{ ok, errorCode?, fileName? }` — **no full path** in the renderer. |
| `vaultArchive:import` | Unlocked **or** vault not configured | Input: `{ passphrase: string, newVaultPassword?: string, confirmPhrase?: "REPLACE LOCAL VAULT" }`. Main shows Open dialog. `newVaultPassword` required when `configured === false`. `confirmPhrase` required when destination already has a DB. |

Guard with existing vault rules: export requires unlocked; import-over-existing requires unlocked; import-on-empty requires not configured.

Passphrase stays in the IPC payload (renderer → main) the same way vault setup already sends the app password. Never echo it in logs, analytics, or error strings.

Register from `register-handlers.ts`. Preload: `window.moatDesktop.vaultArchive.export | import` only.

### Analytics

`desktop_vault_archive_exported` / `desktop_vault_archive_imported` with `{ userId? }` or `{ demoUser: true }` per [AGENTS.md](../../../AGENTS.md). Payload: booleans/counts only (e.g. `hadPlaidItems: boolean`). No file names, paths, or passphrase length.

### Logging

Shared logger. `warn` for cancel/wrong passphrase; `error` for failed snapshot/write. No paths that include usernames if avoidable; never tokens, key hex, or passphrase.

## Implementation Plan

### Phase 1 — Export + import (ship together)

Export without import is a brick. Build both.

1. Contracts + Zod manifest.
2. Main-process archive engine (snapshot, strip Plaid tokens, wrap, zip, unwrap, validate, replace) with temp-dir tests (`node:test` pattern in `apps/desktop/src/main/vault/database-key-provider.test.ts` and encryption migration tests).
3. IPC + preload + Settings + setup-screen entry.
4. Native save/open dialogs in main.
5. Honest Local vault copy.

**Acceptance:** Mac-packaged → Windows-packaged (or any two OS) round-trip of a fixture DB: transactions/rules present, Plaid items flagged reconnect, destination Keychain/DPAPI wrap succeeds, wrong passphrase does not clobber destination.

### Phase 2 — Polish (same feature, not a new bet)

- Progress events if snapshot is slow on large DBs.
- “Reveal in Finder/Explorer” after export (optional).
- Command-palette actions.

### Later (not this spec)

- Printed recovery key that unwraps `database-key.bin` without an export step (dead laptop if they never exported).
- Zero-knowledge encrypted cloud snapshot of this same archive.
- Domain-level cloud restore (`desktop-cloud-backup`).
- Bidirectional / mode cutover (`desktop-cloud-sync`).

## Acceptance Criteria

- [ ] Unlocked Settings can export a `.moatvault` after the user sets a 12+ character archive passphrase (create + confirm).
- [ ] Archive contains SQLCipher `moat.db` (no WAL), format sidecar, password-wrapped key blob, and manifest — not `userData` wholesale.
- [ ] Live `moat.db` is unchanged by export, including Plaid tokens on the source machine.
- [ ] Snapshot in the archive has `PlaidItem.accessTokenEncrypted` null and `requiresReconnect` true.
- [ ] Cloud session and agent tokens are absent from the archive.
- [ ] Empty-machine import: open archive → passphrase → new app password → vault opens with imported data.
- [ ] Import re-wraps the SQLCipher key for the destination OS; source Keychain/DPAPI material is not required.
- [ ] Import of a Mac archive onto Windows (and the reverse) succeeds when app versions are compatible.
- [ ] Wrong passphrase or corrupt file leaves the destination vault untouched.
- [ ] Import over existing data requires `REPLACE LOCAL VAULT` and only replaces files after the archive validates.
- [ ] Older app + newer `minAppVersion` archive fails with update copy; files preserved.
- [ ] Renderer never receives the raw database key or a filesystem path to `userData`.
- [ ] No PII, tokens, or key material in logs or analytics.

## Non-Goals

- Copying or documenting `userData` folder migration.
- Restoring Plaid access tokens, `cloud-token.bin`, or agent tokens.
- Cloud upload of the archive; Moat-hosted backup; web/iOS import.
- Switching desktop to API-backed repos.
- Printed/BIP39 recovery key at first-run (sibling feature).
- Re-encrypting the snapshot under a new SQLCipher key (optional later).
- Changing vault password minimum (8) for daily unlock.
- Time Machine / Migration Assistant support as a product promise.
- Multi-vault or merging two databases.
- Export while locked.

## Open Questions

- **Confirm phrase on empty import?** Empty machine has nothing to destroy; likely skip `REPLACE LOCAL VAULT` there.
- **Should appearance / agent auto-start travel?** v1 says no. Easy to add fields later via manifest version.
- **Passphrase KDF:** reuse current scrypt params in `database-key-provider.ts` for consistency, or bump cost only for archives because the file may leave the device? Recommend reuse v1 so unwrap code stays one path; revisit if we add a dedicated archive blob version.
- **Zip vs custom binary:** zip is simple and the payload is already encrypted. Custom format hides file names only. Recommend zip + manifest `version`.
- **Default save location:** user-chosen only (no silent write to Desktop) — confirm.

## Related Specs

- [Desktop database encryption](../../features/desktop-database-encryption/spec.md) — at-rest model; machine-bound key; recovery-key follow-on.
- [Desktop local vault recovery](../../features/desktop-vault-recovery/spec.md) — forgot-password email; destructive reset. Orthogonal to moving computers.
- [Desktop cloud backup](../../features/desktop-cloud-backup/spec.md) — optional domain push; no pull.
- [Desktop cloud sync (backlog)](../desktop-cloud-sync.spec.md) — mode cutover; not this.
- [MCP / local desktop security notes](../mcp-and-local-desktop-security-enhancements.spec.md) — “recovery key for backup restore.”
- [SQLite and local data](../../../apps/desktop/docs/patterns/sqlite-and-local-data.md)
- [Main/renderer IPC](../../../apps/desktop/docs/patterns/main-renderer-ipc.md)

## Suggested Commit Message

```text
docs (desktop): adds vault archive backlog spec
```
