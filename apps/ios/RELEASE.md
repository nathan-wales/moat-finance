# iOS Release

Moat iOS uses a separate release train from cloud (`release:cloud`) and desktop (`release:desktop`).

## How it works

```txt
main (merged features)
  └── pnpm release:ios
        ├── bump MARKETING_VERSION + CURRENT_PROJECT_VERSION in Moat.xcodeproj
        ├── commit + tag ios-vX.Y.Z
        └── push tag
              └── GitHub Actions (ios-release.yml)
                    ├── archive Release build on macOS
                    ├── export App Store IPA
                    └── upload to TestFlight
                          └── you submit for App Store review in App Store Connect
```

Unlike Vercel deploys, iOS does **not** go live when the tag is pushed. Apple still has to process the build and approve App Store review before users get the update.

| Stage | Who | What happens |
|-------|-----|--------------|
| Tag push | You (`pnpm release:ios`) | Starts CI |
| CI build | GitHub Actions | Signs and uploads IPA to TestFlight |
| Processing | Apple | Usually 5–30 minutes |
| TestFlight | You / testers | Install and verify |
| App Store | You in App Store Connect | Submit build for review |
| Review | Apple | Manual approval |
| Release | You or automatic | Users receive update |

Cloud and iOS releases are **independent**. Ship cloud when backend/web changes are ready; ship iOS when the native app changes are ready. Coordinate when an API change requires a minimum app version.

## Release command

From the repo root:

```bash
pnpm release:ios
```

Requires a clean working tree on `main`. Bumps the patch version in `apps/ios/Moat.xcodeproj/project.pbxproj` and increments the build number (`CURRENT_PROJECT_VERSION`), which Apple requires to be unique for every upload.

## Required GitHub secrets

Add under **Settings → Secrets and variables → Actions**:

```txt
APPLE_TEAM_ID
APP_STORE_CONNECT_KEY_ID
APP_STORE_CONNECT_ISSUER_ID
APP_STORE_CONNECT_PRIVATE_KEY
```

Create an App Store Connect API key with **App Manager** access:

1. App Store Connect → Users and Access → Integrations → App Store Connect API
2. Generate a key and download the `.p8` file once
3. Store the key ID and issuer ID as secrets
4. Paste the full `.p8` contents into `APP_STORE_CONNECT_PRIVATE_KEY`

The workflow uses automatic code signing with `-allowProvisioningUpdates`, so distribution certificates and profiles are managed through your Apple Developer account via the API key.

## Manual steps after CI

1. Wait for the GitHub Actions run to finish and for Apple to finish processing the build in TestFlight.
2. Install the build from TestFlight and smoke-test against production API.
3. In App Store Connect, submit the build for review and choose release timing (manual or automatic after approval).

There is no fully automated App Store publish step in v1 — review and release timing stay manual by design.

## Local release build

For ad-hoc archive testing in Xcode:

1. Open `apps/ios/Moat.xcodeproj`
2. Select **Any iOS Device (arm64)**
3. **Product → Archive**
4. Use the Organizer to distribute to TestFlight

## Related releases

| Command | Tag | Deploy target |
|---------|-----|---------------|
| `pnpm release:cloud` | `cloud-v*` on last green staging SHA (bumps if tag exists) | api, mcp, web, marketing on Vercel |
| `pnpm release:desktop` | `desktop-v*` on last green staging SHA (bumps if tag exists) | GitHub Releases + R2 downloads |
| `pnpm release:ios` | `ios-v*` from `main` | TestFlight → App Store |
| `pnpm release:emergency` | new cloud + desktop tags on `main` | skip staging CI (type `PUSH TO PRODUCTION`) |
