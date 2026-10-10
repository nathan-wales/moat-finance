# Taxes v2 — Calculation, Filing, Engines, and CPA Package

## Status

Draft. Created September 12, 2026 as a **follow-up** to [taxes/spec.md](../taxes/spec.md) (Taxes v1). Do not implement this spec until v1 has shipped and **Phase 0** has reviewed that implementation against the v1 agreement.

v1 explicitly deferred the work below. This spec picks it up:

- accurate Form 1040 math
- expanding IRS form coverage toward a complete, registry-driven catalog
- e-file through a filing-provider interface
- full state tax engines
- a full depreciation engine
- a full equity-compensation tax engine
- a polished CPA / tax-preparer package

It does **not** pick up scraping TurboTax, FreeTaxUSA, or any other tax-preparation product. That remains a non-goal. v1 designed `TaxFilingProvider` / `TaxExportProvider` so Moat can hand structured facts to software, a CPA, or a future Moat Tax layer without becoming a clone or a scraper.

---

## Goal

After Taxes v1 is the system of record for **facts + provenance**, make those facts computable, complete, and portable:

1. Compute a **provenance-backed federal Form 1040-style result** from confirmed `TaxFact`s and official federal-rules tables.
2. Grow form coverage through a **registry** so adding an IRS form is a schema + extractor + fact-projection change, not a new product.
3. Run **state**, **depreciation**, and **equity-compensation** engines that write the same `TaxFact` / provenance model.
4. Ship a **CPA Tax Package** (summary PDF, CSV, JSON, source-document bundle, open questions).
5. File or export through a **`TaxFilingProvider`** — partner/official APIs or generated packages — never by scraping tax software.

Success means:

- Phase 0 produces a written v1 accuracy review. If v1 drifted, this spec is updated before calculation/filing work starts.
- A user with confirmed v1 facts can see a line-aware federal estimate (Form 1040 + core schedules) where every material line cites facts, not a black-box total.
- A CPA can download a package that a human can audit: summary, documents, open questions, source transactions, account summaries.
- An agent can ask for a 1040 line, a state result, or a depreciation schedule through small `moat.*` tools and get `{ value, source, confidence }` — same contract as v1.
- Switching filing destinations (CPA export, partner e-file, future Moat Tax) does not require a new fact model.

---

## Product Context

[taxes/spec.md](../taxes/spec.md) is the parent. Read it first. The product principle does not change:

> Moat already understands the user’s financial life. The user adds the documents Moat cannot know. Moat reconciles those sources into a trusted tax data layer. From there: Moat → tax software, CPA, AI agent, filing API, or future Moat Tax.

v1 built the **data layer and workspace**. v2 builds the **computation, completeness, and handoff** layers that v1 left as empty extension points (`TaxEstimator`, `TaxRulesEngine`, `TaxFilingProvider`, `TaxExportProvider`).

v1 Overview may show “Likely refund” / “Likely amount owed” only when enough confirmed facts exist, and must not claim IRS accuracy. v2 is allowed to claim **line-level federal (and, where implemented, state) calculations** — still labeled as Moat’s computation until a filing provider accepts a return — and must still show provenance on every line.

This is **not** a TurboTax UI. The Taxes workspace stays a dashboard + review surface. Calculation results appear as inspectable statements and packages, not as a 1040 interview wizard.

---

## Prerequisite: Taxes v1

| Item | Location |
|------|----------|
| Parent spec | [../taxes/spec.md](../taxes/spec.md) |
| Roadmap entry | [../../roadmap.md](../../roadmap.md) — Taxes v1 under Planned until shipped |
| Parent non-goals this spec inherits as **goals** (except scraping) | Parent “Non-Goals” and “Recommended next phases after v1” |
| Parent architecture that v2 must not replace | `TaxFact`, `TaxYearProfile` (derived), `TaxDocument`, `TaxDocumentParser`, `FileStorageProvider`, `mcp:tax:read` / `moat.*` tools |

**Do not start Phase 1+ until Phase 0 is done.** If v1 is not implemented yet, this spec stays parked.

---

## Current Repo Context

Until Phase 0 runs against **shipped** v1, treat the following as the last known ground truth (September 12, 2026 / v1 spec-time). Phase 0 must replace this table with actual paths, types, and gaps.

### What v1 is supposed to have created

Cite the parent for the full map. Implementers should look for these after v1 lands — names may have shifted; Phase 0 records the real ones.

| Concern | Expected location after v1 | v2 relationship |
|---------|---------------------------|-----------------|
| Tax contracts | `packages/contracts/src/taxes/` | Extend; do not fork |
| Domain | `packages/domain/src/taxes/` | Add `calculation/`, `state/`, `depreciation/`, `equity/`, `export/`, `filing/` |
| Repositories | `TaxRepository` + Postgres/SQLite | Persist returns, packages, engine outputs as facts or versioned snapshots — not a second ledger |
| Shared UI | `packages/features/src/taxes/` | New tabs: Filing, CPA Export, Opportunities — v1 left these as placeholders |
| MCP | `apps/mcp/src/tools/taxes.ts`, desktop gateway mirror | Add calculation/export/filing **read** tools; writes stay scoped |
| Estimator stub | Parent: coarse refund/owed or `insufficient` | Replace with `TaxCalculator` consuming facts + federal-rules |
| Filing / export interfaces | Parent §24 — designed, not implemented | Implement for real |

### What already exists **outside** Taxes v1 (still true if v1 is not merged)

| Asset | Location | v2 relationship |
|-------|----------|-----------------|
| Planning `TaxProfile` | `packages/contracts/src/financial-profile-data.ts` | Still not the 1040 source of truth |
| Retirement tax projection | `packages/domain/src/retirement/taxes.ts` | **Do not reuse as the 1040 engine.** It is a lifetime planning estimate (ordinary + LTCG slice + flat state). Share **tables** via `@moat/domain/federal-rules`, not this function. |
| Federal-rules registry | [federal-rules/spec.md](../federal-rules/spec.md), `packages/domain/src/federal-rules/` | **Required input** for statutory amounts. 1040 math must resolve brackets, standard deduction, and contribution limits by `taxYear` with official vs estimated labels. |
| Real estate | `RealEstateInvestment` (`usageType`, purchase, loan, rent, expense fields) | Depreciation engine attaches to these ids; no parallel property table |
| Holdings | `PlaidHolding.costBasis` (display), no tax lots / RSU / ISO / NSO tables | Equity engine extends v1 fact types + new event records; do not assume a trade ledger exists |
| MCP tax scope | `mcp:tax:read` in `packages/mcp-contracts/src/scopes.ts` | Calculation outputs are tax data — same scope. Add `mcp:tax:write` for file/export confirmations if not already added in v1. |
| Object storage | Parent `FileStorageProvider` (private blob / vault) | CPA document bundles reuse it |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Parent fact / provenance / reconciliation rules | [taxes/spec.md](../taxes/spec.md) §§5, 7, 8, 14, 18 | v2 engines **emit `TaxFact`s**. They do not silently overwrite. |
| Federal-rules official vs estimated | `packages/domain/src/federal-rules/` | Never label an estimated future-year table as an IRS fact |
| Shared Taxes page + year chrome | `@moat/features/taxes` | Calculation and packages are year-scoped like everything else |
| Auth wrappers | `withAuth` / `withDemoOrAuth` | Filing and package generation are `withAuth` |
| Profile isolation | `effectiveUserId` | Same as v1 — no cross-profile leak |

---

## Phase 0 — Review v1 for accuracy (mandatory first step)

This phase is the first implementation work on this spec. It produces a review document, not engines.

Write `specs/features/taxes-v2/v1-accuracy-review.md` (or update this spec’s Status + Current Repo Context in place) after reading **shipped** code, not this file’s expected-path table.

### 0.1 Confirm v1 actually shipped

- [ ] Taxes destination exists on web, desktop, and iOS per v1 acceptance criteria.
- [ ] `TaxFact`, `TaxDocument`, derived `TaxYearProfile`, readiness, and MCP tools exist and match the parent contracts **or** the review records the rename/drift.
- [ ] Parser provider abstraction exists; Unstructured (or successor) is an adapter, not the domain model.
- [ ] File bytes are not in relational rows; cloud objects are private.

If v1 is incomplete, **stop**. Finish v1. Do not start 1040 math on a missing fact graph.

### 0.2 Diff shipped v1 against [taxes/spec.md](../taxes/spec.md)

Walk the parent’s Acceptance Criteria, Tests/fixtures, Architecture sketch, and Non-Goals. For each item record:

| Parent requirement | Shipped? | Actual path / type | Drift | Implication for v2 |
|--------------------|----------|--------------------|-------|---------------------|
| … | yes / no / partial | … | … | … |

Especially verify:

- Provenance is still mandatory and inspectable.
- `TaxYearProfile` is still derived, not a second writable ledger.
- Financial-data facts are still candidates until confirmed.
- Conflicts are still stored; nothing silent-overwrites.
- MCP tools are still small, year-scoped, and metadata-default for documents.
- Existing `TaxProfile` JSON was **not** widened into the fact graph.
- Retirement `taxes.ts` was **not** reused as filing math.

### 0.3 Re-validate v1 product principles for v2

Confirm these are still true after v1. If product has changed, update **this** spec before coding.

1. Moat is the system of record for tax facts, not a tax-prep interview UI.
2. Parsed text is evidence, not the primary model.
3. Do not scrape TurboTax / FreeTaxUSA / IRS online accounts.
4. Filing and export are providers behind interfaces.
5. Confirmed vs potential values stay uncollapsed.

### 0.4 Inventory what v1 already approximated

v1 allowed a coarse `TaxEstimator` stub. Phase 0 must answer:

- What does Overview “estimated result” actually compute today?
- Which form schemas shipped (W-2, 1099-*, 1098, 5498, K-1 stub, …)?
- Which `TaxFact.type` keys exist? Publish the live catalog in the review.
- Did anyone persist a `TaxYearProfile` row despite the parent saying derived-only?
- Which placeholder tabs exist (Opportunities / Filing / CPA Export)?
- What MCP tools shipped vs the parent table?

### 0.5 Phase 0 exit

- [ ] Review doc committed.
- [ ] Parent spec Status updated if v1 is complete or superseded in part.
- [ ] This spec’s Current Repo Context rewritten with **real** post-v1 paths.
- [ ] Open Questions below resolved or explicitly carried forward.
- [ ] No v2 engine work started until the above is true.

---

## Target Experience

Year chrome and Overview / Documents / Tax Details / Ask Moat stay as in v1. v2 fills the placeholder destinations.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  2026 Taxes                                           [ 2026 ▾ ]         │
│                                                                          │
│  Federal result (calculated)     State result          CPA package       │
│  $3,420 refund · 1040            CA · $890 owed        Ready to export   │
│  Every line has a source         3 states not modeled  Updated Sep 12    │
│                                                                          │
│  [ Overview ] [ Documents ] [ Tax Details ] [ Calculation ]              │
│  [ Filing ] [ CPA Export ] [ Ask Moat ]                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Calculation

A Calculation (or Tax Details expansion) view that looks like a **statement**, not an IRS PDF recreation:

```text
Form 1040 — 2026                          Source
1   Wages                                 $180,420    SchoolAI W-2 Box 1
2b  Taxable interest                      $1,102      1099-INT
3a  Qualified dividends                   $2,850      1099-DIV
7   Capital gain (or loss)                $4,200      1099-B lots
11  AGI                                   $…
15  Taxable income                        $…
24  Total tax                             $…
33  Total payments                        $31,224     W-2 Box 2
34  Refund / 37 Amount owed               $3,420
```

Tapping a line opens contributing facts, conflicts, and confidence. Lines that used estimated federal-rules tables say so. Missing required inputs show “Not computed” rather than a guessed number.

Simple filers (1 W-2, 1 brokerage, 1 mortgage) see a short statement. Schedules C / E / D / equity AMT appear only when facts make them relevant — same progressive-disclosure rule as v1.

### Filing

Not a scraped TurboTax session.

- Choose a destination: **CPA package**, **export JSON/CSV**, **partner e-file** (when a provider is configured), future **Moat Tax**.
- Show eligibility: missing facts, unresolved conflicts, unconfirmed candidates.
- E-file requires explicit user confirmation (`withAuth`, MCP `requiresConfirmation`).
- Never tell the user Moat “filed with TurboTax” unless a real provider integration exists.

### CPA Export

Polished package, not a raw JSON dump:

- Tax summary PDF (human-readable, line + source)
- CSV of facts and of 1040/state lines
- JSON (`TaxYearProfile` + calculation + readiness + open questions)
- Source document bundle (originals via `FileStorageProvider`)
- Open questions / needs-attention list
- Optional source-transaction appendix for candidate deductions (ids + amounts + categories — follow no-PII logging; the package itself is user-owned)

### Ask Moat

Starter questions added:

- Walk me through my 1040.
- Where did line 1a come from?
- What would a CPA need from me this week?
- Export my tax package.
- Do I have wash sales or missing basis that change Schedule D?
- What is my rental depreciation this year?

Selected `taxYear` remains required context (v1 web `clientContext.taxYear`).

---

## Architecture / Data Model

v2 **adds engines and artifacts on top of v1 facts**. It does not replace `TaxFact` as source of truth.

```text
v1 TaxFacts + documents + readiness
        ↓
TaxRulesEngine / form registry   (statutory + form math)
        ↓
TaxCalculator                    (1040 + schedules + state)
        ↓
Calculated lines (facts or snapshot with provenance)
        ↓
TaxExportProvider / TaxFilingProvider
        ↓
CPA package · partner e-file · future Moat Tax
```

```ts
interface TaxCalculator {
  calculate(input: {
    userId: string;
    taxYear: number;
    facts: TaxFact[];
    profile: TaxYearProfile;
  }): Promise<TaxCalculation>;
}

interface TaxExportProvider {
  exportPackage(input: TaxPackageInput): Promise<TaxPackageArtifact>;
}

interface TaxFilingProvider {
  id: string;
  createSubmission(input: TaxFilingInput): Promise<TaxFilingSubmission>;
  getStatus(id: string): Promise<TaxFilingStatus>;
}
```

Do not implement fictional partners. Ship:

- `MoatJsonExportProvider` / `MoatCpaBundleProvider` (real)
- `TaxFilingProvider` interface + at most **one** real adapter when credentials and legal path exist
- Placeholder names (`FreeTaxUSAPartnerProvider`, `TurboTaxPartnerProvider`, `ColumnTaxProvider`, `IRSDirectProvider`, `MoatTaxProvider`) stay comments until a contract exists

### Accurate Form 1040 math

Build a **line-oriented** federal calculator in `packages/domain/src/taxes/calculation/`.

- Inputs: confirmed `TaxFact`s (and explicitly included user-confirmed candidates). Never mix unconfirmed financial-data candidates into refund/owed without labeling them as scenario/what-if.
- Statutory numbers: `@moat/domain/federal-rules` for that `taxYear`. Official vs estimated must surface on the result.
- Output: `TaxCalculation` with `lines[]` `{ form, line, description, amount, factIds[], confidence, status }`.
- Core v2 federal surface (Phase 0 may narrow/widen after seeing v1 facts):
  - Form 1040
  - Schedule 1 (additional income / adjustments)
  - Schedule A when itemizing
  - Schedule B when interest/dividends require it
  - Schedule D + Form 8949 from 1099-B lots
  - Schedule E when rental facts exist
  - Schedule C when business/1099-NEC facts exist (ordinary; not a full bookkeeping product)
  - SE tax when self-employment income exists
- Every line stores provenance back to facts (and thus to documents/transactions).
- Do not call retirement `packages/domain/src/retirement/taxes.ts`. If brackets are duplicated, delete the duplicate and import federal-rules.

“Accurate” here means: deterministic, tested against fixtures, line-traceable, using official tables for that year — **not** “Moat is your tax attorney.” UI copy: “Moat calculated” / “Ready to export,” not “IRS accepted” until a filing provider says so.

### IRS form catalog (“every form”)

Do not hard-code a second ad-hoc list in UI.

```text
packages/contracts/src/taxes/forms/
  registry.ts          # form id, tax years in force, schema, extractor id
  w-2.ts
  1099-*.ts
  1040.ts
  schedules/*.ts
  …
```

v1 already required high-volume information returns. v2:

1. Inventories shipped forms in Phase 0.
2. Adds calculation forms (1040 and schedules above).
3. Expands information-return coverage in priority order: remaining 1099s, 2439/4800-series as needed, state equivalents, less common credits (e.g. 8863, 8880, 8889, 8959/8960) **when facts exist**.
4. Unknown uploads still become generic facts + text fallback (v1 rule).

“Every IRS form” is the **north star of the registry** (easy to add, none require a new architecture). It is not a single-PR promise to implement every obscure form. Phase 0 + the live `TaxFact.type` catalog decide the next slice. Do not block 1040 math on complete catalog coverage.

### State tax engines

```text
packages/domain/src/taxes/state/
  types.ts
  registry.ts          # state → engine
  federal-taxable-income.ts
  states/ca.ts
  states/ny.ts
  …
  fallback/flat-or-unsupported.ts
```

- Relevance from profile location + part-year / multi-state facts (explicit; do not guess residency).
- Each engine consumes the federal calculation + state-specific facts (state W-2 boxes, 1099 state withholding, residency days).
- Unsupported states: `status: "unsupported"` with no invented liability — same honesty as v1 `insufficient`.
- Full coverage is the goal of this **program**, shipped incrementally (high-population + user-base states first). Phase 0 records which states to start with; do not pretend a flat `estimatedStateTaxRate` from `TaxProfile` is a state engine.

Do not reuse retirement’s single `stateTaxRate` as California/NY math.

### Depreciation engine

v1 forbade a full depreciation engine. v2 builds one that still attaches to `RealEstateInvestment` (and future asset facts), not a shadow property database.

Cover at minimum:

- Basis: purchase + improvements − land (land is not depreciated; missing land value is a review item, not 0)
- Placed-in-service date, recovery period, convention (residential rental 27.5 / MACRS as applicable)
- Current-year depreciation, accumulated, remaining
- Partial year / mid-month
- Personal-use / days-rented allocation for mixed use
- §179 / bonus only when a fact says they were elected — do not auto-elect

Outputs are `TaxFact`s (`real_estate.depreciation.current`, etc.) with `sourceRealEstateId` and engine version in metadata. Schedule E lines consume them.

Not in the first slice unless Phase 0 finds existing infrastructure: cost-segregation, listed property, vehicle mileage vs actual, full Form 4562 UI recreation.

### Equity-compensation tax engine

v1 allowed extensible types only. v2 models events without assuming “investment tax = 1099-B totals.”

Event types (facts + optional `TaxEquityEvent` records if Phase 0 finds no place to hang dates/quantities):

- RSU vest / withhold / sale
- ESPP purchase / disqualifying vs qualifying disposition
- ISO grant / exercise / sale (AMT spread vs regular tax)
- NSO grant / exercise / sale
- 83(b) when the user records it

Rules:

- Missing basis, missing FMV at vest/exercise, or missing holding period → review item, never a guessed gain.
- Wash sales and lot matching consume v1 1099-B lots when present.
- AMT-related outputs are facts with `category: "amt"`, not a second tax system buried in metadata.

Do not build a brokerage. Connect to existing holdings/accounts where ids exist.

### CPA package (`TaxExportProvider`)

Generate artifacts into `FileStorageProvider` (private). Persist `TaxExport` metadata: year, createdAt, artifact keys, included document ids, calculation id.

Contents:

| Artifact | Required in v2 |
|----------|----------------|
| Summary PDF | Yes |
| Facts CSV | Yes |
| Calculation-lines CSV | Yes |
| Structured JSON | Yes |
| Original document bundle | Yes |
| Open questions | Yes |
| Source-transaction appendix | Yes when candidate deductions are included |

PDF should feel like Moat (summary, sources, attention), not a photocopied 1040. Include the 1040-line statement as a section.

### E-file / tax software (`TaxFilingProvider`)

E-file is in scope **only** through a real provider:

- Authorized e-file partner, IRS MeF through a licensed transmitter, or a documented vendor API
- User confirmation, per-profile, per-year
- Store submission id + status + timestamps — not full return XML in logs
- Failures are visible; no silent “filed”

**Scraping tax software is out of scope.** No headless TurboTax/FreeTaxUSA/IRS Online Account automation, no stored site credentials for those products, no DOM mapping to their interview fields. The supported path to those products is:

1. CPA / JSON / CSV package the user (or an agent) uploads or types from
2. A future official partner adapter behind `TaxFilingProvider`

Phase 0 must re-confirm this. If a future partner requires a specific export shape, add a provider — do not scrape.

### MCP additions (after v1 tools)

Follow `docs/patterns/mcp-tools.md`. Suggested tools (rename in Phase 0 if v1 naming drifted):

| Contract name | Scope | Notes |
|---------------|--------|--------|
| `moat.getTaxCalculation` | `mcp:tax:read` | Federal (+ state if present) lines; provenance per line |
| `moat.getTaxFormLine` | `mcp:tax:read` | `{ form, line, taxYear }` → one value + sources |
| `moat.getTaxDepreciationSchedule` | `mcp:tax:read` | Per property |
| `moat.getTaxEquitySummary` | `mcp:tax:read` | Confirmed vs missing basis |
| `moat.getTaxStateSummary` | `mcp:tax:read` | Unsupported states explicit |
| `moat.getTaxPackage` | `mcp:tax:read` | Metadata + artifact refs; bytes opt-in |
| `moat.createTaxPackage` | `mcp:tax:write` | Confirmation required |
| `moat.getTaxFilingStatus` | `mcp:tax:read` | No original submission payload |

Same safety as v1: required `taxYear`, minimum data, no original documents unless asked, no other profile/year.

---

## Implementation Plan

### Phase 0 — V1 accuracy review

See above. **Gate for everything else.**

**Acceptance criteria:** review committed; this spec’s repo context updated; parent principles still hold.

### Phase 1 — Federal calculator + form registry

1. Form registry + 1040/schedule schemas.
2. `TaxCalculator` from confirmed facts + federal-rules.
3. Persist or deterministically recompute `TaxCalculation`; if persisted, invalidate on fact changes (same rule as v1 agent-context cache).
4. Calculation UI + `moat.getTaxCalculation` / `moat.getTaxFormLine`.
5. Tests: v1 fixtures plus known 1040 cases (single W-2; MFJ two W-2s; Schedule D with missing basis excluded from totals until resolved).

**Acceptance criteria:** line-level federal result with provenance; unconfirmed candidates excluded from the filed/export number unless the user opts into a “what-if” calculation.

### Phase 2 — CPA package

1. `TaxExportProvider` + PDF/CSV/JSON/bundle.
2. CPA Export tab.
3. `moat.createTaxPackage` / `moat.getTaxPackage`.

**Acceptance criteria:** a CPA can open the PDF and reconstruct every headline number from listed sources.

### Phase 3 — State engines

1. Registry + 2–3 first states (Phase 0 picks from user base).
2. Unsupported-state honesty.
3. State section on Calculation + MCP.

**Acceptance criteria:** no invented liability for unsupported states; supported states are fixture-tested.

### Phase 4 — Depreciation + equity engines

1. Depreciation schedule from `RealEstateInvestment` + improvement/land facts.
2. Equity event types + AMT/holding-period review items.
3. Feed Schedule E / D / AMT facts into `TaxCalculator`.

**Acceptance criteria:** missing land / missing FMV blocks the computed number and creates review items; no silent basis.

### Phase 5 — Filing provider

1. `TaxFilingProvider` + submission records.
2. Filing tab eligibility.
3. One real adapter **only** if a partner/legal path exists; otherwise ship the interface + package-as-handoff and stop.

**Acceptance criteria:** no scraping; no fake “filed with TurboTax” copy; confirmation required.

---

## Acceptance Criteria

- [ ] Phase 0 review exists and this spec’s Current Repo Context matches shipped v1.
- [ ] v1 fact/provenance/year/profile-isolation rules still hold; v2 does not introduce a second source of truth.
- [ ] Federal 1040-style calculation is line-oriented, deterministic, federal-rules-backed, and provenance-complete.
- [ ] Unconfirmed candidates cannot change refund/owed without an explicit what-if mode.
- [ ] Form coverage is registry-driven; adding a form does not require a new storage model.
- [ ] State results are either engine-backed or explicitly unsupported.
- [ ] Depreciation and equity engines emit `TaxFact`s with sources; missing inputs become review items.
- [ ] CPA package includes summary PDF, CSV, JSON, document bundle, and open questions.
- [ ] E-file only through `TaxFilingProvider` with a real adapter or not at all.
- [ ] No TurboTax / FreeTaxUSA / IRS scraping.
- [ ] MCP tools stay small, typed, year-scoped, and provenance-aware.
- [ ] Retirement planning tax engine remains separate.
- [ ] Tests include Phase 0-updated fixtures plus calculation, state (where implemented), depreciation, equity, and export.

---

## Tests

In addition to v1 fixtures (reused as calculator inputs):

| Fixture | Intent |
|---------|--------|
| Single W-2 1040 | Wages + withholding + standard deduction |
| MFJ two W-2s | Combined wages, correct filing-status brackets |
| Itemizers with 1098 + confirmed donations | Schedule A vs standard; take the computed better or user election — Phase 0 decides default |
| 1099-B lots with one missing basis | Schedule D omits or flags the lot; does not invent basis |
| Rental with land value + placed-in-service | Depreciation amount + Schedule E |
| Rental missing land value | No depreciation number; review item |
| ISO exercise + sale | Regular vs AMT facts; missing FMV → review |
| Unsupported state | `unsupported`, no liability |
| Conflicted HSA (v1 complex fixture) | Calculator uses resolved facts only |

Export tests: package contents and year isolation. Filing tests: confirmation gate; no adapter → no success status.

---

## Non-Goals

- Scraping or automating TurboTax, FreeTaxUSA, H&R Block, IRS Online Account, or state filing sites
- Recreating a full tax-prep interview UI
- Claiming legal/CPA advice or IRS acceptance without a provider
- Replacing Retirement’s lifetime tax projection
- Implementing every obscure IRS form in the first v2 slice (registry must make them additive)
- Cost-segregation / full 4562 product / brokerage execution
- Fictional filing-partner adapters
- Widening `FinancialProfileData.taxProfile` into calculation state
- Starting Phase 1+ before Phase 0

---

## Open Questions

Resolve in Phase 0 unless already decided:

- Did v1 persist any calculation or profile snapshot we must migrate?
- Which states to implement first?
- Default when standard deduction exceeds computed itemized: auto-better vs user election?
- Is there a licensed e-file transmitter, or is CPA/export the only v2 filing path?
- PDF renderer already in-repo vs new dependency (prefer existing if one exists after v1)?
- Should calculated lines be stored as `TaxFact`s (`sourceType` new value `calculated`) or only as a `TaxCalculation` snapshot? Prefer snapshot + fact ids so calculated numbers cannot be mistaken for source facts.

---

## Related Specs

- **Parent:** [taxes/spec.md](../taxes/spec.md) — v1 data layer, UI, MCP, iOS; this spec must not contradict it without an explicit Status update on the parent
- [federal-rules/spec.md](../federal-rules/spec.md) — statutory tables for 1040 / credits / limits
- [retirement/spec.md](../retirement/spec.md) — do not merge engines
- [row-level-security/spec.md](../row-level-security/spec.md)
- [docs/patterns/mcp-tools.md](../../../docs/patterns/mcp-tools.md)
- [apps/api/docs/patterns/prisma-and-migrations.md](../../../apps/api/docs/patterns/prisma-and-migrations.md)

---

## Suggested Commit Message

```text
docs: adds taxes v2 follow-up spec
```
