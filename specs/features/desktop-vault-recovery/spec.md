# Desktop Local Vault — Recovery Email and Destructive Reset

## Status

Draft. Created June 19, 2026 after reviewing the shipped local vault unlock flow, reset dialog, vault IPC contracts, desktop onboarding, and the parent [desktop-local-vault spec](../desktop-local-vault/spec.md).

## Goal

Close the security gap where anyone with physical access to an unlocked-or-locked device can reset the vault unlock **without deleting data**, set a new app password, and open the existing local financial database.

Success means:

- **Reset local vault** is always destructive: it deletes the local database, vault config, MCP logs, agent tokens, cloud sign-in, and every other Moat file under userData. It is a last-resort wipe, not a shortcut back into the app.
- **Forgot password?** gives legitimate users a recovery path that preserves local data when they configured a recovery email.
- **Onboarding** includes a skippable step to add a recovery email after first unlock.
- **Settings** lets users add, change, verify, or remove a recovery email later.
- Recovery uses a minimal cloud email relay only — no Moat cloud account or financial data upload is required.

## Product Context

Moat Finance Desktop is local-first. Unlock is **not** cloud login. Users prove presence to their own device so Moat can open a local vault.

That framing creates a tension:

| Path | User intent | Must preserve data? |
|------|-------------|---------------------|
| Unlock with password / biometrics | Daily use | Yes |
| Forgot password | Legitimate owner forgot credential | Yes, if recovery was configured |
| Reset local vault | Abandon this device / start over / attacker wipe | No — always delete |

Today, reset optionally keeps `moat.db`. That means an intruder can:

1. Open the locked app.
2. Choose **Reset local unlock…**
3. Leave **Also delete local financial data** unchecked.
4. Set a new app password.
5. Open the existing SQLite database with all transactions and settings.

Reset must not be a bypass into local data. It must only be a confirmed wipe.

Legitimate users who forget their app password need a separate recovery path. A **recovery email** is the V1 answer: optional at setup, verifiable out-of-band, and independent of Moat cloud account login.

## Current Repo Context

### What already exists

**Vault unlock (desktop main process)**

- `apps/desktop/src/main/vault/vault-service.ts` — setup, password unlock, Touch ID unlock, lock.
- `apps/desktop/src/main/vault/vault-config.ts` — `vault-config.json` with scrypt password hash, salt, biometric flag.
- `apps/desktop/src/main/ipc/vault.ts` — IPC handlers; reset clears config and optionally deletes `moat.db`.

**Reset dialog (renderer)**

- `apps/desktop/src/renderer/src/pages/vault-unlock/reset-vault-dialog.tsx`
- Checkbox: **Also delete local financial data on this device** (defaults unchecked).
- Confirmation phrase: `RESET LOCAL VAULT`.
- Copy switches between preserve vs delete messaging.

**Contracts**

- `packages/contracts/src/ipc/vault.ts` — `ResetVaultInputSchema` includes `deleteLocalData: boolean`.

**Onboarding**

- `apps/desktop/src/renderer/src/pages/onboarding/index.tsx` — post-unlock wizard; no recovery email step today.

**Email infrastructure (API)**

- `apps/api/src/lib/email/resend.ts` — transactional email via Resend.
- Existing patterns for token + email in household invites and auth flows.

### Known limitation (parent spec)

V1 vault is an app-level unlock gate. SQLite is not encrypted at rest ([architecture note](../desktop-local-vault/architecture-note.md)). Recovery email does not replace future at-rest encryption, but it fixes the immediate **reset-as-unlock-bypass** hole.

## Threat Model

### Adversary: someone with access to the device (unlocked session ended)

| Action | Without recovery email | With recovery email |
|--------|----------------------|-------------------|
| Guess/brute app password | Blocked by password | Blocked by password |
| Use biometrics | Blocked unless enrolled | Blocked unless enrolled |
| Reset local vault | Wipes all local data (after this spec) | Wipes all local data |
| Forgot password flow | N/A | Requires inbox access to recovery email |

### Design rules

1. **Reset never preserves data.** No checkbox, no alternate copy path.
2. **Forgot password never skips email verification** when recovery email is configured.
3. **No recovery email configured** → unlock screen shows forgot-password entry, but flow ends with honest copy: the only option is destructive reset.
4. **Recovery email is optional** — skipping it is allowed, but copy must explain the tradeoff.
5. **API relay stores no financial data** — only recovery registration metadata and short-lived verification codes.
6. **No Moat account required** for recovery email setup or verification.

## User Experience

### 1. Reset local vault (updated)

Available from the locked unlock screen (**Reset local unlock…**).

**Copy (only description):**

> This permanently deletes all local data on this device: the database, vault unlock, MCP logs, agent tokens, and cloud sign-in. You will need to set up Moat Finance again.

**Behavior:**

- User must type `RESET LOCAL VAULT` to confirm.
- On confirm: stop agent gateway and other unlocked services, delete every Moat file under Electron `userData` (not just `moat.db`), including `agent-audit.jsonl`, `agent-tokens.json`, `agent-settings.json`, `cloud-token.bin`, `cloud-backup-state.json`, `billing-status.json`, `retail-ingest-sessions.json`, the `vault/` directory, encryption sidecars, and any other non-Electron sidecar. Also delete leftover legacy userData folders (`moat-desktop`, `Moat Finance`) so setup cannot copy them back. Best-effort revoke cloud refresh token, clear Chromium storage, clear recovery registration with API, return to vault setup.
- Remove the **Also delete local financial data** checkbox entirely.
- Remove `deleteLocalData` from IPC input — reset is always destructive.

**Copy should avoid:**

- Imp that reset is a way to "try again" on password.
- Imp that data might be kept.

### 2. Forgot password? (new)

Available on the unlock screen below the password form.

**When recovery email is configured:**

1. User taps **Forgot password?**
2. Screen shows masked recovery email (e.g. `j•••@gmail.com`).
3. User taps **Send recovery code**.
4. Moat sends a 6-digit code to the recovery email (via API relay).
5. User enters code + new app password + confirm password.
6. On success: vault password hash updated, vault unlocks, user continues into the app. **Local database preserved.**

**When recovery email is not configured:**

1. User taps **Forgot password?**
2. Screen explains: without a recovery email, Moat cannot verify ownership. The only option is **Reset local vault**, which deletes all local data.
3. Link to destructive reset dialog.

**Rate limiting / abuse:**

- Max 3 code sends per hour per recovery device id.
- Code expires in 10 minutes.
- 5 invalid code attempts → invalidate code, require new send.

### 3. Recovery email during onboarding (new, skippable)

Insert after **Your data stays here** and before **Invite code** in desktop onboarding.

**Step title:** `Add a recovery email`

**Description:**

> Optional. If you forget your app password, Moat can email you a recovery code so you keep your local data.

**Step content:**

- Email input + **Send verification code**
- 6-digit code input
- Primary: **Save recovery email**
- Secondary: **Skip for now**

**Skip copy (footer):**

> You can add a recovery email later in Settings. Without one, forgetting your app password means resetting the vault and deleting local data.

On skip: persist `desktop_recovery_email_skipped_at` in onboarding metadata (same pattern as other skip semantics).

### 4. Recovery email in Settings (new)

In **Local vault** settings card:

| State | Actions |
|-------|---------|
| Not configured | Add recovery email (same verify flow as onboarding) |
| Configured | Show masked email, **Change**, **Remove** |
| Pending verification | Show pending email, **Resend code**, **Cancel** |

Changing email requires verifying the new address before it replaces the old one.

Removing recovery email requires app password confirmation (or active unlock session + password re-entry).

## Architecture

### Local storage

Extend `VaultConfigFile` in `vault-config.ts`:

```ts
type VaultConfigFile = {
  version: 2;
  passwordHash: string;
  passwordSalt: string;
  biometricEnabled: boolean;
  recoveryDeviceId: string;          // random cuid, stable for this install
  recoveryEmailNormalized?: string;   // lowercase trimmed; used for display + send
  recoveryEmailVerifiedAt?: string;    // ISO timestamp after successful verify
};
```

Migration: existing `version: 1` configs gain `recoveryDeviceId` on first read/write after app update.

Store `recoveryEmailNormalized` locally so the desktop app can show masked email and request sends without cloud lookup of the address. The API receives the email on send/verify calls; it does not need to persist the plaintext email if verification is code-based and keyed by `recoveryDeviceId`.

**Do not store** recovery codes, plaintext passwords, or financial data in vault config.

### Minimal cloud relay (API)

New unauthenticated desktop recovery endpoints under `apps/api/src/server/handlers/desktop-vault-recovery.ts` (name TBD).

**Prisma model (Postgres — relay only):**

```prisma
model DesktopVaultRecoveryRegistration {
  id                String   @id @default(cuid())
  recoveryDeviceId   String   @unique
  emailHash          String   // sha256(normalizedEmail + serverPepper)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([emailHash])
}

model DesktopVaultRecoveryCode {
  id                String   @id @default(cuid())
  recoveryDeviceId   String
  codeHash          String   // hash of 6-digit code
  expiresAt          DateTime
  attemptCount      Int      @default(0)
  consumedAt         DateTime?
  createdAt          DateTime @default(now())

  @@index([recoveryDeviceId, expiresAt])
}
```

**Endpoints (all public, rate-limited by IP + device id):**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/desktop/vault-recovery/register` | Upsert registration after local email verify |
| POST | `/api/v1/desktop/vault-recovery/send-code` | Send 6-digit code to email |
| POST | `/api/v1/desktop/vault-recovery/verify-code` | Validate code; return short-lived recovery token |
| POST | `/api/v1/desktop/vault-recovery/unregister` | Remove registration on destructive reset |

**Recovery token:** signed JWT or HMAC token (5-minute TTL, single-use) returned by verify-code. Desktop main process accepts token via IPC to call `resetVaultPassword(newPassword, recoveryToken)` — only updates hash/salt in vault config.

Desktop main process owns password rewrite. Renderer never receives recovery tokens in persistent storage.

### IPC additions

Extend `packages/contracts/src/ipc/vault.ts`:

```ts
// Replace reset input
ResetVaultInputSchema = z.object({
  confirmPhrase: z.literal("RESET LOCAL VAULT"),
});

// New
SendRecoveryCodeInputSchema = z.object({ email: z.string().email() });
VerifyRecoveryCodeInputSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8),
});
SetRecoveryEmailInputSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});
RemoveRecoveryEmailInputSchema = z.object({
  password: z.string().min(1),
});
GetRecoveryEmailStatusSchema = z.object({
  configured: z.boolean(),
  maskedEmail: z.string().nullable(),
  verified: z.boolean(),
});
```

New channels: `vault:sendRecoveryCode`, `vault:verifyRecoveryCode`, `vault:setRecoveryEmail`, `vault:removeRecoveryEmail`, `vault:getRecoveryEmailStatus`.

All recovery IPC handlers require vault to be **locked** for forgot-password flows except `setRecoveryEmail` / `removeRecoveryEmail`, which require **unlocked** session (+ password for remove).

### Process boundaries

- Renderer → preload → main process for all recovery actions.
- Main process → API for email send/register/verify only.
- Never log email, codes, tokens, passwords, or recovery device ids in plaintext.
- Financial IPC remains fail-closed while locked.

### Suggested file layout

```text
apps/api/src/server/handlers/desktop-vault-recovery.ts
apps/api/src/server/services/desktop-vault-recovery.ts
apps/api/src/lib/email/send-vault-recovery-code-email.ts
apps/desktop/src/main/vault/recovery-service.ts
apps/desktop/src/main/ipc/vault.ts
apps/desktop/src/renderer/src/pages/vault-unlock/forgot-password-flow.tsx
apps/desktop/src/renderer/src/pages/vault-unlock/reset-vault-dialog.tsx
apps/desktop/src/renderer/src/pages/onboarding/recovery-email-step.tsx
apps/desktop/src/renderer/src/pages/settings/recovery-email-settings.tsx
packages/contracts/src/ipc/vault.ts
```

## Copy Guidelines

Use **recovery email**, not "backup email" or "account email."

| Surface | Preferred copy |
|---------|----------------|
| Unlock | `Forgot password?` |
| Forgot flow | `We'll send a recovery code to j•••@gmail.com` |
| Reset | `Reset local vault` / `This permanently deletes all local data on this device…` |
| Onboarding skip | `Skip for now` |
| No recovery configured | `Without a recovery email, resetting the vault is the only way to regain access — and that deletes local data.` |

Avoid cloud-login language (`Sign in`, `Log in to Moat`).

## Implementation Plan

### Phase 1 — Destructive reset only (quick security fix)

1. Remove checkbox and `deleteLocalData` flag from reset dialog, contracts, preload, IPC.
2. Reset handler always deletes DB files.
3. Update reset copy to single paragraph.
4. Call API unregister on reset when `recoveryDeviceId` exists.

**Acceptance criteria:**

- Reset without recovery email wipes all local Moat data, including `moat.db`, MCP audit logs, and agent tokens.
- Reset with recovery email wipes that data **and** clears cloud registration.
- No code path preserves `moat.db`, `agent-audit.jsonl`, or `agent-tokens.json` on reset.

### Phase 2 — API recovery relay

1. Add Prisma models + migration.
2. Implement register / send-code / verify-code / unregister services.
3. Add Resend email template for recovery code.
4. Rate limiting + structured logging (no PII).

**Acceptance criteria:**

- Code email delivers via Resend in dev/staging.
- Invalid/expired codes fail with typed errors.
- Registration upsert is idempotent per `recoveryDeviceId`.

### Phase 3 — Desktop forgot-password flow

1. Add `recovery-service.ts` in main process.
2. Extend vault IPC + preload + renderer client.
3. Build `forgot-password-flow.tsx` on unlock screen.
4. Implement password rewrite after verified recovery token.

**Acceptance criteria:**

- Forgot password with configured email preserves DB and updates password.
- Forgot password without email directs to destructive reset only.
- Unlock works with new password after recovery.

### Phase 4 — Onboarding + settings

1. Add skippable `recovery-email-step.tsx` to onboarding STEPS.
2. Persist skip metadata.
3. Add recovery email section to local vault settings.
4. Change/remove flows with verification.

**Acceptance criteria:**

- Onboarding step can be skipped or completed.
- Settings can add recovery email after skip.
- Masked email displays correctly on unlock screen.

## Data and Security Requirements

- Do not preserve local data on reset under any code path.
- Do not store recovery codes or plaintext passwords on disk.
- Do not log recovery emails, codes, tokens, or password hashes.
- Hash recovery codes server-side with pepper; single-use consumption.
- Rate-limit send and verify endpoints.
- Recovery token is short-lived and single-use for password reset IPC.
- Unregister cloud recovery row on destructive reset.
- PostHog (if tracked): `desktop_vault_recovery_code_sent`, `desktop_vault_recovery_completed`, `desktop_vault_reset_completed` — counts/booleans only, `{ demoUser: true }` or local-only flag; never email.
- Honest UX when recovery email was skipped: destructive reset is the only fallback.

## Testing Plan

**Desktop (main / IPC):**

- Reset always deletes `moat.db` and vault config.
- Reset calls unregister when registration exists.
- `resetVaultPassword` rejects invalid/expired recovery token.
- `resetVaultPassword` updates hash and unlocks on valid token.
- Recovery IPC fail-closed when vault already unlocked (forgot flow).

**API:**

- Send-code rate limit enforced.
- Verify-code succeeds once, fails on reuse.
- Register upserts by `recoveryDeviceId`.
- Unregister is idempotent.

**Renderer:**

- Reset dialog: no checkbox; phrase gate works.
- Forgot flow shows masked email when configured.
- Forgot flow without email links to reset.
- Onboarding skip vs complete metadata.
- Settings change/remove requires verification / password.

**Manual:**

- Full forgot-password flow with real email in staging.
- Reset → setup vault → empty database confirmed in UI.

## Non-Goals

- Moat cloud account login as recovery method.
- SMS or TOTP authenticator app recovery.
- Recovery key PDF / printable backup codes (future spec).
- Encrypted SQLite / SQLCipher (tracked in parent spec).
- Cross-device recovery sync of local DB.
- Web app recovery flows.

## Open Questions

- Should recovery email setup also appear on the **initial vault setup** screen (before first unlock), or only onboarding + settings?
- Use 6-digit numeric code vs magic link — code is simpler for desktop UI; confirm product preference.
- Should removing recovery email require re-entering the current app password on all platforms, or is unlocked session enough on macOS with Touch ID?
- Retention policy for `DesktopVaultRecoveryRegistration` after desktop unregister — immediate delete vs soft-delete for abuse audit.
- Does recovery email setup require network connectivity during onboarding, or queue registration until online?

## Related Specs

- [Desktop Local Vault Unlock](../desktop-local-vault/spec.md) — parent unlock, onboarding, and installer tracks.
- [Desktop Local Vault Architecture Note](../desktop-local-vault/architecture-note.md) — V1 limitations.
- [MCP and local desktop security enhancements](../../backlog/mcp-and-local-desktop-security-enhancements.spec.md) — recovery key / export backup ideas.

## Suggested Commit Message

```text
docs (desktop): adds vault recovery spec
```
