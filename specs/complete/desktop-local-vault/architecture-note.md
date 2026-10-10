# Desktop Local Vault — V1 Architecture Note

May 30, 2026.

## Selected approach (V1)

**App-level unlock gate** with secrets stored in OS-backed secure storage where available. Full SQLite encryption (SQLCipher / field-level) is deferred until a dedicated data-layer spike confirms Prisma + Electron packaging constraints.

### Vault secrets

- Fallback credential: **app password** (minimum 8 characters). Stored as **scrypt** hash + salt in `userData/vault/vault-config.json` (never plaintext).
- Optional **Touch ID** on macOS via `systemPreferences.promptTouchID()` when enabled and available. Touch ID confirms presence only; unlock still requires prior vault setup.
- Session state: in-memory `unlocked` flag in the main process. Financial IPC and the local MCP gateway fail closed while locked.

### Startup

1. Register IPC handlers and open the window (locked UI).
2. After successful setup or unlock, initialize SQLite, agent gateway, and Plaid scheduler.
3. Renderer never receives vault keys or raw password material.

### Limitations (explicit)

- Local SQLite files are not encrypted at rest in V1.
- Windows Hello and Linux biometrics are not implemented in V1.
- Reset without a recovery key removes vault config; optional destructive wipe deletes `moat.db`.

### Deferred

- SQLCipher / `better-sqlite3-multiple-ciphers` evaluation
- Windows Hello (WebAuthn or native module)
- User-held recovery keys and cloud recovery
