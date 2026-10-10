# Desktop Database Encryption at Rest

## Status

Implemented (in review). Updated September 1, 2026 after a full spec-vs-code review of the desktop encryption stack. The original draft said “spec only”; the code now exists under the module layout below. This revision records what shipped, what the review fixed, and which residual risks remain.

## Goal

Encrypt the local desktop financial database at rest, automatically migrate every existing plaintext `moat.db` without data loss, and keep the existing vault password / Touch ID gate as a separate layer.

Success means:

- A copied `moat.db` (and its WAL/SHM sidecars) cannot be opened with ordinary SQLite or a SQLCipher client using the wrong key.
- Existing customer data survives migration. A failed or interrupted migration never destroys the only usable copy.
- New installs create an encrypted database from the first open.
- The raw database key never leaves the Electron main process and is never stored in source, `.env`, logs, localStorage, renderer state, or plaintext next to the database.
- Product copy and security state are honest about what this does and does not protect, especially on Windows and Linux.

## Recommendation — is this the best path?

**Yes: encrypt the SQLite file with a SQLCipher-compatible cipher, keep Prisma, and migrate existing files with a crash-safe export/swap.** That matches the threat model (offline file copy, backup/sync of the DB file, casual `sqlite3 moat.db`) without rewriting the desktop data layer.

It is **not** viable to “turn on SQLCipher” under today’s Prisma query engine. The original prompt assumed a SQLCipher drop-in for whatever SQLite package we already use. We do not use `better-sqlite3`, `node-sqlite3`, or libSQL. We use **Prisma 6’s bundled SQLite query engine**, which speaks stock SQLite and has no supported `PRAGMA key` / SQLCipher path.

| Option | Verdict | Why |
|--------|---------|-----|
| Prisma query engine + `PRAGMA key` after connect | Reject | Engine may read the file before we can set the key; connection pooling would drop the key; Prisma does not support SQLCipher URIs. |
| Custom Prisma engine built against SQLCipher | Reject | Unofficial, we would own a forked native binary across macOS/Windows/Linux and every Electron upgrade. |
| Replace Prisma with raw `better-sqlite3` / Drizzle | Reject for this work | Touches every `Sqlite*Repository`, `runMigrations`, tests, and packaging. High rewrite risk on a data-loss-sensitive change. |
| AES-wrap the whole `.db` file, decrypt to a temp path on unlock | Reject | Plaintext (and WAL) exist on disk while the app is open; a crash leaves plaintext; does not meet the threat model. |
| Field-level encryption of “sensitive columns” | Reject as the at-rest answer | Schema, relationships, and unencrypted columns still leak. Useful later as defense-in-depth, not a substitute. |
| Rely on FileVault / BitLocker / LUKS only | Reject as the at-rest answer | Does not stop same-user file copy, Time Machine / iCloud / Dropbox of `userData`, or another app opening `moat.db`. |
| **Prisma driver adapter + SQLCipher-compatible `better-sqlite3` fork** | **Recommend** | Keeps repositories and `runMigrations()`. Applies the key on the native connection **before** Prisma runs SQL. WAL/SHM are encrypted by the cipher. `sqlcipher_export()` (or the library equivalent) supports plaintext → encrypted copy. |

Do **not** combine this with a Prisma 6 → 7 upgrade. Prisma 7’s rust-free client would drop the query engine and is attractive later, but it is a separate compatibility project.

## Product Context

Moat Desktop is local-first. The V1 vault ([desktop-local-vault](../../complete/desktop-local-vault/spec.md)) is an **app-level unlock gate**. The architecture note is explicit: SQLite is plaintext at rest; SQLCipher was deferred until a data-layer spike confirmed Prisma + Electron packaging.

That gap is the one this spec closes. Unlocking with a password or Touch ID does not encrypt `moat.db`. Anyone who can read the user-data folder can open the file with a normal SQLite client.

This work is the missing half of the “local vault” promise. It does not replace:

- Vault password / Touch ID (presence + session gate)
- Recovery email / destructive reset ([desktop-vault-recovery](../desktop-vault-recovery/spec.md))
- Plaid token `safeStorage` wrapping
- Optional cloud backup of selected domains ([desktop-cloud-backup](../desktop-cloud-backup/spec.md))

## Current Repo Context

Findings below are from the repo as of this spec, not from the original prompt.

### 1. SQLite library and how the DB is opened

| Fact | Location |
|------|----------|
| ORM | Prisma `^6.19.3` (`prisma-client-js`) |
| Native engine | Prisma SQLite **query engine** (still required on Prisma 6 even with a driver adapter) |
| SQLCipher connection | `better-sqlite3-multiple-ciphers@13.0.3` via `packages/db-sqlite/src/encrypted-sqlite-connection.ts` |
| Prisma bridge | Custom `KeyedSqliteAdapter` in `encrypted-prisma-adapter.ts` — **not** `@prisma/adapter-better-sqlite3`, which is hard-wired to stock `better-sqlite3` |
| Client factory | `packages/db-sqlite/src/createSqliteClient.ts` — `createSqliteClientHandle(dbPath, { key })` opens the keyed native connection **before** `new PrismaClient({ adapter })` |
| Structural type | `packages/db-sqlite/src/db-client.ts` (`SqliteDbClient`) |
| Desktop init | `apps/desktop/src/main/db.ts` → `initDesktopDb(userDataPath)` (legacy path copy → encryption ensure → keyed Prisma → `runMigrations`) |
| Packaged client | electron-builder `extraResources` copies `packages/db-sqlite/src/generated/client` → `Resources/prisma-client` **and** SQLCipher `.node` → `Resources/sqlcipher-native` |
| Vite | `electron.vite.config.ts` externalizes the generated client and `better-sqlite3-multiple-ciphers` so the native addon is not bundled into `out/main` |

There is **one** Prisma client per process, held in `_desktop` after first successful unlock. The local MCP gateway, Plaid scheduler, cloud-backup scheduler, retail ingest, and IPC handlers all share that client via `AppRuntime`. There is no second SQLite process, but there is also **no single-instance lock** (`requestSingleInstanceLock` is unused), so two Moat processes can open the same file.

### 2. File locations

Production filename is **`moat.db`**, not `moat.sqlite`.

| Build | Directory | DB file |
|-------|-----------|---------|
| Packaged macOS | `~/Library/Application Support/moat-finance/` | `moat.db` |
| Unpackaged `pnpm dev` | `~/Library/Application Support/moat-finance-dev/` | `moat.db` |
| Packaged Windows | `%APPDATA%/moat-finance/` | `moat.db` |
| Packaged Linux | `~/.config/moat-finance/` | `moat.db` |

Sidecars: `moat.db-wal`, `moat.db-shm`. Reset already deletes those three (`apps/desktop/src/main/ipc/vault.ts` `deleteLocalDatabase`).

Legacy aliases still exist: `fin.db` → `moat.db`, and old folder names `moat-desktop` / `Moat Finance`, copied by `apps/desktop/src/main/migrate-legacy-data.ts` **before** the Prisma client opens. Encryption migration must run **after** that copy.

Unpackaged macOS uses Chromium `--use-mock-keychain` and a separate userData folder so mock ciphertext cannot decrypt packaged Plaid tokens. Encryption keys must follow the same split.

### 3. Schema / migrations

Runtime migrations are **not** `prisma migrate deploy`. They are embedded SQL in `packages/db-sqlite/src/migrations.ts`: `CREATE TABLE IF NOT EXISTS`, `PRAGMA table_info` + `ALTER TABLE`, and one-shot flags in `_MoatSchemaFlag`.

Prisma migration SQL under `packages/db-sqlite/prisma/migrations/` is the generate-time history, not what packaged apps run.

New encrypted databases set `PRAGMA user_version = 1` (`MOAT_SQLITE_USER_VERSION`). Export restores the source value so a migrated file keeps its previous version. Detection of encrypted vs plaintext still uses the file header + sidecar, not `user_version`. Preserve `_MoatSchemaFlag` rows and `sqlite_master` objects.

`runMigrations()` issues `PRAGMA foreign_keys = ON` on the live connection. That must happen **after** the encryption key is applied.

### 4. Startup and vault auth

Current order (`apps/desktop/src/main/index.ts` + `ipc/vault.ts`):

```text
app.whenReady
  → register IPC (including vault)
  → create BrowserWindow  (marks os-safe-storage ready)
  → locked UI
  → setup / password / Touch ID / recovery
  → ensurePostUnlockServices
       → initDesktopDb (open Prisma, runMigrations, seed, runtime)
       → agent gateway, retail ingest, Plaid scheduler, cloud backup, accruals
```

Vault is an in-memory `_unlocked` flag plus scrypt hash in `userData/vault/vault-config.json`. Touch ID (`systemPreferences.promptTouchID`) is **presence only** — it does not unwrap a DB key. On lock, `stopUnlockedServices()` now `$disconnect()`s Prisma, closes the native handle, and sets `_desktop = null`. A later unlock reopens from `DatabaseKeyProvider`.

`localDb.getStatus` uses `getUnlockedDesktopDb()`. The payload is `{ ok, hasLocalUser, encrypted }` — no filesystem `dbPath`.

Single-instance lock: `app.requestSingleInstanceLock()` in `index.ts`; a second instance focuses the existing window.

### 5. IPC / MCP surface

Typed domain channels only (`packages/contracts/src/ipc/*`). Preload exposes `window.moatDesktop.*`. There is **no** generic execute-SQL, read-file, or encryption-key IPC.

Insights/spending/memories/notifications use `$queryRaw` / `$queryRawUnsafe` with **fixed** SQL strings in the main process, not caller-supplied SQL.

Local MCP (`apps/desktop/src/main/agent-gateway/`) talks to `AppRuntime` / scoped tools, not the filesystem DB path. Keep it that way.

### 6. Packaging, signing, updates

- Electron `^36.3.1`, electron-builder, native runners in `.github/workflows/desktop-release.yml`.
- macOS: Developer ID, hardened runtime, notarization; Keychain item `{app.name} Safe Storage` (`moat-finance Safe Storage`). Consistent signing identity is already required for Plaid tokens.
- Windows: NSIS x64, Authenticode when secrets exist.
- Linux: AppImage.
- Auto-update: `electron-updater`, generic provider `https://downloads.moatfinance.ai/updates`. `allowDowngrade` is **not** set (default false). Manual install of an older DMG/NSIS is still possible.
- `asarUnpack: **/*.node` already exists for native addons.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| DB init | `apps/desktop/src/main/db.ts` | Encryption ensure + legacy path copy run **before** keyed Prisma / `runMigrations` |
| Prisma client factory | `packages/db-sqlite/src/createSqliteClient.ts` | Adapter + keyed native connection |
| Keyed adapter | `packages/db-sqlite/src/encrypted-prisma-adapter.ts` | Custom; official better-sqlite3 adapter cannot load the cipher fork |
| Runtime SQL | `packages/db-sqlite/src/migrations.ts` | Must not run until key is applied |
| Legacy path copy | `apps/desktop/src/main/migrate-legacy-data.ts` | Keep; run first |
| OS crypto gate | `apps/desktop/src/main/vault/os-safe-storage.ts` | Async `encryptStringAsync` / `decryptStringAsync` plus Linux backend detection |
| Plaid token wrap | `apps/desktop/src/main/plaid/token-storage.ts` | Already `safeStorage`; leave as second layer inside the encrypted DB |
| Vault IPC | `apps/desktop/src/main/ipc/vault.ts` | Post-unlock init; lock closes DB; reset deletes `moat.db`+WAL+SHM+key blob+temps |
| Vault guard | `apps/desktop/src/main/ipc/vault-guard.ts` | Fail-closed financial IPC |
| SQLite tests | `packages/db-sqlite/src/*.test.ts` | Pattern: temp dir + `createSqliteClientHandle` + keyed close |
| Packaging docs | `apps/desktop/docs/patterns/packaging.md` | extraResources, signing, mock keychain |
| Parent limitation | `specs/complete/desktop-local-vault/architecture-note.md` | This spec is the deferred SQLCipher spike |

## Threat Model

### Protects against

- Copying `moat.db` / `-wal` / `-shm` off the machine and opening them with stock SQLite.
- Another app casually scanning the user-data folder and running `sqlite3`.
- Backup / file-sync tools that pick up the DB file **without** the OS-protected key blob (and without the ability to unwrap that blob).
- Offline inspection of the raw bytes for merchant names, amounts, account names.

### Does not protect against

- A fully compromised OS or an attacker with the logged-in user’s credentials and the ability to run code as that user.
- Malware in the Moat process (main, renderer, or injected native code).
- Memory scraping while the vault is unlocked and the SQLCipher connection is live.
- Forensic recovery of **pre-migration** plaintext from SSD unallocated space after we delete the old file. Do not claim secure erase.

### `safeStorage` is not the same on every OS

| OS | What wraps the SQLCipher key | Practical meaning |
|----|------------------------------|-------------------|
| macOS (signed packaged app) | Keychain item `moat-finance Safe Storage` | Best of the three. ACL is tied to the signing identity. Unsigned `pnpm dev` uses mock keychain and **must not** share this ciphertext. |
| Windows | DPAPI (user profile) | Any process running as that Windows user can typically decrypt the blob. Encrypting the DB still stops “I only stole `moat.db`”. It does **not** equal Keychain app isolation if the attacker copies the whole `userData` folder **and** runs as that user. |
| Linux + `gnome_libsecret` / `kwallet*` | Session keyring | Similar to a password manager; depends on the desktop having an unlocked keyring. |
| Linux + `basic_text` | Chromium hardcoded plaintext wrapping | **Not encryption.** `isEncryptionAvailable()` can still be true. Must not be treated as Keychain-grade storage. |

Do not market this as “biometric-bound SQLCipher.” Touch ID does not hold the DB key.

## Architecture

### Layers (keep them separate)

1. **App lock** — existing vault password / Touch ID / recovery email. Gates *when* main process may unwrap the DB key and open the file.
2. **Database encryption** — SQLCipher-compatible cipher on `moat.db`. Protects the file at rest.
3. **Plaid / cloud tokens** — existing `safeStorage` blobs inside tables / `cloud-token.bin`. Unchanged.

### Recommended native stack

```text
IPC / AppRuntime / Sqlite*Repository / runMigrations
        ↓
PrismaClient({ adapter })          ← keep generated client + query engine
        ↓
KeyedSqliteAdapter                 ← custom; stock @prisma/adapter-better-sqlite3 cannot load this fork
        ↓
better-sqlite3-multiple-ciphers    ← native addon, SQLCipher cipher mode
        ↓
moat.db (encrypted pages + encrypted WAL)
```

Library choice: **`better-sqlite3-multiple-ciphers`** (SQLite3MultipleCiphers). It is the maintained Electron-friendly fork; `@journeyapps/sqlcipher` dropped Windows prebuilds. Default cipher of that fork is **sqleet**, not SQLCipher — we set SQLCipher mode explicitly (`PRAGMA cipher = 'sqlcipher'` then `PRAGMA legacy = 4`) so export/key semantics match what we document.

v13 ships **N-API** prebuilds (`darwin-arm64.node`, `win32-x64.node`, …). Root `package.json` lists it in `pnpm.neverBuiltDependencies` so install does not compile from source. Dist copies those prebuilds with `apps/desktop/scripts/copy-sqlcipher-prebuilds.mjs` into `Resources/sqlcipher-native`. `validate:prisma` fails the mac/win dist if the addon is missing. An Electron ABI rebuild is not required while we stay on this N-API prebuild line.

On open (before any Prisma query):

1. Open the native connection with `{ fileMustExist }` as appropriate.
2. `PRAGMA cipher = 'sqlcipher'`
3. Use SQLCipher 4 secure defaults (do not invent KDF/page-size overrides unless a compatibility test requires `legacy=4` for our own files — prefer one canonical profile and test it).
4. Apply the raw 256-bit key as `PRAGMA key = "x'<64 hex chars>'"` (already-random key; do not run a passphrase KDF on it).
5. Verify with a harmless read (`SELECT count(*) FROM sqlite_master`).
6. Construct the Prisma adapter + `PrismaClient`.
7. Then `PRAGMA foreign_keys = ON` / `runMigrations()`.

**Spike gate (implementation, not this spec):** confirm the fork exposes `sqlcipher_export()` in SQLCipher mode. If it does not, use the library’s documented equivalent (`ATTACH ... KEY ...` then export/copy all schema objects). Never `PRAGMA rekey` on a plaintext SQLite file.

Keep the Prisma query engine in `Resources/prisma-client` (adapter still needs it on Prisma 6) **and** ship the `better-sqlite3-multiple-ciphers` `.node` via extraResources (`sqlcipher-native`). Open uses `nativeBinding` when `process.resourcesPath/sqlcipher-native/${platform}-${arch}.node` exists; unpackaged `pnpm dev` loads the package prebuild from node_modules.

### `DatabaseKeyProvider`

Main-process only. Isolate key persistence from DB open/migration.

Responsibilities:

- Generate `crypto.randomBytes(32)` once per install (or once per successful first encryption).
- Persist **only** the OS-protected blob (or the password-wrapped blob on insecure Linux — see below).
- Load + decrypt after `markOsSafeStorageReady()`.
- Use Electron **async** `safeStorage.encryptStringAsync` / `decryptStringAsync` so `shouldReEncrypt` and `isTemporarilyUnavailable` are handled. Today `os-safe-storage.ts` only wraps the sync APIs.
- If `shouldReEncrypt === true`, re-encrypt and atomically replace the blob file.
- If `isTemporarilyUnavailable`, return a typed error — do not create a new key, do not create a new DB.
- Never log plaintext keys, hex keys, or decrypted blobs.

Suggested on-disk name: `userData/vault/database-key.bin` (next to `vault-config.json`, **not** named like the DB, **not** a sibling `moat.db.key` in plaintext). File mode `0600` on POSIX.

Do not put the raw key in `vault-config.json`.

### Linux `basic_text`

On Linux, call `safeStorage.getSelectedStorageBackend()` after `app.whenReady()`.

- `gnome_libsecret` / `kwallet` / `kwallet5` / `kwallet6` → use async `safeStorage` for the DB key (same as macOS/Windows).
- `basic_text` or `unknown` → **do not** store the SQLCipher key via `safeStorage`. Log a non-sensitive diagnostic (`backend=basic_text`). Surface `keyStorage: "insecure_os_backend"` on vault/security status.

**Recommended behavior for `basic_text`:** still encrypt `moat.db`, but wrap the SQLCipher key with the vault password (scrypt/Argon2, separate salt from the login hash). Password unlock unwraps the key; there is no Touch ID on Linux V1. Copying `moat.db` alone still fails. Copying the wrapped blob still fails without the password.

**Do not** silently keep a plaintext `moat.db` because keyring is missing.

Open question: refuse to run the app on Linux without a real keyring vs password-wrap. Recommendation is password-wrap so Linux users are not stranded, with honest Settings copy.

### Where the key lives per OS (after wrap)

| OS | Secret that can unwrap the 32-byte SQLCipher key | Blob on disk |
|----|--------------------------------------------------|--------------|
| macOS packaged | Keychain (`moat-finance Safe Storage`) | `vault/database-key.bin` (safeStorage ciphertext) |
| macOS `pnpm dev` | Mock keychain | Same path under `moat-finance-dev` — useless to packaged builds |
| Windows | DPAPI for the current Windows user | `vault/database-key.bin` |
| Linux + libsecret/KWallet | Session keyring | `vault/database-key.bin` |
| Linux + `basic_text` | User’s vault password (KDF wrap) | `vault/database-key.bin` (password-wrapped; different header/version so we never send it to `decryptString`) |

Renderer, preload, MCP tools, and logs never see the 32-byte key.

### Startup after this work

```text
app ready → window → os-safe-storage ready
  → vault setup/unlock (unchanged UX)
  → stop if already-initialized
  → migrateLegacyDesktopData
  → recover interrupted encryption migration (filesystem state machine)
  → DatabaseKeyProvider.getOrCreateKey()
  → if plaintext legacy DB: run encryption migration (must succeed or abort)
  → open SQLCipher connection + apply key
  → verify
  → createPrisma(adapter)
  → runMigrations / seed / runtime   ← never before key
  → start gateway / schedulers
```

### Vault lock (behavior change, required for the model)

On lock:

1. Stop gateway, retail ingest, schedulers (already partly done).
2. `$disconnect()` Prisma and `close()` the native SQLite handle.
3. Drop the in-memory key.
4. Keep `_desktop = null` so a later unlock re-opens with a key from `DatabaseKeyProvider`.

Otherwise “locked” is only a UI/IPC flag while SQLCipher still has the key in process.

### IPC audit (required, small)

- No new channel for keys, SQL, or arbitrary files.
- `localDb.getStatus` must use `getUnlockedDesktopDb()` (or stop returning `dbPath` while locked). Returning the absolute `dbPath` to the renderer is not a key leak but is unnecessary; prefer a boolean health flag.
- Reset must delete encrypted DB + WAL + SHM + `database-key.bin` + any migration temp files.

### Format marker (downgrade / old build)

Write a small plaintext sidecar, e.g. `moat-db-format.json`:

```json
{
  "version": 1,
  "encryption": "sqlcipher",
  "minAppVersion": "<first encrypting desktop version that wrote this file>"
}
```

`minAppVersion` is `app.getVersion()` at first write and is **never lowered** on later opens. Do not hardcode a shipped plaintext version such as `0.1.33`.

This is **not** how we detect encryption for migration (header + open-with-key vs open-without-key). It is how we fail closed and show copy. Old builds will not read it.

**Already-shipped builds** (`0.1.33` and earlier) that are manually reinstalled over an encrypted DB will treat the file as corrupt (`file is not a database`), throw in `initDesktopDb`, and surface `VAULT_INTERNAL_ERROR`. The unlock screen still offers **Reset local vault**, which **deletes** the DB. That is the highest-severity residual risk of this project.

Mitigation:

1. **Compatibility detector is in this encrypting build.** If `moat-db-format.json` says `encryption: sqlcipher` and `minAppVersion` is newer than the running app, return `DATABASE_INCOMPATIBLE_VERSION` and copy: install the latest Moat; resetting deletes data. Reset is a link, not the primary action.
2. That detector **cannot** help binaries that already shipped without it. Do not treat “we wrote a sidecar” as protection for `0.1.33`. A dedicated pre-encryption compatibility release is still the only way to close that hole for users who never update past `0.1.33` before encrypting.

electron-updater will not auto-downgrade. Manual old installers remain the hole the sidecar shrinks for *future* encrypting builds.

### Single-instance lock

Add `app.requestSingleInstanceLock()` as part of this work. Two processes + WAL + encryption migration is an unsafe combination. Focus the second instance.

## Existing customer migration

Versioned, idempotent, never in-place conversion of the only copy.

Do **not** use filename or a config flag alone to decide plaintext vs encrypted. Probe:

- Bytes start with `SQLite format 3` → plaintext (or unencrypted SQLite).
- Open without key fails / file is not a database, and key exists → treat as encrypted; open with key.
- Interrupted artifacts present → recovery table below.

`PRAGMA rekey` is forbidden on plaintext.

Preserve SQLCipher’s note: `sqlcipher_export()` does not copy `PRAGMA user_version`. If we start writing `user_version`, restore it explicitly. Always copy `_MoatSchemaFlag`.

### State machine (on-disk names)

All paths under `userData`, beside production `moat.db`.

| Path | Role |
|------|------|
| `moat.db` (+ `-wal` `-shm`) | Production |
| `moat.db.safety-copy` (+ sidecars) | Untouched backup of plaintext until after proven cutover |
| `moat.db.encrypted-migration` | Candidate encrypted DB |
| `moat.db.legacy-plaintext` | Production renamed during swap only |
| `moat-db-format.json` | Compatibility marker |
| `vault/database-key.bin` | Wrapped key |
| `vault/encryption-migration-state.json` | Non-sensitive phase + checksums (table names, row counts, not financial values) |

### Phase 1 — preparation

1. Assert single instance; stop gateway/schedulers; no other DB handles.
2. If Prisma is already open (should not be on first post-unlock path), disconnect.
3. Checkpoint WAL (`PRAGMA wal_checkpoint(TRUNCATE)` / close) so committed data is in the main file; then close.
4. Detect format; detect leftover temp names from a previous crash.
5. Snapshot non-sensitive validation: `sqlite_master` names/types, row counts per user table, `_MoatSchemaFlag` map, `PRAGMA user_version` if set.

### Phase 2 — safety copy

Copy `moat.db` + WAL + SHM to `moat.db.safety-copy*`. Production file stays until the encrypted candidate is fully validated. Do not modify production in this phase.

### Phase 3 — export

1. `getOrCreate` 32-byte key; persist wrapped blob **before** relying on it (so reopen tests the real provider).
2. Create new encrypted file `moat.db.encrypted-migration`.
3. `ATTACH` + `sqlcipher_export()` (or equivalent) from the plaintext source.
4. Restore `user_version` and any PRAGMAs we depend on (`foreign_keys` is per-connection; journal mode: match current production, typically WAL).
5. Confirm tables, indexes, triggers, views, row counts.

### Phase 4 — validation (before any rename of production)

1. Open candidate with the in-memory key: `sqlite_master`, `PRAGMA integrity_check`, schema objects, row counts, critical tables (`Transaction`, `Account`, `PlaidItem`, `Category`, rules, retirement, notifications, `_MoatSchemaFlag`), plus a small set of representative repository queries (account list, recent transactions, category count).
2. **Close completely.**
3. Reload key **only** via `DatabaseKeyProvider` (disk blob + OS decrypt or password wrap).
4. Reopen candidate from scratch; repeat enough checks to prove the persisted key works.

If anything fails: delete candidate (not production, not safety copy), keep plaintext production, typed error, do not mark complete.

### Phase 5 — atomic cutover

Only after phase 4:

1. All handles closed.
2. Rename `moat.db` → `moat.db.legacy-plaintext` (and sidecars).
3. Rename `moat.db.encrypted-migration` → `moat.db` (and encrypted sidecars if any).
4. Write/update `moat-db-format.json`.
5. Open production path with provider key; integrity/schema sanity.
6. Mark migration complete in `encryption-migration-state.json`.

If a rename fails: reverse the swaps we did; restore production to the plaintext file. Never delete plaintext until phase 6.

### Phase 6 — plaintext cleanup

Only after production encrypted DB was closed, reopened from the production path with the persisted key, and validated:

Delete `moat.db.legacy-plaintext*`, `moat.db.safety-copy*`, leftover plaintext WAL/SHM, `encrypted-migration` leftovers.

Do not keep an indefinite `.bak`. Do not claim SSD secure deletion in UI copy.

## Crash / rollback recovery

Startup inspects names **before** opening Prisma.

| On disk | Action |
|---------|--------|
| Only `moat.db` plaintext, no temps | Normal migrate or already-done skip |
| `moat.db` encrypted + format marker + key | Skip migrate; open encrypted; delete leftover plaintext temps |
| `moat.db` + `encrypted-migration` (incomplete export) | Delete candidate; keep `moat.db`; retry later |
| `moat.db` + `safety-copy` | Production is source of truth; ignore/delete incomplete candidate; delete safety copy only after encrypted production reopens with the persisted key |
| `legacy-plaintext` + `encrypted-migration` + **no** `moat.db` (crash during swap) | If the key is available, prefer a candidate that passes phase 4 against the leftover plaintext catalog; else rename `legacy-plaintext` back to `moat.db`. If the key blob is missing, restore plaintext and create a **new** key rather than leaving the user with no production file |
| `legacy-plaintext` + `moat.db` (encrypted in place) + crash before cleanup | Validate `moat.db` against the leftover plaintext catalog (row counts / schema), not merely “opens with key”; if OK, continue phase 6; if not, restore `legacy-plaintext`. Never delete plaintext because the encrypted file is merely readable |
| No `moat.db`, leftover `safety-copy` | Restore safety copy to production, then continue (migrate if plaintext) |
| Key blob missing, `moat.db` present (encrypted) | **Never** create a new empty DB. Typed `DATABASE_KEY_MISSING`. Preserve file. |
| Key blob present, `moat.db` missing, no recoverable leftovers | Typed `DATABASE_FILE_MISSING`. Do not generate a fresh empty encrypted DB over a restore the user is about to copy back. Open the Prisma client with `fileMustExist` when the production file already exists. |
| Key unwrap fails (Keychain/DPAPI/keyring) | Typed `KEY_STORAGE_UNAVAILABLE` / `KEY_UNWRAP_FAILED`. Preserve DB. Offer existing `repairSafeStorage` where relevant. |
| Encrypted `moat.db` + wrong/corrupt key | Typed `DATABASE_CANNOT_DECRYPT`. Preserve DB. |
| Old app / plaintext engine on encrypted file | Compatibility error (only in builds that include the detector). Preserve DB. |

**Never** respond to decrypt failure by `unlink(moat.db)` or by opening a new empty file at the same path. First-run setup may only create a DB when **no** `moat.db` exists.

Vault first-run rollback (setup fails after writing config) already deletes `moat.db`. After encryption, that path must also delete `database-key.bin` and temp migration files, and must **not** run if a pre-existing customer DB is present.

## Recovery / key-loss (product)

| Situation | Behavior |
|-----------|----------|
| Keyring temporarily locked | Typed error; retry; repair Safe Storage. No new key. |
| Blob deleted, DB remains | Cannot decrypt. Preserve DB. Honest copy: without backup/export, data is unrecoverable. Destructive reset remains the wipe path. |
| User moves `moat.db` to another machine | Key does not travel (Keychain/DPAPI/password wrap is machine/user bound). Preserve file; do not re-init. |
| Restores old userData backup | May restore mismatched key+DB pair; same fail-closed errors. |
| OS user account change (Windows profile / new Mac user) | DPAPI/Keychain miss; fail closed. |
| Reinstall app, keep userData | Packaged identity + Keychain should still unwrap if signing identity matches. |
| Reinstall app, wipe userData | Empty vault setup; new encrypted DB. |
| Recovery email password reset | Must **not** rotate the SQLCipher key. Password hash in `vault-config.json` changes; `database-key.bin` unchanged. |

No cloud key-recovery in this spec. Tradeoff: a user-held recovery key / printed backup is the only way to survive Keychain loss without wiping data. Track that as a follow-on (already listed as a non-goal in vault-recovery). Surface in Settings: this device’s database cannot be opened elsewhere without a future recovery-key feature.

## Upgrade / downgrade

- New build must migrate every supported plaintext `moat.db` (including `fin.db` after alias copy).
- No reconnect Plaid / reimport CSV as part of encryption migrate.
- Schema migrations (`runMigrations`) run only on an already-keyed connection, after encryption migrate.
- Auto-updater does not roll back. Compatibility build + format sidecar + fail-closed errors protect manual downgrade as much as old binaries allow.

## User-visible errors (copy direction)

Use vault-style language, not “SQLite” / “SQLCipher” in primary copy.

| Code (internal) | Direction |
|-----------------|-----------|
| `DATABASE_KEY_MISSING` | Moat cannot open the local vault key for this database. The data file was left untouched. |
| `DATABASE_CANNOT_DECRYPT` | Moat cannot read the local database with the saved key. The file was not replaced. |
| `KEY_STORAGE_UNAVAILABLE` | This device’s secure storage is locked or unavailable. [Repair] |
| `DATABASE_INCOMPATIBLE_VERSION` | This database was written by a newer Moat Finance. Install the latest version. Resetting deletes local data. |
| `ENCRYPTION_MIGRATION_FAILED` | Moat could not encrypt the local database. Your existing data was left as-is. |

Linux `basic_text`: Settings / security state: “This Linux session is not using a system keyring. The database file is still encrypted; the key is protected by your app password.”

## Implementation Plan

Code for phases 1–4 lives in-tree. Phase 0 is the detector inside this same build (not a prior plaintext-only release).

### Phase 0 — Compatibility detector (same train as encryption)

1. Header / format-sidecar detection in `initDesktopDb` / vault init.
2. Typed `DATABASE_INCOMPATIBLE_VERSION` without deleting files.
3. Unlock UI: reset is a link with last-resort copy, not the primary action.

**Acceptance:** sidecar `minAppVersion` newer than the running app preserves the file and distinguishes update vs reset. Already-shipped `0.1.33` still cannot do this.

### Phase 1 — Native open path (dev + tests)

1. `DatabaseKeyProvider` + async `safeStorage` + Linux backend detection.
2. `createSqliteClientHandle(dbPath, { key })` via custom adapter + SQLCipher mode.
3. Copy N-API prebuilds to extraResources; `validate:prisma` checks the addon on mac/win dist.
4. Tests: new encrypted DB, wrong key, missing key.

**Acceptance:** packaged smoke on macOS/Windows/Linux opens an encrypted fixture; stock `sqlite3` cannot read it.

### Phase 2 — Crash-safe plaintext → encrypted migration

1. State machine + recovery table (including safety-copy restore and catalog check vs leftover plaintext, not merely “opens with key”).
2. Export / validate / reopen-from-provider / swap / cleanup. Failed cutover always restores leftover plaintext if it still exists.
3. Wire into post-unlock init **before** `runMigrations`.
4. Close DB on lock (`closeDesktopDb` + drop `_desktop`).

**Acceptance:** fixture with production-like tables survives; kill -9 between every filesystem step recovers; plaintext deleted only after proven reopen.

### Phase 3 — Product surfaces + IPC

1. Error codes through vault action results + unlock copy.
2. Linux insecure backend on `VaultStatus`; Settings copy; forgot-password blocked when the key is password-wrapped.
3. Reset deletes key blob + temps.
4. Single-instance lock.
5. `localDb.getStatus` vault-gated; no `dbPath` in the payload.

**Acceptance:** no key/SQL IPC; MCP still scoped; lock closes the native connection.

### Phase 4 — Proof of encryption

1. Automated: ordinary SQLite open fails; SQLCipher+right key works; wrong key fails.
2. Raw file bytes contain no high-signal plaintext strings from the fixture (names/amounts planted in the test DB).
3. WAL produced during encrypted operation is not readable as plaintext SQLite.

## Testing

Prefer `node:test` + temp dirs in `packages/db-sqlite` (crypto path) and `apps/desktop/src/main` (provider + state machine with mocked `safeStorage`).

Minimum cases:

- Brand-new encrypted DB
- Plaintext legacy → encrypted
- Fixture modeled on an older schema (use historical SQL from `packages/db-sqlite/prisma/migrations/` plus `runMigrations` gap-fill)
- Row counts for every user-data table (exclude `sqlite_*`)
- Indexes / triggers / views if present
- `_MoatSchemaFlag` preserved
- `user_version` if we set it
- Reopen after simulated restart (new process, key only from provider)
- Wrong key / missing key / missing DB
- Corrupt encrypted candidate
- Failed export
- Failure before rename; between renames; after encrypted file has the production name
- Crash/interrupt recovery for each state-table row (including missing production + safety-copy, and encrypted production that opens but fails catalog checks against leftover plaintext)
- Leftover plaintext temps deleted only after encrypted production reopens with the persisted key
- WAL-mode plaintext source
- Already-encrypted skip (idempotent second launch)
- App update path: encrypted DB + newer `runMigrations` only
- Linux backend flag (unit)
- `shouldReEncrypt` rewrites blob without changing the SQLCipher key
- Vault lock disconnects; second unlock reopens
- Reset removes DB + key blob
- First-run setup failure does not delete a pre-existing DB

## Verification (implementation checklist)

A migrated `moat.db` must:

- Fail to open/query with ordinary SQLite without the key.
- Open with SQLCipher-compatible client + the right key.
- Fail with the wrong key.
- Show no obvious plaintext financial strings in raw bytes (fixture-based).
- Produce WAL/journal files that are not plaintext SQLite.

## Suggested module layout

Keep kebab-case; put filesystem/migration code next to vault/DB init, not inside repositories.

```text
apps/desktop/src/main/vault/database-key-provider.ts
apps/desktop/src/main/db/detect-database-format.ts
apps/desktop/src/main/db/encrypt-legacy-database.ts
apps/desktop/src/main/db/database-encryption-migration.ts
apps/desktop/src/main/db/database-encryption-validation.ts
packages/db-sqlite/src/createSqliteClient.ts          ← adapter + key
packages/db-sqlite/src/encrypted-sqlite-connection.ts ← native open + PRAGMA key
packages/db-sqlite/src/encrypted-prisma-adapter.ts    ← Prisma 6 driver adapter
```

Names can match existing `db.ts` / `vault/` style; do not invent a second ORM.

## Packaging / signing implications

- **macOS:** keep `appId` `com.moatfinance.desktop`, packaged `app.setName('moat-finance')`, Developer ID. Changing the name breaks Keychain for **both** Plaid tokens and the new DB key.
- **Native module:** Dist copies `better-sqlite3-multiple-ciphers` N-API prebuilds into `Resources/sqlcipher-native`. `validate:prisma` (mac/win unpacked apps) must fail if the addon is missing, same spirit as a missing query engine. Linux AppImage contents are not unpacked by that script today.
- **Linux AppImage:** libsecret/KWallet may be absent; `basic_text` handling is mandatory.
- **Dev:** mock keychain + `moat-finance-dev` remains; never mix packaged key blobs.

## What could make this migration unsafe

1. **Running `runMigrations` / Prisma before `PRAGMA key`** — empty or corrupt interpretation of an encrypted file.
2. **In-place `rekey` on plaintext** — documented SQLCipher footgun.
3. **Deleting plaintext before reopen-from-persisted-key** — the original prompt’s overriding rule; keep it.
4. **Old build + Reset after failed open** — ship compatibility build first.
5. **Two app instances** during migrate — add single-instance lock.
6. **Treating Linux `basic_text` as encrypted key storage.**
7. **Creating a new DB when decrypt fails.**
8. **Logging SQL with financial values during export/validate.**
9. **Leaving Prisma open on vault lock** — key stays in memory; IPC gaps like `localDb.getStatus`.
10. **Shipping without Electron ABI rebuild** — crashes on open, users reset, data gone.
11. **Format detection by filename only.**

## Acceptance Criteria

- [ ] New installs create SQLCipher-compatible encrypted `moat.db` with a 256-bit random key.
- [ ] Existing plaintext `moat.db` migrates automatically with no row-count loss on user tables.
- [ ] Failed/interrupted migration leaves a usable plaintext (or restored) production DB.
- [ ] Production plaintext copies are removed only after encrypted production reopen via persisted key.
- [ ] Key never in renderer, preload, MCP, logs, `.env`, or plaintext sidecar.
- [ ] Vault password / Touch ID remain; not advertised as binding the SQLCipher key.
- [ ] Decrypt/key-loss errors never create an empty DB over an existing file.
- [ ] Linux `basic_text` is detected, logged without secrets, and surfaced; not treated as Keychain.
- [ ] Packaged macOS signing identity unchanged; native addon present in dist.
- [ ] Compatibility behavior exists so an old build does not steer users to reset as the first response to an encrypted file.
- [ ] Automated tests cover the list in Testing; encryption is proven with a non-SQLCipher client failure + byte inspection on a fixture.

## Non-Goals

- Cloud key escrow / account-based key recovery.
- User-exportable recovery key PDF (follow-on).
- Replacing Prisma or upgrading to Prisma 7.
- Windows Hello / Linux biometrics.
- Encrypting MCP audit logs, `agent-settings.json`, or other JSON next to the DB (separate if needed).
- Secure-erase / forensic wiping of SSD remnants.
- Changing cloud backup domain selection or encrypting backups client-side (backup spec is separate).
- Claiming protection against same-user malware.

## Open Questions

- Ship the compatibility (fail-closed) build as its own desktop release before the encrypting build? **Still recommended for users who may install an old `0.1.33` over an encrypted DB.** This encrypting build includes the detector for *future* downgrades; it cannot patch already-shipped `0.1.33` binaries.
- Linux without keyring: **password-wrap** (implemented). Recovery email cannot unwrap that blob, so forgot-password is blocked with honest copy.
- Settings “encrypted at rest” indicator: **yes** on macOS/Windows (and Linux with a real keyring). Linux `basic_text` uses the fallback sentence in Settings, not Keychain-grade language.
- `PRAGMA user_version`: **set to `1`** on new encrypted databases (`MOAT_SQLITE_USER_VERSION`). Export restores the source `user_version`. Format detection still uses the SQLite header + sidecar, not `user_version` alone.

## Related Specs

- [Desktop Local Vault](../../complete/desktop-local-vault/spec.md) — unlock UX; encryption was deferred.
- [Desktop Local Vault Architecture Note](../../complete/desktop-local-vault/architecture-note.md) — V1 plaintext limitation; this spec is the SQLCipher follow-through.
- [Desktop Vault Recovery](../desktop-vault-recovery/spec.md) — reset must stay destructive; recovery email must not rotate the SQLCipher key.
- [Desktop Cloud Backup](../desktop-cloud-backup/spec.md) — backup reads via Prisma after unlock; not a second DB connection model.
- [MCP and local desktop security enhancements](../../backlog/mcp-and-local-desktop-security-enhancements.spec.md) — recovery key / export backup ideas.

## Suggested Commit Message

```text
feat (desktop): encrypts local sqlite at rest
```
