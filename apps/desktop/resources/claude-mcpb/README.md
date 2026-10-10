# Claude Desktop MCPB assets

`server/proxy.cjs` is a bundled stdio → Streamable HTTP bridge used when generating
`moat-finance-local.mcpb` from the desktop app.

Rebuild after changing the proxy source:

```bash
pnpm --filter moat-desktop run build:claude-mcp-proxy
```
