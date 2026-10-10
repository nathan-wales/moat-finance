# Encryption Key Management Runbook

**Owner:** Moat Finance engineering  
**Last updated:** May 29, 2026  
**Related:** `apps/api/src/server/lib/encryption.ts`, `docs/data-retention-policy.md`

---

## Overview

Moat Finance uses AES-256-GCM authenticated encryption for sensitive stored values:
- Financial provider access tokens and refresh tokens
- TOTP (2FA) secrets
- Sync cursors containing sensitive metadata
- Tax document bytes in private R2 (`MOAT1` binary envelope: random per-object DEK wrapped by `ENCRYPTION_KEY`)

Encrypted values use a versioned envelope format that supports key rotation without a data migration window.

### Envelope Format

**v1 (current):**
```
v1:<keyId>:<iv>:<authTag>:<ciphertext>
```
All fields are hex-encoded, colon-delimited.

**Legacy (v0):**
```
<iv>:<authTag>:<ciphertext>
```
Treated as encrypted with the `default` key (`ENCRYPTION_KEY`).

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `ENCRYPTION_KEY` | Default / legacy key (64 hex chars = 32 bytes) | Yes |
| `ENCRYPTION_KEY_ID` | Active key ID for new writes (default: `"default"`) | No |
| `ENCRYPTION_KEY_<id>` | Named additional key for rotation (e.g. `ENCRYPTION_KEY_v2`) | During rotation |

---

## Generating A New Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Store the result in your secrets manager (Vercel environment variables, AWS Secrets Manager, etc.). Never commit key material to version control.

---

## Key Rotation Procedure

Key rotation is a **zero-downtime** process. New writes use the new key. Old values remain decryptable until re-encrypted.

### Step 1: Generate new key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Add new key to secrets

Add the new key as `ENCRYPTION_KEY_v2=<new-key-hex>` in your production secrets manager (Vercel, etc.).

### Step 3: Switch active key

Set `ENCRYPTION_KEY_ID=v2` in production. Deploy.

**Verification:** New writes will now produce `v1:v2:...` payloads. Old `v1:default:...` and legacy payloads remain decryptable.

### Step 4: Backfill (optional, recommended)

Run the rotation script to re-encrypt existing values with the new key:

```bash
# Not yet implemented — add as a migration script in apps/api/scripts/
# pnpm --filter moat-api run encrypt:rotate --from=default --to=v2
```

Until backfill is complete, both `ENCRYPTION_KEY` (default) and `ENCRYPTION_KEY_v2` must remain in the environment.

### Step 5: Retire the old key

After verifying all sensitive values have been re-encrypted (query for `v1:default:` or legacy format in the DB), the old key can be removed from secrets.

**Do not remove the old key until the backfill is verified complete.**

---

## Fields Using Encryption

| Table | Field | Notes |
|-------|-------|-------|
| `User` | `twoFactorSecret` | TOTP secret — encrypted with `encrypt()` |
| `FinancialConnection` | `accessToken`, `refreshToken`, `cursor` | Provider tokens |
| `PlaidItem` | `accessToken` | Plaid item token |

These fields must all be included in the rotation backfill script.

---

## Encryption Health Check

The `validateProductionConfig()` function in `env-validation.ts` verifies that `ENCRYPTION_KEY` is present at startup. Any request to an API route that uses encryption will also fail fast if the key is missing.

To verify the current key configuration:
```bash
# Check that the key env is present (without printing the value)
node -e "const k = process.env.ENCRYPTION_KEY; console.log('Key present:', !!k, 'Length (bytes):', k ? Buffer.from(k, 'hex').length : 0)"
```

---

## KMS / Envelope Encryption (Future)

The current model uses a symmetric key stored as an environment variable. For stronger key management:

1. Use a KMS provider (AWS KMS, GCP Cloud KMS, HashiCorp Vault) as the key-encryption key (KEK).
2. Generate a data-encryption key (DEK) per sensitive value or per tenant.
3. Wrap the DEK with the KMS KEK; store the wrapped DEK alongside the ciphertext.
4. On decrypt: unwrap the DEK via KMS, then decrypt the value.

This is the target architecture. The current versioned envelope format (`v1:<keyId>:...`) is designed to make this migration non-breaking — the `keyId` field will point to the KMS key alias rather than an environment variable name.

Tax document objects in R2 already use a binary envelope (`MOAT1`) with a random 32-byte DEK per object, wrapped by `ENCRYPTION_KEY`. That is application-level envelope encryption, but the KEK is still an environment secret rather than KMS. Do not treat env-based wrapping as the production end state.

**Action required (Phase 4):** Choose KMS provider for Vercel/Neon deployment and implement envelope encryption as a drop-in replacement for `loadKey()`.

---

## Incident Response: Suspected Key Compromise

If you believe the encryption key has been exposed:

1. **Immediately generate a new key** and deploy it as the active key (Steps 1–3 above).
2. **Rotate all provider connections**: revoke existing tokens via provider APIs (Plaid, MX, Finicity) and re-link accounts.
3. **Invalidate all auth sessions**: run `revokeAllUserTokens` for all users or rotate `AUTH_SECRET`.
4. **Disable 2FA** for all affected users if TOTP secrets are suspected to be compromised.
5. **Notify affected users** per the incident response runbook.
6. **Audit logs** for any unexpected decryption or access patterns.
