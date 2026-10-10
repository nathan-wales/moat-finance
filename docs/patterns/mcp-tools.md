# Pattern: MCP Tools

## Overview

MCP tools in `apps/mcp` expose Moat Finance financial data to LLMs (Claude, Cursor, ChatGPT, etc.). Every tool is registered in a central registry, scoped for authorization, and automatically audit-logged. The tool surface is intentionally curated — no admin, raw SQL, shell, or broad passthrough tools.

---

## Tool registry

All tools are registered in `apps/mcp/src/tools/registry.ts`. Contracts (name, description, Zod input/output schemas, scopes) live in `packages/mcp-contracts`. The registry wires handlers to those contracts.

When adding a new tool, always register it here — never wire it outside the registry.

---

## Input / output schemas

- Every tool must declare Zod `inputSchema` and `outputSchema` on its contract in `packages/mcp-contracts`.
- Handlers return `schemaEnvelope(kind, data)` objects. Cloud and desktop gateways must set both text `content` and object `structuredContent` so clients can validate against `outputSchema`.
- Descriptions must name real argument keys and defaults. Do not mention filters that are not in the schema.
- **ZodEffects pitfall:** `.refine()` / `.superRefine()` wrap object schemas so the MCP SDK advertises an empty `inputSchema`. Register tools with `getAdvertisedInputSchema(contract.inputSchema)` (unwrapped object) while keeping the full refined schema for runtime `.parse()`.

---

## Adding a new tool

1. **Add the handler** in `apps/mcp/src/tools/[domain].ts` — keep it thin, focused on data retrieval and formatting.
2. **Add the contract** in `packages/mcp-contracts` (input schema, output schema, description naming real args, scopes).
3. **Register it** in `registry.ts` with the contract and handler.
4. **Audit logging** is handled automatically by the wrapper in `mcp-server.ts` / `executeMcpTool` — don't call `log-tool-call.ts` manually.
5. **Format output** using helpers from `tools/format.ts` — normalize amounts, dates, and labels consistently.

---

## What tools should NOT expose

- Admin operations (user management)
- Raw SQL or database schema
- Shell or file system access
- Arbitrary REST passthrough
- PII: email, account numbers, routing numbers, raw transaction descriptions beyond minimal context
- Credentials, tokens, or secrets

---

## Scope model

Scopes are defined in `packages/mcp-contracts/src/scopes.ts`. Current write scopes:

| Scope | Allows |
|-------|--------|
| `mcp:memories:write` | Save memories |
| `mcp:reports:write` | Create / update / share reports |
| `mcp:feedback:write` | Submit feedback |
| `mcp:rules:write` | Create / update / delete / enable transaction rules; apply to past transactions |
| `mcp:transactions:write` | Update category/type/fields/hashtags; hide transaction; **desktop-only** JSON/CSV import (`moat.previewTransactionImport`, `moat.commitTransactionImport`) |
| `mcp:budget:write` | Set / delete category budgets |
| `mcp:community-tips:read` | List / get community tips |
| `mcp:community-tips:write` | Create / update community tips |

OAuth grants `mcpScopes` except ChatGPT Apps v1 (`readScopes` only). PAT and desktop local agent tokens are unchanged.

Check `scope-checker.ts` for enforcement logic.

---

## Financial write safety

- Historical rule application requires `confirmedPreviewCount` matching the live preview count.
- Desktop transaction import requires `confirmed: true` and `confirmedNewCount` matching the live preview `newCount`.
- Destructive tools require `confirmed: true` in the tool input schema.
- `requiresConfirmation` / `destructiveHint` annotations help hosts show approval UI; the gateway still enforces schema-level gates.

---

## Anti-patterns

- **Don't add a tool without a scope.** Every tool must declare a required scope in the registry.
- **Don't add a tool without `outputSchema`.** Clients rely on structured results for validation and typing.
- **Don't return raw Prisma models.** Always select and normalize only the fields the LLM needs.
- **Don't skip formatting helpers.** Consistent amount/date formatting makes LLM responses predictable.
- **Don't expose write tools without careful review.** Write tools can modify user data — they require explicit scope and testing.
- **Don't register refined ZodEffects schemas directly for advertising.** Use `getAdvertisedInputSchema` so `tools/list` exposes real parameters.
