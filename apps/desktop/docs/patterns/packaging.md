# Pattern: Packaging and Distribution (apps/desktop)

## Build toolchain

The desktop app uses:
- **Electron Vite** (`electron.vite.config.ts`) — fast HMR dev server + production build
- **Electron Builder** — packages and signs the app for macOS and Windows distribution

---

## Commands

| Task | Command (from repo root) |
|------|--------------------------|
| Dev (with HMR) | `pnpm --filter moat-desktop run dev` |
| Production build | `pnpm --filter moat-desktop run build` |
| Package for macOS | `pnpm --filter moat-desktop run dist:mac` |
| Package for Windows | `pnpm --filter moat-desktop run dist:win` |
| Package for Linux | `pnpm --filter moat-desktop run dist:linux` |
| Typecheck | `pnpm --filter moat-desktop run typecheck` |
| Lint + format | `pnpm --filter moat-desktop run check:write` |

---

## Build outputs

```
apps/desktop/out/
├── main/           ← Compiled main process
├── preload/        ← Compiled preload script
└── renderer/       ← Compiled renderer (React app)

apps/desktop/dist/
├── Moat Finance-x.y.z.dmg            ← macOS installer
├── Moat Finance Setup x.y.z.exe      ← Windows installer
├── Moat Finance-x.y.z.AppImage       ← Linux AppImage
└── ...
```

## Local install paths (macOS)

| Concern | Path |
|---------|------|
| Installed app | `/Applications/Moat Finance.app` |
| User data (SQLite, vault, Electron state) | Packaged: `~/Library/Application Support/moat-finance`. Unpackaged `pnpm dev`: `~/Library/Application Support/moat-finance-dev` |
| Bundle ID | `com.moatfinance.desktop` |
| pnpm package name | `moat-desktop` (unchanged; used for `--filter`) |

The Electron `userData` folder is set via `app.setName(...)` in `src/main/index.ts`. Packaged builds stay on `moat-finance` so the Keychain service (`moat-finance Safe Storage`) keeps decrypting existing Plaid tokens. Unpackaged macOS builds use `--use-mock-keychain` and a separate `moat-finance-dev` folder so they cannot share ciphertext with the installed app. Older installs may still have `moat-desktop` or `Moat Finance` userData folders — those are migrated into packaged userData on startup and removed by the wipe script.

### macOS Keychain prompts

Electron / Chromium stores an OSCrypt key in Keychain as `{app.name} Safe Storage`
(for Moat: `moat-finance Safe Storage`). Creating the first `BrowserWindow` can
hit that item even before Moat encrypts any Plaid tokens — which is why the
prompt can appear on the vault unlock screen.

**`pnpm dev` (unsigned Electron):** macOS will not reliably honor **Always Allow**.
Unsigned / rebuilt binaries look like a different app to Keychain ACLs, so the
password dialog returns on every launch. Moat therefore enables Chromium’s
`--use-mock-keychain` switch in unpackaged macOS builds so local development
never talks to the real Keychain. Unpackaged userData is `moat-finance-dev`, so
that mock ciphertext never overwrites packaged tokens. Packaged apps do **not**
use that switch.

**Packaged / signed `Moat Finance.app`:** Expected UX is:

1. First Keychain access → macOS may ask once.
2. Choose **Always Allow**.
3. Later launches unlock and sync without prompting.

Electron’s docs require a consistent code signature for this. Without Developer
ID signing, re-prompts after every rebuild are expected.

`scripts/brand-electron-macos.mjs` still renames the Electron.dev bundle to
`Moat Finance.app` / `com.moatfinance.desktop` so any rare real-Keychain touch
in tooling matches the production identity. Re-run after Electron upgrades.

`safeStorage` must not run before `app.whenReady()` or before the first
`BrowserWindow` (otherwise macOS may create a Chromium-named Keychain item).
Main process code goes through `vault/os-safe-storage.ts`, which enforces that
order.

To fully uninstall a local install:

```bash
pnpm --filter moat-desktop run wipe:local:dry-run
pnpm --filter moat-desktop run wipe:local
```

---

## Electron Builder config

Electron Builder is configured in `package.json` under the `"build"` key (or a separate `electron-builder.config.js`). Key settings:
- **`appId`** — must be set for macOS notarization and Windows signing
- **`productName`** — "Moat Finance"
- **`mac.category`** — `public.app-category.finance`
- **`files`** — includes `out/` only (plus production `dependencies`)
- **`extraResources`** — copies the trimmed Prisma SQLite client + native query engine to `Resources/prisma-client`
- **`asarUnpack`** — `**/*.node` so any remaining native addons can load outside the asar

### Keeping the install size small

electron-builder packs every package in `dependencies` (and their transitive deps). Renderer-only libraries and code that electron-vite already bundles must live in `devDependencies`, otherwise they get shipped again as raw `node_modules` (lucide, posthog, date-fns locales, Prisma wasm engines, etc.).

Current split:
- **`dependencies`**: only runtime externals that cannot/should not be bundled (`electron-updater`)
- **`devDependencies`**: React UI stack, workspace packages, Plaid/MCP/PostHog, Prisma generate tooling — all bundled into `out/` or copied via `extraResources`

---

## Code signing and notarization (macOS)

For macOS distribution outside the Mac App Store:
1. A Developer ID Application certificate is required.
2. Set `CSC_LINK` (certificate .p12 path) and `CSC_KEY_PASSWORD` as environment variables before running `dist:mac`.
3. Notarization requires `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` env vars.
4. `dist:mac` imports the `.p12` into a temporary keychain, then runs electron-builder with identity auto-discovery. Do not pass `CSC_LINK` straight to electron-builder 26.x — it unlocks that keychain with the wrong password (`SecKeychainUnlock`) on macOS 26+.
5. `mac.forceCodeSigning` is on so a missing identity fails the build instead of publishing an unsigned app.

**These credentials are never committed to the repo.** Set them in CI environment variables or locally via `apps/desktop/.env` (gitignored).

---

## Auto-updater

`src/main/updater.ts` integrates `electron-updater` for automatic updates:

```ts
// src/main/index.ts
const mainWindow = await createWindow();
initAutoUpdater(mainWindow);
```

- Update checks run once on packaged-app launch (`checkForUpdates`).
- Updates download silently in the background.
- When an update is ready, the renderer shows a bottom-left floating widget with **Later** and **Update**.
- Clicking **Update** calls `autoUpdater.quitAndInstall(false, true)` through the typed `window.moatDesktop.updates` IPC bridge.
- The update feed URL is `https://downloads.moatfinance.ai/updates` (generic provider via electron-builder).
- macOS builds must ship both `dmg` (manual install) and `zip` (`electron-updater` / Squirrel.Mac). Collect and publish scripts allow `.zip`.

**Never force-quit the app during an update.** Always prompt the user through the in-app widget.

---

## SQLite in the packaged app

The packaged app uses Prisma's SQLite query engine (native `.node` binary). At dist time:

1. `prepare-dist` runs `prisma generate` for `@moat/db-sqlite` (multi-arch `binaryTargets` in the SQLite schema)
2. electron-builder copies the trimmed generated client to `Contents/Resources/prisma-client` (no wasm/edge/browser/maps)
3. `createSqliteClient()` resolves that directory via `process.resourcesPath`
4. `pnpm run validate:prisma` fails the mac/win dist if `Resources/prisma-client` (plus query engine) is missing

Do not put `@prisma/client` in desktop `dependencies` — the npm package ships engines for every database and is ~70MB+. The generated client under `packages/db-sqlite/src/generated/client` is self-contained for SQLite.

Vault setup opens SQLite only after the app password is created. If DB init fails, setup rolls back the vault config so the user can retry instead of getting stuck on `VAULT_ALREADY_CONFIGURED`.

---

## Release builds

There is no release workflow in this repo. Build distributables locally with `pnpm --filter moat-desktop run dist:mac` (or `dist:win` / `dist:linux`) on the matching OS. Signing, notarization, Plaid build-time keys, and auto-update hosting are described in [`RELEASE.md`](../../RELEASE.md).

`electron-vite` fails production builds when `PLAID_CLIENT_ID` / `PLAID_SECRET` are missing so empty credentials cannot ship.

Never commit certificates or passwords.

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Bumping Electron version | This file (SQLite section) + check native module compatibility |
| Changing auto-update behavior | This file (auto-updater section) |
| Building signed releases | This file (code signing section) + [`RELEASE.md`](../../RELEASE.md) |
| Adding new native dependencies | This file + Electron Builder docs |
