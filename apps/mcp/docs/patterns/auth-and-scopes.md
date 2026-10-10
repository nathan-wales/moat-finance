# Pattern: Auth and Scopes (apps/mcp)

## Token types

The MCP server supports two token types:

| Type | Prefix | Issued by | Storage | Revocable |
|------|--------|-----------|---------|-----------|
| PAT (Personal Access Token) | `moat_dev_` | Account settings UI | Peppered-hashed in DB | Yes (per-token) |
| OAuth access token | (no prefix) | OAuth 2.0 + PKCE flow | Client-side (bearer) | Yes (per-client) |

---

## Token verification flow

Every request goes through `src/auth/verify-token.ts`:

```
Incoming request with Authorization: Bearer <token>
  → verify-token.ts
    → if token starts with "moat_dev_": pat-service.ts (hash + DB lookup)
    → else: oauth-service.ts (JWT verify or DB lookup for opaque tokens)
      → resolve-household-identity.ts (resolves userId + household)
        → scope-checker.ts (does this token's scopes include the required scope?)
```

**Never call the DB directly in a transport handler.** All auth resolution goes through `verify-token.ts`.

---

## PAT service

`src/auth/pat-service.ts` handles PAT issuance and verification:

- **Issuance:** A raw token is generated once and shown to the user. The hashed version is stored in DB with pepper applied.
- **Verification:** The incoming token is peppered-hashed and compared against stored hashes. Timing-safe comparison is used.
- **`lastUsedAt`** is updated on each successful verification.

```ts
// Issuing a PAT (from the API, not directly from MCP)
const { rawToken, hashedToken } = await patService.issue(userId, scopes);
// Store hashedToken in DB, return rawToken to user once

// Verifying a PAT (inside MCP)
const identity = await patService.verify(incomingToken);
// Returns: { userId, scopes } or throws if invalid/revoked
```

---

## OAuth (PKCE)

`src/auth/oauth-service.ts` implements OAuth 2.0 with PKCE for third-party clients:

- **Dynamic client registration** — clients (Claude Desktop, Cursor, ChatGPT, etc.) register themselves at `/oauth/register`.
- **PKCE is mandatory** — `code_challenge` and `code_verifier` must be present in the authorization and token exchange flows.
- **Consent screen** is served from `apps/web` at `/mcp/authorize`, which redirects back to the MCP server after user approval.
- **Token rotation** — access tokens are short-lived; refresh tokens rotate on each use.
- **Cursor redirects** — Desktop uses loopback `http://localhost|127.0.0.1:<port>/callback` or `/oauth/callback` (RFC 8252 any port; Cursor commonly uses `8787`). Web / Cloud Agents use `https://www.cursor.com/agents/mcp/oauth/callback`. Custom scheme `cursor://anysphere.cursor-mcp/oauth/callback` remains allowed. Hosts default to `www.cursor.com,cursor.com` via `MCP_OAUTH_CURSOR_REDIRECT_HOSTS`.
- **Claude hosted redirects** — Claude.ai / Desktop / mobile / Cowork DCR uses `https://claude.ai/api/mcp/auth_callback` (and `claude.com`). Hosts default to `claude.ai,claude.com` via `MCP_OAUTH_CLAUDE_REDIRECT_HOSTS`.

---

## Scope enforcement

Every tool invocation passes through `src/auth/scope-checker.ts`. Scope is defined per-tool in the registry (`requiredScope`).

```ts
// scope-checker.ts pattern
export function checkScope(tokenScopes: string[], requiredScope: string): void {
  if (!tokenScopes.includes(requiredScope)) {
    throw new McpAuthError(`Missing required scope: ${requiredScope}`);
  }
}
```

**Never bypass scope checking.** Adding a tool without a `requiredScope` in the registry is not allowed — the registry type enforces this.

---

## Scope table

| Scope | Tools covered |
|-------|---------------|
| `mcp:accounts:read` | `moat.listAccounts` |
| `mcp:transactions:read` | `moat.listTransactions`, `moat.searchTransactions`, `moat.getSpendingBreakdown` |
| `mcp:budget:read` | `moat.getBudgetStatus` |
| `mcp:forecast:read` | `moat.getForecast`, `moat.explainForecast` |
| `mcp:rules:read` | `moat.listTransactionRules`, `moat.previewRuleMatches` |
| `mcp:read` | `moat.getProfileSummary`, `moat.listReports` |
| `mcp:memories:read` / `mcp:memories:write` | `moat.getSavedFinancialContext`, `moat.saveFinancialContext` |
| `mcp:insurance:read` | Reserved for cloud-safe insurance policy tools |
| `mcp:assets:read` | Reserved for assets & liabilities tools |
| `mcp:profile:read` | Reserved for financial profile tools |
| `mcp:tax:read` | Reserved for tax context tools |
| `mcp:reports:write` | Report create/update/delete/share tools |
| `mcp:feedback:write` | `moat.submitFeedback` |
| `mcp:rules:write` | Rule create/update/delete/enable + apply to past transactions |
| `mcp:transactions:write` | Transaction category/type/field/hashtag updates + soft-delete |
| `mcp:budget:write` | Category budget upsert/delete |

OAuth grants `mcpScopes` except ChatGPT Apps v1, which stays on `readScopes`. PAT and desktop local tokens are unchanged.

New scopes must be added to `packages/mcp-contracts/src/scopes.ts` and surfaced in the PAT / consent UIs.

---

## resolve-household-identity.ts

After token verification, `resolve-household-identity.ts` resolves the effective `userId` for queries (handles household member scenarios — same as `apps/api`).

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a new scope for a new tool | This file (Scope table section + mcp-contracts) |
| Understanding PKCE flow | This file (OAuth section) |
| Adding a new tool | [tool-lifecycle.md](tool-lifecycle.md) |
| Transport setup | [transports.md](transports.md) |
