# Pattern: Transports (apps/mcp)

## Two transports, one server

The MCP server (`src/server.ts`) supports two transports that share the same tool registry and auth layer:

| Transport | File | Use case | Hosted |
|-----------|------|----------|--------|
| HTTP/SSE | `src/transports/http.ts` | Remote clients (Claude.ai, ChatGPT, custom apps) | Vercel |
| stdio | `src/transports/stdio.ts` | Local clients (Claude Desktop, Cursor, local dev) | Local process |

The transport is selected at startup based on the `MCP_TRANSPORT` environment variable (or a command-line flag).

---

## HTTP transport (Vercel)

`src/transports/http.ts` implements the MCP HTTP+SSE transport:

- Runs as a Vercel serverless function (`api/[[...path]].ts`).
- `vercel.json` rewrites `/(.*)` → `/api/$1`; Express strips the `/api` prefix so public paths (`/mcp`, `/.well-known/...`) match.
- Unauthenticated `/mcp` returns **HTTP 401** with `WWW-Authenticate: Bearer resource_metadata=...` (never 403/200 for missing auth).
- OAuth discovery: `/.well-known/oauth-protected-resource` (+ `/mcp`) and `/.well-known/oauth-authorization-server` (+ `/mcp`).
- Auth is extracted from the `Authorization: Bearer <token>` header on each request.
- Rate limiting is applied via Upstash Redis (`src/rate-limit/rate-limit.ts`) per `userId`.
- CORS allows browser MCP hosts and exposes `WWW-Authenticate`.

### Vercel config

`vercel.json` routes all public paths to the catch-all API function while preserving the path:

```json
{ "source": "/(.*)", "destination": "/api/$1" }
```

- `MCP_TRANSPORT=http` selects the HTTP transport
- Rate limit thresholds are tunable via Vercel Edge Config (no redeploy needed)

### Rate limiting

Rate limiting uses Upstash Redis with a sliding window algorithm. The limit is per `userId` (resolved after auth). If a userId can't be resolved, the request is rejected before counting.

```ts
// Rate limit check pattern
const identifier = `mcp:${userId}`;
const { success } = await ratelimit.limit(identifier);
if (!success) throw new McpRateLimitError();
```

---

## stdio transport (local dev)

`src/transports/stdio.ts` implements the MCP stdio transport for local process communication:

- Auth is provided via the `MOAT_MCP_TOKEN` environment variable (a PAT with required scopes).
- The `MOAT_MCP_CLIENT_PROFILE` env var sets the client identity for audit logs.
- Stdio transport does not apply rate limiting (it's a local process owned by the user).

### Running locally

```bash
# Set a valid PAT before starting
MOAT_MCP_TOKEN=moat_dev_<your-pat> MOAT_MCP_CLIENT_PROFILE=local-dev \
  pnpm --filter @moat/mcp run dev:stdio
```

Point Claude Desktop or Cursor at this stdio process using their MCP configuration files.

---

## Local dev with HTTP transport

```bash
pnpm --filter @moat/mcp run dev:http
```

This starts a local HTTP server. Configure Claude Desktop or other clients to point at `http://localhost:<port>/mcp` with a valid PAT.

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Changing rate limit thresholds | This file (Rate limiting section) |
| Adding a new transport or protocol | This file + `src/transports/` source |
| Debugging auth failures | [auth-and-scopes.md](auth-and-scopes.md) |
| Testing tools end-to-end | [testing.md](testing.md) |
