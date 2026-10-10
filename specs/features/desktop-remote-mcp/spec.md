# Desktop remote MCP tunnel

## Status

Draft. Created September 26, 2026 after reviewing the local agent gateway (`apps/desktop/src/main/agent-gateway`), cloud MCP OAuth (`apps/mcp`), desktop cloud sign-in (`apps/desktop/src/main/lib/cloud-auth.ts`), and PostHog feature flags (`packages/contracts/src/feature-flags.ts`).

## Goal

Let a person running Moat Desktop expose a stable public MCP URL that ChatGPT or another MCP client can call, while the SQLCipher database and MCP tools stay on that computer.

Success means:

- The desktop opens an outbound WebSocket only. No inbound port, UPnP, or router configuration.
- `https://tunnel.moatfinance.ai/d/<publicTunnelId>/mcp` is routing information. A request without a device-scoped OAuth token, including `tools/list`, returns 401 and never reaches the desktop.
- Cloudflare does not store or log financial payloads.
- The feature stays off unless PostHog flag `desktop-remote-mcp` is on and the user opts in locally.

## Product Context

Moat Desktop is local-first. Remote MCP exists so an external assistant can reach that local data without copying the financial database into Moat's cloud. The user must keep the desktop app running and online.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Local MCP | `apps/desktop/src/main/agent-gateway` | `127.0.0.1:3030`, Streamable HTTP, tools from `@moat/mcp-contracts` |
| Local OAuth | `apps/desktop/src/main/agent-gateway/oauth-metadata.ts` | Issuer is loopback. Not usable as the public authorization server |
| Cloud OAuth | `apps/mcp/src/auth/oauth-service.ts`, `apps/mcp/src/transports/http.ts` | PKCE, DCR, consent on the web app |
| Cloud sign-in | `apps/desktop/src/main/lib/cloud-auth.ts` | Optional. Tokens in Keychain-backed `cloud-token.bin` |
| Feature flags | `packages/contracts/src/feature-flags.ts`, `apps/desktop/src/main/lib/analytics.ts` | PostHog, kebab-case. Main process uses `isMainProcessFeatureEnabled` |
| Device id | `recoveryDeviceId` in vault config | Vault recovery handle. Must not appear in the public URL |
| MCP settings UI | `apps/desktop/src/renderer/src/pages/mcp` | Existing AI access page |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `createLocalMcpServer` | `apps/desktop/src/main/agent-gateway/mcp-server.ts` | Source of truth for tools |
| `withAuth` / `withPublic` | `apps/api/src/server/handler-wrappers.ts` | New device and introspection routes |
| OAuth consent | `apps/web/src/app/mcp/oauth/authorize` | Extend with device binding |
| `@moat/ui` | `packages/ui` | Remote MCP card |

## Target Experience

The Remote MCP card appears on the desktop MCP settings tab only when `desktop-remote-mcp` is enabled.

Copy:

- Title: Remote MCP
- Body: Connect AI tools such as ChatGPT to this computer's local Moat data.
- Privacy: Your financial database remains on this computer. Remote MCP requests are securely routed to Moat Desktop and processed locally. This app must be running and online. The endpoint URL is not a password.

States: Off, Connecting, Connected, Offline, Authentication error.

The enable switch defaults off. It stays disabled until the user is signed in to a Moat account. The endpoint and copy button appear after the user enables Remote MCP.

## Architecture / Data Model

```text
MCP client --POST /d/dv_xxx/mcp--> Worker
  --introspect token--> API (401/403 stops here)
  --> Durable Object for dv_xxx
  --outbound WebSocket--> Electron main
  --> createLocalMcpServer
  --> SQLCipher
```

- `DesktopMcpTunnel` rows store `userId`, `deviceId`, `publicTunnelId`, and an optional label. No financial columns.
- `McpOAuthAccessToken.desktopPublicTunnelId` binds a cloud OAuth token to one device. Null means a normal cloud MCP token, which cannot call the tunnel. A non-null value cannot call cloud `/mcp`.
- Desktop connection JWTs are Ed25519, audience `tunnel-connect`, about 10 minutes, memory-only on the desktop.
- Tunnel protocol version is 1. Messages are `connection_ready`, `mcp_request`, `mcp_response`, and `error`.
- One Durable Object per `publicTunnelId`, WebSocket hibernation, no stored MCP bodies.
- A remote MCP session is scoped to the OAuth token that opened it. A second token that reuses the same `mcp-session-id` gets its own local server.
- Request timeout is 25 seconds. Offline desktops return JSON-RPC `DEVICE_OFFLINE` and do not queue work.

## Acceptance Criteria

- [ ] Flag off: no socket, no Remote MCP card, local `:3030` gateway unchanged.
- [ ] Flag on and user opt-in off: no socket.
- [ ] Opt-in connects outbound only and shows the public URL.
- [ ] `initialize`, `tools/list`, and a read-only `tools/call` hit `createLocalMcpServer` and return to the HTTP client.
- [ ] Missing token, wrong device token, and unknown routes never forward to a desktop.
- [ ] Offline and timeout return safe errors.
- [ ] Logs omit MCP arguments and results.
- [ ] Two devices and two MCP sessions do not share state.

## Non-Goals

- General-purpose TCP, HTTP, filesystem, shell, or SQL tunneling.
- Publishing the loopback OAuth issuer as the public authorization server.
- Syncing the SQLCipher database to Postgres or Cloudflare.
- Enabling the PostHog flag for all users.

## Open Questions

- If a ChatGPT connector build requires the authorization server host to equal the MCP host, proxy the existing OAuth routes through the Worker in a follow-up. Tokens stay device-scoped.

## Related Specs

- `specs/features/desktop-local-mcp-oauth/spec.md`
- `specs/complete/desktop-mcp-page/spec.md`

## Suggested Commit Message

```text
feat: adds desktop remote mcp tunnel
```
