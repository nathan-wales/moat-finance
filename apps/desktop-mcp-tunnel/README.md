# Desktop MCP tunnel

Cloudflare Worker that terminates MCP HTTP for a desktop device, checks a device-scoped OAuth token, and bridges JSON-RPC over an outbound WebSocket. Tool execution and the SQLCipher database stay in the Electron app.

## Local

```bash
pnpm --filter @moat/desktop-mcp-tunnel run dev
```

Set `TUNNEL_INTROSPECT_SECRET` in `.dev.vars` (same value as the API) and `DESKTOP_TUNNEL_JWT_PUBLIC_KEY` to the SPKI public key for `DESKTOP_TUNNEL_JWT_PRIVATE_KEY`.

Desktop dev connects with `REMOTE_MCP_TUNNEL_URL=ws://localhost:8787/connect`.

## Production

1. Deploy the API migration before this Worker.
2. `pnpm --filter @moat/desktop-mcp-tunnel exec wrangler login`
3. `pnpm --filter @moat/desktop-mcp-tunnel exec wrangler whoami`
4. `pnpm --filter @moat/desktop-mcp-tunnel exec wrangler secret put TUNNEL_INTROSPECT_SECRET --env production`
5. Set `DESKTOP_TUNNEL_JWT_PUBLIC_KEY` on the production env (`wrangler secret` is unnecessary; it is a public key var).
6. `pnpm --filter @moat/desktop-mcp-tunnel run deploy`

`tunnel.moatfinance.ai` is a custom domain when the zone is on the same Cloudflare account. Wrangler does not hardcode an account or zone id. If the zone is elsewhere, add a proxied CNAME from `tunnel` to the `workers.dev` hostname printed by deploy.
