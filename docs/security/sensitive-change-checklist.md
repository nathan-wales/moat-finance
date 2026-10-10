# Security PR Checklist

**Use this checklist when opening a PR that touches any of the following areas:**
- Authentication, session management, JWT / NextAuth configuration
- Authorization checks, `withAuth`, `withDemoOrAuth`, `handler-wrappers.ts`
- Encryption / key management (`encryption.ts`, provider token storage)
- Webhooks (Plaid, MX, Finicity)
- Analytics or logging (PostHog, Axiom)
- Two-factor authentication flows
- New API endpoints or permissions boundaries
- Environment variable configuration or secrets

---

## PR Author Checklist

### Authentication & Authorization

- [ ] Any new API handler uses `withAuth`, `withDemoOrAuth`, or `withPublic` from `handler-wrappers.ts`. No manual `requireDemoOrAuthenticated()` calls.
- [ ] Authorization is enforced **server-side**. No permission logic in React components or client-side stores.
- [ ] If a new handler key is added, consider whether it should be in `TWO_FACTOR_ALLOWLIST` or blocked for pending-2FA users.
- [ ] Session tokens are not logged, returned in error responses, or exposed in client-accessible APIs.

### Encryption & Secrets

- [ ] No plaintext secrets, API keys, or tokens in code, logs, or comments.
- [ ] New sensitive fields (tokens, secrets, TOTP) use `encrypt()` from `lib/encryption.ts` before storage.
- [ ] The `.env.example` is updated if a new required environment variable is introduced.
- [ ] `validateProductionConfig()` is updated if a new production-required secret is added.

### Webhooks

- [ ] Any new webhook endpoint verifies the payload signature **before** processing.
- [ ] Webhook signature verification fails closed (returns 400/401, not 200) when the secret is missing in production.
- [ ] Raw webhook payloads are not logged in full. Use `redactSensitiveFields()` from `lib/redaction.ts` before logging or storing.

### Analytics & Logging

- [ ] No PII in PostHog capture events: no email, name, account numbers, routing numbers, raw transaction descriptions. Email is allowed only as an identify person property (distinct ID stays userId).
- [ ] Session recordings, autocapture, heatmaps, and surveys remain disabled in PostHog SDK init.
- [ ] New analytics events follow naming convention: `<domain>_<object>_<action>` (snake_case).
- [ ] New analytics calls use `capture()` from `~/lib/analytics` (not `posthog.capture()` directly).
- [ ] No `console.log` or `console.error` — use the shared `logger` with structured context.
- [ ] No sensitive values in log context: no tokens, secrets, raw payloads, or account numbers.

### Data Retention

- [ ] New data entities have a documented retention period (add to `docs/data-retention-policy.md`).
- [ ] New cron-eligible data (tokens, sessions, temp records) has a corresponding cleanup job or TTL.

### Input Validation

- [ ] All user-controlled inputs are validated with Zod or an equivalent schema before use.
- [ ] No raw SQL interpolation — Prisma parameterized queries are used throughout.
- [ ] File uploads (if any) validate type, size, and content before processing.

---

## Reviewer Checklist

- [ ] Confirm no secrets or PII appear in the diff (check log statements, error messages, analytics calls).
- [ ] Confirm authorization gating is server-side, not just UI-hidden.
- [ ] If encryption is modified, confirm both the new format **and** the legacy format are handled in `decrypt()`.
- [ ] If a new webhook endpoint is added, confirm signature verification is fail-closed in production.
- [ ] If analytics are added or modified, spot-check capture payloads for PII (especially email, account numbers). Email on identify is expected.
- [ ] If a new env var is required, confirm `.env.example` and `validateProductionConfig()` are updated.

---

## Escalation

If you're unsure whether a change is safe, tag `@moat-engineering` for a security review before merging.

For suspected vulnerabilities in existing code, file a private issue and do not discuss publicly until patched.
