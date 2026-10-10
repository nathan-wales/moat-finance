# Pattern: External Integrations (apps/api)

## Containment principle

External integrations are isolated in their own directories or files under `src/server/`. Business logic that depends on external data goes through a service, not directly through the integration client.

| Integration | Location | Type |
|-------------|----------|------|
| Plaid | `src/server/plaid/` | Bank account + transaction data |
| Email (transactional) | `src/lib/email/` | Resend or similar |
| Axiom (logging) | `src/lib/logger.ts` | Structured log sink |
| PostHog (analytics) | Server-side events via PostHog Node SDK | Analytics |

---

## Plaid

Plaid lives in `src/server/plaid/`. Key rules:

- **All Plaid API calls go through `src/server/plaid/`** — never call the Plaid SDK directly from a service or handler.
- **Raw Plaid types are normalized to internal types before being stored or returned.** Plaid transaction objects become Prisma `Transaction` models. Plaid account objects become Prisma `Account` models.
- **Webhook signatures must be verified** before processing any webhook payload. Plaid sends a `Plaid-Verification` header; verify it via the Plaid client before reading `req.body`.

```ts
// ✅ Verify webhook before processing
const isValid = await plaidClient.webhookVerificationKeyGet({
  key_id: req.headers["plaid-verification"] as string,
});
if (!isValid) return res.status(400).end();
```

- **Plaid Link tokens are short-lived** — generate them on demand (per link request) and do not cache them.
- **Access tokens are stored encrypted.** Never log a Plaid access token.

---

## Adding a new external integration

1. Create a new directory under `src/server/[integration-name]/` or a single file if it's small.
2. Export a typed client or a set of functions — never expose the raw third-party SDK types outside the integration directory.
3. Normalize responses to internal types at the boundary.
4. Add any necessary secrets to environment variables (type-safe via `src/env.js` or equivalent).
5. Verify webhook payloads before processing (if the integration sends webhooks).
6. Never log raw payloads that might contain PII or sensitive data.

---

## Environment variables

All external integration secrets are injected via environment variables. The API app uses a type-safe env validator (see `src/env.js` or `env.ts`). Add new env vars there — don't access `process.env` directly in integration files.

```ts
// ✅ Use the validated env object
import { env } from "~/env";
const client = new PlaidApi({ clientId: env.PLAID_CLIENT_ID });

// ❌ Don't access process.env directly
const client = new PlaidApi({ clientId: process.env.PLAID_CLIENT_ID });
```

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a Plaid webhook handler | This file, plus `src/server/plaid/` source |
| Storing new Plaid data | [prisma-and-migrations.md](prisma-and-migrations.md) |
| Deep-dive on external integration patterns | [../../../../docs/patterns/external-integrations.md](../../../../docs/patterns/external-integrations.md) |
