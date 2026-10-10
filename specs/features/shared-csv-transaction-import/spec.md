# Shared CSV Transaction Import (Web + Desktop)

## Status

Draft. Created August 25, 2026 after reviewing desktop CSV import, the local agent import gateway, fingerprint dedupe used by Plaid/MX/FinanceKit, the shared `TransactionsPage` header slot, and the `@moat/features` extraction pattern.

## Goal

Ship the same human CSV import wizard on web that desktop already has in the transactions header, with production-quality persist, dedupe, account assignment, and rule application. Put the wizard UI in `@moat/features` and the parse / preview / commit logic in `@moat/domain` so web (HTTP) and desktop (IPC) share one implementation.

Success means:

- A signed-in web user can import a bank CSV from the transactions page (top-right icon and empty-state action) without connecting Plaid.
- Desktop’s existing `/import` flow uses the same wizard and the same domain commit path. Behavior does not regress.
- Preview and commit use `createTransactionDedupeFingerprint` (not the current `date|amount|description[0..40]` string), persist that fingerprint on every imported row, and skip rows that already exist for that user + account.
- Imported rows are assigned to a chosen account when the user picks one, capped at 5,000 rows, and run through the same categorization rules that fire after Plaid / Apple Wallet import.
- The desktop-only localhost POST (`127.0.0.1:3030/import/transactions`) is **not** moved into the shared UI package in this work. It already calls the same domain functions, so fingerprint / limit / confirmation upgrades apply automatically. A later change can feed agent previews into this wizard.

## Product Context

Moat’s free path is “import transactions or add accounts by hand” (`apps/marketing/index.html`). Bank sync is the paid convenience. Web currently only offers Plaid / Financial Connections / Apple Wallet for bringing transactions in. Desktop already has a four-step CSV wizard, but it is renderer-local, talks to IPC, and uses a weaker dedupe than provider sync.

CSV import is the job: “I have a statement file; I want those rows in Moat, attached to the right account, categorized by my rules, without duplicates if I re-import or if those rows already arrived via Plaid.”

This is also the human counterpart of [desktop agent transaction import](../desktop-agent-transaction-import/spec.md). Agents POST JSON to the local gateway. Humans upload a CSV and review it. Both should eventually share fingerprinting, row limits, confirmation, and (later) the same review UI. This spec shares the first three now and the human wizard across web + desktop. It does **not** share the POST-to-localhost chrome.

## Current Repo Context

### What already works

| Asset | Location | Notes |
|-------|----------|-------|
| Human CSV wizard | `apps/desktop/src/renderer/src/pages/import.tsx` | Upload → map columns → preview table → commit. Client-side header sniff. Calls IPC. **No account picker.** |
| Header button | `apps/desktop/src/renderer/src/pages/transactions/index.tsx` | Ghost `FileUp` icon, `nav.push("/import")`, passed as `headerActions` |
| Empty-state CSV action | same file, `TransactionsEmptyActions` | “Import CSV” next to connect-bank |
| Shared transactions page | `packages/features/src/transactions/page.tsx` | Already accepts `headerActions` and `emptyStateAction`. Web does not pass either. |
| Web transactions route | `apps/web/src/app/(dashboard)/transactions/page.tsx` | Thin wrapper around `TransactionsPage` |
| Domain import | `packages/domain/src/imports/importTransactions.ts` | `previewTransactionImport` / `commitTransactionImport` / `previewCsvImport` / `commitCsvImport`. 5,000-row cap. Confirmation via `confirmedNewCount`. |
| CSV parse / normalize | `packages/domain/src/imports/parseCsv.ts`, `normalizeTransaction.ts` | Header mapping, date/amount parse, `importRowSignature` |
| IPC | `apps/desktop/src/main/ipc/import.ts` | Still calls **legacy** `previewCsvImport` + `commitCsvImport` (commit trusts client-sent rows, does not re-preview) |
| Agent HTTP + MCP | `apps/desktop/src/main/agent-gateway/import-http.ts`, MCP tools in `packages/mcp-contracts` | Already uses `previewTransactionImport` / `commitTransactionImport`. Body cap 2MB. Desktop-only. |
| Agent note UI | `apps/desktop/src/renderer/src/pages/import-agent-note.tsx` | Explains `POST http://127.0.0.1:<port>/import/transactions`. **Stay desktop-only.** |
| Fingerprint helper | `packages/financial-data-providers/src/core/dedupe.ts` → `createTransactionDedupeFingerprint` | Used by Plaid, MX, Finicity, Apple FinanceKit. **Not used by CSV import today.** |
| Postgres `dedupeFingerprint` | `apps/api/prisma/schema.prisma` `Transaction` | Column exists. CSV `createMany` does not set it. |
| SQLite `Transaction` | `packages/db-sqlite/prisma/schema.prisma` | **No `dedupeFingerprint` column.** Source is a free-form string (`manual` / `PLAID` / `import`). |
| Postgres `createMany` | `packages/db-postgres/src/repositories/PostgresTransactionRepository.ts` | Maps `accountId` → `plaidAccountId`. Default `source: "CSV"`. Ignores `"import"` if passed (Prisma enum would reject it). |
| Domain commit source | `commitCsvImport` writes `source: "import"` | Breaks on Postgres unless mapped to `CSV`. |
| Account list (shared client) | `MoatApiClient.listAccounts()` | Desktop: local `Account` rows. Web: Plaid accounts via `listPlaidItems` (`apps/web/src/lib/http-api-client.ts`). |
| Rules after provider sync | `apps/api/src/server/services/transaction-rules-on-import.service.ts` | `applyRulesToSyncedTransactions(userId, externalTransactionIds)` — **looks up by `externalTransactionId`**, which CSV rows do not have. |
| Domain rules | `packages/domain/src/rules/applyRules.ts` | Single-tx evaluate via `repositories.rules`. Desktop historical apply lives in `apps/desktop/src/main/services/rules-apply.ts`. |
| API AppContext | `apps/api/src/server/createApiAppContext.ts` | Already used by budget / spending / retirement handlers to call `@moat/domain`. |
| API router | `apps/api/pages/api/v1/[router]/[action].ts` | Dynamic `handlers[router][action]`. Body parser `sizeLimit: "25mb"` locally; Vercel still caps ~4.5MB. |
| OpenAPI + client | `packages/openapi/api-v1.yaml`, Orval → `packages/client-ts` | No import endpoints. Add paths, run `pnpm --filter @moat/openapi run generate`. |
| Features API client | `packages/features/src/api-client-context.tsx` | Wizard must call `useApiClient()`, not `@moat/client-ts` directly, so desktop IPC client works. |
| Desktop Vite aliases | `apps/desktop/electron.vite.config.ts` | **Must add `@moat/features/import`** or the renderer fails at runtime even if typecheck passes. See `apps/desktop/AGENTS.md`. |
| Import contracts | `packages/contracts/src/ipc/import.ts`, `packages/mcp-contracts/src/schemas.ts` | MCP schemas are the richer source (`rows` / `csvText+mapping` / `rawRows+mapping`, `confirmedNewCount`). IPC schemas are CSV-only. |
| Row cap | `MAX_TRANSACTION_IMPORT_ROWS = 5000` in domain + mcp-contracts | Keep. Surface in the wizard when exceeded. |
| Preview sample | `IMPORT_PREVIEW_SAMPLE_SIZE = 10` | Agent HTTP returns 10. Human wizard today renders up to 100 rows from the full `rows` array. |

### Known problems to fix as part of this work

1. **Dedupe is not fingerprint-based.** `existingSignatures()` loads up to 10,000 recent transactions and compares `YYYY-MM-DD|amount|description[0..40]`. Misses older history, ignores account, and does not match Plaid/FinanceKit fingerprints.
2. **`source: "import"` is invalid on Postgres** (`TransactionSource` is `CSV \| PLAID \| MX \| FINICITY \| MANUAL \| APPLE_FINANCEKIT`).
3. **Desktop human commit is stale-row based.** IPC `commitCsv` writes the previewed row list without re-running preview. Agent commit already re-previews. The shared wizard must use the agent-style confirm path.
4. **No account assignment in the wizard**, and Postgres `createMany` only knows `plaidAccountId`.
5. **Rules do not run** on CSV insert on either platform.
6. **Wizard UI is not shared.** Web would otherwise copy 370 lines of desktop JSX.
7. **SQLite cannot store fingerprints** until a column is added.

### Building blocks to reuse (do not reinvent)

| Need | Reuse |
|------|--------|
| Parse / map / normalize | `@moat/domain` `parseCsv`, `autoDetectColumns`, `normalizeTransaction`, `resolveImportRows` |
| Preview + confirm commit | `previewTransactionImport`, `commitTransactionImport` (extend; do not add a third commit path) |
| Fingerprint algorithm | `createTransactionDedupeFingerprint` / `createAccountFingerprint` from `@moat/financial-data-providers` |
| Account dropdown data | `client.listAccounts()` already used by transaction filters |
| Rules (web) | Extend `applyRulesToSyncedTransactions` to accept internal ids (new sibling function) |
| Rules (desktop) | `apps/desktop/src/main/services/rules-apply.ts` after insert |
| UI primitives | `@moat/ui` Button, Select, Card, Table, Badge, Label |
| Navigation | `useMoatNavigation().push("/import")` |
| Handler wrappers | `withAuth` for preview + commit (writes / PII-adjacent CSV). Not demo. |
| Analytics | `transaction_import_completed` with counts/booleans only — [AGENTS.md](../../../AGENTS.md) |

## Target Experience

### Entry points (both platforms)

1. **Transactions header (desktop md+):** ghost icon button, tooltip **Import transactions**, `aria-label` **Import transactions**, `FileUp` icon. Top-right of the shared page header.
2. **Transactions header (mobile):** same control, already rendered below the title when `headerActions` is set (`packages/features/src/transactions/page.tsx`).
3. **Empty state:** two actions — **Connect your bank account** (primary) and **Import CSV** (ghost). Copy stays “Link a bank account to import transactions…” for the connect path; the extra button is the CSV escape hatch.

Both hosts pass the shared button / empty actions into `TransactionsPage`. Route is `/import` on both (desktop already maps it; web adds `apps/web/src/app/(dashboard)/import/page.tsx`).

### Wizard steps

Shared copy and layout. Desktop may render an extra card **after** the upload step (agent POST note). Web does not.

```text
← Back
Import Transactions
Don’t want to worry about importing? Connect your bank account directly
so transactions sync in the background.

[ Step card  ]
```

#### Step 1 — Upload CSV

- Dashed drop zone: **Click to select a CSV file** (`accept=".csv"`).
- On select, read as text in the browser, sniff headers, auto-map columns with the same heuristics desktop uses today (`date`, `description|memo|name|payee`, `amount|sum|value`, optional `type`, `category`).
- If the file is empty, not parseable as CSV, or has no header row: inline error **Couldn’t read that file. Export a CSV from your bank and try again.** Stay on step 1.
- If parsed row count (pre-normalize) exceeds 5,000: inline error **This file has more than 5,000 rows. Split it and import again.** Do not advance.
- Desktop only, below the upload card: existing `ImportAgentNote` (localhost POST + MCP tools). Not part of `@moat/features/import`.

#### Step 2 — Map columns + account

Required selects: **Date ***, **Description ***, **Amount ***. Optional: **Type**, **Category**.

New required-when-accounts-exist control:

- Label: **Account**
- Options: **Unassigned**, then `listAccounts()` rows that are `isActive && !isHidden`, formatted `{name}` plus mask when present (`Chase Checking · 1234`).
- Helper: **Assign these rows to an account so they show up in filters and don’t duplicate bank sync.**
- If the user has zero accounts: default **Unassigned**, helper **No accounts yet. You can still import, or connect a bank / add a manual account in Financial Profile.** Link: `nav.push("/financial-profile?highlight=accounts")`.
- Account is **not** required. Unassigned imports are valid (free-path users may have no linked bank).

Disabled **Preview Import →** until date, description, and amount are mapped.

#### Step 3 — Preview

Badges: `{n} new`, and if `duplicateCount > 0` `{n} duplicates (will be skipped)`, and if `invalidCount > 0` `{n} invalid rows skipped`.

Table columns: Date, Description, Amount, Type, Account (chosen account name or **Unassigned**). Show `sample` (up to 100). If `newCount > sample.length`, footer **…and {n} more rows**.

Primary: **Import {newCount} Transactions**. Disabled when `newCount === 0` or pending.

Errors:

- Preview failure: **Failed to parse CSV. Check your column mapping.**
- Commit `confirmation_mismatch` (409): **This file changed since preview. Review again.** Return to a fresh preview.
- Commit generic: **Import failed. Please try again.**

#### Step 4 — Done

Check icon. **Import Complete.** `{imported} transactions imported.` If skipped/duplicates: `{n} duplicates were skipped.` If rules applied (imported > 0): **Existing rules were applied to new rows.** Button: **Import Another File**. Secondary text button: **View transactions** → `/transactions`.

### States

| State | Behavior |
|-------|----------|
| Demo / signed-out (web) | Hide header import button. Empty state only offers connect-bank / sign-in. API `withAuth` returns 401. |
| Vault locked (desktop) | Existing vault gate on IPC; wizard is unreachable until unlock. |
| No file | Step 1 |
| Mapping incomplete | Preview disabled |
| Preview pending | Button **Previewing…** |
| Commit pending | Button **Importing…**, controls disabled |
| All duplicates | Preview shown, import disabled, explain skipped |
| Over row limit | Stop on step 1 |

### Analytics

`transaction_import_completed` with `{ imported, skipped, duplicateCount, invalidCount, hadAccount, success }` plus identity (`userId` **or** `demoUser`, never both). No descriptions, merchant names, or file names. Desktop may keep `desktop_import_completed` as an additional event for one release, then standardise on `transaction_import_completed`.

## Architecture / Data Model

### Package boundaries

```text
Human (web or desktop renderer)
  → @moat/features/import  (wizard UI)
      → useApiClient().previewTransactionImport / commitTransactionImport
          Web: HTTP  POST /api/v1/transaction/previewImport
                         POST /api/v1/transaction/commitImport
          Desktop: IPC   import:previewCsv / import:commitCsv
                         (handlers call the same domain functions)

Domain (@moat/domain)
  → parse, normalize, fingerprint, row cap, re-preview on commit, createMany

Host post-commit
  → Web API: applyRulesToImportedTransactions(userId, ids)
  → Desktop IPC: existing rules-apply on those ids

NOT in @moat/features (this spec)
  → ImportAgentNote, gateway /import/transactions, MCP tools
```

The localhost POST path already enters domain at `previewTransactionImport` / `commitTransactionImport`. Upgrading those functions is how agent import gets fingerprint dedupe and (after IPC/HTTP alignment) the same confirmation semantics. **Do not** mount gateway routes, copy the agent note, or add cloud MCP import tools in this work.

Later (out of scope): an agent preview could open this wizard with a pending `TransactionImportSource` so humans confirm the same table. Design the wizard as a pure function of `{ source, preview, accountId }` so that is possible without another rewrite.

### Fingerprint

Replace `importRowSignature` for **matching** (keep `dedupKey` as a row identity in the preview DTO if useful, but do not use it as the DB uniqueness key).

For each normalized row and chosen account:

```ts
const date = row.date.toISOString().slice(0, 10); // UTC calendar day, same as provider mapping
const accountFingerprint = selectedAccount
  ? createAccountFingerprint({
      name: selectedAccount.name,
      type: selectedAccount.type,
      subtype: selectedAccount.subtype,
      mask: selectedAccount.mask,
      currency: selectedAccount.currency ?? "USD",
    })
  : null;

const dedupeFingerprint = createTransactionDedupeFingerprint({
  accountFingerprint,
  amount: row.amount,
  date,
  description: row.description,
  pending: false,
});
```

Use the real `createAccountFingerprint` / `createTransactionDedupeFingerprint` from `@moat/financial-data-providers` (add that workspace dependency to `@moat/domain`). Do not fork the hash.

Preview matching:

1. Compute fingerprints for the incoming batch.
2. Query existing rows for this `userId` whose `dedupeFingerprint` is in that set (new repo method `findFingerprints({ userId, fingerprints })`). **Do not** `listRecent({ limit: 10000 })`.
3. Incoming rows whose fingerprint is already present → `duplicateCount`. Others → `newCount`.
4. **Legacy fallback (desktop, one release):** SQLite rows with null `dedupeFingerprint` still match via the old `importRowSignature` against the incoming batch only (not a 10k table scan of every column). Web Plaid rows already have fingerprints, so fallback is mainly for older local CSV/Plaid rows.

Persist `dedupeFingerprint` on every inserted row. Do not unique-index it in v1 (pending vs posted, splits, and provider collisions are handled by skip-on-preview; a unique index can wait).

Same-file re-import on the same account → all skipped. Same file on a different account → not skipped (account is part of the hash). CSV of a statement that Plaid already synced onto that account → skipped when amount, date, and normalized description match. Known v1 miss: Plaid prefers `merchantName ?? description`; CSV only has description. Document; do not invent merchant extraction.

### Account assignment

Wizard sends `accountId` (optional) on preview and commit. Domain passes it through to `createMany`.

| Host | `accountId` meaning | Persist as |
|------|---------------------|------------|
| Desktop | Local `Account.id` | `Transaction.accountId` (existing SQLite FK) |
| Web | `PlaidAccount.id` from `listAccounts()` | `Transaction.plaidAccountId` (existing `createMany` mapping). Filters already OR `plaidAccountId` / `financialAccountId` / `appleFinanceKitAccountId`. |

Handlers **must** verify the account belongs to `ctx.userId` before commit (desktop: `accounts` repo; API: `plaidAccount.findFirst({ id, userId })`). Invalid id → 400.

Unassigned → null account fields.

**Not in v1:** creating a manual Financial Profile JSON account from the wizard; attaching to `FinancialAccount` / Apple FinanceKit ids (web `listAccounts()` is Plaid-only today). If we later widen `listAccounts()`, the same `accountId` field works as long as each host maps the id to the correct FK.

### Source field

| Host | Value |
|------|--------|
| Postgres | `CSV` |
| SQLite | `import` (keep existing local convention; backup already treats `import` / `CSV` / `manual` as user-owned) |

Domain should pass a platform-neutral `source: "csv-import"` on `CreateTransactionInput` **or** let each repository map. Prefer repository default: Postgres already defaults to `CSV`; SQLite defaults to `import`. Stop sending `source: "import"` from domain into Postgres.

### Row limit and payload

- Hard cap **5,000** source rows (`TOO_MANY_ROWS` / `TransactionImportError` code).
- `csvText` max **2,000,000** characters (already in mcp-contracts). Wizard should refuse huge files before upload.
- Commit body is the **source** (csvText + mapping + accountId + `confirmedNewCount`), not 5,000 normalized row objects. That keeps Vercel’s ~4.5MB limit comfortable for typical statements.
- Preview response returns counts + `sample` (wizard requests `sampleSize: 100`, max 100). Do not send all new rows over HTTP.

### Confirmation

`commitTransactionImport` already re-runs preview and refuses when `confirmedNewCount !== preview.newCount`. Shared wizard **must** use this. Delete the “commit these client rows” path from the human flow.

Desktop IPC handlers should switch to `previewTransactionImport` / `commitTransactionImport` (same as agent HTTP). Keep channel names `import:previewCsv` / `import:commitCsv` if that avoids a preload churn, but change the payload to the transaction-import source + `confirmedNewCount`.

### Rules after insert

Domain generates a `id` for each new row (already optional on `CreateTransactionInput`) so `createMany` does not need `createManyAndReturn`. After a successful write, the **host** applies rules:

- **API:** add `applyRulesToImportedTransactions(userId, transactionIds: string[])` next to `applyRulesToSyncedTransactions`, same matching/mutation/hashtag logic, lookup `where: { id: { in: transactionIds }, userId }`. Call it from the commit handler. Batch in chunks of 500 ids if needed (FinanceKit already chunks).
- **Desktop:** after IPC commit, run the existing local rule applier against those ids (load rules, `previewRuleMatches` / apply mutations). If the current helper is “apply one rule historically,” add a small “apply all active rules to these ids” in `rules-apply.ts` rather than inventing a second engine.

CSV category column (optional mapping) still resolves to `categoryId` by name **before** rules. Rules may overwrite.

Do not apply rules in demo. Do not log descriptions.

### Schema / repo changes

**SQLite** (`packages/db-sqlite`):

- Add `Transaction.dedupeFingerprint String?`
- Index `Transaction_userId_dedupeFingerprint` (non-unique)
- Prisma migration **and** `packages/db-sqlite/src/migrations.ts` `PRAGMA table_info` ALTER (same pattern as other Transaction columns)
- `SqliteTransactionRepository.createMany` persists fingerprint
- `findFingerprints({ userId, fingerprints })`

**Postgres:**

- No new column. `createMany` must write `dedupeFingerprint` (and keep `plaidAccountId`)
- `PostgresTransactionRepository.findFingerprints`
- Optional: set `importBatchId` (uuid per commit) for support/debug; not required for v1 UI

**`CreateTransactionInput`** (`packages/data-access/src/types.ts`): add `dedupeFingerprint?: string`.

### HTTP API

Router `transaction`, actions `previewImport` and `commitImport` (matches existing `/api/v1/transaction/{action}` style).

Auth: `withAuth` (not `withDemoOrAuth`).

Reuse Zod from `packages/mcp-contracts` (`previewTransactionImportInputSchema`, `commitTransactionImportInputSchema`) **or** lift those schemas into `@moat/contracts` and re-export from mcp-contracts so OpenAPI/IPC/MCP stay one shape. Prefer lift-to-contracts if mcp-contracts would otherwise become a web/API dependency.

Preview input: existing source object plus optional `sampleSize` (1–100, default 10 so agent HTTP stays small).

Preview output:

```json
{
  "newCount": 42,
  "duplicateCount": 3,
  "invalidCount": 1,
  "headers": ["Date", "Amount", "Memo"],
  "sample": [{ "date": "2026-08-01", "amount": 12.5, "type": "EXPENSE", "description": "Coffee" }]
}
```

Commit input: source + `confirmed: true` + `confirmedNewCount`.

Commit output (200): `{ imported, skipped, newCount, duplicateCount, invalidCount }`  
409: `{ code: "confirmation_mismatch", actualNewCount, duplicateCount, invalidCount }`  
400: `{ code: "TOO_MANY_ROWS" | "INVALID_SOURCE" | "ACCOUNT_NOT_FOUND", message }`  
413: payload too large

OpenAPI: add both paths under tag Transaction, sessionCookie security, regenerate client. Add `previewTransactionImport` / `commitTransactionImport` to `MoatApiClient` and implement in `apps/web/src/lib/http-api-client.ts` and `apps/desktop/src/renderer/src/lib/ipc-api-client.ts`.

Handlers stay thin: parse, `createApiAppContext`, call domain, then rules. No Prisma in the handler beyond the account ownership check (or put that check in a small `import.service.ts` if we want zero Prisma in handlers — follow `docs/patterns/api-patterns.md`).

### Shared UI layout

```text
packages/features/src/import/
  index.ts                 ← ImportPage, ImportTransactionsButton, ImportEmptyStateActions
  import-page.tsx          ← wizard shell + optional extras slot
  column-mapper.tsx
  account-picker.tsx
  preview-table.tsx
  types.ts

packages/features/package.json  exports "./import"
apps/desktop/electron.vite.config.ts  alias @moat/features/import
```

`ImportPage` props:

```ts
type ImportPageProps = {
  extras?: ReactNode;          // desktop ImportAgentNote
  onCapture?: (event: string, props?: Record<string, unknown>) => void;
};
```

Hosts:

- Web: `apps/web/src/app/(dashboard)/import/page.tsx` → `<ImportPage onCapture={captureWithCurrentIdentity} />`
- Desktop: `apps/desktop/src/renderer/src/pages/import.tsx` becomes `<ImportPage extras={<ImportAgentNote />} onCapture={...} />`

Transactions pages on both hosts pass `headerActions={<ImportTransactionsButton />}` and `emptyStateAction={<ImportEmptyStateActions />}`.

### Desktop IPC vs agent HTTP

After this spec, both human IPC and agent HTTP call the same domain functions. Differences that remain (intentionally):

| | Human wizard | Localhost POST / MCP |
|--|--------------|----------------------|
| UI | Shared `@moat/features/import` | None (JSON only) |
| Auth | Session / vault IPC | Bearer local token + `mcp:transactions:write` |
| Sample size | 100 | 10 |
| Account picker | Yes | Optional `accountId` in JSON |
| Shared this spec? | Yes | Domain only; UI/routes stay in `apps/desktop` |

## Implementation Plan

### Phase 1 — Domain + repositories (fingerprint, persist, confirm)

1. Add `dedupeFingerprint` to SQLite schema + runtime migration + `findFingerprints` on both transaction repos.
2. Extend `CreateTransactionInput` and both `createMany` implementations to persist fingerprint and stop sending illegal Postgres `source`.
3. Change `previewNormalizedImport` to fingerprint-match via `findFingerprints`, with legacy signature fallback for null fingerprints.
4. Generate ids in `commitCsvImport` / `commitTransactionImport`; return them on applied commits for the host rule step.
5. Accept optional `sampleSize` on preview.
6. Expand `packages/domain/src/imports/importTransactions.test.ts` for fingerprint hits/misses, account-scoped hashes, row cap, confirmation mismatch.

**Acceptance:** Domain tests cover fingerprint skip; Postgres mapping would no longer use `source: "import"`. Agent HTTP starts skipping true fingerprint duplicates as soon as desktop ships this phase (no wizard required).

### Phase 2 — API + OpenAPI (web write path)

1. Lift or reuse import Zod schemas; add `previewImport` / `commitImport` handlers with `withAuth`, account ownership check, domain calls, then `applyRulesToImportedTransactions`.
2. OpenAPI + Orval + `MoatApiClient` methods + web HTTP client.
3. Handler tests: auth, too many rows, unknown account, confirmation mismatch, happy path count.

**Acceptance:** Authenticated curl/Orval client can preview and commit a small CSV against local API; demo token cannot; duplicates of existing Plaid fingerprints are skipped.

### Phase 3 — Shared wizard + host wiring

1. Extract `packages/features/src/import` from desktop `import.tsx`; add account picker; commit via `confirmedNewCount`; request `sampleSize: 100`.
2. Export package subpath; add desktop Vite alias; restart desktop dev after alias change.
3. Web `/import` page; pass header + empty actions on web transactions page.
4. Desktop page becomes thin wrapper + `ImportAgentNote` extras; IPC handlers call `previewTransactionImport` / `commitTransactionImport`.
5. Desktop post-commit rule apply on returned ids.
6. Hide import on web demo.

**Acceptance:** Web and desktop wizards are visually the same except the agent note; re-import skips; rules fire; account filter shows assigned rows.

### Phase 4 — Polish / verify

1. Analytics event.
2. Command menu entry on web if desktop already has Import (optional; match desktop `route-command-menu` if present).
3. Manual pass: empty CSV, 5,001 rows, all-duplicates, unassigned, assigned Plaid account that already has the same posted txs, rule that sets category from description.

## Acceptance Criteria

- [ ] Web transactions page shows the import icon (authenticated, non-demo) and empty-state **Import CSV**.
- [ ] `/import` on web runs the four-step wizard (upload, map + account, preview, done).
- [ ] Desktop `/import` uses `@moat/features/import`; `ImportAgentNote` still appears only on desktop.
- [ ] Column auto-detect and manual mapping still work for date / description / amount / type / category.
- [ ] Account picker lists active visible accounts plus **Unassigned**; assigned web rows set `plaidAccountId`; assigned desktop rows set `accountId`; foreign account ids are rejected.
- [ ] Preview reports new / duplicate / invalid counts; table shows up to 100 sample rows.
- [ ] Files with more than 5,000 data rows are rejected before commit.
- [ ] Commit re-previews on the server/main process; `confirmedNewCount` mismatch writes nothing.
- [ ] Dedupe uses `createTransactionDedupeFingerprint`; fingerprints are stored; re-import of the same file+account imports 0 new rows.
- [ ] Existing Plaid rows on web with a matching fingerprint are not duplicated by CSV.
- [ ] Postgres `source` is `CSV`; domain no longer writes `import` into Postgres.
- [ ] Active rules run on newly imported ids (category/hashtag/type), same engine as provider import on that host.
- [ ] Demo mode cannot import; API is `withAuth`.
- [ ] No PII (descriptions, file names, emails) in logs or analytics.
- [ ] Localhost `POST /import/transactions` and MCP import tools remain desktop-only and are **not** copied into `@moat/features`; they pick up domain fingerprinting without UI changes.
- [ ] Desktop Vite alias `@moat/features/import` is added; `pnpm --filter moat-desktop run dev` resolves the import.
- [ ] OpenAPI client regenerated; `MoatApiClient` implemented on both HTTP and IPC clients.

## Non-Goals

- Sharing or redesigning `ImportAgentNote`, gateway routes, or `moat.previewTransactionImport` / `moat.commitTransactionImport` MCP tools in `@moat/features`.
- Opening the human wizard from a localhost POST (future: same wizard, pending source).
- Cloud MCP bulk import.
- iOS / extension CSV import.
- OFX, QFX, XLSX, PDF.
- Persisted mapping drafts or `ImportBatch` UI.
- Creating manual Financial Profile accounts inside the wizard.
- Attaching CSV rows to `FinancialAccount` or Apple FinanceKit ids until `listAccounts()` includes them.
- Unique DB constraint on `dedupeFingerprint`.
- Backfilling fingerprints for all historical Plaid rows (web already has them; desktop uses legacy fallback).
- Changing marketing pricing copy.
- Demo-mode import of sample CSVs.

## Open Questions

- **Should Unassigned be allowed when the user has accounts?** This spec says yes (less friction; fingerprints omit account). Product may prefer requiring an account when any exist.
- **Widen web `listAccounts()` now?** Today it is Plaid-only. Manual-only users (the $0 path) can still import unassigned. Widening to Financial Profile manual accounts needs a real FK and is a separate spec.
- **Unify analytics on `transaction_import_completed` immediately** vs keep `desktop_import_completed` for a release.
- **Sample default:** keep domain default 10 (agent) and let the wizard pass 100, as specified. Confirm agent output size is acceptable if someone omits `sampleSize`.

## Related Specs

- [Desktop agent transaction import](../desktop-agent-transaction-import/spec.md) — localhost POST + MCP; consumes the same domain functions; UI stays out of this spec
- [Plaid reconnect transaction dedupe](../plaid-reconnect-transaction-dedupe/spec.md) — provider watermarking; different problem, same fingerprint helper
- [Shared onboarding](../../complete/shared-onboarding/spec.md) — precedent for `@moat/features` extraction + desktop Vite aliases
- [Apple Wallet](../../complete/apple-wallet/spec.md) (if present) / FinanceKit import — rules-on-import pattern to copy

## Suggested Commit Message

```text
docs: adds shared csv import spec
```
