# Desktop Continue with Google

## Status

Draft. Created August 22, 2026 after reviewing the cloud backup account modal, extension auth handoff, and desktop → web link-outs.

## Goal

Let desktop users sign in to (or create) a Moat cloud account with Google from the existing account modal, without putting email, userId, or tokens in URL query params.

Success means:

- The account dialog shows **Continue with Google** above Create / Sign in tabs.
- Clicking it opens the web app with only an opaque short-lived `pair` id.
- After Google (and 2FA if needed) on web, the desktop receives Bearer tokens via a PKCE claim over HTTPS.
- Tokens land in the same `cloud-token.bin` path used by email/password cloud backup and billing gates.
- Email/password create and sign-in remain available.

## Product Context

Desktop cloud backup and Plaid sync entitlement require a Moat cloud account. Today that path is credentials-only in [`CloudBackupAccountDialog`](../../../apps/desktop/src/renderer/src/pages/settings/cloud-backup-account-dialog.tsx). Web and iOS already support Google. Users who only have Google accounts cannot complete the desktop gate without inventing a password.

This is **not** cloud runtime mode cutover ([desktop-cloud-sync backlog](../../backlog/desktop-cloud-sync.spec.md)). It only authenticates the existing local-first cloud session.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Account modal | `apps/desktop/.../cloud-backup-account-dialog.tsx` | Email/password only |
| Cloud auth storage | `apps/desktop/src/main/lib/cloud-auth.ts` | `safeStorage` → `cloud-token.bin` |
| Credentials exchange | `apps/desktop/src/main/cloud-backup/api-client.ts` | `POST /api/v1/auth/exchange` |
| Web Google button | `apps/web/src/app/auth/signin/page.tsx` | NextAuth `signIn("google")` |
| Extension handoff | `apps/web/src/app/extension/auth/` | Passes tokens/userId/email in URL — **do not copy** |
| Extension API | `apps/api/src/server/handlers/extension-auth.ts` | Session → Bearer pattern to reuse |
| Token minting | `apps/api/src/server/lib/token-manager.ts` | `createAuthSession` / `generateAccessToken` |
| Web base URL | `apps/desktop/src/main/lib/moat-web-url.ts` | `shell.openExternal` link-outs |

## Design

### Handshake

1. Desktop generates a PKCE `code_verifier` and S256 `code_challenge`.
2. Desktop calls `POST /api/v1/desktopAuth/start` → `{ pairId, expiresAt, authorizeUrl }`.
3. Desktop opens `authorizeUrl` (`/auth/desktop?pair=<pairId>`) in the system browser.
4. Web page: if no session, `signIn("google", { callbackUrl })`; if 2FA required, existing middleware returns to the same callback.
5. Web (authenticated) shows a confirm screen with the current email. The pair is not bound until the user chooses **Use this account**. **Use a different account** signs out and restarts Google with `prompt=select_account`.
6. After confirm, web calls `POST /api/v1/desktopAuth/complete` with the pair id (session cookie + CSRF).
7. Desktop polls `POST /api/v1/desktopAuth/claim` with `pairId` + `codeVerifier` until tokens, expiry, or cancel.
8. Desktop writes tokens via `writeCloudTokenPayload` (renderer never sees them).

### URL vs private data

| In URL | Never in URL |
|--------|--------------|
| Opaque `pairId` (UUID) | Email, userId |
| | Access / refresh tokens |
| | PKCE `code_verifier` |
| | Vault / recovery ids |

### Data model

`DesktopAuthPair`: `id`, `pairId` (unique), `codeChallenge`, `userId?`, `expiresAt`, `claimedAt?`, `createdAt`, `deviceInfo?`.

- TTL ~10 minutes.
- Single claim.
- Store the challenge (S256 of verifier). Never log verifier, email, or tokens.

## API

| Action | Auth | Behavior |
|--------|------|----------|
| `desktopAuth/start` | public | Create pending pair; return authorize URL |
| `desktopAuth/complete` | session (`withAuth`) | Bind current user to pair |
| `desktopAuth/claim` | public | Pending → `{ status: "pending" }`; bound + valid verifier → mint tokens once |

`complete` is idempotent for the same user. Reject expired, claimed, or wrong-user binds.

## UI

- Desktop: Google button above tabs; while waiting, show “Waiting for Google in your browser…” with Cancel.
- Web `/auth/desktop`: if already signed in, ask the user to confirm that email before binding. Do not auto-complete from the session cookie.
- After confirm, show “Desktop connected” and that desktop will sign in with that email and the subscription tied to it — do not dump to `/overview`.
- Use `Referrer-Policy: no-referrer` on the desktop auth page so `pair` does not leak to Google as a referrer.

## Non-goals

- Custom `moat://` / `fin://` protocol callback
- Replacing email/password
- Changing the Chrome extension token-in-URL redirect
- Embedded Electron BrowserWindow Google login
- Cloud runtime mode switch

## Acceptance criteria

- [x] Account modal shows Continue with Google above Create / Sign in
- [x] Opening Google uses only an opaque `pair` query param
- [x] Signed-in web sessions must confirm the current email before the pair is bound
- [x] Success copy names the confirmed email and that desktop uses the subscription tied to it
- [x] After Google (+ 2FA if enabled) and confirm, desktop stores the same cloud token payload as credentials sign-in
- [x] Claim fails without the correct PKCE verifier
- [x] Expired or already-claimed pairs cannot mint tokens
- [x] Beta denial on web leaves the pair unbound; desktop surfaces a timeout / cancel message
- [x] No PII or tokens in URL query params or structured logs for this flow

## Open Questions

- None for v1. A custom protocol can later notify desktop sooner on top of the same claim endpoint.
