# Taxes — System of Record for the User’s Tax Life

## Status

Draft. Created September 12, 2026 after reviewing the financial-profile `TaxProfile` blob (`packages/contracts/src/financial-profile-data.ts`), retirement tax math (`packages/domain/src/retirement/taxes.ts`), federal-rules registry (`specs/features/federal-rules/spec.md`), MCP tax scope with no tools (`packages/mcp-contracts/src/scopes.ts`), insurance document-reference + Vercel Blob upload precedents, shared feature-shell conventions (`packages/features/src/retirement/`), and iOS More-menu destinations (`apps/ios/Moat/App/app-destination.swift`).

Updated September 18, 2026: cloud (Cloudflare R2) document storage is capped at **100 MB combined per tax year per user**. Desktop local vault storage has no cap.

This spec is the shared agreement **before** implementation. It stays 1:1 with the product brief: Moat is the system of record for tax facts and evidence, not a TurboTax / FreeTaxUSA clone.

---

## Goal

Build a first-class **Taxes** product surface across shared web/desktop (`@moat/features`) and a native iOS UI, with a long-lived canonical tax data layer underneath.

Do **not** build this around TurboTax, FreeTaxUSA, or another tax-preparation UI.

Model **canonical tax facts and supporting evidence independently** so the same data can eventually be used for:

- answering tax-related questions
- preparing information for TurboTax / FreeTaxUSA / a CPA
- identifying missing documents
- estimating tax readiness
- generating structured tax summaries
- eventually integrating with a filing provider
- potentially powering Moat’s own tax preparation layer in the future

The core architecture:

```text
Original source documents
    ↓
Document parsing/extraction
    ↓
Normalized structured tax facts
    ↓
Tax-year tax profile / tax fact graph
    ↓
Derived summaries + readiness
    ↓
Agent/MCP access
    ↓
Future filing/export integrations
```

Do not treat parsed document text as the primary data model. The primary asset is **structured, normalized tax data with provenance back to its source**.

Success means:

- A user opens **Taxes** for a tax year and immediately sees readiness, documents on file vs expected, high-level facts, items needing attention, and a labeled estimated result **when enough information exists**.
- Uploading a W-2 (or other supported document) produces structured `TaxFact` rows with inspectable provenance — never a bare number without a source.
- Web and desktop render the **same** React tree from `@moat/features/taxes`; per-platform code is transport, navigation, and file storage only.
- An agent can answer “What do I enter for W-2 Box 1 from SchoolAI?” via small MCP tools and receive `{ value, source, confidence }` without dumping the user’s entire ledger or original PDFs.
- iOS has a native Taxes destination that matches the same information architecture (not a WebView).

---

## Product Context

[specs/mission.md](../../mission.md) already names taxes as part of the financial graph: Moat “connects real bank accounts, investments, assets, liabilities, insurance policies, **taxes**, budgets, cash flow, and financial goals.” The mission is to become “the canonical source of truth for a user’s entire financial story.” Taxes is the missing first-class destination for that claim.

Today, “tax” in Moat means three unrelated things:

1. A **planning assumptions** JSON blob (`TaxProfile`) on Financial Profile — filing status, estimated bracket, self-employed / rental flags.
2. A **retirement projection tax engine** — lifetime brackets, withdrawal order, RMD-related ordinary income. Not filing data.
3. Curated **prompts** (`packages/ai-prompts/src/prompts/tax.ts`) that tell an agent to infer deductions from spending. No tax fact graph behind them.

None of those is a system of record for W-2s, 1099s, readiness, or provenance. This feature is.

The end-state we are designing toward:

> Moat already understands the user’s income, spending, accounts, investments, real estate, debt, transactions, and financial history. The user then adds the relatively small number of tax documents Moat cannot independently know. Moat reconciles those sources into a trusted tax data layer.

From there:

```text
Moat → tax software
Moat → CPA
Moat → AI agent
Moat → future filing API
Moat → future Moat Tax
```

The tax data model is **long-lived platform infrastructure**, not a temporary UI feature.

The UX job is: *“You’ve been living your financial life inside Moat all year, and now Moat has already assembled most of your taxes.”* It should feel like a financial dashboard, not like filling out an IRS form.

---

## Current Repo Context

### Naming collisions (read this first)

| Existing name | Where | What it actually is | Does Taxes reuse it? |
|---------------|-------|---------------------|----------------------|
| `TaxProfile` | `packages/contracts/src/financial-profile-data.ts`, Financial Profile UI, retirement plan drafts | Planning JSON: `filingStatus`, `taxYear`, estimated bracket/state rate, income estimates, `deductionStrategy`, `selfEmployedIncome`, `rentalIncome` | **Yes — as an input seed**, not as the tax-year system of record. Keep the type. Do not widen it into a fact graph. |
| `TaxPolicy` | `packages/contracts/src/retirement-policies.ts` | Retirement withdrawal / tax-treatment policy | **No.** Different product. |
| Retirement `taxes.ts` | `packages/domain/src/retirement/taxes.ts` | Lifetime federal/state estimate for projections | **No as SoT.** May later consume `TaxFact`s; do not invert the dependency in v1. |
| Financial Profile “Taxes” section | `packages/features/src/financial-profile/section-components/taxes-section.tsx`, `/financial-profile#taxes` | Edit the planning blob | **Keep.** Deep-link the new `/taxes` destination from it; do not replace the section with the full tax workspace. |
| Retirement Plan “Taxes” tab | `packages/features/src/retirement/income/taxes-section.tsx` | Lifetime taxes paid in a projection | **Keep.** Different time horizon. |
| `mcp:tax:read` | `packages/mcp-contracts/src/scopes.ts`, privacy domain `tax` | Scope exists; **zero tools** use it | **Reuse and honor.** Add `mcp:tax:write` for uploads / manual facts / confirmations. |
| `UserMemory.category = tax_context` | Prisma + `packages/contracts/src/ipc/memories.ts` | Agent memory category | Orthogonal. Do not store tax facts as memories. |
| `RetailOrder.tax` | `apps/api/prisma/schema.prisma` | Sales tax on a retail order | **No.** |

**New names this spec introduces:**

| Name | Role |
|------|------|
| `TaxFact` | Canonical atomic tax-relevant fact with provenance |
| `TaxYearProfile` | Derived projection/aggregation of facts for one year — **not** a second source of truth |
| `TaxDocument` | Uploaded source document metadata + storage reference |
| `TaxDocumentParser` | Provider-agnostic parse interface |
| `TaxReadiness` | Deterministic, inspectable readiness result |
| `TaxAgentContext` | Compact structured year summary for agents |

**Rule for implementers:** never store the tax-year fact graph inside `FinancialProfileData.taxProfile`. Never merge this feature into the retirement tax engine. Never name MCP tools `tax.*` — existing tools are `moat.getRetirementPlan`, `moat.listTransactions`, etc.

### What exists today

| Area | Location | Taxes relationship |
|------|----------|-------------------|
| Planning tax blob | `TaxProfile` in `packages/contracts/src/financial-profile-data.ts` | Seed filing status, tax year, SE/rental flags for readiness relevance |
| Profile household | `FinancialProfileRecord.dependentsCount`, `householdType` | Seed taxpayer/household section; dependents become facts only when confirmed |
| Tax field recommendations | `packages/domain/src/financial-profile/apply-tax-profile-defaults.ts` | Income lookback already exists — reuse as a **candidate** source, not confirmed wages |
| Federal rules (in flight) | `packages/domain/src/federal-rules/`, [federal-rules/spec.md](../federal-rules/spec.md) | Readiness and future estimates resolve IRS limits by `taxYear` from here — do not duplicate 2026 constants |
| Retirement tax math | `packages/domain/src/retirement/taxes.ts` | Out of scope for filing accuracy; do not call it “your refund” |
| Shared feature shell | `packages/features/src/{api-client-context,navigation-context}.tsx` | Same pattern as Retirement |
| Retirement layout (template) | `packages/features/src/retirement/`, `apps/web/src/app/(dashboard)/retirement/page.tsx`, `apps/desktop/src/renderer/src/pages/retirement.tsx` | Copy the thin-page + shared-tree pattern |
| Web/desktop nav | `apps/web/src/components/layout/sidebar.tsx` `wealthItems`; desktop `sidebar.tsx` + `App.tsx` `Page` union | Add Taxes next to Investments / Retirement / Scenarios |
| Command palette | `packages/features/src/retirement/search-routes.ts`, web/desktop `route-command-menu.tsx` | Add `taxesSearchRoutes` |
| API handler pattern | `apps/api/src/server/handlers/retirement.ts` → `retirement.service.ts` → `@moat/domain` | Mirror: `handlers/taxes.ts`, `services/taxes.service.ts` |
| AppContext + repos | `packages/domain/src/context.ts`, `packages/data-access/`, `packages/db-postgres/`, `packages/db-sqlite/` | Add `taxes?: TaxRepository` |
| Identity / household | `apps/api/src/server/context/resolve-active-context.ts` (`effectiveUserId`, `activeProfileId`); MCP `apps/mcp/src/auth/resolve-household-identity.ts` | All tax rows scoped to `effectiveUserId`. Never leak another profile’s tax year. |
| Auth wrappers | `apps/api/src/server/handler-wrappers.ts` | Reads: `withDemoOrAuth`. Uploads, confirmations, manual facts: `withAuth`. |
| MCP contracts | `packages/mcp-contracts/src/{tools,schemas,output-schemas,scopes,privacy-domains}.ts` | Add `moat.*` tax tools; reuse `mcp:tax:read`; add `mcp:tax:write` |
| Cloud MCP registry | `apps/mcp/src/tools/registry.ts`, `docs/patterns/mcp-tools.md` | New `apps/mcp/src/tools/taxes.ts` |
| Desktop MCP registry | `apps/desktop/src/main/agent-gateway/tools/registry.ts` | Mirror tax tools against SQLite `AppContext` |
| Ask Moat (web) | `apps/web/src/components/agent/moat-ai-panel/*` — `clientContext: { currentRoute, activePage }` | Extend context with `taxYear` when on `/taxes` |
| Prompts | `packages/ai-prompts/src/prompts/tax.ts` | Keep; add Taxes-page starter questions that target the new tools |
| Real estate | `RealEstateInvestment` in `apps/api/prisma/schema.prisma` — `usageType` `PRIMARY_RESIDENCE \| RENTAL \| VACATION_HOME \| MIXED_USE`, mortgage + expense fields | Source for expected 1098 / rental facts; do not invent a parallel property table |
| Investments / holdings | `Investment`, `PlaidHolding` (`costBasis` display only) | Candidate investment facts. **No tax lots, RSU/ISO/NSO, or trade table exist.** |
| Categories | `packages/category-mapping/src/canonical-categories.ts` — `Gifts & Donations`, `Health & Medical`, `Education` | Map to **candidate** deduction facts only |
| Object storage | Feedback screenshots use `@vercel/blob` `access: "public"` | **Do not copy that route.** Cloud tax files use a dedicated private Cloudflare R2 bucket (`TAX_R2_*`), not Vercel Blob and not the public `moatfinance-downloads` CDN bucket. |
| Insurance doc refs | `InsuranceDocumentReference` in `financial-profile-data.ts` | Metadata-only precedent (`storageScope`, `localOnly`). Taxes needs real bytes + a storage provider. |
| CSV import | `packages/domain/src/imports/`, `packages/features/src/import/` | Precedent for preview/commit + desktop-local files — not tax documents |
| iOS destinations | `apps/ios/Moat/App/app-destination.swift` `MoreMenuSection.wealthManagement` = investments, retirement, scenarios | Add `.taxes` |
| iOS tax UI today | `FinancialProfileTaxesSection` only | Keep; add `Features/Taxes/` |
| iOS Ask Moat | `AskAIDispatchService` opens ChatGPT/Claude; no in-app agent | Entry point + year context + starter questions; do not build a new LLM client |
| OpenAPI | `packages/openapi/api-v1.yaml` retirement block | Add `/api/v1/taxes/*` the same way |
| Client | `packages/contracts/src/api-client.ts` `MoatApiClient`; web `http-api-client.ts`; desktop `ipc-api-client.ts` | Add tax methods on all three |
| Desktop IPC | `packages/contracts/src/ipc/retirement.ts` | Add `packages/contracts/src/ipc/taxes.ts` + `apps/desktop/src/main/ipc/taxes.ts` |
| RLS | [row-level-security/spec.md](../row-level-security/spec.md), `apps/api/docs/patterns/prisma-and-migrations.md` | New tables must be FORCE RLS’d; do not let a generated migration drop policies |

### What does not exist today

- No `TaxFact`, `TaxDocument`, `TaxYearProfile`, or tax-year Prisma/SQLite models
- No `/taxes` route, sidebar item, or iOS destination
- No document parser, Unstructured.io client, or `TaxDocumentParser` interface
- No private object-storage abstraction (feedback screenshots are public blobs)
- No tax readiness engine
- No tax MCP tools (scope only)
- No tax lots, equity-compensation events, or depreciation engine
- No CPA export package
- No in-app Ask Moat on desktop or iOS

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `useApiClient()` / `useMoatNavigation()` | `packages/features/src/api-client-context.tsx`, `navigation-context.tsx` | Shared web/desktop data + routing |
| `@moat/ui` primitives | `packages/ui` | Tabs, Card, Dialog, Button, Select, Progress, EmptyState — do not invent native controls |
| `withAuth` / `withDemoOrAuth` | `apps/api/src/server/handler-wrappers.ts` | Guaranteed `userId` |
| `createApiAppContext` / `createSqliteAppContext` | `apps/api/src/server/createApiAppContext.ts`, `packages/db-sqlite/src/createSqliteAppContext.ts` | Domain bridge |
| `TaxProfile` seed fields | `packages/contracts/src/financial-profile-data.ts` | Filing status, SE/rental flags, tax year |
| `RealEstateInvestment` | Prisma + `packages/contracts/src/ipc/real-estate.ts` | Property facts live here; tax layer references `source` IDs |
| Federal-rules `taxYear` | `packages/domain/src/federal-rules/` | Expected contribution limits, official vs estimated |
| MCP tool lifecycle | `docs/patterns/mcp-tools.md`, `apps/mcp/docs/patterns/tool-lifecycle.md` | Contract → registry → `schemaEnvelope` → scopes |
| `mcp:tax:read` + privacy item `tax` | `scopes.ts`, `privacy-domains.ts` | Relabel privacy copy from “Tax profile” to “Taxes” when tools ship |
| Cloudflare R2 | Desktop release already publishes to a **public** downloads bucket | First **cloud** tax adapter is a **separate private** R2 bucket. Never share the downloads token or public custom domain. |
| Insurance `storageScope` / `localOnly` | `financial-profile-data.ts` | Same cloud-vs-desktop sensitivity idea |
| iOS design system | `apps/ios/Moat/Core/DesignSystem/` | `MoatCard`, `MoatGlassSheet`, `.moatToggleStyle()`, `.refreshable` |
| iOS Retirement module | `apps/ios/Moat/Features/Retirement/{Models,Views,ViewModels,Services}/` | Folder template |
| Analytics | root `AGENTS.md` PostHog rules | `tax_*` events: counts/booleans/enums only; no filenames that include SSNs, no raw amounts on capture if they encode income identity — prefer status enums + counts |

---

## Target Experience

### 1. Taxes navigation / top-level UX

Add a first-class **Taxes** destination.

| Surface | Where | What to add |
|---------|-------|-------------|
| Shared UI | `packages/features/src/taxes/` + `package.json` export `"./taxes"` | `TaxesPage` and tabs |
| Web | `apps/web/src/app/(dashboard)/taxes/page.tsx` | Thin wrapper like retirement |
| Web sidebar | `wealthItems` in `apps/web/src/components/layout/sidebar.tsx` | `{ href: "/taxes", label: "Taxes", icon: Receipt }` (or equivalent Receipt/ReceiptText glyph — **no enclosing circle**) |
| Desktop | `pages/taxes.tsx`, `App.tsx` `Page` + `routePages`, sidebar `wealthItems`, Vite alias | Same tree |
| Command palette | `packages/features/src/taxes/search-routes.ts` | Overview, Documents, Tax Details, Ask Moat |
| iOS | `AppDestination.taxes` in `wealthManagement` | Native module, not WKWebView |

Default view is organized around a **tax year**. Switching years is first-class chrome (2026 / 2025 / 2024 / …), not a buried setting.

Example landing chrome:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  2026 Taxes                                           [ 2026 ▾ ]         │
│                                                                          │
│  Estimated readiness          Documents              Estimated result    │
│  82% ready                    8 of 10 expected       $3,420 refund       │
│                                                      or $1,250 owed      │
│  Last updated September 11                                               │
│                                                                          │
│  [ Overview ]  [ Documents ]  [ Tax Details ]  [ Ask Moat ]              │
└──────────────────────────────────────────────────────────────────────────┘
```

Main sections/tabs:

- Overview
- Documents
- Tax Details
- Ask Moat

Potential future sections (chrome-ready, **do not overbuild**):

- Opportunities
- Filing
- CPA Export

Empty state (no documents, no inferred candidates):

```text
Taxes for 2026
Moat can start from the accounts and transactions you already have.
Upload a W-2 or 1099 to turn that into confirmed tax facts.
[ Upload a document ]    [ Enter a fact manually ]
```

Demo mode: Overview / Details / readiness **read** via `withDemoOrAuth`. Uploads and confirmations require a real session.

### 2. Tax Overview

The Overview answers:

1. How ready am I to file?
2. What documents do I have?
3. What appears to be missing?
4. What important tax facts has Moat found?
5. What might need my attention?
6. What is my high-level estimated tax position, **if we have enough information**?

Suggested cards:

| Card | Example copy |
|------|----------------|
| Tax readiness | “82% ready” — score is inspectable; tap through to reasons |
| Documents | “8 of 10 expected” |
| Income identified | $XXX,XXX |
| Taxes withheld | $XX,XXX |
| Potential deductions identified | $XX,XXX |
| Capital gains/losses | +$X,XXX / −$X,XXX |
| Estimated result | “Likely refund” or “Likely amount owed” — **only** when the estimator has enough confirmed facts; otherwise “Not enough information to estimate” |
| Needs attention | See examples below |

Needs-attention examples:

- Missing W-2 from SchoolAI
- Robinhood 1099-B has not been uploaded
- Mortgage interest document expected but not found
- Rental property expenses need review
- Possible charitable donations found in transactions but not confirmed
- HSA contribution amount differs from Form 5498-SA
- RSU sale may require cost-basis review

Include an **“Ask Moat about my taxes”** CTA prominently on Overview.

Do not pretend the readiness percentage is a mathematically precise filing probability. It is a deterministic score of expected evidence (see Readiness).

### 3. Documents

Users upload tax-related documents. Support at minimum:

- PDF
- images (png, jpeg, webp, heic if the parser accepts it)
- other common document types already accepted by app upload surfaces

Example document types (classification, not a closed enum forever):

W-2, 1099-INT, 1099-DIV, 1099-B, 1099-NEC, 1099-MISC, 1099-K, 1098, 1098-E, 1098-T, 5498, 5498-SA, Schedule K-1, prior tax returns, property tax statements, donation receipts, brokerage tax packages, employer equity statements, RSU/ISO/NSO documentation, rental income/expense reports, miscellaneous supporting documents.

Each document has:

| Field | Notes |
|-------|--------|
| `id` | cuid |
| `taxYear` | Required. User-correctable if classification is wrong |
| `documentCategory` | e.g. wage, investment, mortgage, prior_return |
| `formType` | If recognized (`W-2`, `1099-B`, …) |
| `issuer` | Employer / payer / lender |
| `recipient` | Taxpayer / spouse when detectable |
| `source` | `upload` \| `manual` \| future import |
| `originalFilename` | Stored; **never log** |
| `mimeType` | Allowlisted |
| `uploadedAt` | |
| `processingState` | `uploaded` \| `processing` \| `parsed` \| `needs_review` \| `complete` \| `failed` |
| `parserProvider` | e.g. `unstructured` — domain stores the **id**, UI does not mention the vendor |
| `parserVersion` | If available |
| `extractionConfidence` | 0–1 or enum mapped from provider |
| `originalFileRef` | Storage key, not a blob column |
| `parsedTextRef` | Storage key for normalized text |
| `extractedStructuredFacts` | Via `TaxFact` rows + optional form payload |
| `reviewStatus` | |
| `userConfirmed` | |

UX list example:

```text
W-2 — SchoolAI
2026 · Processed
12 tax facts extracted

Robinhood Consolidated 1099
2026 · Needs review
Cost basis missing for 3 transactions

Mortgage Interest Statement
2026 · Processed
```

Opening a row goes to a **document details** screen: status, issuer, facts extracted, provenance snippets, confirm/reject, replace file, reprocess.

Failed processing is visible and retryable. Silent failure is a bug.

### 15. Tax Details page

Human-readable tax-year profile. Sections:

- Personal / household
- Income
- Employment
- Investments
- Retirement
- Real estate
- Business
- Deductions
- Credits
- Education
- Healthcare
- Estimated payments
- Prior-year carryforwards

Each row shows **value, source, and confidence/status**.

```text
Employment income          $180,420     SchoolAI W-2 · Box 1
Federal withholding        $31,224      W-2 Box 2
Mortgage interest          $22,401      Form 1098
Potential charitable        $6,942      34 Moat transactions · Needs confirmation
```

Click-through goes to evidence (document detail, transaction list, or manual-entry editor).

Hide empty sections for simple filers (1 W-2 + 1 brokerage + 1 mortgage). Complex users expand into rentals, K-1s, equity compensation without changing the primary IA.

### 19. Ask Moat tax experience

Wire the existing agent UI into the selected tax year. The selected year is automatic context.

Web: extend `MoatAgentStreamInput.clientContext` with `{ taxYear }` when `activePage` is taxes (today only `currentRoute` / `activePage` are sent from `apps/web/src/components/agent/moat-ai-panel/chat-store.ts`).

Desktop / iOS: no in-app agent panel. Provide the same starter questions via `PromptMenu` / `AskAIDispatchService`, with copy that names the selected year and points at MCP tools.

Starter questions:

- Am I ready to file?
- What tax documents am I missing?
- How much did I earn last year?
- How much federal tax was withheld?
- Do I have any capital losses?
- What did I pay in mortgage interest?
- How much did I donate?
- Do I have anything that might complicate my taxes?
- Summarize my taxes for my CPA.
- Walk me through entering my W-2.
- Explain where this number came from.

### 21. UI design principles

Feel like Moat. Avoid recreating government tax software.

Prefer:

- summaries
- progressive disclosure
- confidence / status indicators
- clear review workflows
- source attribution

Avoid exposing IRS complexity until the user drills in.

Someone with 1 W-2, 1 brokerage, and 1 mortgage should have an extremely simple experience. Someone with 6 rentals, a business, ISOs, and multiple brokerages should expand into deeper detail without breaking the primary UI.

### 22. iOS

Native Taxes destination. Same conceptual IA as web/desktop. **Not a WebView.**

Include:

- Taxes landing page
- Tax-year selector
- Readiness card
- Estimated result card
- Documents status
- Needs attention
- Tax Details
- Document list
- Document detail
- Ask Moat entry point

Follow `apps/ios/AGENTS.md`: `MoatCard`, `MoatGlassSheet`, `.moatToggleStyle()`, `.moatKeyboardDismissToolbar()` on numeric pads, native `.refreshable`.

Folder:

```text
apps/ios/Moat/Features/Taxes/
  Models/
  Views/
  ViewModels/
  Services/
```

v1 iOS focus is **UI + Codable models/interfaces** matching the API contracts. If cloud upload/parse endpoints are not yet reachable from the iOS environment during implementation, ship the screens against the contracts and a local/preview fixture — do not spend significant effort inventing a parallel iOS parser or FinanceKit tax pipeline.

Add `.taxes` to `AppDestination` and `MoreMenuSection.wealthManagement` (after Retirement).

---

## Architecture / Data Model

### Shared vs per-platform

```text
packages/contracts          Zod + TS types (TaxFact, TaxDocument, forms, readiness)
packages/domain/src/taxes   Normalization, readiness, reconciliation, agent context
packages/data-access        TaxRepository interface
packages/db-postgres        PostgresTaxRepository
packages/db-sqlite          SqliteTaxRepository
apps/api                    handlers + services + parser adapters + file storage
apps/mcp + desktop gateway  moat.* tax tools
packages/features/src/taxes Shared React page (web + desktop)
apps/web + apps/desktop     Thin routes, nav, transport
apps/ios                    Native UI + models
```

Business logic lives in `@moat/domain`, not in React or SwiftUI.

Web/cloud: hosted API + Postgres. Desktop: Electron IPC + local SQLite. **Do not duplicate domain logic.** Desktop main process calls the same `@moat/domain` functions as `taxes.service.ts`.

### 23. Data storage / file storage

Do **not** store large document blobs in ordinary relational rows.

Prefer:

```text
TaxDocument metadata  +  secure object/file storage reference
                      +  parsed representation reference
                      +  TaxFact rows
```

Introduce a small **`FileStorageProvider`** (domain-facing):

```ts
interface FileStorageProvider {
  put(input: {
    key: string;
    bytes: Uint8Array;
    mimeType: string;
    visibility: "private";
  }): Promise<{ key: string }>;
  get(key: string): Promise<{ bytes: Uint8Array; mimeType: string }>;
  delete(key: string): Promise<void>;
}
```

| Runtime | Adapter | Notes |
|---------|---------|--------|
| Cloud | `R2TaxFileStorage` via `@aws-sdk/client-s3` against a private Cloudflare R2 bucket | **Private** objects only — no public URLs, no `r2.dev`, no custom domain. Do not reuse `moatfinance-downloads`. Paths like `taxes/{userId}/{taxYear}/{documentId}/original`. Env: `TAX_R2_ACCOUNT_ID`, `TAX_R2_ACCESS_KEY_ID`, `TAX_R2_SECRET_ACCESS_KEY`, `TAX_R2_BUCKET`. Combined original documents are limited to **100 MB per tax year per user**. The Documents tab shows usage and rejects uploads that would exceed the cap. |
| Desktop | `LocalVaultFileStorage` | Bytes on disk under the unlocked vault directory; SQLite stores the key only. Follow existing encrypted-DB / vault patterns. **No storage cap** — the 100 MB limit applies only to Cloudflare R2. |

Keys are generated server-side / main-process-side. Clients never invent storage paths. Original filename is metadata only.

Original document is never thrown away. Store:

1. Original document
2. Parsed representation / normalized text where appropriate
3. Extracted structured facts

The application queries **structured facts first**. Raw text is supporting evidence and fallback context.

### 4. Document parsing architecture

Provider abstraction. The rest of the app must not know or care that Unstructured.io is the first implementation.

```ts
interface TaxDocumentParser {
  parseDocument(input: {
    bytes: Uint8Array;
    mimeType: string;
    filename: string;
  }): Promise<ParsedTaxDocument>;
}
```

`ParsedTaxDocument` is a **normalized intermediate** (Moat-owned), not the Unstructured payload:

- document text
- pages / sections
- tables
- key-value candidates
- form classification
- extracted fields
- confidence
- source locations (page / bounding box when available)

Then Moat’s own layer:

```text
upload
  → FileStorageProvider.put(original)
  → TaxDocumentParser.parseDocument
  → persist parsed representation
  → tax form classifier
  → structured fact extraction (form schemas)
  → normalized TaxFacts
  → validation / reconciliation
  → readiness + agent summary
```

Initial parser: **Unstructured.io**. Later we should be able to add `UnstructuredParser`, `LocalParser`, `OpenAIParser`, `ClaudeParser`, `DoclingParser`, `CustomOCRParser` without changing `TaxFact` or UI.

Avoid leaking provider-specific shapes into domain models. Map inside the adapter.

Parser failures: `processingState = failed`, user-visible retry, structured log **without** filename/PII/file bytes.

### 5. TaxFact data model (most important)

A `TaxFact` is an atomic piece of tax-relevant information, independent of any tax-preparation product.

Examples:

- W-2 wages = $180,000
- Federal income tax withheld = $31,000
- Mortgage interest = $22,400
- Ordinary dividends = $3,220
- Qualified dividends = $2,850
- Short-term capital gain = $4,200
- HSA contributions = $8,300
- Charitable cash contributions = $6,100
- Rental property gross income = $24,000

Conceptual shape (Zod in `@moat/contracts`; Prisma/SQLite columns follow project conventions):

```ts
type TaxFact = {
  id: string;
  userId: string;
  taxYear: number;

  category: TaxFactCategory; // income, withholding, deduction, …
  type: string; // stable machine type, e.g. "w2.wages"
  key: string; // grouping key for reconciliation, e.g. "w2.wages:employer:schoolai"

  value: unknown; // validated by valueType
  valueType: "money" | "number" | "percent" | "boolean" | "date" | "string" | "enum";
  unit?: string;
  currency?: "USD";

  sourceType: TaxFactSourceType;
  sourceDocumentId?: string;
  sourceTransactionId?: string;
  sourceAccountId?: string;
  sourceHoldingId?: string;
  sourceManualEntryId?: string;
  sourceRealEstateId?: string;

  sourceForm?: string; // "W-2"
  sourceBox?: string; // "1"
  sourcePage?: number;
  sourceText?: string; // evidence snippet — not for logs

  confidence: number; // 0–1
  extractionMethod: "parser" | "classifier" | "manual" | "financial_data" | "agent";

  status: TaxFactStatus;
  userConfirmed: boolean;

  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
```

```ts
type TaxFactSourceType =
  | "reported" // official form box
  | "document"
  | "financial_data" // Moat transactions / accounts / holdings
  | "manual"
  | "agent_inference"
  | "prior_year";

type TaxFactStatus =
  | "candidate"
  | "extracted"
  | "confirmed"
  | "conflicting"
  | "superseded"
  | "rejected";
```

**Provenance is mandatory.** Never create an important financial/tax number without retaining its source.

An agent or UI must be able to answer “Where did this $180,000 number come from?” with the equivalent of:

```text
SchoolAI W-2
Box 1
2026
uploaded Feb 3
confidence: high
```

### 6. Form-specific structured data

For common IRS forms, also create normalized Zod schemas / extraction mappings. Do not dump every field into generic JSON when a known form structure exists.

Start with high-volume forms. Make it easy to add schemas later (`packages/contracts/src/taxes/forms/`).

**W-2:** employer, EIN, employee, wages, federal tax withheld, Social Security wages/tax, Medicare wages/tax, state wages/tax, local wages/taxes, retirement plan indicator, dependent care benefits, Box 12 codes, Box 14 values.

**1099-INT:** interest income, early withdrawal penalty, US savings bond interest, federal withholding, tax-exempt interest, etc.

**1099-DIV:** ordinary dividends, qualified dividends, capital gain distributions, Section 199A dividends, foreign tax paid, etc.

**1099-B:** support **individual transactions/lots**, not just totals — description, quantity, acquisition date, disposition date, proceeds, cost basis, wash sale adjustment, short/long term, covered/noncovered, gain/loss, missing-basis indicator.

**1099-NEC / MISC / K:** income information.

**1098:** mortgage interest, outstanding principal, property address, points, property taxes if available.

**1098-E:** student loan interest.

**5498 / 5498-SA:** retirement / HSA contribution data.

**K-1:** extensible model; do not fully implement every K-1 box in v1.

Do not try to fully implement every obscure IRS form in the first pass.

Form payloads live beside facts (e.g. `TaxFormExtraction.payload` validated by the form Zod schema). Facts are still projected out so Overview / MCP / readiness never have to parse form JSON.

### 7. Tax profile / fact graph

```ts
type TaxYearProfile = {
  taxYear: number;
  taxpayer: …;
  spouse: …;
  dependents: …;
  income: …;
  withholding: …;
  investments: …;
  retirement: …;
  deductions: …;
  credits: …;
  healthcare: …;
  education: …;
  realEstate: …;
  business: …;
  equityCompensation: …;
  estimatedPayments: …;
  priorYear: …;
  documents: …;
  missingInformation: …;
};
```

This profile is **mostly derived from `TaxFact`s**. It is a convenient projection, not an independent source of truth.

```text
TaxFacts        = canonical atomic facts
TaxYearProfile  = aggregation of those facts
```

Do not create uncontrolled duplication. If a UI needs wages, it reads facts (or the derived profile), not a second writable wages column.

Seed household fields from existing `TaxProfile` / `FinancialProfileRecord` when facts do not yet exist; mark them `sourceType: "financial_data"` or profile-derived until the user or a prior-year return confirms them.

### 8. Use Moat’s existing financial data

This is where Moat is more useful than a standalone tax organizer.

Potential sources:

Transactions, accounts, investment accounts, holdings, trades (when they exist), real estate, mortgages, loans, income, categories, merchants, rules, manual assets/liabilities, existing profile/family information.

Examples: transactions categorized as charitable giving (`Gifts & Donations`), property tax, medical (`Health & Medical`), education, business expense, interest expense → **potential** tax facts.

**Do not automatically treat inferred transaction data as confirmed deductible tax information.**

Clear distinction:

| Kind | Meaning |
|------|---------|
| reported fact | Official form box |
| document-derived fact | Extracted from an upload |
| financial-data-derived candidate | Moat ledger inference |
| user-confirmed fact | User accepted it |
| agent inference | Model-suggested; still a candidate until confirmed |

Example review copy:

> Moat found $7,230 in transactions categorized as Donations. Confirm which of these were charitable contributions.

That creates a review workflow, not a deduction.

### 9. Tax readiness engine

Deterministic, readable scoring based on **expected information** — not a fake precision percentage.

Possible categories:

- Identity / family
- Employment income
- Investment income
- Retirement
- Real estate
- Business income
- Healthcare / HSA
- Education
- Deductions
- Credits
- Estimated payments

Determine which categories are **relevant** from what Moat already knows.

Example: salary deposits + brokerage accounts + mortgage + HSA → expected documents might include W-2, brokerage 1099, 1098, 5498-SA. Readiness reflects whether expected **evidence** exists.

Outputs:

- readiness score
- missing items
- unresolved items
- review-needed items
- inspectable reasons (why this category was relevant; why points were withheld)

Do not label the score as “IRS-ready” or “you will get this refund.”

### 10. Prior-year tax returns

Support uploading prior-year returns.

Extract useful carry-forward information such as:

- filing status
- dependents
- prior AGI
- capital loss carryforward
- charitable contribution carryforward
- passive activity loss carryforward
- depreciation-related information
- tax credit carryforwards
- prior Schedule C businesses
- prior rental properties
- estimated payment patterns
- relevant elections where detectable

Do **not** assume every prior-return field can safely carry forward.

Track these as `sourceType: "prior_year"` facts, distinct from current-year facts. They may **inform** the current-year profile (expected properties, filing status seed) but must not silently become current-year wages/withholding.

### 11. Real estate / rentals

Use Moat’s existing `RealEstateInvestment` where possible. A property may have:

- property id, address, ownership percentage
- primary residence / rental / mixed use (`usageType` already exists)
- acquisition date, purchase price, land value, improvement basis
- loan, mortgage interest, property tax, insurance
- rent received, repairs, utilities, management fees, HOA
- improvements / capex
- depreciation data
- days rented / personal-use days

Do **not** become a complete depreciation engine in v1 unless related infrastructure already exists (it does not).

Design facts so these values have a clean home (`category: "real_estate"`, `sourceRealEstateId`). Link 1098 / rental documents to the property when issuer/address matches; otherwise leave unlinked and flag for review.

### 12. Investments / equity compensation

Connect cleanly to Moat’s investment model. Support **eventual** concepts:

realized gains/losses, short vs long term, wash sales, missing cost basis, dividend income, interest income, foreign tax, tax lots, RSUs, ESPP, ISOs, NSOs, exercise / vesting / sale events, withholding, AMT-related information.

Do **not** overbuild an equity-compensation tax engine now.

Create extensible `TaxFact.type` / form schemas instead of assuming “investment tax = 1099-B totals.” 1099-B v1 stores lots when present; missing basis is a review item, not a guessed number.

There is no RSU/ISO/NSO table today — use document-derived facts + metadata (`equityAwardType`) rather than inventing a full equity ledger.

### 13. Manual tax facts

Users can enter information manually. Examples:

- cash charitable donation
- estimated tax payment
- unreimbursed business expense
- rental expense
- basis adjustment
- dependent information
- childcare expense
- education expense

Manual facts use the **same** `TaxFact` / provenance system: `sourceType = "manual"`, `sourceManualEntryId` set. They participate in reconciliation like any other fact.

### 14. Review and conflict resolution

Tax data will conflict. Example: Moat transactions suggest HSA contributions $8,000; Form 5498-SA says $8,300.

Do **not** silently overwrite facts.

Represent:

- conflicting facts (same `key` / tax year / user)
- preferred source
- confidence
- resolution state (`open` \| `accepted_document` \| `accepted_manual` \| `accepted_financial` \| `split` \| `dismissed`)

Document-derived official tax forms are **generally** stronger evidence than inferred transaction classifications, but do not hard-code unsafe assumptions everywhere. Official form vs official form (two W-2s, amended 1099) stays open until the user picks.

Reusable reconciliation layer in `@moat/domain` (`reconcileTaxFacts`). UI and MCP both consume its output.

### 16. Agent-optimized tax context

For each tax year, derive a compact structured context so agents do **not** inspect 100 PDFs every time.

Equivalent of:

```text
Tax year: 2026
Filing status: Married Filing Jointly
Taxpayer / Spouse / Dependents
Employment: SchoolAI W-2 — wages, federal withholding
Investments: Robinhood — dividends, ST/LT gain
Real estate: primary + rental
Deductions
Documents present
Missing / expected
Unresolved questions
```

Deterministic and structured. Avoid giant prose summaries as the canonical representation. Source references remain available via detail tools.

`TaxAgentContext` is derived from facts + readiness + documents — cacheable, regenerable, not a handwritten blob.

### 17. MCP server / agent tools

Follow existing MCP conventions (`moat.*` names, Zod contracts, `schemaEnvelope`, registry in cloud **and** desktop).

An external agent should help a user fill out taxes **without** dumping their entire financial database into context.

Tools (brief names → Moat names):

| Brief name | Contract name | Scope |
|------------|---------------|--------|
| `tax.getTaxYearSummary` | `moat.getTaxYearSummary` | `mcp:tax:read` |
| `tax.getReadiness` | `moat.getTaxReadiness` | `mcp:tax:read` |
| `tax.listDocuments` | `moat.listTaxDocuments` | `mcp:tax:read` |
| `tax.getDocument` | `moat.getTaxDocument` | `mcp:tax:read` |
| `tax.listTaxFacts` | `moat.listTaxFacts` | `mcp:tax:read` |
| `tax.getTaxFact` | `moat.getTaxFact` | `mcp:tax:read` |
| `tax.getIncomeSummary` | `moat.getTaxIncomeSummary` | `mcp:tax:read` |
| `tax.getWithholdingSummary` | `moat.getTaxWithholdingSummary` | `mcp:tax:read` |
| `tax.getInvestmentTaxSummary` | `moat.getTaxInvestmentSummary` | `mcp:tax:read` |
| `tax.getRealEstateTaxSummary` | `moat.getTaxRealEstateSummary` | `mcp:tax:read` |
| `tax.getDeductionSummary` | `moat.getTaxDeductionSummary` | `mcp:tax:read` |
| `tax.getRetirementTaxSummary` | `moat.getTaxRetirementSummary` | `mcp:tax:read` |
| `tax.getBusinessTaxSummary` | `moat.getTaxBusinessSummary` | `mcp:tax:read` |
| `tax.getEstimatedPayments` | `moat.getTaxEstimatedPayments` | `mcp:tax:read` |
| `tax.getPriorYearCarryforwards` | `moat.getTaxPriorYearCarryforwards` | `mcp:tax:read` |
| `tax.getMissingInformation` | `moat.getTaxMissingInformation` | `mcp:tax:read` |
| `tax.getItemsNeedingReview` | `moat.getTaxItemsNeedingReview` | `mcp:tax:read` |
| `tax.searchTaxData` | `moat.searchTaxData` | `mcp:tax:read` |

Every list/get tool takes `taxYear` (required except when `id` uniquely identifies a row). Defaulting the year in the host is fine; the tool schema still requires it so years cannot be mixed accidentally.

Required `taxYear` (or unique id) on every call. Tools return the **minimum** data for that question.

Potential agent workflow:

1. `moat.getTaxYearSummary`
2. Decide which section of FreeTaxUSA / TurboTax / the user question is in play
3. Request only the relevant subsection tool
4. Inspect exact source facts/documents only if needed
5. Return a value **with provenance**

Example — “What do I enter for W-2 Box 1 from SchoolAI?”

```json
{
  "value": 180420.22,
  "source": {
    "document": "SchoolAI W-2",
    "form": "W-2",
    "box": "1"
  },
  "confidence": "verified"
}
```

Example — “What were my charitable contributions?”

Do **not** collapse uncertain and confirmed values:

```json
{
  "confirmed": 4200,
  "potential": 2742,
  "potentialTransactionCount": 12
}
```

MCP tools must be small, predictable, typed, composable, and provenance-aware.

Avoid one giant `getEverythingForTaxes` as the only interface. A high-level summary tool is good; detailed tools still exist.

Default `mcp:tax:read` is **not** in `defaultMcpScopes` today (same as insurance/profile). Keep it opt-in via privacy settings. Add `mcp:tax:write` for future confirm/manual tools; v1 may ship read tools first and keep write on HTTP/IPC only if that matches retirement’s split — prefer adding write tools for confirm/reject when the HTTP mutations exist, with `requiresConfirmation`.

### 18. MCP safety / disclosure

Tax data is sensitive. Follow existing authorization patterns (`effectiveUserId`, household membership, profile switcher).

Do not expose:

- tax data from another profile
- another family member’s tax facts (unless they belong to the active profile’s ledger)
- another tax year unintentionally
- original documents unless **explicitly** requested (`moat.getTaxDocument` returns metadata + fact summaries by default; bytes/signed URL only with `includeOriginal: true` and `mcp:tax:read`, still scoped)

Return the minimum data appropriate to the tool. Important financial values expose provenance.

Never log SSNs, EINs, account numbers, raw document text, or original filenames.

`moat.getTaxDocument` must not dump parsed full text by default. Add `includeParsedText` as an explicit flag.

### 20. CPA / tax preparer export

Architecture so we can eventually provide a “Tax Package.” **No polished export format required in v1** unless it falls out of the JSON summary cheaply.

Structure data so we could later generate:

- summary PDF
- CSV
- JSON
- source document bundle
- CPA handoff package

A CPA should eventually receive: Tax Summary, Supporting Documents, Open Questions, Source Transactions, Relevant Account Summaries.

v1: `TaxYearProfile` + `TaxAgentContext` + document metadata list is the package substrate. Optional `moat.getTaxYearSummary` is the agent-facing JSON package.

### 24. Extensibility

Design for future providers. Do **not** implement fictional integrations today.

```ts
interface DocumentParserProvider { /* TaxDocumentParser */ }

// Future — interfaces only if they clarify boundaries; no fake adapters
interface TaxEstimator { estimate(profile: TaxYearProfile): TaxEstimate }
interface TaxRulesEngine { … }
interface TaxFilingProvider { … }
interface TaxExportProvider { … }
```

Someday filing providers might include FreeTaxUSA, TurboTax, Column Tax, IRS Direct, Moat Tax. Avoid architecture that makes them impossible (e.g. encoding “this number is a TurboTax field” as the primary key).

`TaxEstimator` in v1 is a **coarse, labeled** estimate (refund vs owed direction + rough magnitude) driven by confirmed wages/withholding/documented deductions — **not** a complete Form 1040 engine. If confidence is low, return `insufficient`.

### Suggested Prisma / SQLite sketch

Mirror in `apps/api/prisma/schema.prisma` **and** `packages/db-sqlite/prisma/schema.prisma`. Commit Postgres migrations; never `db push` on Neon. FORCE RLS on new public tables.

```prisma
model TaxDocument {
  id                    String   @id @default(cuid())
  userId                String
  taxYear               Int
  documentCategory      String
  formType              String?
  issuer                String?
  recipient             String?
  source                String
  originalFilename      String
  mimeType              String
  uploadedAt            DateTime @default(now())
  processingState       String
  parserProvider        String?
  parserVersion         String?
  extractionConfidence  Float?
  originalStorageKey    String
  parsedStorageKey      String?
  reviewStatus          String
  userConfirmed         Boolean  @default(false)
  metadata              Json?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  facts                 TaxFact[]
  formExtractions       TaxFormExtraction[]

  @@index([userId, taxYear])
  @@index([userId, processingState])
}

model TaxFact {
  id                   String   @id @default(cuid())
  userId               String
  taxYear              Int
  category             String
  type                 String
  key                  String
  value                Json
  valueType            String
  unit                 String?
  currency             String?
  sourceType           String
  sourceDocumentId     String?
  sourceTransactionId  String?
  sourceAccountId      String?
  sourceHoldingId      String?
  sourceManualEntryId  String?
  sourceRealEstateId   String?
  sourceForm           String?
  sourceBox            String?
  sourcePage           Int?
  sourceText           String?
  confidence           Float
  extractionMethod     String
  status               String
  userConfirmed        Boolean  @default(false)
  metadata             Json?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  sourceDocument       TaxDocument? @relation(fields: [sourceDocumentId], references: [id], onDelete: SetNull)

  @@index([userId, taxYear])
  @@index([userId, taxYear, key])
  @@index([sourceDocumentId])
}

model TaxFormExtraction {
  id          String   @id @default(cuid())
  userId      String
  documentId  String
  formType    String
  schemaVersion String
  payload     Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  document    TaxDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([userId, documentId])
}

model TaxFactConflict {
  id                String   @id @default(cuid())
  userId            String
  taxYear           Int
  factKey           String
  factIds           String[]
  preferredFactId   String?
  resolutionState   String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId, taxYear])
  @@unique([userId, taxYear, factKey])
}
```

`TaxYearProfile` and `TaxReadiness` are **not** persisted as sources of truth. Optional cache table for `TaxAgentContext` is allowed if regeneration is expensive; it must be invalidated when facts/documents change.

### HTTP / IPC surface (illustrative)

Mirror retirement’s action-style endpoints:

| Action | Wrapper | Purpose |
|--------|---------|---------|
| `getOverview` | `withDemoOrAuth` | Cards + attention + estimate |
| `getReadiness` | `withDemoOrAuth` | Score + reasons |
| `getYearProfile` | `withDemoOrAuth` | Tax Details projection |
| `getAgentContext` | `withDemoOrAuth` | Structured agent summary |
| `listDocuments` / `getDocument` | `withDemoOrAuth` | Metadata; original bytes via signed/local fetch |
| `uploadDocument` | `withAuth` | Store + enqueue parse |
| `reprocessDocument` | `withAuth` | Retry parse |
| `listFacts` / `getFact` | `withDemoOrAuth` | Filter by year, category, status, document |
| `createManualFact` / `updateFact` / `confirmFact` | `withAuth` | Manual + review |
| `listConflicts` / `resolveConflict` | `withAuth` on write | Reconciliation |
| `listYears` | `withDemoOrAuth` | Years with data + current default |

Desktop: `TAX_CHANNELS` in `packages/contracts/src/ipc/taxes.ts`, handlers in `apps/desktop/src/main/ipc/taxes.ts`.

OpenAPI: add the same paths under `/api/v1/taxes/` in `packages/openapi/api-v1.yaml` and regenerate the client.

---

## Implementation Plan

Prioritize in this order (from the product brief):

1. Canonical data model (contracts + schema + repository)
2. Documents + ingestion + file storage
3. Parser provider abstraction (Unstructured first)
4. TaxFact + provenance
5. Tax-year profile (derived)
6. Overview UI
7. Documents UI
8. Tax Details UI
9. Tax readiness
10. MCP tax tools
11. iOS UI
12. Clean extensibility (estimator / filing / export interfaces as comments or empty modules — no fake providers)

### Phase 1 — Domain, schema, storage

1. Add Zod types in `packages/contracts/src/taxes/`.
2. Prisma + SQLite models + Postgres migration + RLS.
3. `TaxRepository` + Postgres/SQLite implementations + `AppContext.repositories.taxes`.
4. `FileStorageProvider` + cloud private R2 + desktop vault adapter.
**Acceptance criteria:** A document metadata row and a manual `TaxFact` can be written and read for `userId` + `taxYear` on both Postgres and SQLite; another user/profile cannot see them.

### Phase 2 — Parse + normalize + reconcile

1. `TaxDocumentParser` + Unstructured adapter.
2. Form classifier + W-2 / 1099-INT / 1099-DIV / 1099-B (lots) / 1099-NEC|MISC|K / 1098 / 1098-E / 5498 / 5498-SA / extensible K-1 schemas.
3. Fact extraction + provenance.
4. Financial-data candidate generation (donations, medical, education, property tax, HSA, mortgage from real estate).
5. `reconcileTaxFacts`.
**Acceptance criteria:** Fixture W-2 produces Box 1/2 facts with document + box provenance; donation transactions become candidates, not confirmed deductions; 5498-SA vs transaction HSA conflict stays open.

### Phase 3 — Readiness, profile, estimator stub

1. Relevance detection from profile + accounts + real estate + facts.
2. Readiness score + missing / unresolved / review items.
3. `buildTaxYearProfile` + `buildTaxAgentContext`.
4. Coarse estimated result only when enough confirmed employment + withholding facts exist.
**Acceptance criteria:** Homeowner-with-brokerage fixture expects W-2 + 1099 + 1098; reasons are machine-readable; estimate is hidden when insufficient.

### Phase 4 — Shared web/desktop UI

1. `@moat/features/taxes` page + tabs + year switcher.
2. Thin web/desktop routes, nav, command palette, `MoatApiClient` + IPC.
3. Upload, document detail, Tax Details, review/confirm, Ask Moat CTA.
4. Web agent `clientContext.taxYear`.
**Acceptance criteria:** Web and desktop render the same tree; year switch filters all tabs; empty and failed-parse states are visible.

### Phase 5 — MCP

1. Contracts, output schemas, scopes (`mcp:tax:write` if mutations are exposed).
2. Cloud `apps/mcp/src/tools/taxes.ts` + desktop gateway mirror.
3. Privacy-domain label update.
**Acceptance criteria:** Summary → subsection → fact provenance workflow works; tools refuse the wrong `taxYear` / other profile; documents are metadata-default.

### Phase 6 — iOS UI

1. `AppDestination.taxes`, feature module, year selector, cards, details, documents, Ask Moat entry.
2. Codable models aligned with contracts.
**Acceptance criteria:** Native screens match the IA; no WebView; pull-to-refresh and design-system rules followed.

---

## Acceptance Criteria

- [ ] `/taxes` exists on web and desktop; Taxes appears in wealth nav and command palette.
- [ ] Default view is tax-year scoped; year switching is obvious and filters Overview, Documents, Tax Details, and Ask Moat context.
- [ ] Overview shows readiness, documents expected vs present, key fact rollups, needs-attention, and estimated result **or** an explicit insufficient-data state.
- [ ] Users can upload PDF/images; processing states are visible; document detail opens.
- [ ] Parsing goes through `TaxDocumentParser`; Unstructured is an adapter only; domain types have no Unstructured shapes.
- [ ] Original file, parsed representation, and `TaxFact`s are all retained; facts are the query path.
- [ ] Every material number has provenance (source type + document/form/box or transaction/account ids).
- [ ] Form schemas exist for the high-volume forms listed in §6; unknown forms still produce generic facts + raw text fallback.
- [ ] `TaxYearProfile` is derived from facts, not a second writable ledger.
- [ ] Financial-data inferences are `candidate` until confirmed; UI copy says so.
- [ ] Readiness is deterministic and inspectable; relevant categories come from known user context.
- [ ] Prior-year returns upload and produce `prior_year` facts, not silent current-year overwrites.
- [ ] Real-estate facts reference `RealEstateInvestment` ids; no parallel property table.
- [ ] Investment/equity types are extensible; 1099-B can store lots; no fake cost basis.
- [ ] Manual facts use the same `TaxFact` model with `sourceType = manual`.
- [ ] Conflicts are stored and surfaced; nothing is silently overwritten.
- [ ] Tax Details rows show value + source + status and click through to evidence.
- [ ] `TaxAgentContext` is structured and year-scoped.
- [ ] MCP tools in the table above exist on cloud and desktop registries; names are `moat.*`; values include provenance; confirmed vs potential are not collapsed.
- [ ] MCP cannot read another profile or another year by omission; original bytes are opt-in.
- [ ] Ask Moat starter questions exist; selected year is context on web.
- [ ] iOS has a native Taxes destination with the listed screens.
- [ ] File bytes are not in relational rows; cloud blobs are private; desktop uses vault file refs.
- [ ] Cloud R2 document storage is capped at 100 MB combined per tax year per user; desktop local storage is unlimited.
- [ ] Zod validation everywhere; no `any`; handlers use wrappers; domain sits outside UI.
- [ ] Tests cover the fixtures and domain behaviors listed below.
- [ ] Financial Profile `#taxes` and Retirement taxes tab still exist and are not broken.

---

## Tests

Domain tests (`node:test` / existing `@moat/domain` style) around:

- tax fact normalization
- document parsing normalization (fixture Unstructured-like payload → `ParsedTaxDocument` → facts)
- readiness determination
- provenance attached on every extracted money fact
- conflict / reconciliation
- tax-year filtering
- profile isolation (`userId`)
- MCP response shapes (confirmed vs potential; no original bytes by default)

Realistic fixtures:

| Fixture | Intent |
|---------|--------|
| W-2 employee | Single W-2, simple Overview |
| W-2 + brokerage | Expected 1099; investment cards |
| Married couple, two W-2s | Household + two employers, no collapsed wages |
| Homeowner | Expected 1098 from `RealEstateInvestment` + mortgage |
| Rental property owner | Rental section + expense review |
| Self-employed 1099 user | NEC/MISC income; SE flag from profile |
| Investor with 1099-B | Lots + missing basis review |
| Complex user with conflicts | HSA / donation mismatches stay open |

Do not log fixture SSNs or production-like EINs in test names/output beyond obviously fake values (`00-0000000`).

---

## Non-Goals

Do **not** spend significant time on:

- calculating a perfectly accurate federal tax return
- implementing every IRS form
- e-filing a return
- scraping TurboTax or FreeTaxUSA
- building every state’s tax rules
- a full depreciation engine
- a full equity-compensation tax engine
- replacing Financial Profile or Retirement tax UIs
- storing tax facts as `UserMemory`
- public blob URLs for tax documents
- a polished CPA PDF/CSV package (substrate only)
- Opportunities / Filing / CPA Export tabs beyond placeholders
- a new iOS LLM client
- widening `FinancialProfileData.taxProfile` into the fact graph

---

## Open Questions

Resolved in this spec by matching existing Moat patterns (no need to block implementation):

- Shared UI lives in `@moat/features/taxes`, primitives from `@moat/ui` — not a parallel `packages/ui` feature tree. The brief’s “packages/ui” maps to design-system primitives; feature pages already live in `@moat/features`.
- MCP names use the `moat.` prefix.
- Existing `TaxProfile` stays; new derived type is `TaxYearProfile`.
- Cloud files use a `FileStorageProvider` with a private Cloudflare R2 bucket as the first adapter (not Vercel Blob, not the public downloads CDN).

Still optional product polish (do not block v1):

- Exact readiness weights per category (implementer: equal weight across *relevant* categories, document the formula in code).
- Whether Financial Profile Taxes card should deep-link to `/taxes` only, or also keep inline edits for planning fields (keep inline edits; add a “Open Taxes” link).
- When to add `mcp:tax:read` to a default scope preset (keep opt-in).

---

## Related Specs

- **Follow-up:** [taxes-v2/spec.md](../taxes-v2/spec.md) — Form 1040 math, form registry, state/depreciation/equity engines, CPA package, e-file providers. First step is a post-v1 accuracy review. Do not start it until this spec has shipped.
- [federal-rules/spec.md](../federal-rules/spec.md) — versioned IRS/SSA tables by tax year
- [retirement/spec.md](../retirement/spec.md) — shared-feature + MCP + iOS template; retirement tax engine is **not** this product
- [complete/shared-onboarding/spec.md](../../complete/shared-onboarding/spec.md) — web/desktop package boundary
- [complete/insurance-policy-intake/spec.md](../../complete/insurance-policy-intake/spec.md) — upload/blob cautionary precedent
- [row-level-security/spec.md](../row-level-security/spec.md) — new tables
- [account-switcher/spec.md](../account-switcher/spec.md) — profile isolation
- [shared-csv-transaction-import/spec.md](../shared-csv-transaction-import/spec.md) — import UX, not tax docs
- [docs/patterns/mcp-tools.md](../../../docs/patterns/mcp-tools.md)
- [docs/patterns/auth-permissions.md](../../../docs/patterns/auth-permissions.md)
- [apps/api/docs/patterns/prisma-and-migrations.md](../../../apps/api/docs/patterns/prisma-and-migrations.md)

---

## Implementation deliverable (when this spec is built)

The implementing PR/series should close with:

1. Summary of the architecture created
2. Database / schema changes
3. New shared UI / components
4. Web / desktop routes / screens
5. iOS screens / components
6. Document parsing architecture
7. TaxFact model and provenance design
8. MCP tools added
9. Tests added
10. Anything intentionally deferred
11. Architectural risks or decisions to review
12. Recommended next 3 phases after that implementation

Recommended next phases **after** v1 (do not do these in the first implementation):

See **[taxes-v2/spec.md](../taxes-v2/spec.md)**. That follow-up starts with a review that the shipped v1 still matches this spec, then: Form 1040 math, form registry, state / depreciation / equity engines, CPA package, and `TaxFilingProvider` e-file. Scraping tax software stays out of scope.

---

## Suggested Commit Message

```text
docs: adds taxes feature spec
```
