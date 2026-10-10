# Desktop Account Identity

## Status

Draft. Created August 22, 2026 after reviewing the desktop sidebar account menu, web sidebar, desktop settings, and cloud token identity.

## Goal

After a desktop user creates or signs in to a Moat cloud account, the bottom-left account menu should show that account the same way web does — name, email, and a way to sign out and sign in with a different email. Settings should let them set the account name. Email stays the account identifier and is not editable.

Success means:

- Signed-in desktop sidebar shows the cloud account name and email, not only the local "Personal" profile label.
- Users can sign out of the cloud account and sign in with another email without locking the local vault.
- Settings has a Profile card to view email and edit name.
- Local vault lock and local workspace profiles stay separate from cloud account identity.

## Product Context

Desktop is local-first. A Moat cloud account is optional and is used for trial/billing, Plaid sync entitlement, and cloud backup. Users may have a subscription on one email and need to switch. Today the account menu only shows the local workspace name ("Personal") and **Lock app**. Sign-out lives only on the Cloud Backup card. There is no profile editor.

Web already shows session name + email, profile switching, and **Sign out**. Desktop should match the account identity row without becoming a cloud-runtime app.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Desktop sidebar menu | `apps/desktop/src/renderer/src/components/sidebar.tsx` | Shows local profile `displayName` only |
| Shared switcher | `packages/features/src/profile-switcher/profile-switcher-menu-item.tsx` | Already accepts optional `email` |
| Web sidebar | `apps/web/src/components/layout/sidebar.tsx` | Account name + email; Personal keeps the person's name |
| Web profile editor | `apps/web/src/app/(dashboard)/settings/profile-section.tsx` | Edit name; email read-only |
| Cloud tokens | `apps/desktop/src/main/lib/cloud-auth.ts` | `email`, `name`, `userId` in `cloud-token.bin` |
| Account dialog | `apps/desktop/src/renderer/src/pages/settings/cloud-backup-account-dialog.tsx` | Create / Sign in / Google |
| Backup sign-out | `apps/desktop/src/renderer/src/pages/settings/cloud-backup-settings-card.tsx` | Only current sign-out UI |
| Update name API | `POST /api/v1/account/updateProfile` | `{ name }` |
| Settings page | `apps/desktop/src/renderer/src/pages/settings.tsx` | No Profile card |

### Existing building blocks to reuse

- `getCloudAuthIdentity()` for renderer-safe identity (no tokens).
- `cloudBackup.signOut` / register / signIn / signInWithGoogle.
- `CloudBackupAccountDialog` for create and switch-account.
- `@moat/ui` Avatar, SidePanel, Input — same pattern as web Profile section.

## Target Experience

### Sidebar trigger (signed in)

- Avatar initials from the account name (or email if name is empty).
- Primary line: cloud account name. If a non-Personal local workspace is active, show that workspace name (same rule as web).
- Secondary line: cloud account email.

### Sidebar trigger (signed out)

- Keep the current local profile label (e.g. Personal).
- No email line.

### Sidebar menu

- Existing items unchanged (feedback, support, Moat Mode, Settings, Appearance, local profile submenu).
- Signed in: **Sign out** (clears cloud tokens; does not lock the vault).
- Signed out: **Sign in** (opens the existing account dialog).
- **Lock app** remains and still locks the local vault.

### Settings → Profile

- Signed out: copy that this is the Moat account used for trial, sync, and backup, plus **Create or sign in**.
- Signed in: name, email, edit name (email disabled — "Email cannot be updated after account creation").
- **Sign out** and **Use another email** (sign out, then open the account dialog).

## Architecture / Data Model

No Prisma or web session changes. Identity stays in main-process `cloud-token.bin`.

| Channel | Auth | Behavior |
|---------|------|----------|
| `cloudBackup:getIdentity` | vault unlocked | `{ signedIn, email, name }` from `getCloudAuthIdentity()` |
| `cloudBackup:updateProfile` | signed in | `POST /api/v1/account/updateProfile`, then persist `name` on the token payload |

Password sign-in should store `name` from the auth exchange when the API returns it.

## Acceptance Criteria

- [x] Signed-in account menu shows cloud name and email
- [x] Signed-out account menu shows the local profile name and no email
- [x] Sign out clears the cloud session and keeps the local vault unlocked
- [x] After sign-out, the user can sign in with a different email
- [x] Settings Profile card can edit the account name and shows the linked email as read-only
- [x] Lock app and local workspace profiles are unchanged
- [x] No tokens, emails, or names in structured logs

## Non-Goals

- Changing local workspace profile names (Personal / Family / Business)
- Making cloud email editable
- Cloud runtime mode cutover
- Replacing vault lock with cloud sign-out
- Web or iOS changes beyond optional additive `name` on auth exchange

## Open Questions

- None for v1. Switching accounts is sign out + sign in, not multiple stored cloud sessions.

## Related Specs

- [Desktop Cloud Backup](../desktop-cloud-backup/spec.md)
- [Desktop Continue with Google](../desktop-google-auth/spec.md)

## Suggested Commit Message

```text
feat (desktop): show account email and sign out
```
