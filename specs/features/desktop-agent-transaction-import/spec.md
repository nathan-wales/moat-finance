# Desktop Agent Transaction Import

## Status

Approved for implementation. Created August 25, 2026 after reviewing the local agent gateway, desktop CSV import IPC, MCP write tools, and cloud vs desktop MCP connection flows.

## Goal

Let a local agent or script upload transactions into the desktop SQLite vault over `127.0.0.1:3030` without a CSV file. JSON rows and an in-request column mapping (“mapping draft”) are enough.

Success means:

- An MCP client with `mcp:transactions:write` can preview and commit imports via `moat.previewTransactionImport` and `moat.commitTransactionImport`.
- The same payload works over REST `POST /import/transactions/preview` and `POST /import/transactions` on the local gateway.
- Commit is confirmation-gated and re-deduped; cloud MCP does not advertise these tools.

## Product Context

Desktop CSV import already exists for humans (Import page → map columns → preview → commit JSON rows). Local MCP already has write tools for updating and hiding transactions, but nothing can *create* rows. Agents that already hold a local token should be able to load statement-like data they parsed themselves.

This is local-only. Cloud MCP has no generic row-import service; hosted clients keep using Plaid/Apple/retail paths.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| CSV preview/commit | `packages/domain/src/imports/importTransactions.ts` | Preview parses CSV; commit already takes `NormalizedImportRow[]` |
| Column mapping | `packages/domain/src/imports/types.ts`, `packages/contracts/src/ipc/import.ts` | In-memory mapping only; no persisted draft |
| Desktop IPC | `apps/desktop/src/main/ipc/import.ts` | `import:previewCsv` / `import:commitCsv` — not reachable by agents |
| Local gateway | `apps/desktop/src/main/agent-gateway/index.ts` | `127.0.0.1:3030`; 404s everything except `/mcp` |
| Local write tools | `apps/desktop/src/main/agent-gateway/tools/financial-writes.ts` | Update/delete only |
| MCP contracts | `packages/mcp-contracts/src/tools.ts` | Cloud registry is `Record<McpToolName, …>` |
| Local tokens | `apps/desktop/src/main/agent-gateway/local-token-service.ts` | Already includes `mcp:transactions:write` |

Write access on local MCP already exists. The gap is create/import.

## Target Experience

Agent flow:

1. Call `moat.previewTransactionImport` with JSON rows or a mapping draft.
2. Review `newCount`, `duplicateCount`, `invalidCount`, and a small sample.
3. Call `moat.commitTransactionImport` with the same payload plus `confirmed: true` and `confirmedNewCount` equal to the live preview `newCount`.

Script flow (same auth as MCP):

```http
POST http://127.0.0.1:3030/import/transactions/preview
Authorization: Bearer moat_local_…
Content-Type: application/json
```

Then `POST /import/transactions` with `confirmed: true` and `confirmedNewCount`.

The desktop Import page shows this option on the CSV upload step, with the JSON example and a link to AI Access.

Optional: `POST /import/columns/detect` with `{ "headers": ["Date", "Amount", "Memo"] }`.

## Architecture / Data Model

No schema change. No persisted mapping drafts or ImportBatch.

Input is exactly one source:

1. **Normalized JSON rows** — `{ date, amount, type?, description?, category?, account? }[]`
2. **CSV text + mapping** — `{ csvText, mapping }`
3. **Mapping draft** — `{ mapping, rawRows, headers? }` where `rawRows` are keyed objects

Shared domain entry points:

- `previewTransactionImport(ctx, input)`
- `commitTransactionImport(ctx, input)` — re-runs preview, refuses on count mismatch, writes only new rows

Limits: 5,000 rows. Dedup signature stays `date|amount|description[0..40]`. Audit logs record counts only.

Cloud: mark tools desktop-only; exclude from `getToolsForClientProfile` and `getRegisteredTools`.

## Acceptance Criteria

- [ ] JSON rows import without CSV
- [ ] Mapping draft (`mapping` + `rawRows`) previews and commits
- [ ] `confirmedNewCount` mismatch does not write
- [ ] REST routes on `:3030` require bearer token + `mcp:transactions:write`
- [ ] Vault locked → 503; missing token → 401; missing write scope → 403; unknown path → 404
- [ ] Cloud MCP does not advertise or execute the import tools
- [ ] Desktop Import page IPC still works
- [ ] Import page notes that users can POST JSON themselves or have an agent post the same schema

## Non-Goals

- Local OAuth authorization server
- Persisted mapping drafts / ImportBatch
- Cloud generic bulk import API
- Unauthenticated localhost import
- Changing existing update/delete write tools

## Open Questions

None for v1. Local OAuth vs token remains a later product decision; Quick Connect is the current connection link.

## Related Specs

- [Desktop MCP page](../../complete/desktop-mcp-page/spec.md)
- [Phase 5 agent gateway](../../complete/desktop-electron-app/phase-5-agent-gateway.spec.md)

## Suggested Commit Message

```text
feat (desktop): adds local agent transaction import
```
