# MCP Financial Writes

## Status

Implemented 2026-07-15. Spec written from MCP tool contracts, disabled write stubs, OAuth registration policy, and API rule/transaction/budget handlers; implementation landed on branch `cursor/mcp-financial-writes-edd2`.

## Goal

Enable AI agents (via the Moat MCP server and desktop local agent gateway) to create/manage categorization rules, edit transactions, and adjust category budgets — with explicit write scopes, confirmation gates for destructive/historical actions, and PAT-first authorization.

Success means:

- A user with a PAT that grants `mcp:rules:write`, `mcp:transactions:write`, and/or `mcp:budget:write` can perform the corresponding mutations through MCP tools.
- OAuth dynamic clients remain read-only for financial writes (PAT or explicit local desktop tokens only).
- Historical rule application requires a matching preview confirmation count before mutating transactions.
- Scope labels and presets are available in web, desktop, and iOS token UIs.

## Product Context

MCP today is read-heavy: agents can inspect accounts, transactions, budgets, forecasts, and rules, but cannot act on the user’s request to “categorize this,” “make a Starbucks rule,” or “set Dining to $400.” Two write tools were previously stubbed and disabled pending write-scope re-enablement. Completing financial writes closes the most common assistant action loop without exposing bank linking, billing, or account admin.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Tool contracts | `packages/mcp-contracts/src/tools.ts` | `moat.createRule` / `moat.updateTransactionCategory` commented out |
| Schemas | `packages/mcp-contracts/src/schemas.ts` | Create-rule + category-update schemas already exist |
| Scopes | `packages/mcp-contracts/src/scopes.ts` | No rules/transactions/budget write scopes |
| Cloud MCP handlers | `apps/mcp/src/tools/{rules,transactions,spending-budget}.ts` | Stubs commented; budget write missing |
| Registry | `apps/mcp/src/tools/registry.ts` | Must register every new tool |
| Historical backfill | `apps/api/src/server/rules-engine/historicalBackfill.ts` | `previewBackfillCount` + `runHistoricalBackfill` |
| OAuth policy | `apps/mcp/src/hosts/registration-policy.ts` | Caps clients to `readScopes` |
| PAT create | `apps/api/src/server/handlers/mcp.ts` | Accepts any scope in `mcpScopes` |
| Scope UI | `packages/features/src/mcp/`, iOS catalog, desktop MCP page | Driven by contracts |
| Desktop local tools | `apps/desktop/src/main/agent-gateway/tools/` | Partial registry; needs write handlers |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Commented create-rule tool | `apps/mcp/src/tools/rules.ts` | Re-enable and extend |
| Commented category update | `apps/mcp/src/tools/transactions.ts` | Re-enable and extend |
| API budget upsert/delete | `apps/api/src/server/handlers/budget.ts` | Mirror ownership checks |
| AppRuntime repos (desktop) | `@moat/data-access` / `@moat/db-sqlite` | `rules.*`, `transactions.update`, `budgets.upsertCategoryBudget` |
| `schemaEnvelope` | `apps/mcp/src/tools/format.ts` | All tool responses |

## Target Experience

Agent loop (cloud MCP + PAT with financial write scopes):

1. `moat.searchTransactions` → find target txs
2. `moat.updateTransactionCategory` → recategorize one tx
3. `moat.applyRulesPreview` with proposed conditions → get match count
4. `moat.createRule` with `applyToHistorical: true` and `confirmedPreviewCount`
5. `moat.upsertCategoryBudget` → set monthly goal by category name or id

Destructive / high-impact tools require `confirmed: true` and/or preview confirmation.

## Architecture / Data Model

### New scopes

| Scope | Tools |
|-------|-------|
| `mcp:rules:write` | create/update/delete/toggle rule, apply historical |
| `mcp:transactions:write` | update category/fields/type/hashtags, delete |
| `mcp:budget:write` | upsert/delete category budget |

### New / re-enabled tools

| Tool | Safety class | Confirmation |
|------|--------------|--------------|
| `moat.createRule` | `mutates_app_data` | Yes when historical apply requested |
| `moat.updateRule` | `mutates_app_data` | Yes when historical apply requested |
| `moat.deleteRule` | `mutates_user_financial_data` | `confirmed: true` |
| `moat.toggleRule` | `mutates_app_data` | No |
| `moat.applyRuleHistorical` | `mutates_user_financial_data` | `confirmed: true` + matching preview count |
| `moat.updateTransactionCategory` | `mutates_user_financial_data` | Annotation yes |
| `moat.updateTransaction` | `mutates_user_financial_data` | Annotation yes |
| `moat.updateTransactionType` | `mutates_user_financial_data` | Annotation yes |
| `moat.setTransactionHashtags` | `mutates_user_financial_data` | Annotation yes |
| `moat.deleteTransaction` | `mutates_user_financial_data` | `confirmed: true` (soft-hide) |
| `moat.upsertCategoryBudget` | `mutates_user_financial_data` | Annotation yes |
| `moat.deleteCategoryBudget` | `mutates_user_financial_data` | `confirmed: true` |

### Auth policy

- **PAT / desktop local tokens:** may grant financial write scopes.
- **OAuth DCR (hosted + loopback):** remains `readScopes` only for v1.
- New preset: `financial-assistant` = all read scopes + three financial write scopes + `mcp:feedback:write`.

### Historical apply gate

1. Rule must exist (create/update first, or pass `ruleId`).
2. Server runs `previewBackfillCount`.
3. If `confirmedPreviewCount !== actualCount`, do not mutate; return mismatch payload with `actualPreviewCount`.
4. On match, run `runHistoricalBackfill` and return affected count (no raw tx descriptions in logs).

## Implementation Plan

### Phase 1 — Contracts + scopes
1. Add write scopes, labels, `writeScopes`, `financial-assistant` preset.
2. Add schemas for all new tools; tighten create-rule historical confirmation.
3. Uncomment/register all tool contracts.

### Phase 2 — Cloud MCP handlers
1. Re-enable and harden rule/transaction tools.
2. Add budget upsert/delete.
3. Wire registry + server instructions + pattern docs.

### Phase 3 — Token UIs
1. iOS `mcp-scope-catalog.swift` mirrors new scopes/preset.
2. Desktop available/local agent scopes include financial writes.
3. Web PAT UI picks up contracts automatically via `@moat/mcp-contracts`.

### Phase 4 — Desktop local agent parity
1. Implement write tools against AppRuntime repositories.
2. Historical apply uses evaluate + update path (no Postgres backfill engine).

### Phase 5 — Verification
1. Lint + typecheck mcp-contracts, mcp, desktop, features.
2. Add focused unit tests for historical confirmation mismatch and scope helpers.

**Acceptance criteria:** see below.

## Acceptance Criteria

- [x] `mcp:rules:write`, `mcp:transactions:write`, `mcp:budget:write` exist in `mcpScopes` / `writeScopes` / labels
- [x] All listed write tools are registered in cloud MCP and callable with the correct scope
- [x] Historical apply refuses mismatched `confirmedPreviewCount`
- [x] Transaction delete soft-hides (`hidden: true`), matching API
- [x] Budget upsert accepts `categoryId` or `categoryName`
- [x] OAuth registration still cannot request financial write scopes
- [x] Web/desktop/iOS scope UIs expose the new scopes and `financial-assistant` preset
- [x] Desktop local gateway registers the same write tools
- [x] No PII (emails, account numbers, raw tokens) in audit logs or tool error messages beyond existing redaction posture

## Non-Goals

- Exposing Plaid link/disconnect, billing, household admin, or account deletion via MCP
- Bulk delete / bulk type update via MCP
- Transaction split/unsplit via MCP (deferred)
- Granting financial write scopes to hosted OAuth clients
- Forecast scenario CRUD, investment/real-estate CRUD, category CRUD as first-class MCP tools

## Open Questions

- None for v1 — OAuth stays read-only; PAT/desktop tokens are the write path.

## Related Specs

- MCP gateway patterns: `apps/mcp/AGENTS.md`, `docs/patterns/mcp-tools.md`
- Desktop local agent: `apps/desktop/docs/patterns/local-agent-gateway.md` (if present)

## Suggested Commit Message

```text
feat (mcp): enable financial write tools
```
