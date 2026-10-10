# Building desktop release builds

To distribute your own desktop builds, build them locally (or in your own CI) with `electron-builder`, as described below.

The official Moat builds are produced by `.github/workflows/desktop-release.yml` when a `desktop-v*` tag is pushed (`pnpm release:desktop`). That workflow needs the maintainer's signing, notarization, Plaid, and R2 secrets, so on a fork it fails at the secret-validation step; use the manual steps here instead.

## 1. Plaid keys (bring your own)

Plaid credentials are compiled into the desktop binary at build time. End users do not configure them. Production builds fail when they are missing.

Copy `apps/desktop/.env.example` to `apps/desktop/.env` and set:

| Variable | Purpose |
|----------|---------|
| `PLAID_CLIENT_ID` | Your Plaid client ID |
| `PLAID_SECRET` | Your Plaid secret for the chosen environment |
| `PLAID_ENV` | `sandbox` or `production` (production needs Plaid's approval) |

You pay Plaid directly for usage under your keys. Anyone with the binary can extract them, so only distribute builds to people you trust with those keys. See [docs/self-hosting.md](../../docs/self-hosting.md#bring-your-own-plaid-keys).

Set `MOAT_API_URL` / `VITE_MOAT_API_URL` and `MOAT_WEB_URL` if the build should talk to your own self-hosted server instead of the upstream defaults.

## 2. Code signing (optional)

Unsigned builds work for personal use. For a smooth public install, sign them. `electron-builder` reads these environment variables:

| Variable | Purpose |
|----------|---------|
| `CSC_LINK` | macOS Developer ID Application `.p12` (path or base64) |
| `CSC_KEY_PASSWORD` | Certificate password |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `WIN_CSC_LINK` | Windows Authenticode `.p12` |
| `WIN_CSC_KEY_PASSWORD` | Windows certificate password |

Unsigned macOS builds are blocked by Gatekeeper until the user allows them in System Settings. Windows SmartScreen warns on unsigned installers. Linux AppImage builds need no signing.

Before shipping your own builds, replace the upstream identifiers (`build.appId`, Apple Team ID) as listed in [docs/self-hosting.md](../../docs/self-hosting.md#forking-things-to-rename).

## 3. Build

```bash
pnpm --filter moat-desktop run dist:mac     # or dist:win / dist:linux
```

Artifacts land in `apps/desktop/dist/`. Build each platform on its own OS.

## 4. Auto-update

Packaged builds check `build.publish.url` in [`package.json`](package.json) (upstream: `https://downloads.moatfinance.ai/updates`) on launch via `electron-updater`. Point it at your own static host and upload the platform `latest*.yml` files that electron-builder generates alongside the installers, or remove the `publish` block to disable auto-update.

macOS auto-update needs the `.zip` artifacts in addition to the `.dmg`, because `electron-updater` (Squirrel.Mac) downloads the zip. Confirm `latest-mac.yml` lists both.

When a download completes, the app shows a bottom-left **Update ready** widget. **Update** restarts into the new version via `quitAndInstall`; **Later** dismisses it for the current session.

## QA checklist

- [ ] App opens (signed builds: no Gatekeeper / SmartScreen block)
- [ ] Local SQLite DB initializes on first launch
- [ ] Plaid Link opens during onboarding / Connect accounts
- [ ] Connect one institution, confirm transactions appear without duplicates
- [ ] Auto-update finds the release, if you configured it (check `[updater]` logs)
