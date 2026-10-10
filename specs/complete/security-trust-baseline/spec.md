# Moat Finance Security + Trust Baseline Spec

**Status:** Draft  
**Created:** May 29, 2026  
**Repo audit:** May 30, 2026  
**Owner:** Moat Finance engineering  
**Surfaces:** Web, API, MCP, Desktop, Extension, iOS, Marketing, Operations  
**Related docs:** [mission](../../mission.md), [roadmap](../../roadmap.md), [auth permissions](../../../docs/patterns/auth-permissions.md), [external integrations](../../../docs/patterns/external-integrations.md), [error handling](../../../docs/patterns/error-handling.md), [global legal compliance baseline](../../../docs/global-legal-compliance-baseline.md)

---

## Goal

Moat Finance should be able to credibly say, in product and marketing language, that it protects user financial data with strong, evidence-backed security practices.

This feature turns the current security review into an implementation roadmap that closes known gaps and creates the operating evidence needed to meet or surpass the competitor posture:

```txt
We do not sell user data.
We do not store bank login credentials.
We encrypt sensitive financial connection data.
We support and enforce multi-factor protection.
We minimize sensitive data in analytics, logs, AI flows, and vendor systems.
We operate with documented controls, retention, monitoring, and incident readiness.
```

The practical outcome is not just stronger code. It is a repeatable trust baseline: controls, documentation, tests, deployment checks, vendor records, retention jobs, and claim substantiation that make Moat Finance safer and make public security claims defensible.

---

## Background

The repo already has several strong foundations:

- Server-side authorization is the stated rule, with `withAuth`, `withDemoOrAuth`, and `withPublic` wrappers in `apps/api`.
- Moat Finance's aggregator direction says providers own credential collection, OAuth, MFA, consent, and bank authentication. Moat Finance should never collect bank credentials directly.
- Plaid tokens and provider connection tokens are encrypted before storage.
- Desktop Plaid token storage uses Electron `safeStorage`, backed by OS keychain or platform credential storage.
- Webhook verification exists for Plaid, Finicity, and MX.
- Account deletion and export flows exist, and exports intentionally exclude provider access tokens and 2FA secrets.
- MCP has scoped tools, rate limiting, and audit logging.

The May 30 repo audit found that several original gaps have already been partially closed:

- API-side 2FA enforcement now exists. `apps/api/src/server/api-context.ts` derives `requiresTwoFactor` from the NextAuth session cookie, and `apps/api/src/server/handler-wrappers.ts` blocks pending-2FA users from protected handlers except the explicit 2FA/sign-out allowlist.
- PostHog `identify` no longer sends `email` or `name` through page tracking, and `apps/web/src/lib/analytics.ts` provides a central analytics wrapper with prohibited-key filtering.
- Token encryption now uses a versioned AES-256-GCM envelope format with key IDs and legacy-payload compatibility in `apps/api/src/server/lib/encryption.ts`.
- Production config validation exists in `apps/api/src/server/lib/env-validation.ts`, `apps/mcp/src/config/env.ts` requires `MCP_TOKEN_PEPPER` in MCP production, and MX/Finicity/Plaid webhook handlers fail closed for verification failures in production paths.
- Current security evidence docs exist under `docs/security/`, including claims evidence, vendor inventory, encryption runbook, incident runbook, sensitive-change checklist, and access-review checklist.
- A current retention policy exists at `docs/data-retention-policy.md`, and cron endpoints exist for expired 2FA replay tokens, expired auth sessions, demo sessions, and raw webhook payload cleanup.
- CI security scanning exists in `.github/workflows/security.yml` for typecheck, lint, TruffleHog secret scanning, and high-severity dependency audit.

The remaining gaps that block stronger public claims are now more specific:

- Recent step-up authentication does not exist for high-risk operations such as account deletion, data export, disabling 2FA, creating/revealing MCP personal access tokens, or financial institution reconnect/disconnect flows.
- 2FA verification and backup-code attempts are not rate limited or audit logged as security events.
- Direct `posthog.capture` calls in web AI and what-if surfaces have been migrated to the analytics wrapper, CI now includes a direct-PostHog usage guard, and an initial analytics event catalog exists. The remaining analytics work is test coverage for prohibited keys.
- Pending public “do not sell” language has been removed from marketing while the claims evidence file still marks that claim pending vendor/privacy review.
- Encryption supports key IDs, but production still depends on environment-provided symmetric keys. There is no KMS-backed envelope provider, purpose-separated keys, key metadata table, or backfill/rotation script.
- API-created MCP tokens now require `MCP_TOKEN_PEPPER` in production and only fall back to `DATABASE_URL` for non-production compatibility.
- Webhook storage now redacts provider payloads before persistence, but `ProviderWebhookEvent.rawPayload` is still a JSON field without encryption or per-record `retainUntil`; cleanup uses fixed windows and clears old webhook payloads after 30 days.
- Redaction utilities are now integrated into webhook storage, but provider import, support upload, and logging flows still need broader minimization review.
- Security CI does not yet include CodeQL, Semgrep, or equivalent SAST rules for auth, crypto, logging, injection, and analytics bypass patterns.
- Security test coverage is minimal. The current API test script only runs CORS and client contract tests; there are no tests for 2FA API enforcement, step-up, webhook fail-closed behavior, encryption tampering/legacy compatibility, analytics redaction, deletion/export coverage, or retention jobs.
- Account deletion/export flows exist, but they are not step-up gated, not covered by tests, and vendor deletion/anonymization tasks for PostHog, Stripe, AI providers, and other processors remain mostly documented rather than implemented.
- A public trust/security page does not yet exist; the marketing page has a security section but no evidence-backed trust center, responsible disclosure path, or public vendor/privacy detail.

## Repo Audit Snapshot

This snapshot is the baseline for the remaining roadmap. Update it whenever a phase lands.

| Area | Repo State | Remaining Work |
|------|------------|----------------|
| API 2FA enforcement | Implemented in `api-context.ts` and `handler-wrappers.ts` | Add tests, rate limiting, security-event audit logs, and step-up auth |
| Analytics no-PII | Wrapper, PII-free identify, direct-call migration, CI guard, and event catalog exist | Add prohibited-key tests |
| Encryption | Versioned AES-256-GCM envelope exists | Add KMS/envelope provider, purpose separation, key registry, rotation script/tests |
| Production config | Central validation exists for API v1 entry; API and MCP require `MCP_TOKEN_PEPPER` in production; webhooks fail closed in handlers | Ensure validation runs for all deployed API surfaces, cover with tests, update env docs |
| Webhook payloads | Verified events stored with redacted payloads and cleaned after fixed windows | Encrypt retained raw payloads, add `retainUntil`, broaden provider/support minimization, add tests |
| Retention | Policy and four cron endpoints exist | Add missing AI/MCP/support cleanup jobs, DB run tracking, reconcile completed open items |
| Account lifecycle | Delete/export handlers exist and exclude obvious secrets | Add step-up, tests, processor deletion/anonymization jobs, verify cascade coverage |
| MCP security | PAT hashing/prefixes, scopes, rate limiting, and audit logs exist | Add step-up for token creation/reveal, tests, stale-token cleanup, retention job |
| Desktop security | Plaid token storage uses Electron `safeStorage` | Decide if local DB encryption belongs in this baseline or later local privacy work |
| CI/security program | Typecheck, lint, TruffleHog, dependency audit exist | Add SAST, analytics bypass checks, security tests, risk register, review evidence |
| Public claims | Internal claims evidence exists | Remove or qualify unsupported marketing claims until vendor/privacy review is complete |

---

## Non-Goals

This project does not attempt to complete SOC 2, ISO 27001, GLBA certification, or a formal legal audit by itself.

This project does not introduce client-side encryption with user-held keys. That may become a later privacy tier, especially for desktop/local-first data, but it is not required for this baseline.

This project does not remove all third-party processors. Moat Finance will continue to use vendors such as Plaid, MX, Finicity, Stripe, PostHog, Axiom, Vercel, Neon, AI providers, and platform app stores where the product requires them.

This project does not make Moat Finance a bank, broker, registered adviser, insurer, legal adviser, tax adviser, or medical product.

---

## Security Posture Principles

### 1. Server-side enforcement wins

UI checks, route redirects, hidden buttons, and middleware redirects are UX controls. They are not final access control.

Every sensitive API path must enforce authentication, authorization, account context, and any required step-up control server-side.

### 2. Credentials stay at the provider edge

Moat Finance must never ask users for bank usernames, passwords, MFA answers, or bank security questions. Aggregators own credential collection, OAuth, MFA, bank consent, and credential refresh.

Moat Finance stores only provider-issued tokens or identifiers needed to sync user-authorized data, and those tokens must be encrypted or hashed according to whether Moat Finance needs to recover the value.

### 3. Minimize before encrypting

Encryption is not permission to store everything. Raw provider payloads, webhook payloads, AI prompts, analytics identifiers, logs, screenshots, and support metadata should be minimized, redacted, and retained only as long as needed.

### 4. Fail closed in production

Production should not boot or deploy with missing auth secrets, encryption keys, webhook verification secrets, token peppers, or required security settings.

### 5. Claims need evidence

Do not say “bank-level security,” “we never sell data,” “fully encrypted,” “SOC 2 ready,” or “MFA protected” unless there is a maintained evidence file showing exactly what the claim means and where it is implemented.

---

## Workstream 1: MFA And Step-Up Auth

### Problem

The original server-side 2FA gap has been closed in the API wrapper layer: pending-2FA users are rejected from protected API handlers unless the handler is explicitly allowlisted for verification or sign-out.

The remaining problem is hardening. 2FA verification is not rate limited, failed attempts are not recorded in a durable security-event model, and high-risk actions do not require a recent step-up challenge after initial login.

### Requirements

- Keep API context deriving and exposing 2FA pending state for session-cookie auth. Mobile/JWT auth must either derive equivalent state at token exchange or document why JWT issuance is impossible before 2FA completion.
- Keep `withAuth` and `withDemoOrAuth` rejecting authenticated real-user requests when 2FA is pending, except for explicitly allowed 2FA verification and sign-out/revoke endpoints.
- Add tests that prove API-side 2FA enforcement cannot be bypassed by calling API routes directly.
- Sensitive actions must support step-up auth even after initial login:
  - account deletion
  - data export
  - disabling 2FA
  - creating/revealing MCP personal access tokens
  - connecting or reconnecting financial institutions
  - changing email or password when those flows exist
- 2FA verification attempts must be rate limited per user, session, and IP where possible.
- Backup code attempts must be rate limited and audit logged without logging the submitted code.
- TOTP secrets must remain encrypted at rest.
- Backup codes must remain one-way hashed and consumed after use.
- Session update paths must not allow the client to mark 2FA complete without a successful server-side verification record.
- Add durable security events for 2FA success/failure, backup-code use, rate-limit denial, step-up challenge creation, step-up success/failure, and high-risk action completion.

### Implementation Notes

- `ApiContext.requiresTwoFactor` and the 2FA allowlist already exist; keep them as the enforcement entry point unless a stronger shared auth package replaces them.
- Prefer a server-side 2FA session marker tied to the auth session or JWT session identifier, not just a client-requested `session.update({ twoFactorVerified: true })` value. Verify the current NextAuth callback behavior and document the authoritative server-side marker.
- Implement a reusable `requireRecentStepUp(ctx, purpose)` helper for high-risk operations.
- Model step-up state with either a `StepUpChallenge` table or a short-lived server-side session marker that records user, purpose, method, verification time, expiry, and consumption.
- Return typed `403` or `401` responses with stable error codes such as `TWO_FACTOR_REQUIRED`, `STEP_UP_REQUIRED`, and `STEP_UP_EXPIRED`.

### Acceptance Criteria

- A user with enabled 2FA cannot call protected API endpoints until server-side 2FA verification succeeds, and this is covered by tests.
- A test proves that middleware bypass does not bypass API-side 2FA enforcement.
- A user can still reach the 2FA verification endpoint while pending.
- High-risk actions require recent step-up auth or equivalent confirmation.
- Failed 2FA attempts are rate limited and logged without PII or submitted token values.
- Step-up events and high-risk action outcomes are auditable without logging passwords, TOTP codes, backup codes, provider tokens, or PII.

---

## Workstream 2: Analytics, Privacy, And “Do Not Sell” Controls

### Problem

Moat Finance now has a central analytics wrapper that removes prohibited keys, page tracking identifies users by ID only, direct web AI/what-if PostHog calls have been migrated, CI includes a direct-call guard, and an initial event catalog exists. The remaining enforcement work is adding prohibited-key tests and keeping the catalog current.

A public “we do not sell your data” claim remains blocked. The vendor inventory is a draft, AI and observability vendor terms still need review, and marketing must keep avoiding that wording until the claims evidence file marks it safe.

### Requirements

- Remove email, name, merchant names, account masks, transaction descriptions, raw paths with sensitive IDs, and other PII from analytics events and identify calls.
- Analytics events must include either `{ userId }` or `{ demoUser: true }`, never both.
- Keep the central analytics wrapper that rejects or redacts prohibited properties before sending events.
- Keep direct `posthog.capture`, `posthog.identify`, and `usePostHog().capture` calls out of product code outside `apps/web/src/lib/analytics.ts`.
- Keep documenting every analytics event name, owner, purpose, and allowed properties in `docs/security/analytics-events.md`.
- Add tests or lint checks for known prohibited analytics keys.
- Keep CI enforcement that fails when product code imports `posthog` directly or calls `posthog.capture`/`posthog.identify` outside the approved wrapper.
- Create a vendor/subprocessor inventory covering:
  - data categories shared
  - purpose
  - retention, where known
  - training/no-training terms for AI vendors
  - deletion/export behavior
  - whether data is used for targeted advertising or sale/share concepts
- Keep the internal claims evidence file current, and create public privacy/security claim content before marketing uses “we do not sell your data.”
- Remove, hide, or qualify existing public “No selling your data” language until vendor inventory, privacy notice review, and claims evidence are complete.

### Implementation Notes

- The direct PostHog calls in `apps/web/src/lib/agent-analytics.ts`, `apps/web/src/app/(dashboard)/ask-ai/page.tsx`, `apps/web/src/components/common/ask-ai-button.tsx`, and `apps/web/src/app/(dashboard)/what-if/*` have been migrated; keep `scripts/check-analytics-usage.mjs` as the regression guard.
- Keep event payloads to counts, booleans, enums, feature names, and non-sensitive IDs.
- Avoid sending raw route paths if future paths may contain slugs, report links, invitation tokens, or user-generated names.
- Keep the CI check that searches for `posthog.capture` and `posthog.identify` outside the wrapper.
- Keep `docs/security/analytics-events.md` reviewable in PRs whenever analytics events change.

### Acceptance Criteria

- No PostHog identify call sends email or name.
- No direct PostHog call path exists outside the approved analytics wrapper or its test files.
- No analytics call path can send known prohibited keys without failing a test or lint check.
- A vendor inventory exists and is referenced by the privacy notice/security overview.
- Product, legal, and marketing have approved wording for “we do not sell your data” that matches actual data flows.
- Existing marketing copy is reconciled with the claims evidence file.

---

## Workstream 3: Encryption, Key Management, And Secret Handling

### Problem

Provider tokens and TOTP secrets are encrypted with AES-256-GCM, and the repo now supports a versioned `v1:<keyId>:<iv>:<authTag>:<ciphertext>` envelope plus legacy decryption.

The remaining gap is production-grade key management. Keys are still environment-provided symmetric secrets, there is no KMS-backed envelope provider, no purpose-separated key hierarchy, no database-backed key registry, and no implemented backfill script to re-encrypt existing values during rotation.

### Requirements

- Keep the versioned encryption envelope format for recoverable sensitive values.
- Keep storing a key ID/version with each encrypted payload.
- Keep supporting old payload versions while writing only the active version.
- Add a rotation plan for provider access tokens, provider refresh tokens, sync cursors, TOTP secrets, and future high-sensitivity fields.
- Use managed KMS or an equivalent platform secret management strategy in production.
- Separate keys or key purposes for at least:
  - financial provider tokens
  - auth/2FA secrets
  - raw provider/debug payloads, if retained
  - document/vault data, when document storage exists
- Hash tokens that do not need to be recovered, such as MCP access tokens and invitation tokens.
- Store only token prefixes for display and lookup hints.
- Add an encryption health check that verifies required key configuration at boot/deploy without exposing key material.
- Add an implemented rotation/backfill script that can scan encrypted fields, identify stale key IDs with `isEncryptedWithActiveKey`, and safely re-encrypt values.
- Add a crypto inventory that lists every encrypted, hashed, token-prefix, and raw sensitive field with owner, purpose, key/purpose, rotation behavior, and export/deletion behavior.

### Implementation Notes

- Keep AES-256-GCM or equivalent authenticated encryption.
- Prefer envelope encryption: data encryption key per payload or per tenant/object, wrapped by a KMS key.
- The envelope format and key versioning are already in place. The next implementation should swap the key-loading layer to a KMS-backed provider without changing stored payload shape.
- Avoid logging decrypt errors with ciphertext, plaintext, tokens, or raw payload fragments.

### Acceptance Criteria

- New encrypted fields include a key version or key ID.
- Existing encrypted fields remain decryptable.
- A documented rotation runbook exists.
- A tested rotation/backfill script exists and can run in dry-run mode.
- Production fails closed when encryption key configuration is missing or invalid across all deployed API entry points.
- Tests cover encrypt/decrypt, invalid key, tampered ciphertext, legacy payload compatibility, stale key detection, and rotation/backfill behavior.

---

## Workstream 4: Production Security Configuration And Webhook Verification

### Problem

Central production config validation now exists, and MX/Finicity/Plaid webhook handlers reject invalid verification in production paths. The remaining issue is proof and coverage: validation is imported by the API v1 route entry point, but every deployed API surface and public webhook route must be covered by either startup validation or local fail-closed checks, and the behavior needs tests.

### Requirements

- Production startup/config validation must require:
  - `AUTH_SECRET`
  - `ENCRYPTION_KEY` or the active KMS configuration
  - `MCP_TOKEN_PEPPER`
  - provider webhook verification secrets for enabled providers
  - Plaid client credentials when Plaid connections are enabled
  - MX credentials and webhook basic auth when MX is enabled
  - Finicity credentials and webhook signature secret when Finicity is enabled
  - Stripe webhook secret when Stripe billing is enabled
- Webhook endpoints must fail closed in production if verification cannot run.
- Development/test may allow explicit insecure bypasses, but only when `NODE_ENV !== "production"` and the bypass is visible in logs.
- Public webhook endpoints must enforce method, body size limits, raw body verification where required, idempotency, and safe logging.
- Add deployment documentation for required secrets per enabled feature flag.
- Ensure `validateProductionConfig()` or an equivalent validation path runs for all API routes that can be deployed independently, not only `/api/v1/[router]/[action]`.
- Require `MCP_TOKEN_PEPPER` in API production config because `apps/api` creates MCP PATs and hashes them; `DATABASE_URL` fallback may remain only as an explicitly documented legacy/non-production compatibility path.
- Add tests for production missing-secret behavior for env validation and each provider webhook handler.

### Implementation Notes

- Keep centralized production env validation, but avoid relying on a single route import as the only execution path in a serverless deployment.
- Provider feature flags should drive required secret validation.
- Preserve local development ergonomics with `.env.example` and clear error messages.
- Add body size limits to raw-body webhook readers before concatenating request chunks.
- Consider replacing provider-specific raw body readers with one shared helper that enforces method, content type where applicable, byte limit, and safe error responses.

### Acceptance Criteria

- Production cannot start with an enabled provider whose webhook verification secret is missing.
- A test covers Finicity/MX webhook verification failing closed when secrets are missing in production.
- Webhook handlers never persist unverified events as `VERIFIED`.
- Plaid webhook tests cover invalid signatures, mismatched body hash, and stale `iat`.
- `.env.example`, `apps/api/.env.example`, and setup/deployment docs identify required production secrets per enabled provider.

---

## Workstream 5: Sensitive Retention, Redaction, And Data Rights

### Problem

Moat Finance now has an active retention policy, several cleanup cron endpoints, and webhook payload redaction before persistence. However, retained provider/webhook payloads are still stored in JSON fields rather than encrypted fields with per-record retention metadata, and redaction/minimization needs to be applied consistently outside webhook storage.

The remaining problem is turning the policy into enforceable data minimization: redact or avoid raw payloads before storage, encrypt any raw payloads that must be retained, add per-record retention metadata, cover AI/MCP/support retention, and record cleanup job outcomes.

### Requirements

- Keep the current data retention policy under `docs/data-retention-policy.md` and reconcile its open-item checklist with implemented cron endpoints.
- Classify data categories by sensitivity:
  - public/product metadata
  - account/profile data
  - financial transactions and balances
  - provider tokens and auth secrets
  - raw provider payloads
  - logs and analytics
  - AI prompts, outputs, and tool call records
  - screenshots/support uploads
  - MCP audit logs
- Define retention periods and deletion behavior for each category.
- Redact or avoid raw provider payloads by default where normalized fields are enough.
- If raw payloads are retained, redact before storage where possible, encrypt them, and store a per-record retention deadline such as `retainUntil`.
- Add scheduled cleanup jobs for:
  - expired 2FA replay tokens (implemented, needs tests/docs status update)
  - expired auth sessions and refresh tokens (implemented, needs tests/docs status update)
  - raw webhook payloads past retention (implemented as fixed-window clearing/deletion, needs encryption/`retainUntil`/tests)
  - raw provider debug payloads past retention
  - old support screenshots/uploads
  - stale demo overlay sessions (implemented, but uses raw `console.error` in the failure path and should use the shared logger)
  - AI conversations and AI report drafts past retention
  - MCP tool-call audit records past retention
- Account deletion must revoke provider access where possible, delete user data, and queue best-effort vendor deletion/anonymization tasks.
- Data export should include user-meaningful data while excluding secrets, auth tokens, encrypted provider tokens, internal audit metadata, and unrelated operational logs.
- Add retention job result tracking so cleanup outcomes are queryable and auditable.

### Implementation Notes

- A shared redaction utility exists at `apps/api/src/server/lib/redaction.ts` and is integrated into webhook storage; extend it to provider import, logging, and support upload flows.
- Keep enough normalized webhook metadata to debug delivery without storing sensitive payloads indefinitely.
- Add a `retention_exempt_until` or legal hold design only when the product needs it.
- Avoid storing `rawProviderPayload` or `rawPayload` at all when the normalized data is sufficient for sync/debugging.

### Acceptance Criteria

- A current retention policy exists and maps to implementation jobs.
- Raw webhook/provider payloads have a documented retention period, cleanup job, encryption/minimization behavior, and per-record retention deadline.
- Account deletion covers user data, sessions, provider disconnect, MCP tokens, AI reports/shares, memories, and analytics/vendor deletion or anonymization where possible.
- Export excludes all secrets and encrypted token material.
- Retention jobs record scanned/deleted/redacted/error counts without logging PII or raw payloads.
- Tests cover cleanup behavior for expired 2FA tokens, auth sessions, webhook payloads, AI conversations, MCP tool calls, and demo sessions.

---

## Workstream 6: Secure SDLC, CI Security, And Operational Evidence

### Problem

Security conventions and several evidence docs now exist, and CI already runs typecheck, lint, secret scanning, and dependency audit. The remaining gap is automated depth and review evidence: no SAST/CodeQL/Semgrep, minimal test coverage, no analytics bypass check, no risk register, and no proof that sensitive-change checklists or access reviews are actually used.

### Requirements

- Add CI checks for:
  - typecheck (implemented)
  - lint/check (implemented)
  - dependency vulnerability scanning (implemented with `pnpm audit --audit-level=high --prod`)
  - secret scanning (implemented with TruffleHog verified-secret scan)
  - static analysis for auth, injection, unsafe crypto, and logging risks
  - tests for auth wrappers, 2FA enforcement, webhook verification, encryption, deletion/export, and analytics redaction
  - analytics wrapper bypass detection for direct PostHog calls
- Add a sensitive-change PR checklist for changes touching:
  - auth/session/token code
  - handler wrappers and API context
  - provider token storage or sync
  - webhook handlers
  - MCP tools/scopes/audit logs
  - analytics/logging
  - data export/deletion
  - AI prompt/tool data flows
  - encryption and secret management
- Create a lightweight risk register with owner, severity, due date, and remediation status.
- Keep the incident response runbook current and add breach-notification checklist/exercise evidence.
- Keep the quarterly access review checklist current and record completed reviews.
- Document secure coding rules already present in `AGENTS.md` as an engineering security standard.
- Add evidence capture for completed access reviews, sensitive-change reviews, incident exercises, and security scan runs.

### Implementation Notes

- GitHub Actions, Dependabot/Renovate, CodeQL, Semgrep, Gitleaks, OSV Scanner, or equivalent tools are acceptable. Choose tools based on repo fit and noise level.
- CI must fail on high-confidence secret leaks and critical vulnerabilities. Medium findings may create issues initially.
- Avoid noisy blanket gates that make developers ignore the system.
- The first SAST pass should prioritize high-confidence rules for auth bypass, direct Prisma/web DB access from web, unsafe crypto, raw `console.*` in API failure paths, and prohibited analytics calls.
- The current test command only runs `apps/api/src/server/lib/cors.test.ts` and `packages/client-ts/api-client.test.ts`; add security tests before relying on CI as security evidence.

### Acceptance Criteria

- CI blocks obvious secret leaks and critical dependency vulnerabilities.
- Sensitive code paths have tests or explicit manual review evidence.
- A security issue register exists and is updated during implementation.
- An incident runbook exists with named owners and escalation steps.
- SAST/static rules run in CI and produce actionable findings with a documented triage process.
- Sensitive-change and access-review checklists have dated, reviewer-owned completion evidence.

---

## Workstream 7: Public Security Claims And Trust Center Foundation

### Problem

Moat Finance already has internal claims evidence and a marketing security section. Marketing no longer uses the pending “do not sell” wording, but `docs/security/claims-evidence.md` still marks that claim pending vendor inventory completion, privacy notice review, and AI/vendor terms confirmation.

The remaining work is to make public language evidence-backed, remove or qualify pending claims until approved, and create a trust/security page that users can actually read.

### Requirements

- Keep and maintain the claims evidence file for every public security/privacy claim.
- Define approved claim tiers:
  - **Current safe claim:** Moat Finance does not ask for or store bank login credentials. Financial institution login happens through trusted data providers.
  - **Current safe claim after test evidence:** Moat Finance supports two-factor authentication and enforces it server-side for protected account access when enabled.
  - **After analytics cleanup/vendor/privacy review:** Moat Finance does not sell user data, and analytics/vendor sharing is limited to operating, securing, supporting, and improving the product.
  - **After KMS/rotation:** Sensitive provider tokens are encrypted with authenticated encryption and managed or KMS-backed key rotation.
  - **After SDLC/retention evidence:** Moat Finance follows a documented security and retention program with automated checks, tested data lifecycle controls, and incident readiness.
- Build a security overview page or trust center section covering:
  - credential handling
  - financial data providers
  - encryption and token storage
  - MFA/passkeys roadmap
  - deletion/export
  - vendor and analytics practices
  - incident contact
  - responsible disclosure path
- Reconcile `apps/marketing/index.html` with approved claims immediately; remove or qualify pending claims until they are approved.
- Prohibit unsupported language:
  - “bank-level security” unless defined and evidenced
  - “military-grade encryption”
  - “fully secure”
  - “zero risk”
  - “we never share data” if vendors/processors receive data
  - “SOC 2 ready” without a scoped readiness checklist

### Acceptance Criteria

- Marketing copy references the claims evidence file before publication.
- The security overview does not overstate controls.
- The privacy/security page clearly says Moat Finance does not store bank login credentials.
- The page distinguishes data selling from service-provider processing.
- Public claims are reviewed whenever analytics, AI, provider sync, or vendor flows materially change.
- Existing public marketing claims match the evidence file or are removed until evidence is complete.
- The trust/security page includes an incident contact and responsible disclosure path.

---

## Cross-Cutting Data Model Considerations

This feature still needs schema changes for the portions that require durable audit, step-up, retention, or vendor records. Do not add tables until a concrete phase needs them, but the May 30 repo audit found that none of the following models exist yet as first-class Prisma models except vendor inventory as a markdown document and key versioning as environment configuration.

Potential new tables or fields:

```txt
SecurityEvent
  id
  userId?
  actorUserId?
  eventType
  sensitivity
  outcome
  ipHash?
  userAgentHash?
  metadata
  createdAt

StepUpChallenge
  id
  userId
  purpose
  method
  verifiedAt
  expiresAt
  consumedAt?
  createdAt

EncryptionKeyVersion
  id
  provider
  purpose
  keyId
  status
  createdAt
  retiredAt?

RetentionJobRun
  id
  jobName
  status
  scannedCount
  deletedCount
  failedCount
  startedAt
  completedAt
  errorMessage?

VendorProcessor
  id
  name
  category
  dataCategories
  purpose
  retentionSummary
  subprocessorsUrl?
  dpaStatus
  securityReviewStatus
  createdAt
  updatedAt
```

Do not add these tables until a concrete phase requires them. Start with the smallest durable model that supports enforcement and evidence.

Current data-model notes:

- `ProviderWebhookEvent.rawPayload` is required JSON and stores a redacted payload, but has no encryption marker, `retainUntil`, or redaction metadata.
- Several user-owned models already cascade on user deletion, including MCP tokens, memories, agent conversations, AI reports, and shares, but deletion/export behavior still needs tests and processor deletion/anonymization jobs.
- `McpPersonalAccessToken` and OAuth token records store hashes/prefixes rather than recoverable token material, which matches the baseline requirement.
- Encryption key IDs are embedded in ciphertext envelopes but not tracked in an `EncryptionKeyVersion` table.
- Retention cron endpoints log counts but do not persist `RetentionJobRun` rows.

---

## Phased Delivery Plan

### Phase 0: Claims Freeze And Evidence Setup

- ✅ Security claims evidence file exists.
- ✅ Unsupported-claims guidance exists in the claims evidence file.
- ✅ Vendor inventory draft exists.
- ✅ PII was removed from the page-tracking PostHog identify call.
- ✅ Claims evidence no longer treats key versioning as missing.
- ✅ Removed pending “No selling your data” / “We do not sell your data” wording from marketing.
- ✅ Initial analytics event catalog exists.
- ✅ Remaining direct PostHog calls were migrated to the wrapper.
- ✅ CI/lint enforcement for direct PostHog bypasses exists.

### Phase 1: MFA Enforcement And Sensitive Auth Hardening

- ✅ API-side 2FA enforcement exists in handler wrappers.
- Verify and document the authoritative server-side 2FA completion marker for NextAuth sessions and mobile/JWT token issuance.
- Add API enforcement tests for pending-2FA users, allowlisted verification/sign-out endpoints, and direct API bypass attempts.
- Add 2FA verification and backup-code rate limiting.
- Add security-event audit logs for 2FA and backup-code attempts.
- Add recent step-up checks for export, deletion, 2FA disable, MCP token creation/reveal, and bank connection changes.
- Add step-up tests and UX/API error handling for `STEP_UP_REQUIRED`.

### Phase 2: Production Fail-Closed Config

- ✅ Central env validation exists for production config.
- ✅ API production config requires `MCP_TOKEN_PEPPER` for API-created MCP tokens.
- ✅ MX/Finicity/Plaid webhook handlers reject failed verification before persisting verified events.
- Ensure validation runs for every deployed API/webhook surface, not only the API v1 router entry.
- Add webhook verification tests, including missing secrets in production, invalid credentials/signatures, Plaid body hash mismatch, and stale Plaid `iat`.
- Add raw body size limits and shared safe raw-body parsing for webhook routes.
- Update `.env.example`, `apps/api/.env.example`, and deployment docs with required secrets per enabled provider.

### Phase 3: Retention And Redaction

- ✅ Current retention policy exists.
- ✅ Shared redaction utility exists.
- ✅ Webhook storage uses the shared redaction utility before persisting provider payloads.
- ✅ Cron endpoints exist for expired 2FA tokens, expired auth sessions, demo sessions, and webhook payload clearing/deletion.
- Reconcile retention policy open items with implemented jobs.
- Extend redaction/minimization beyond webhook storage into provider import/support/logging flows.
- Encrypt retained raw payloads and add per-record `retainUntil` metadata.
- Add cleanup jobs for AI conversations, MCP tool-call records, support uploads/screenshots, and raw provider debug payloads.
- Add `RetentionJobRun` or equivalent durable cleanup outcome tracking.
- Validate deletion/export coverage with tests, including cascaded MCP, AI report/share, memory, provider connection, and settings records.
- Add vendor deletion/anonymization tasks for PostHog, Stripe, AI providers, and other processors where supported.

### Phase 4: Encryption Key Management

- ✅ Versioned encrypted payload format exists.
- ✅ Key versioning helpers and rotation runbook exist.
- Add tests for encryption tampering, invalid key material, legacy payload compatibility, active-key detection, and decrypt error logging safety.
- Add KMS/envelope encryption provider or a documented platform secret-management equivalent.
- Add key purpose separation for provider tokens, auth/2FA secrets, raw payloads, and future document/vault data.
- Add key metadata inventory or table.
- Implement dry-run and execute modes for backfill/lazy rotation of existing encrypted values.

### Phase 5: Secure SDLC And Trust Center

- ✅ Dependency audit and secret scanning exist.
- ✅ Sensitive-change checklist, incident runbook, and access-review checklist exist.
- Add CodeQL, Semgrep, or equivalent SAST with high-confidence rules.
- Add security tests to CI and make them blocking for the relevant app/package.
- Create a risk register with owner, severity, due date, and remediation status.
- Capture evidence for completed access reviews and sensitive-change reviews.
- Publish security overview/trust center content only after claims are evidenced and marketing copy is reconciled.

---

## Security Tests Required

- `withAuth` rejects pending-2FA users for protected endpoints.
- `withDemoOrAuth` rejects pending-2FA real users while continuing to allow demo-mode reads.
- 2FA verification endpoint allows pending users to complete verification.
- Session update cannot mark 2FA complete without server verification.
- 2FA and backup-code attempts are rate limited per user/session/IP where possible and logged without submitted code values.
- Export and delete require recent step-up.
- 2FA disable, MCP PAT creation/reveal, and provider reconnect/disconnect require recent step-up.
- Analytics wrapper rejects prohibited keys such as `email`, `name`, `merchantName`, `description`, `accountNumber`, `routingNumber`, and token-like fields.
- Direct PostHog calls outside the analytics wrapper fail CI or lint.
- Finicity/MX webhooks fail closed in production when verification secrets are missing.
- Plaid webhook rejects invalid signatures, mismatched body hash, and stale `iat`.
- Encryption rejects tampered ciphertext and invalid key material.
- Legacy encrypted provider tokens remain decryptable after key-version rollout.
- Rotation dry-run identifies values not encrypted with the active key, and rotation execution re-encrypts them without changing plaintext.
- Retention jobs delete or redact expired raw payloads and record job results.
- Account deletion removes or revokes all user-owned tokens and linked provider records where possible, and queues supported processor deletion/anonymization tasks.
- Data export excludes secrets, provider tokens, raw webhook payloads, auth/session records, internal audit logs, and encrypted token material.

---

## Operational Evidence Required

Before Moat Finance uses stronger public claims, create and maintain these artifacts:

- Security claims evidence file.
- Vendor/subprocessor inventory.
- Data map and retention schedule.
- Encryption/key-management runbook.
- Incident response runbook.
- Sensitive-change PR checklist.
- Access review checklist.
- Security scan configuration and recent passing run.
- Risk register.
- Analytics event catalog and direct-PostHog bypass scan result.
- MFA enforcement test results.
- 2FA rate-limit and step-up test results.
- Webhook verification test results.
- Analytics no-PII test results.
- Encryption tamper/legacy/rotation test results.
- Retention cleanup test/job-run evidence.
- Account deletion/export test results.
- Vendor/privacy review sign-off for “do not sell” language.

---

## Recommended Public Wording By Milestone

### Safe Now, With Current Evidence

```txt
Moat Finance does not ask for or store your bank login credentials. Financial account connection and authentication happen through trusted data providers such as Plaid and other supported aggregators.
```

```txt
Moat Finance encrypts sensitive provider tokens and avoids logging bank credentials, account numbers, routing numbers, raw transaction descriptions, or secrets.
```

### Safe After MFA/API Tests And Rate-Limit Follow-Up

```txt
Moat Finance supports two-factor authentication and enforces it server-side for protected account access when enabled.
```

### Safe After Analytics Cleanup, Vendor Review, And Privacy Notice Update

```txt
Moat Finance does not sell user data. We share limited data with service providers only to operate, secure, support, and improve the product, as described in our privacy notice.
```

Do not use this claim publicly while `docs/security/claims-evidence.md` marks it pending. Current marketing copy must be reconciled.

### Safe After KMS/Rotation And Evidence

```txt
Sensitive provider tokens are protected with authenticated encryption and managed key rotation.
```

Avoid “bank-level security” unless Moat Finance defines the phrase on the security page and can point to specific controls that support it.

---

## Open Questions

- Should 2FA become mandatory for all users who connect real financial institutions, or remain optional with strong nudges?
- Should passkeys/WebAuthn be part of this baseline or a follow-up feature?
- Which KMS provider should be canonical for Vercel/Neon deployments?
- What is the desired retention period for raw provider payloads: 7 days, 30 days, or disabled by default?
- Should AI prompt/output retention be user-configurable?
- Should the desktop app offer a local-only privacy mode before or after cloud trust center work?
- Who owns vendor review and public claims approval long-term?
- Should step-up require TOTP/password/passkey, or is a recently verified 2FA session sufficient for specific purposes?
- Should raw webhook/provider payload storage be disabled by default in production except for incident/debug sampling?
- Should vendor inventory remain markdown, move into the database, or be managed in a compliance tool once reviews become recurring?

---

## Definition Of Done

This feature is done when:

- API-side MFA enforcement is real, rate limited, audited, and tested.
- High-risk operations require recent step-up and return stable typed errors when step-up is missing or expired.
- Analytics no longer sends PII, all direct PostHog usage goes through the wrapper, and CI prevents regression.
- Public “do not sell” language is either removed or fully evidenced by vendor inventory, privacy notice review, and legal/product approval.
- Production security config fails closed for required secrets and enabled providers across all deployed API surfaces.
- Webhook routes enforce verification, method, raw-body limits, idempotency, safe logging, and tests.
- Sensitive provider/debug payload retention is documented, minimized before storage, encrypted when retained, tied to per-record retention metadata, automated, and tested.
- Encryption supports versioning and rotation, has a tested rotation/backfill path, and uses KMS/envelope encryption or an explicitly accepted platform secret-management equivalent.
- CI includes practical security checks for secrets, dependencies, SAST/high-risk code patterns, analytics bypasses, and the security test suite.
- Account deletion/export behavior is tested against the current data model and queues supported vendor deletion/anonymization tasks.
- A security overview/trust page uses only evidenced claims and includes credential handling, providers, encryption, MFA, deletion/export, vendor practices, incident contact, and responsible disclosure.
- A vendor inventory, incident runbook, access review checklist, sensitive-change checklist, risk register, and claims evidence file exist and have owner/review evidence.
