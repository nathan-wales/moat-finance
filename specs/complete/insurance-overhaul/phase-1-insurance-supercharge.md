# Phase 1 Insurance Supercharge - Repo-Aligned Implementation Plan

## Status

Draft, revised against the current Moat Finance repo context.

This plan supersedes the earlier broad cloud-vs-local architecture note. The product direction is still correct, but the implementation must account for the system that already exists:

- Web and desktop both render the shared financial profile UI from `packages/features/src/financial-profile`.
- The canonical shared TypeScript/Zod contract today is `FinancialProfileData.insurancePolicies` in `packages/contracts/src/financial-profile-data.ts`.
- Cloud stores that profile in Postgres as JSONB on `FinancialProfileData.insurancePolicies`.
- Desktop stores the same profile in local SQLite as stringified JSON through `@moat/db-sqlite`.
- The current UI is a simple policy table, not a type-specific insurance workflow.
- The current cloud MCP scopes do not include insurance-specific scopes or tools.

The robust path is therefore an incremental contract-first expansion, followed by normalized cloud/local persistence only when the shape is stable. Do not jump directly to a new parallel insurance subsystem that bypasses the shared contract, shared UI package, API wrappers, desktop IPC, or MCP contract package.

## Goal

Build a structured Insurance Profile that helps Moat Finance understand insurance coverage, premiums, renewal timing, financial exposure, and agent-safe summaries across cloud web, local desktop, and MCP.

Phase 1 should deliver cloud-safe insurance coverage intelligence and a strong foundation for the later local private vault. It should not store raw medical, claims, identity, or credential artifacts in the cloud.

Success means a user can enter meaningful insurance coverage details manually, Moat Finance can use those details for planning and agent summaries, the data contract works across web and desktop, and the implementation leaves a clean path to normalized tables and local-only private documents.

## Product Boundary

### Phase 1 Builds

- Manual insurance profile entry and editing.
- Type-specific insurance fields for common policy types.
- Coverage line items, covered assets, covered people/roles, premium cadence, renewal dates, and policy status.
- Cloud-safe privacy messaging near insurance entry points.
- Shared contracts and validation that web, API, desktop, and future MCP tools can reuse.
- Read-only, structured insurance summaries for agent/MCP use after the profile contract is in place.
- Backward-compatible migration from the current simple `InsurancePolicy` records.

### Phase 1 Does Not Build

- Cloud storage of raw PDFs, EOBs, claims, prescriptions, diagnoses, provider names, lab results, IDs, SSNs, tax IDs, payment cards, bank accounts, carrier credentials, or driver license/passport scans.
- Cloud OCR or upload-assisted extraction unless the Phase 2 safety controls are implemented first.
- Carrier API connectors.
- Claims management.
- Quote shopping, underwriting, enrollment, or broker workflows.
- Enterprise insurer/employer workflows.
- Local private document vault UI, except for copy and links that explain it is the right future surface for highly sensitive documents.

## Current Repo Context

### Existing Data Shape

The current contract is intentionally simple:

```ts
interface InsurancePolicy {
  id: string;
  name: string;
  type: "Health" | "Dental" | "Vision" | "Auto" | "Home" | "Renters" | "Life" | "Disability" | "Umbrella" | "Boat" | "Other";
  provider: string;
  premium: number;
  frequency: "Monthly" | "Quarterly" | "Semiannual" | "Annual";
  coverageAmount?: number;
  linkedAsset?: string;
  renewalDate?: string;
}
```

This shape is used by:

- `packages/contracts/src/financial-profile-data.ts`
- `packages/features/src/financial-profile/section-components/insurance-section.tsx`
- `apps/api/src/server/handlers/financial-profile.ts`
- `packages/db-sqlite/src/repositories/SqliteFinancialProfileDataRepository.ts`
- `packages/domain/src/financial-profile/getFinancialProfileData.ts`
- `apps/desktop/src/main/ipc/financial-profile-data.ts`

### Existing Gaps To Fix

- The API handler duplicates the financial profile Zod schema instead of importing the shared contract schema, which creates drift risk.
- The API handler directly upserts Prisma data; any meaningful insurance business logic should move behind a service layer.
- The shared insurance section is table-based and will exceed the component organization limits once a wizard is added. Split it into a folder before expanding it.
- The OpenAPI/client story is inconsistent: `apps/web/src/lib/http-api-client.ts` hand-writes `financialProfile` calls even though repo guidance says new or changed API contracts should be represented in `packages/openapi` and generated clients.
- MCP has no insurance-specific tools or scopes today. New tool names must follow the repo's `fin.*` MCP naming pattern, not `insurance.*`.

## Architecture Decision

Use a two-track architecture.

### Track A - Shared Profile Contract V2 First

For Phase 1, evolve `FinancialProfileData.insurancePolicies` into a richer backward-compatible contract. This keeps web and desktop aligned, avoids a large data migration before the product shape is proven, and lets the existing financial profile page continue to work during rollout.

The contract should support both legacy records and V2 records during migration. Prefer a `schemaVersion` field and normalizer utilities over destructive rewrites.

### Track B - Normalized Persistence After Contract Stabilizes

The target long-term model is still normalized:

- policy core
- coverage line items
- parties
- covered assets
- document metadata
- policy versions
- typed details by insurance type

Do not make the normalized tables the only source of truth until the shared contract, UI wizard, validation, and migration strategy are stable. If normalized cloud tables are introduced in the same initiative, they must be fed by a service that preserves compatibility with the existing financial profile reads and desktop JSON storage.

## Shared Contract V2

Update `@moat/contracts` first. Everything else should consume this contract.

### Required Top-Level Fields

```ts
interface InsurancePolicyV2 {
  schemaVersion: 2;
  id: string;
  type: InsurancePolicyType;
  providerName: string;
  policyName: string;
  policyNickname?: string;
  status: "active" | "pending" | "cancelled" | "expired" | "unknown";
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  renewalDate?: string;
  premiumAmount?: number;
  premiumCadence?: "monthly" | "quarterly" | "semiannual" | "annual" | "oneTime" | "unknown";
  source: "manual" | "uploadExtracted" | "api" | "imported";
  storageScope: "cloud" | "localPrivate";
  sensitivityTier: "low" | "moderate" | "highLocalOnly" | "forbidden";
  coverages: InsuranceCoverage[];
  parties: InsuranceParty[];
  assets: InsuranceCoveredAsset[];
  documents?: InsuranceDocumentReference[];
  details: InsuranceTypedDetails;
  review: InsuranceReviewState;
  createdAt?: string;
  updatedAt?: string;
}
```

### Policy Types

Use stable lower-camel values in V2 and provide conversion from current title-case values:

- `auto`
- `health`
- `dental`
- `vision`
- `life`
- `disability`
- `homeowners`
- `renters`
- `longTermCare`
- `umbrella`
- `boat`
- `other`

Map current `Home` to `homeowners` unless the user explicitly chooses renters.

### Coverage Lines

Coverage lines are the reusable core. They are preferable to one-off top-level fields.

```ts
interface InsuranceCoverage {
  id: string;
  coverageType: string;
  label: string;
  limitAmount?: number;
  deductibleAmount?: number;
  copayAmount?: number;
  coinsurancePercent?: number;
  maxBenefitAmount?: number;
  appliesTo?: string;
  notes?: string;
  sensitivityTier: "low" | "moderate" | "highLocalOnly" | "forbidden";
}
```

Cloud notes must be treated as moderate sensitivity and should show a warning when the policy type is health, disability, or long-term care. Do not allow notes that look like claims, diagnoses, prescriptions, provider visits, procedure codes, or medical records.

### Parties

Use parties for roles, not broad identity storage.

```ts
interface InsuranceParty {
  id: string;
  role: "policyholder" | "coveredPerson" | "beneficiary" | "dependent" | "listedDriver" | "owner" | "mortgagee" | "lienholder" | "other";
  displayName?: string;
  percentage?: number;
  relationship?: string;
  sensitivityTier: "low" | "moderate" | "highLocalOnly";
}
```

Cloud Phase 1 should avoid collecting dates of birth, SSNs, driver license numbers, full addresses for people, medical IDs, and dependent medical details. If beneficiary names or percentages are allowed, classify them as moderate, omit them from analytics/logs, and exclude them from broad MCP summaries by default.

### Covered Assets

Use this to link policy coverage to the existing profile `assets` list without depending on fragile names only.

```ts
interface InsuranceCoveredAsset {
  id: string;
  linkedAssetId?: string;
  label: string;
  assetType: "vehicle" | "home" | "rentalProperty" | "boat" | "valuable" | "other";
  summary?: string;
  sensitivityTier: "low" | "moderate";
}
```

For vehicles, VIN is moderate-to-high. Cloud Phase 1 should not collect VIN unless field-level encryption and redaction are included in the same implementation.

### Document References

Phase 1 cloud should store metadata only, not raw documents.

```ts
interface InsuranceDocumentReference {
  id: string;
  documentName: string;
  documentType: "declarations" | "idCard" | "policy" | "bill" | "eob" | "claim" | "medicalRecord" | "other";
  storageScope: "cloud" | "localPrivate";
  redactionStatus: "notRequired" | "pending" | "redacted" | "blocked";
  retainedOriginal: boolean;
  localOnly: boolean;
  extractedAt?: string;
  extractionConfidence?: number;
}
```

In cloud Phase 1, `retainedOriginal` must default to `false`, and document types `eob`, `claim`, and `medicalRecord` must be blocked with local desktop guidance.

### Review State

```ts
interface InsuranceReviewState {
  lastReviewedAt?: string;
  nextReviewDate?: string;
  completeness: "basic" | "partial" | "complete";
  missingFields: string[];
}
```

This lets Moat Finance surface useful planning gaps without pretending to make legal or insurance advice determinations.

## Type-Specific Details

Use a discriminated union for type-specific details. Keep field names financial-planning oriented and cloud-safe.

### Auto

Support:

- vehicles and listed drivers by role/label
- bodily injury liability
- property damage liability
- uninsured/underinsured motorist
- collision deductible
- comprehensive deductible
- medical payments or PIP summary
- rental reimbursement
- roadside assistance
- lienholder label
- premium by vehicle or coverage, if available

Avoid full driver license numbers, photos of licenses, and full VIN in cloud Phase 1.

### Health

Cloud-safe plan-level fields only:

- payer
- plan name
- plan type
- coverage tier
- network type
- individual deductible
- family deductible
- individual out-of-pocket max
- family out-of-pocket max
- Rx deductible amount only
- PCP required
- referral required
- HSA eligible
- major copay/coinsurance summaries

Do not store claims, diagnoses, procedure codes, prescriptions, doctors, lab results, EOBs, hospital records, medical notes, or member card images in cloud Phase 1.

Member ID and group ID should be deferred until field-level encryption exists. If they are added earlier, they must be classified moderate, masked in UI by default, excluded from logs/analytics, and omitted from MCP summary tools.

### Dental

Support:

- annual maximum
- deductible
- preventive coverage
- basic coverage
- major coverage
- orthodontia covered
- orthodontia lifetime max
- waiting periods
- network

### Vision

Support:

- exam frequency
- frame allowance
- contact lens allowance
- lens coverage
- LASIK discount
- network

### Life

Support:

- policy type
- insured person label
- owner label
- death benefit
- term expiry
- cash value balance
- premium
- beneficiary roles and optional percentages
- riders
- policy loans, if known

Beneficiary names and cash value balances are moderate sensitivity. Do not include them in analytics or broad MCP summaries.

### Disability

Cloud-safe fields:

- short-term or long-term
- monthly benefit or percentage of income
- elimination period
- benefit duration
- COLA rider
- employer-sponsored vs individual
- renewability

Local-only fields:

- medical evidence
- disability determinations
- physician notes
- claim files

### Homeowners / Renters

Support:

- property label or linked asset
- dwelling limit
- other structures
- personal property
- loss of use
- liability
- medical payments
- deductible
- replacement cost vs actual cash value
- endorsements
- scheduled valuables summary
- mortgagee/lienholder label

Full property address is already sensitive. Prefer linking to an existing asset or showing a short label. Do not duplicate full addresses across insurance records unless the broader profile model already stores them and field-level protection exists.

### Long-Term Care

Cloud-safe fields:

- daily/monthly benefit
- benefit pool
- elimination period
- benefit duration
- inflation protection
- tax-qualified indicator

Local-only fields:

- care assessments
- cognitive assessments
- medical eligibility records
- clinical notes

## Cloud vs Local Rules

### Cloud Allowed

- policy metadata
- insurer/provider name
- policy nickname
- type
- premium amounts and cadence
- deductible and limit amounts
- coverage summaries
- renewal dates
- effective dates
- high-level plan details
- covered asset summaries
- financial exposure data

### Cloud Cautious

Allow only with explicit classification, masking where useful, no analytics, no logs, and no broad MCP exposure:

- policy numbers
- member IDs
- group IDs
- VINs
- beneficiary names and percentages
- cash value balances
- mortgagee/lienholder labels
- dependent names

Phase 1 should defer most of these unless the field is necessary for the manual profile experience.

### Local Private Only

- raw insurance PDFs
- health claims
- EOBs
- prescription history
- diagnosis/procedure data
- provider names and visit history
- medical records
- disability medical evidence
- long-term-care assessment records
- full insurance card images
- raw sensitive OCR output

### Never Store By Default

- SSNs
- tax IDs
- payment card numbers
- bank account numbers
- carrier usernames/passwords
- security questions/answers
- driver license scans
- passport scans

## Required Web UI Messaging

In the cloud web app insurance profile UI, show this message near manual-entry and any future upload/review areas:

> Moat Finance Cloud stores insurance coverage details useful for financial planning and agent assistance. For highly sensitive documents like health claims, EOBs, prescriptions, disability medical records, or full policy PDFs, use the Moat Finance Private Desktop app to keep those details stored locally on your device.

Also include a secondary CTA/link:

> Want deeper private insurance storage? Use Moat Finance Private Desktop.

Show this message anywhere the user might try to enter health/disability document details or upload files. If desktop is rendering the same shared section, adapt the copy so desktop can present local-private storage as available or coming soon without implying cloud upload is safe.

## Implementation Sequence

### 0. Promote And Freeze The Spec

- Move this plan from `specs/drafted/insurance-overhaul/` into `specs/features/insurance-profile/spec.md` before implementation begins.
- Keep `phase-2-insurance-safety-plan.spec.md` as a supporting safety/compliance reference, but do not treat it as implementation-ready product scope.
- Add a short decision log section if scope changes during build.

Acceptance:

- Implementation PRs link to the promoted feature spec.
- The spec states which fields are Phase 1, deferred, local-only, and forbidden.

### 1. Shared Contract And Normalization

Files to change first:

- `packages/contracts/src/financial-profile-data.ts`
- `packages/contracts/src/index.ts`
- `packages/features/src/financial-profile/types.ts`
- `apps/api/src/server/handlers/financial-profile.ts`
- `packages/domain/src/financial-profile/getFinancialProfileData.ts`
- `packages/db-sqlite/src/repositories/SqliteFinancialProfileDataRepository.ts`

Work:

- Add `InsurancePolicyV2` and supporting schemas in `@moat/contracts`.
- Keep legacy `InsurancePolicy` parse support.
- Add a normalizer such as `normalizeInsurancePolicy` and `normalizeInsurancePolicies` in contracts or domain so every surface can handle old and new records.
- Update API validation to import or reuse the shared `FinancialProfileDataSchema` instead of maintaining a second schema by hand.
- Preserve existing IDs and avoid destructive conversion.
- Add tests for legacy-to-V2 mapping.

Acceptance:

- Existing simple policy rows continue to parse.
- V2 policies parse in web, API, desktop, and local repository flows.
- Typecheck passes for `@moat/contracts`, `@moat/features`, `moat-api`, `moat-web`, and `moat-desktop`.

### 2. API Layer Hardening

Files likely affected:

- `apps/api/src/server/handlers/financial-profile.ts`
- new or existing service under `apps/api/src/server/services/`
- `packages/openapi/api-v1.yaml` if adding dedicated insurance endpoints
- generated client packages if adding/changing OpenAPI-backed endpoints

Work:

- Keep handlers thin. Put insurance validation, normalization, sensitivity checks, and persistence transforms in a service.
- Continue using wrapper-based auth. Reads may use `withDemoOrAuth`; persistent writes must be server-gated and demo writes must remain overlay-only.
- Do not log provider names, policy numbers, member IDs, beneficiary names, dependent names, claim details, OCR text, or notes.
- If the existing whole-profile update endpoint remains the only API path, ensure the service sanitizes all insurance records before upsert.
- If dedicated insurance endpoints are added, update OpenAPI and regenerate clients instead of expanding handwritten client code.
- Preserve snapshot behavior after financial profile updates, but do not put sensitive insurance details into snapshot logs.

Acceptance:

- Invalid cloud-forbidden fields fail closed before persistence.
- Demo mode updates do not persist to the real user database.
- API logs contain only safe structured context: `userId`, feature, operation, error code.

### 3. Shared Insurance UI Wizard

Primary files:

- replace `packages/features/src/financial-profile/section-components/insurance-section.tsx` with a folder such as `insurance-section/`
- `packages/features/src/financial-profile/field-options.ts`
- shared UI primitives from `@moat/ui`

Work:

- Split the section before it grows beyond the component organization limit.
- Build a manual-entry wizard, not one giant form.
- Suggested steps:
  1. Policy type
  2. Basics and status
  3. Premium and renewal
  4. Covered people/assets
  5. Coverage details
  6. Review and save
- Use conditional fields by insurance type.
- Include the required cloud/private messaging near entry points.
- Show sensitive-field warnings for health, disability, and long-term care.
- Use stable layout constraints so long carrier names, policy nicknames, and coverage labels do not resize or overlap controls.
- Keep assets linked by ID where possible, with name fallback only for legacy records.

Acceptance:

- A user can create and edit auto, health, dental, vision, life, disability, homeowners, renters, long-term care, umbrella, boat, and other policies.
- The UI blocks or redirects cloud-forbidden document/detail attempts.
- Existing legacy policies render and can be saved as V2.
- The component structure stays modular and readable.

### 4. Analytics, Logging, And Privacy Guardrails

Work:

- Add meaningful PostHog events only for durable actions, such as `insurance_policy_created`, `insurance_policy_updated`, `insurance_policy_deleted`, and `insurance_profile_review_completed`.
- Event properties may include `userId` or `demoUser`, policy type enum, storage scope, completion state, and boolean flags.
- Event properties must not include provider names, policy names, policy numbers, member IDs, beneficiary names, dependent names, asset labels, notes, document names, or OCR text.
- Use shared loggers only. No raw `console.*`.
- Ensure client error handling shows a useful toast and logs safe failure context.

Acceptance:

- Analytics passes the repo's no-PII rules.
- Error paths are observable without leaking insurance details.

### 5. MCP Read Surface

Primary files:

- `packages/mcp-contracts/src/scopes.ts`
- `packages/mcp-contracts/src/tools` or existing contracts files
- `apps/mcp/src/tools/registry.ts`
- new `apps/mcp/src/tools/insurance.ts`
- local desktop gateway equivalents under `apps/desktop/src/main/agent-gateway/` when local support is added

Use Moat Finance-style tool names:

- `fin.listInsurancePolicies`
- `fin.getInsurancePolicySummary`
- `fin.getInsuranceCoverageDetails`
- `fin.getInsuranceRenewalSummary`
- `fin.getInsuranceSpendSummary`
- `fin.getInsuranceGapSignals`

Scopes:

- Add `mcp:insurance:read` for cloud-safe policy summaries.
- Consider `mcp:insurance:coverages:read` only if separate consent is useful.
- Do not add document scopes in Phase 1 unless redacted document metadata actually exists.
- Do not expose `highLocalOnly` data through hosted cloud MCP.

Output rules:

- Return structured summaries, dates, amounts, coverage labels, and high-level gap signals.
- Do not return raw documents, OCR text, notes that may include medical details, policy numbers, member IDs, group IDs, VINs, beneficiary names, dependent names, or carrier credentials.
- Use existing MCP audit wrapper behavior; never bypass registry/scope enforcement.

Acceptance:

- Every tool has a contract, input schema, scope, implementation, rate limit, and audit log.
- Cloud MCP outputs are safe for agent use.
- Local desktop MCP can later expose local-private data only through explicit local scopes and local audit logs.

### 6. Normalized Cloud Persistence

This is allowed after the contract and UI are stable. It may be Phase 1.5 if queryability is needed immediately.

Add Prisma models only in `apps/api/prisma/schema.prisma` and generate migrations from `apps/api`.

Suggested model groups:

- `InsurancePolicy`
- `InsurancePolicyCoverage`
- `InsurancePolicyParty`
- `InsurancePolicyAsset`
- `InsurancePolicyDocument`
- `InsurancePolicyVersion`

Conventions:

- Every user-owned model has `userId`.
- Every model has `createdAt` and `updatedAt`.
- Use `cuid()` for IDs.
- Add `@@index([userId])` and indexes for common list filters such as `[userId, type]`, `[userId, renewalDate]`, and `[userId, status]`.
- Use service-layer ownership checks before updates/deletes.
- Do not store cloud-forbidden fields in relational tables.
- Avoid broad `extraJson` for fields that deserve typed schema. Allow `metadata` only for low-risk, non-sensitive edge cases.

Migration strategy:

- Backfill from `FinancialProfileData.insurancePolicies` into normalized rows with idempotent SQL or service migration logic.
- Preserve legacy JSON until read paths are proven.
- Add dual-read or dual-write only behind a clear feature flag or service abstraction.
- Never run `prisma migrate reset` on the shared Neon database.
- Regenerate the committed Prisma client after schema changes.

Acceptance:

- Backfill is idempotent.
- Existing users keep their policies.
- Reads and writes remain user-scoped.
- Rollback can disable normalized reads without data loss.

### 7. Local Private Desktop Vault Foundation

This is not a cloud Phase 1 blocker, but the contract should leave room for it.

Desktop rules:

- Renderer never accesses raw filesystem or Prisma.
- All local insurance data access goes through typed IPC and `AppRuntime` repositories.
- Local SQLite schema changes live in `packages/db-sqlite/prisma/schema.prisma` and bundled migrations.
- Raw local documents, when implemented, should be stored under the app data directory with encrypted-at-rest storage or an explicit encryption plan.
- The local MCP gateway must use local scopes, local audit logs, and tool outputs that minimize sensitive detail unless the user explicitly grants access.

Acceptance:

- Cloud copy points users to desktop for sensitive documents without implying the cloud can store them safely.
- Desktop architecture remains local-first and does not expose Node, Prisma, or filesystem APIs to the renderer.

## Target Normalized Model

This is the long-term destination, not necessarily the first PR.

### `InsurancePolicy`

- `id`
- `userId`
- `householdId`, if household-scoped insurance is implemented
- `type`
- `providerName`
- `policyName`
- `policyNickname`
- `status`
- `effectiveStartDate`
- `effectiveEndDate`
- `renewalDate`
- `premiumAmount`
- `premiumCadence`
- `source`
- `storageScope`
- `sensitivityTier`
- `notes`, cloud-cautious and sanitized
- `metadata`, low-risk only
- `createdAt`
- `updatedAt`

### `InsurancePolicyCoverage`

- `id`
- `policyId`
- `userId`
- `coverageType`
- `label`
- `limitAmount`
- `deductibleAmount`
- `copayAmount`
- `coinsurancePercent`
- `maxBenefitAmount`
- `appliesTo`
- `notes`, cloud-cautious and sanitized
- `sensitivityTier`
- `createdAt`
- `updatedAt`

### `InsurancePolicyParty`

- `id`
- `policyId`
- `userId`
- `role`
- `displayName`, optional and cloud-cautious
- `relationship`
- `percentage`
- `sensitivityTier`
- `createdAt`
- `updatedAt`

### `InsurancePolicyAsset`

- `id`
- `policyId`
- `userId`
- `linkedAssetId`, optional
- `assetType`
- `label`
- `summary`
- `sensitivityTier`
- `createdAt`
- `updatedAt`

### `InsurancePolicyDocument`

- `id`
- `policyId`
- `userId`
- `documentName`
- `documentType`
- `storageScope`
- `redactionStatus`
- `retainedOriginal`
- `localOnly`
- `extractedAt`
- `extractionConfidence`
- `sourceMetadata`, no raw OCR text
- `createdAt`
- `updatedAt`

Cloud should default `retainedOriginal` to `false`. Cloud should block `claim`, `eob`, `medicalRecord`, and similar document types until Phase 2 safety controls exist.

### `InsurancePolicyVersion`

- `id`
- `policyId`
- `userId`
- `versionLabel`
- `effectiveStartDate`
- `effectiveEndDate`
- `changeReason`
- `snapshotJson`, sanitized and cloud-safe only
- `createdAt`

Use versions for policy periods, renewals, endorsements, and superseded records.

## Validation And Test Matrix

### Contract Tests

- Legacy `InsurancePolicy` records parse.
- V2 records parse for every policy type.
- Forbidden cloud fields fail validation or are stripped before persistence.
- Normalizer preserves IDs and maps title-case types safely.

### API Tests

- `financialProfile.get` returns V2-compatible data.
- `financialProfile.update` rejects forbidden insurance payloads.
- Demo overlay updates do not persist to real user records.
- Service logs are safe and structured.
- Normalized table writes, if implemented, are user-scoped and idempotent.

### UI Tests

- Wizard renders all steps.
- Conditional fields change by policy type.
- Sensitive health/disability/local-only prompts block cloud storage.
- Existing legacy policy rows render and save.
- Empty, loading, saving, error, delete, and validation states are covered.

### Desktop Tests

- Shared profile contract parses from SQLite stringified JSON.
- IPC update validates with the shared schema.
- Renderer never receives raw local file paths for private documents unless a safe document API is explicitly implemented.

### MCP Tests

- Missing insurance scope denies tool calls.
- Tool outputs omit moderate/high identifiers by default.
- Tool calls are audit-logged by the existing wrapper.
- Local-only data is not exposed by hosted cloud MCP.

## Commands To Run During Implementation

Run the commands that match touched packages:

```bash
pnpm --filter @moat/contracts run typecheck
pnpm --filter @moat/features run typecheck
pnpm --filter moat-api run check
pnpm --filter moat-api run typecheck
pnpm --filter moat-web run check:write
pnpm --filter moat-web run typecheck
pnpm --filter moat-desktop run check:write
pnpm --filter moat-desktop run typecheck
pnpm --filter @moat/mcp-contracts run check
pnpm --filter @moat/mcp-contracts run typecheck
pnpm --filter @moat/mcp run check
pnpm --filter @moat/mcp run typecheck
```

If Prisma schemas change:

```bash
cd apps/api && pnpm prisma generate
pnpm --filter @moat/db-sqlite run db:generate
```

Generate migrations only from the owning app/package. Never reset shared Neon data.

## Acceptance Criteria

- Cloud web supports structured, type-specific insurance profiles without raw sensitive health/claims/document storage.
- The required cloud/private desktop messaging appears anywhere users might enter sensitive insurance details.
- Existing simple insurance profile records migrate or normalize without data loss.
- Shared contracts are the source of truth for web, API, desktop, and future MCP surfaces.
- API writes are validated server-side and scoped to the authenticated/demo context.
- No policy numbers, member IDs, beneficiary names, dependent names, provider names, asset labels, notes, or document contents enter logs or analytics.
- Manual entry is wizard-based and type-specific.
- MCP exposes only structured cloud-safe insurance summaries behind explicit insurance scope.
- Desktop remains the future home for local-private raw documents and high-sensitivity insurance artifacts.
- If normalized tables are added, migration is idempotent, user-scoped, and backward compatible with existing JSON profile data.

## Recommended PR Order

1. `@moat/contracts` V2 schema, normalizers, and tests.
2. API validation/service hardening using shared schema.
3. Shared insurance wizard UI with cloud safety messaging.
4. Analytics/logging guardrails.
5. MCP insurance read contracts and tools.
6. Optional normalized cloud persistence migration.
7. Desktop local-private vault foundation.

Do not combine all of these into one PR. The contract and API hardening should land before broad UI or persistence changes.
