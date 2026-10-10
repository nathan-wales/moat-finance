# Desktop Cloud Backup

## Status

Draft. Created August 19, 2026 after reviewing desktop settings, local vault auth, `cloud-auth.ts` stub, SQLite domain models, and the deferred [desktop-cloud-sync backlog](../../backlog/desktop-cloud-sync.spec.md).

## Goal

Let desktop users opt in to back up selected local SQLite data to their Moat cloud account from Settings — without switching the app into cloud runtime mode.

Success means:

- Users can toggle which domains to back up (or **Everything**), create or sign in to a Moat account immediately before Backup, and push data to the cloud.
- When backups are enabled, desktop syncs on app open and at least once per day.
- Settings shows clear per-domain status (not selected / never synced / up to date / needs sync / failed).
- No web UI. Local SQLite remains the desktop source of truth.

## Product Context

Desktop is local-first. Users may still want a remote copy of hard-to-recreate data (rules, custom categories, budgets, forecasts) without migrating the whole app to cloud APIs.

This is **not** the backlog mode-cutover feature. Cloud is a backup target only. Recovery email remains a separate local-vault unlock path and must not be confused with Moat account login.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Settings page | `apps/desktop/src/renderer/src/pages/settings.tsx` | Scrollable section cards |
| Cloud auth stub | `apps/desktop/src/main/lib/cloud-auth.ts` | Always offline today |
| Recovery API pattern | `apps/desktop/src/main/vault/recovery-service.ts` | Desktop → `MOAT_API_URL` fetch |
| Auth register/exchange | `apps/api/src/server/handlers/auth.ts` | Credentials account + tokens |
| SQLite models | `packages/db-sqlite/prisma/schema.prisma` | Rules, categories, budgets, etc. |
| Mode cutover backlog | `specs/backlog/desktop-cloud-sync.spec.md` | Deferred; not this feature |

## Domains (v1 toggles)

| Toggle | Syncs |
|--------|-------|
| **Everything** | All rows below |
| Rules | `TransactionRule` + conditions + actions |
| Categories | Custom categories (incl. hidden flag). System-category hidden prefs stay local — cloud defaults are shared and must not be mutated per-user. |
| Budgets | `CategoryBudget` |
| Forecasts & profile | `ForecastScenario`, financial profile fields, `FinancialProfileData` |
| Hashtags | `Hashtag` (transaction links only when transactions included) |
| Manual accounts & transactions | Manual accounts + non-Plaid transactions |

**Always exclude:** Plaid access tokens, vault secrets, agent tokens, retail connections, appearance, demo wipe, notification delivery history.

## Account gate

Clicking **Backup** when unsigned-in opens an account sheet:

1. **Continue with Google** (top): opaque PKCE pairing → web Google → desktop claim (see [desktop-google-auth](../desktop-google-auth/spec.md))
2. **Create account**: name, email, password → `auth/register` → `auth/exchange`
3. **Sign in**: email, password → `auth/exchange`

Tokens live in main-process `safeStorage` (`cloud-token.bin`). Renderer never receives the raw token.

## Sync policy

- Manual **Backup** / **Back up now** always runs for selected domains.
- When `backupsEnabled`, run after vault unlock / app ready, and again if last successful sync is older than 24 hours.
- Upserts are idempotent via client-provided IDs (`POST /api/v1/desktopBackup/upsert`).
- System categories map by **name** between desktop and cloud default IDs.

## Status semantics

| State | Meaning |
|-------|---------|
| Not selected | Toggle off |
| Never synced | Selected, no successful push |
| Up to date | Last sync OK |
| Needs sync | Selected and dirty since last success (or never synced while enabled) |
| Failed | Last run error (no PII in message) |

## Non-goals

- Desktop runtime switch to API-backed repos (`packages/db-api`)
- Bidirectional sync / conflict resolution
- Web or iOS backup settings UI
- Migrating Plaid items/tokens
- Pulling cloud data down into SQLite

## Acceptance criteria

- [ ] Settings shows Cloud Backup card with Everything + domain toggles
- [ ] Backup requires Moat account create or sign-in first
- [ ] Successful backup upserts selected domains to cloud
- [ ] Per-domain status is visible after backup
- [ ] Enabled backups re-run on open when stale (>24h)
- [ ] Copy distinguishes Moat account from recovery email
- [ ] No web UI changes

## Open Questions

- None for v1; mode cutover remains a separate backlog item.
