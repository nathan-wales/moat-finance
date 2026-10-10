# Desktop Local MCP OAuth

## Status

Draft. Created September 24, 2026 after reviewing the hosted MCP OAuth surface (`apps/mcp`), the desktop agent gateway (`apps/desktop/src/main/agent-gateway`), and the Cursor / Claude / ChatGPT one-click install paths.

## Goal

Let Cursor, Claude Desktop, and ChatGPT Desktop connect to the local gateway at `http://127.0.0.1:3030/mcp` with a URL-only MCP config. The client discovers OAuth, the user confirms in a Moat dialog, and the client stores the access token. The secret never lands in `mcp.json`, Codex `config.toml`, or Claude Desktop config.

Success means:

- Unauthenticated `/mcp` returns `401` with `WWW-Authenticate: Bearer resource_metadata="http://127.0.0.1:3030/.well-known/oauth-protected-resource", scope="…"`.
- One-click installs emit a URL-only config (no `Authorization` header / `http_headers`).
- Existing `moat_local_…` tokens still authenticate.
- A Moat Allow/Deny dialog is required before an authorization code is issued.

## Product Context

Hosted MCP already installs as `{ url: "https://mcp.moatfinance.ai/mcp" }` with no headers. Local one-click still mints a `moat_local_…` token and writes `Authorization: Bearer …` into the client config. Clients that can already reach loopback can complete the same discovery flow locally, so the raw token does not need to sit in a config file.

This is local-only. ChatGPT on the web still cannot reach `127.0.0.1`.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Local gateway | `apps/desktop/src/main/agent-gateway/index.ts` | Binds `127.0.0.1:3030`; 401 JSON with no challenge |
| Local tokens | `apps/desktop/src/main/agent-gateway/local-token-service.ts` | `moat_local_…` hashed in `agent-tokens.json` |
| Gateway routes | `apps/desktop/src/main/agent-gateway/gateway-routes.ts` | `/mcp` + import POSTs only |
| Hosted discovery | `apps/mcp/src/auth/oauth-metadata.ts`, `apps/mcp/src/transports/oauth-discovery-http.ts` | PRM / AS metadata + `WWW-Authenticate` |
| Hosted OAuth | `apps/mcp/src/auth/oauth-service.ts` | PKCE S256, DCR, 1h access / 30d refresh |
| Hosted redirect policy | `apps/mcp/src/hosts/registration-policy.ts` | Loopback + Cursor custom scheme |
| URL-only config | `packages/mcp-contracts/src/cursor-install-link.ts` | `buildUrlOnlyMcpServerConfig` (cloud only today) |
| One-click installs | `apps/desktop/src/main/ipc/ai-access.ts` | Cursor deeplink, Claude MCPB, Codex toml all embed bearer |
| Connect panels | `apps/desktop/src/renderer/src/pages/mcp/connect-*-desktop-side-panel.tsx` | Mint a token before install |
| Completed MCP page spec | `specs/complete/desktop-mcp-page/spec.md` | Deferred OAuth UI until desktop supports OAuth |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Desktop scopes | `advertisedMcpScopes(desktopMcpScopes)` | Tax scopes stay parked |
| Token file I/O | `local-token-service.ts` | `0o600`, hash-only storage |
| Codex merge | `packages/mcp-contracts/src/client-install.ts` | Extend for URL-only sections |
| Cloud install message | `cursorOauthInstallOpenedMessage` | Reuse for local Cursor |

## Target Experience

1. User starts the local gateway and clicks Add to Cursor / Claude / ChatGPT.
2. Moat writes a URL-only server entry. Example Cursor config:

```json
"moat-finance-local": {
  "url": "http://127.0.0.1:3030/mcp"
}
```

3. The assistant hits `/mcp` with no token, follows the `401` challenge, registers, and opens `/oauth/authorize`.
4. Moat shows a native dialog: “Allow {client_name} to access Moat on this computer?”
5. Allow issues a code and redirects to the client’s loopback `redirect_uri`. Deny sends `error=access_denied`.
6. The client exchanges the code (PKCE S256) and stores the access token itself.

Copy in connect panels tells the user to approve the Moat dialog when the assistant asks to connect.

Settings lists OAuth connections (client name, last used, revoke) next to personal access tokens. Tokens remain for custom clients.

## Architecture / Data Model

Issuer and resource: `http://127.0.0.1:3030` / `http://127.0.0.1:3030/mcp`.

Public routes on the existing gateway (before bearer auth):

| Method | Path |
|--------|------|
| GET | `/.well-known/oauth-protected-resource` and `/mcp` variant |
| GET | `/.well-known/oauth-authorization-server` and `/mcp` variant |
| POST | `/oauth/register` |
| GET | `/oauth/authorize` |
| POST | `/oauth/token` |
| POST | `/oauth/revoke` |

Store: `userData/agent-oauth.json` mode `0o600`. Clients, one-time auth codes, and access/refresh tokens as SHA-256 hashes. No plaintext secrets.

TTLs match hosted MCP: code 10 minutes (single use), access 1 hour, refresh 30 days with rotation. Opaque tokens use `moat_oauth_`.

`resolveAgentToken` tries `moat_local_…` first, then a valid OAuth access token, and returns `LocalAgentContext` (`label` = `client_name`, scopes = granted desktop scopes).

Registration: public clients only (`token_endpoint_auth_method: none`). Redirects must be loopback `http://127.0.0.1` or `http://localhost` with a port (RFC 8252), or the Cursor custom scheme `cursor://anysphere.cursor-mcp/oauth/callback`. Reject everything else.

Authorize requires `response_type=code`, PKCE `S256`, a registered `redirect_uri`, and `Host` `127.0.0.1` or `localhost`. Vault locked returns `503` and does not start OAuth.

On Allow, grant the full `desktopMcpScopes` advertised set (same as one-click mint today). No privacy picker in this pass.

Consent is `dialog.showMessageBox` in the main process. Require the click; never auto-approve.

Installs:

- Cursor: `buildUrlOnlyMcpServerConfig(localUrl)` + existing deeplink.
- ChatGPT Desktop: Codex toml with `url` only (no `http_headers`).
- Claude Desktop: merge a URL-only `moat-finance-local` entry into Claude’s desktop config. Stop baking `MOAT_MCP_AUTH_HEADER` into the MCPB (stdio proxy cannot run the browser flow).

## Acceptance Criteria

- [ ] Unauthenticated `/mcp` returns `401` + `WWW-Authenticate` pointing at local PRM; invalid bearer adds `error="invalid_token"`.
- [ ] Well-known PRM and AS metadata match hosted JSON shapes with issuer `http://127.0.0.1:3030` and `desktopMcpScopes`.
- [ ] DCR rejects non-loopback redirects; PKCE code exchange, refresh rotation, and revoke work against `agent-oauth.json`.
- [ ] `resolveAgentToken` accepts a live `moat_oauth_…` access token and rejects expired or revoked ones; `moat_local_…` still works.
- [ ] Cursor deeplink, Codex toml, and Claude config contain the local URL and no `Authorization`.
- [ ] Connect panels do not mint a token before install; copy mentions the Moat Allow dialog.
- [ ] Settings lists OAuth connections with revoke.

## Non-Goals

- Cloud Neon tables, household identity, NextAuth, or the web consent page.
- Hosted ChatGPT / Claude domain redirect allowlists.
- Privacy / scope picker on local consent.
- Changing parked Taxes product flags.
- ChatGPT web (cannot reach loopback).

## Open Questions

- None for this pass. If a client still requires a static bearer after OAuth, keep `moat_local_…` as the fallback (custom token card).

## Related Specs

- `specs/complete/desktop-mcp-page/spec.md` — deferred OAuth until desktop supported it; this spec is that follow-up.
- `specs/features/desktop-agent-transaction-import/spec.md` — listed local OAuth as a later product decision; import routes keep using `resolveAgentToken`.
- Hosted MCP OAuth: `apps/mcp/docs/patterns/transports.md`, `apps/mcp/docs/patterns/auth-and-scopes.md`.

## Suggested Commit Message

```text
feat (desktop): add local MCP OAuth
```
