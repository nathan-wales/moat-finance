# Moat Finance Data Retention Policy

**Status:** Active  
**Owner:** Moat Finance engineering  
**Created:** May 29, 2026  
**Review cadence:** Quarterly, or whenever a new data category is introduced  

---

## Purpose

This policy defines what data Moat Finance stores, how long it is retained, and when it is deleted. It applies to all environments (production, staging) and all surfaces (web, API, mobile, desktop, extension, MCP).

This policy supersedes the draft in `docs/old/data-retention-policy.md`.

---

## Data Classification And Retention Schedule

### 1. Public / Product Metadata
**Examples:** App version, feature flags, category names, system configuration  
**Retention:** Indefinite  
**Deletion trigger:** Manual cleanup only  
**Sensitivity:** Public  

---

### 2. User Account And Profile Data
**Examples:** User ID, username, email (also sent to PostHog as an identify person property), subscription status, preferences, settings  
**Retention:** Duration of account + 30 days after deletion requested  
**Deletion trigger:** Account deletion flow  
**Sensitivity:** Personal  
**Notes:** After account deletion, email is nulled or hashed. User record is soft-deleted for 30 days then purged. See deletion coverage below.

---

### 3. Financial Transactions And Balances
**Examples:** Transaction records, balance snapshots, investment data, real estate data  
**Retention:** Duration of account  
**Deletion trigger:** Account deletion flow  
**Sensitivity:** Financial / personal  
**Notes:** Exported data includes transactions. Provider data (raw payloads) is separate — see item 5.

---

### 4. Provider Tokens And Auth Secrets
**Examples:** Plaid access tokens, MX connection tokens, Finicity tokens, TOTP secrets, backup codes  
**Retention:** Revoked and deleted on account deletion or provider disconnect  
**At-rest protection:** AES-256-GCM encrypted (TOTP) or encrypted (provider tokens)  
**Deletion trigger:** Provider disconnect, account deletion, or rotation  
**Sensitivity:** Critical — highest sensitivity  
**Notes:** Tokens are never included in exports. Keys must be rotated per the encryption runbook.

---

### 5. Raw Provider Payloads
**Examples:** Raw Plaid transaction payloads, raw MX/Finicity webhook bodies, raw provider sync responses stored for debugging  
**Retention:** 30 days  
**Deletion trigger:** Scheduled cleanup job (`retention-cleanup.job.ts`)  
**Sensitivity:** High (may contain financial data and account metadata)  
**Notes:**  
- Prefer storing normalized fields over raw payloads wherever possible.  
- If raw payloads are retained, store them encrypted and with a `retainUntil` timestamp.  
- Cleanup job must run at least daily.  
- **Action required:** Audit current `rawPayload` fields in `ProviderWebhookEvent` and provider connection records; add `retainUntil` or encryption where absent.

---

### 6. Webhook Event Records
**Examples:** `ProviderWebhookEvent` rows  
**Retention:** 90 days for verified events; 7 days for failed/unverified events  
**Deletion trigger:** Scheduled cleanup job  
**Sensitivity:** Medium  
**Notes:** Retain enough metadata to debug delivery, but do not retain full raw payloads beyond 30 days. Unverified events (FAILED/REJECTED) should be purged more aggressively.

---

### 7. Auth Sessions And Refresh Tokens
**Examples:** `AuthSession`, `RefreshToken`, NextAuth `Session`  
**Retention:** Session TTL (typically 30 days of inactivity) or until explicitly revoked  
**Deletion trigger:** Expiry, revocation, account deletion  
**Sensitivity:** High  
**Notes:** Cleanup job must delete expired sessions daily. Revoked sessions should be purged after 7 days.

---

### 8. 2FA Replay Tokens
**Examples:** `TwoFactorToken` records used to prevent TOTP replay attacks  
**Retention:** 60 seconds (TTL of one TOTP window)  
**Deletion trigger:** Scheduled cleanup job (runs per-request, or periodic job)  
**Sensitivity:** Medium  
**Notes:** Already cleaned up in the `verify` handler. A scheduled job should also sweep expired records.

---

### 9. Logs And Analytics
**Examples:** Axiom log entries, PostHog events  
**Retention:** Logs: 90 days; Analytics: per PostHog configuration (default 7 years — reduce to 1 year)  
**Deletion trigger:** Platform TTL; manual deletion via vendor API for user-requested deletion  
**Sensitivity:** Medium (PostHog identify stores account email; capture events and logs must not contain PII — see AGENTS.md)
**Notes:** No PII in logs. PostHog identify may store account email as a person property; capture events must not. PostHog retention should be configured to 1 year or less. User deletion should trigger a PostHog person deletion request.

---

### 10. AI Prompts, Outputs, And Tool Call Records
**Examples:** `AgentConversation`, `McpToolCall`, AI report content  
**Retention:** AI reports: duration of account; Tool call records: 90 days; Conversation history: 90 days of inactivity  
**Deletion trigger:** Account deletion or user-requested deletion  
**Sensitivity:** High (may reference financial context)  
**Notes:**  
- Prefer zero-data-retention (ZDR) API tiers for AI provider calls.  
- Tool call records log tool names and parameter counts but not raw financial values.  
- **Action required:** Confirm OpenAI ZDR API is in use. Add 90-day conversation cleanup job.

---

### 11. Screenshots / Support Uploads
**Examples:** User-submitted support screenshots, onboarding attachments  
**Retention:** 90 days  
**Deletion trigger:** Scheduled cleanup job; account deletion  
**Sensitivity:** Medium-high (may contain financial screenshots)  
**Notes:** **Action required:** Implement cleanup job if file storage is used.

---

### 12. MCP Audit Logs
**Examples:** MCP tool call audit entries, OAuth authorization records  
**Retention:** 1 year  
**Deletion trigger:** Account deletion (best-effort); automatic expiry  
**Sensitivity:** Medium  
**Notes:** Audit logs should not contain raw financial values — only tool names, success/failure, and user/session identifiers.

---

### 13. Demo Overlay Sessions
**Examples:** `DemoOverlaySession` records  
**Retention:** 24 hours  
**Deletion trigger:** Scheduled cron (`cleanup-demo-sessions`)  
**Sensitivity:** Low  

---

## Scheduled Cleanup Jobs

| Job | Schedule | Targets |
|-----|----------|---------|
| `cleanup-demo-sessions` | Daily | `DemoOverlaySession` records older than 24h |
| `cleanup-expired-2fa-tokens` | Daily | `TwoFactorToken` records past `expires` |
| `cleanup-expired-auth-sessions` | Daily | `AuthSession` / `RefreshToken` past `expiresAt` or revoked >7d ago |
| `cleanup-raw-webhook-payloads` | Daily | `ProviderWebhookEvent` raw payloads older than 30 days |
| `cleanup-stale-webhook-events` | Weekly | `ProviderWebhookEvent` records older than 90 days |
| `cleanup-agent-conversations` | Weekly | `AgentConversation` inactive for >90 days |
| `cleanup-mcp-tool-calls` | Monthly | `McpToolCall` records older than 1 year |

---

## Account Deletion Coverage

When a user deletes their account, the following must be completed:

| Data | Action |
|------|--------|
| Financial transactions, balances, investments | Hard delete |
| Provider connections (Plaid, MX, Finicity) | Revoke access token via provider API, then delete connection record |
| Provider tokens | Delete encrypted token fields |
| TOTP secret + backup codes | Delete |
| Auth sessions + refresh tokens | Revoke and delete |
| MCP personal access tokens | Delete |
| AI reports + shares | Delete |
| Memories | Delete |
| Rules, categories, budgets | Delete |
| User settings | Delete |
| User record | Soft-delete → purge after 30 days |
| PostHog person | Best-effort deletion via PostHog API |
| AI provider data | Best-effort request if vendor supports deletion |

---

## Data Export Coverage

Exports include user-meaningful data and exclude:

- Provider access tokens (never exported)
- TOTP secrets (never exported)
- Backup codes (never exported)
- Internal session / auth tokens
- Raw webhook payloads
- Operational logs
- Internal metadata fields (IDs used only for relational integrity)

---

## Open Items

- [ ] Add `retainUntil` field to `ProviderWebhookEvent` and encrypt raw payloads
- [x] Implement `cleanup-expired-2fa-tokens` cron job
- [x] Implement `cleanup-expired-auth-sessions` cron job
- [x] Implement `cleanup-raw-webhook-payloads` cron job
- [x] Redact webhook payloads before storing `ProviderWebhookEvent.rawPayload`
- [ ] Implement `cleanup-agent-conversations` cron job
- [ ] Implement `cleanup-mcp-tool-calls` cron job
- [ ] Add durable retention job run tracking
- [ ] Confirm PostHog retention is configured to ≤1 year
- [ ] Confirm OpenAI ZDR API is in use
- [ ] Add PostHog person deletion to account deletion flow
