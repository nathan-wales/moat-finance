# Agent CSV Import (Templates + filePath)

## Status

Approved for implementation. Created September 8, 2026 after reviewing desktop agent import, shared CSV wizard, localStorage mapping templates, and MCP preview/commit tools.

## Goal

Let a local agent map CSV headers itself, then preview and commit using `csvText` or a desktop `filePath`, reusing the same persisted mapping templates as the human wizard. Warn when no Category column is mapped.

Success means:

- Agents send **required** column mapping or `templateId` with the file; no detect-columns MCP tool.
- Desktop MCP can pass `filePath` (main process reads the CSV). Web HTTP rejects `filePath`.
- Mapping templates persist per user in Postgres and SQLite and are shared by the wizard and desktop MCP.
- Preview (API, MCP, wizard) warns when the Category column is unmapped.

## Product Context

Agents can already preview/commit with `csvText` + `mapping`. Humans save templates in `localStorage`, which agents cannot see. Category is optional in the mapper, so unattended imports often land uncategorized. This work makes mapping a first-class, shareable record and tells both humans and agents to put categories in the CSV before upload.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Preview/commit domain | `packages/domain/src/imports/importTransactions.ts` | Requires `csvText`+`mapping`, `rawRows`+`mapping`, or JSON `rows` |
| Column mapping schema | `packages/contracts/src/transaction-import.ts` | No `templateId` or `filePath` |
| Wizard templates | `packages/features/src/import/mapping-templates.ts` | `localStorage` key `moat-import-mapping-templates` |
| Wizard UI | `packages/features/src/import/import-page.tsx`, `import-wizard-steps.tsx` | Map step has Category optional |
| Desktop MCP import | `apps/desktop/src/main/agent-gateway/tools/import.ts` | `csvText` only |
| Cloud MCP | `packages/mcp-contracts/src/tools.ts` `desktopOnlyMcpToolNames` | Import tools excluded |
| Category match | `commitCsvImport` | Exact case-insensitive category **name** |

### Existing building blocks to reuse

| Need | Reuse |
|------|--------|
| Preview/commit | `previewTransactionImport` / `commitTransactionImport` |
| CRUD repo shape | `MemoryRepository` |
| RLS on new Postgres table | `AccountBalanceHistory` migration policy pattern |
| SQLite table create | `packages/db-sqlite/src/migrations.ts` `CREATE TABLE IF NOT EXISTS` |
| Handler wrappers | `withAuthNoDemo` |
| MCP desktop-only | `desktopOnlyMcpToolNames` |

## Target Experience

### Agent

1. Read the CSV header row (and a few sample rows).
2. `moat.listImportTemplates` — reuse `templateId` if headers match.
3. Else build `{ date, amount, description, type?, category? }`.
4. `moat.previewTransactionImport` with `mapping` or `templateId` plus `csvText` **or** desktop `filePath`.
5. If `uncategorizedWarning` is set, categorize in the CSV or map a Category column, then preview again.
6. `moat.commitTransactionImport` with the same source, `confirmed: true`, `confirmedNewCount`.
7. Optionally `moat.createImportTemplate` after a good preview.

### Wizard warning copy

> These transactions will be uncategorized. Map a Category column, or categorize them in the CSV before uploading.

Show on the mapping step when Category is `(none)`, and again on preview when the request had no category column and `newCount` is greater than 0.

## Architecture / Data Model

```text
Agent / wizard
  → mapping | templateId
  → csvText | (desktop) filePath → csvText
  → previewTransactionImport / commitTransactionImport
```

`ImportMappingTemplate`: `id`, `userId`, `name`, `isDefault`, `accountId`, `mapping` JSON (`date`, `description`, `amount`, `type?`, `category?`), timestamps. One default per user.

CSV sources require XOR of `mapping` and `templateId`. Request `accountId` overrides the template account. Domain never receives `filePath`.

Preview response adds `categoryColumnMapped` and `uncategorizedWarning` (string or null).

## Implementation Plan

### Phase 1 — Spec (this file)

### Phase 2 — Schema + repos + domain CRUD

### Phase 3 — HTTP, OpenAPI, IPC, MCP template tools

### Phase 4 — `templateId`, desktop `filePath`, preview warnings

### Phase 5 — Wizard API templates + UI warning

## Acceptance Criteria

- [ ] Agents must pass `mapping` or `templateId` with CSV/`filePath`/`rawRows`.
- [ ] Desktop MCP `filePath` reads a `.csv` under the size cap; missing/oversize/non-csv fail clearly.
- [ ] Web `previewImport`/`commitImport` reject `filePath` with `FILE_PATH_NOT_SUPPORTED`.
- [ ] Templates persist on web (Postgres) and desktop (SQLite); wizard no longer depends on `localStorage` after one-time migrate.
- [ ] Preview warning when Category column is unmapped (UI + MCP/API).
- [ ] Cloud MCP does not advertise import or template tools.
- [ ] No multipart upload; no new detect-columns MCP tool.

## Non-Goals

- Multipart / HTTP file upload
- Cloud MCP import or template tools
- Category-value synonym maps
- Applying rules on desktop MCP commit
- Changing 5k / 2MB caps

## Open Questions

None. Product copy and `filePath` vs multipart were decided in planning.

## Related Specs

- [Desktop agent transaction import](../desktop-agent-transaction-import/spec.md)
- [Shared CSV transaction import](../shared-csv-transaction-import/spec.md)

## Suggested Commit Message

```text
feat: persists csv import mapping templates
```
