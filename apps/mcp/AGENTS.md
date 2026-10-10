# apps/mcp — Agent Overlay

> **Baseline**: Read [CLAUDE.md](../../CLAUDE.md) first. This file adds MCP-specific context on top of it.

---

## Purpose

`apps/mcp` is the secure remote MCP (Model Context Protocol) gateway that exposes Moat Finance financial data to LLMs like Claude. It supports both HTTP (self-hosted Docker service or serverless, for remote clients) and stdio (local, for desktop clients like Claude Desktop and Cursor) transports.

---

## Commands

| Task | Command (from repo root) |
|------|--------------------------|
| Dev (HTTP transport) | `pnpm --filter @moat/mcp run dev:http` |
| Dev (stdio transport) | `MOAT_MCP_TOKEN=moat_dev_... MOAT_MCP_CLIENT_PROFILE=local-dev pnpm --filter @moat/mcp run dev:stdio` |
| Build | `pnpm --filter @moat/mcp run build` |
| Typecheck | `pnpm --filter @moat/mcp run typecheck` |
| Lint | `pnpm --filter @moat/mcp run check` |

---

## Code structure

```
apps/mcp/src/
├── server.ts              ← Entry point (chooses HTTP or stdio transport)
├── mcp-server.ts          ← MCP server setup and tool registration
├── tools/
│   ├── registry.ts        ← All tools registered here
│   ├── accounts.ts
│   ├── transactions.ts
│   ├── forecast.ts
│   ├── rules.ts
│   ├── spending-budget.ts
│   ├── format.ts          ← Response formatting helpers
│   └── types.ts
├── auth/
│   ├── pat-service.ts     ← Personal Access Token (PAT) issuance + verification
│   ├── oauth-service.ts   ← OAuth 2.0 + PKCE flow
│   ├── scope-checker.ts   ← Per-tool scope enforcement
│   ├── verify-token.ts    ← Token verification entry point
│   └── resolve-household-identity.ts
├── transports/
│   ├── http.ts            ← HTTP/SSE transport (Vercel)
│   └── stdio.ts           ← Stdio transport (local)
├── audit/
│   └── log-tool-call.ts   ← Audit log every tool invocation
├── rate-limit/
│   └── rate-limit.ts      ← Upstash Redis rate limiting
└── lib/
    ├── db.ts              ← Prisma client instance
    └── logger.ts          ← Structured logger (Axiom)
```

---

## Architecture

### Tool invocation lifecycle

```
LLM client calls tool
  → transport (http.ts / stdio.ts) receives request
    → verify-token.ts (PAT or OAuth access token)
      → scope-checker.ts (does token have required scope for this tool?)
        → tool handler (accounts.ts, transactions.ts, etc.)
          → Prisma query (read from DB)
            → format.ts (normalize response)
              → audit log (log-tool-call.ts)
```

### Auth model

Two token types:
- **PAT** (`moat_dev_*` prefix) — personal access tokens from account settings. Peppered-hashed in DB. Revocable, scoped, tracked with `lastUsedAt`.
- **OAuth** — dynamic client registration with PKCE. Supports Claude Desktop, Cursor, ChatGPT, Gemini, and custom consumer apps. Clients registered in `McpOAuthClient`.

### Scope enforcement

Every tool invocation goes through `scope-checker.ts`. Never add a tool without defining its required scope in the registry.

---

## Anti-patterns

- **Never expose PII directly in tool responses.** Return counts, amounts, dates, enums — not email addresses, account numbers, routing numbers, or raw transaction descriptions beyond what LLMs need.
- **Never skip `scope-checker.ts`.** Token scope enforcement is not optional. Gate every new tool.
- **Never add tools without audit logging.** The audit wrapper in `mcp-server.ts` covers registered tools automatically; don't bypass it.
- **Don't add tools without `outputSchema` + `structuredContent`.** Contracts define Zod output schemas; gateways must return conforming structured results.
- **Don't register refined ZodEffects input schemas for advertising.** Use `getAdvertisedInputSchema` so clients see real parameters.
- **Don't add broad "passthrough" tools** (generic REST fetch, arbitrary SQL queries, shell execution). The tool surface is intentionally curated.
- **Don't run `prisma migrate` from this app.** Schema ownership is in `apps/api`. The MCP app connects to the same DB as a read-heavy consumer.

---

## Change-type routing table

| When you are doing X… | Read |
|-----------------------|------|
| Adding a new MCP tool end-to-end | [docs/patterns/tool-lifecycle.md](docs/patterns/tool-lifecycle.md) |
| Adding or modifying auth scopes | [docs/patterns/auth-and-scopes.md](docs/patterns/auth-and-scopes.md) |
| Changing transport config (HTTP/stdio) | [docs/patterns/transports.md](docs/patterns/transports.md) |
| Configuring rate limiting or Vercel edge | [docs/patterns/transports.md](docs/patterns/transports.md) |
| Writing tests for tools or auth | [docs/patterns/testing.md](docs/patterns/testing.md) |
| Understanding PAT vs OAuth token flow | [docs/patterns/auth-and-scopes.md](docs/patterns/auth-and-scopes.md) |
| Global MCP tool conventions | [../../docs/patterns/mcp-tools.md](../../docs/patterns/mcp-tools.md) |

## Testing matrix

| Change type | Test approach |
|-------------|---------------|
| Tool handler | `node:test` with a mocked ToolContext |
| Scope enforcement | Unit test on scope-checker |
| Full tool invocation | Local stdio loop |

See [docs/patterns/testing.md](docs/patterns/testing.md) for examples.

