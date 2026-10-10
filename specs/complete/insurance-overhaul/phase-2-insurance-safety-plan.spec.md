# Phase 2 Insurance Safety Plan

## Status

Draft, revised against the current Moat Finance repository context on 2026-05-30.

This spec replaces the earlier broad compliance memo. The original risk posture was directionally right, but it did not account for how Moat Finance already works:

- Web and desktop both render the shared financial profile UI from `packages/features/src/financial-profile`.
- The canonical insurance shape already lives in `packages/contracts/src/financial-profile-data.ts` as `InsurancePolicyV2`, with `storageScope`, `sensitivityTier`, document metadata, and backward-compatible legacy policy support.
- Web persists financial profile data through `apps/api/src/server/handlers/financial-profile.ts`, where `FinancialProfileData.insurancePolicies` is currently stored in cloud Postgres JSON.
- Desktop persists the same financial profile through local SQLite via `@moat/db-sqlite` and has a local MCP gateway with local audit logging.
- The shared insurance UI already warns that claims, EOBs, prescriptions, disability medical records, and full policy PDFs belong in Moat Finance Private Desktop. Phase 2 must turn that copy into enforceable product and API behavior.

The Phase 2 theme is simple: cloud-safe insurance planning in web, private sensitive insurance storage in desktop, and server-side enforcement so UI messaging is never the only control.

## Regulatory Baseline

This is not legal advice. It is an engineering safety baseline that should be reviewed by counsel before Moat Finance stores health-adjacent insurance data at scale.

Use these official anchors when this spec is reviewed:

- HHS HIPAA Security Rule summary (`https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html`): covered entities and business associates must protect ePHI with administrative, physical, and technical safeguards. It calls out risk analysis, access control, audit controls, authentication, and transmission security.
- FTC Gramm-Leach-Bliley Act guidance (`https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act`): companies offering consumer financial products or services, including insurance-adjacent services in some cases, may need to explain information-sharing practices and safeguard sensitive customer data.
- FTC Health Breach Notification Rule (`https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule`): consumer health apps outside HIPAA can still have breach-notification duties for unsecured health information.

Phase 2 should assume HIPAA-grade care for health-family insurance data even if Moat Finance is not yet a HIPAA covered entity or business associate. The product should also avoid drifting into insurer, broker, claims, underwriting, enrollment, or provider workflows without a separate legal and compliance review.

## Goal

Make Moat Finance's insurance profile safe enough for real users by enforcing a storage boundary:

- Web app: allow cloud-safe structured insurance planning data only.
- Web app: do not allow upload or retention of extremely sensitive insurance data for now.
- Desktop app: become the intentional local-private surface for highly sensitive insurance documents and health-family details.
- API/contracts: reject unsafe cloud payloads even if a client bypasses the UI.
- MCP/AI: expose only minimized insurance summaries unless the user explicitly grants local-private access in desktop.

Success means a user can still track policy type, provider, premiums, renewal dates, coverage limits, deductibles, and high-level planning context in cloud web, while Moat Finance refuses cloud storage of health records, EOBs, claims, medical IDs, prescriptions, disability medical details, full insurance card images, and similar high-risk material.

## Current Repo Context

### Existing Contract Foundation

`InsurancePolicyV2` already includes the right primitives:

```ts
storageScope: "cloud" | "localPrivate";
sensitivityTier: "low" | "moderate" | "highLocalOnly" | "forbidden";
documents?: InsuranceDocumentReference[];
source: "manual" | "uploadExtracted" | "api" | "imported";
```

Keep those primitives and add enforcement utilities around them. Do not create a parallel insurance model unless Phase 3 normalizes persistence.

### Existing UI Foundation

The shared insurance section now lives under:

- `packages/features/src/financial-profile/section-components/insurance-section/index.tsx`
- `packages/features/src/financial-profile/section-components/insurance-section/policy-editor-dialog.tsx`
- `packages/features/src/financial-profile/section-components/insurance-section/policy-form-utils.ts`

This shared package is rendered by both web and desktop, so app-specific storage rules cannot live only inside the shared component. The component can show app-aware messaging, but the API and desktop IPC/runtime boundary must enforce the rules.

### Existing Trust And Safety Surfaces

- Web settings has `apps/web/src/app/(dashboard)/settings/security-settings.tsx` for account security.
- Desktop has a local agent gateway in `apps/desktop/src/main/agent-gateway` with local token scopes and audit logging.
- Marketing already claims privacy/security posture for sensitive fields and local desktop options.

Phase 2 should add insurance-specific trust language without overstating compliance. Do not claim HIPAA compliance, HIPAA certification, SOC 2, or bank-level security unless the controls and reviews exist.

## Product Boundary

### Phase 2 Builds

- Cloud-safety validation for insurance policies and document references.
- Web-side gates that block high-risk insurance uploads and high-risk free-text entries.
- API-side rejection of forbidden cloud payloads for financial profile updates.
- Desktop-local guidance and architecture tasks for private insurance documents.
- A data classification matrix that maps policy types, document types, and fields to storage scope.
- Redaction, logging, analytics, MCP, and AI rules for insurance data.
- Focused tests for contract validation, API rejection, web UX gates, and desktop-local persistence behavior.

### Phase 2 Does Not Build

- Health insurer integrations.
- Claims management.
- OCR extraction into cloud.
- Cloud upload of health, dental, vision, disability, or long-term-care documents.
- Cloud upload of EOBs, claims, medical records, prescriptions, provider visit summaries, diagnosis/procedure data, or full insurance card images.
- Broker, quote-shopping, enrollment, underwriting, or employer/insurer B2B workflows.
- Support/admin views that reveal sensitive insurance data.

## Storage Policy

### Core Rule

Cloud web may store planning-grade insurance facts. Desktop may store local-private insurance documents and higher-risk details. Cloud must reject `highLocalOnly` and `forbidden` payloads until a later phase explicitly ships field-level encryption, document security, vendor review, deletion/export controls, and legal sign-off.

### Allowed In Web Cloud For Phase 2

These are allowed when manually entered and validated:

- Policy type.
- Provider name.
- Policy nickname or short policy name.
- Status.
- Effective dates and renewal date.
- Premium amount and cadence.
- High-level coverage limits.
- High-level deductible, copay, coinsurance, out-of-pocket max, or annual maximum values.
- Covered asset label for non-health policies, such as "family car" or "primary home".
- Covered person role or short display label, such as "self" or "spouse", without birthdate, SSN, member ID, diagnosis, provider, or claim context.
- Review metadata, missing-field hints, and completeness state.

### Blocked In Web Cloud For Phase 2

Reject these at the web UI and API layers:

- Raw files for health, dental, vision, disability, or long-term-care policies.
- EOBs, claims, medical records, prescriptions, lab records, provider visit notes, procedure codes, diagnosis codes, and medical bills.
- Full insurance card images for health-family policies.
- Member IDs, group IDs, medical record numbers, claim numbers, SSNs, tax IDs, driver license numbers, passport scans, and full dates of birth.
- Beneficiary SSNs, dependent birthdates, dependent medical details, or minor health details.
- Free-text notes that appear to include diagnosis, medication, treatment, provider, claim, EOB, or medical-record content.
- Third-party OCR output or extracted document text in cloud.
- Any `InsurancePolicyV2` with `storageScope: "cloud"` and `sensitivityTier: "highLocalOnly"` or `"forbidden"`.
- Any cloud document with `localOnly: true`, `storageScope: "localPrivate"`, or `redactionStatus: "blocked"`.

### Risky Insurance Types

The user called out healthcare as the main risk. In this repo, treat the risk set as a health family, not only `type: "health"`:

- `health`: highest risk for PHI/ePHI, EOBs, claims, member IDs, prescriptions, providers, diagnoses, and medical records.
- `dental`: health-adjacent and can contain provider, procedure, claim, and dependent information.
- `vision`: health-adjacent and can contain provider, prescription, claim, and dependent information.
- `disability`: very high risk because documents often contain medical evidence, income details, employer details, and claim history.
- `longTermCare`: very high risk because it can contain health status, care needs, claims, and dependent/elder-care details.

For Phase 2 web cloud, do not allow uploads for any of these types. Allow only the structured, planning-safe fields listed above.

Life insurance is not in the health-family block by default, but it is still moderate-to-high risk. Cloud may store high-level coverage, premium, term, death benefit, and cash-value planning fields. Cloud must not store medical underwriting documents, beneficiary SSNs, full beneficiary identity packets, policy scans, or trust/estate documents. If the app cannot distinguish a life document safely, steer it to desktop local-private storage.

Auto, homeowners, renters, umbrella, and boat policies are lower risk than health-family policies but still may include PII. Cloud may store planning facts. Cloud should not store full policy PDFs or ID cards until document redaction and secure document handling are implemented. Declarations-page upload can be considered later only after redaction, virus scanning, deletion, export, and field-level encryption are ready.

## Data Classification Matrix

| Data | Cloud web | Desktop local-private | Notes |
| --- | --- | --- | --- |
| Policy type/provider/status | Allow | Allow | Low or moderate. |
| Premium, renewal date, coverage limit | Allow | Allow | Planning-grade financial data. |
| Health deductible/OOP max/copay | Allow | Allow | Allowed only as numeric plan facts; no claim/provider context. |
| Member ID/group ID/policy number | Block for health-family; defer for others | Allow after local vault controls | Field-level encryption required before cloud. |
| EOB/claim/medical record/prescription/provider notes | Block | Allow only local-private | Treat as highLocalOnly or forbidden for cloud. |
| Full health/dental/vision/disability/LTC card image | Block | Allow only local-private | Usually contains IDs and health-plan identifiers. |
| Life beneficiary name/percentage | Allow with caution | Allow | Moderate; omit from analytics and broad MCP summaries. |
| Beneficiary SSN/DOB/address | Block | Allow only local-private | High-risk identity data. |
| Auto/home declarations summary | Defer upload; manual facts allowed | Allow | Future cloud upload requires redaction pipeline. |
| OCR text | Block | Allow only local-private with redaction | Never log raw OCR text. |

## Required Repo Changes

### 1. Shared Contract Guardrails

Add contract-level helpers in `packages/contracts` so every app uses the same policy:

- `classifyInsurancePolicyForStorage(policy)`.
- `validateInsurancePolicyForCloud(policy)`.
- `sanitizeInsurancePolicyForCloud(policy)` only if safe automatic downgrading is unambiguous.
- `getInsuranceBlockedCloudReasons(policy)` for UI and API error messages.

Rules:

- `storageScope: "cloud"` cannot contain `highLocalOnly` or `forbidden` top-level sensitivity.
- Health-family policy documents must be rejected in cloud, regardless of document type label.
- `eob`, `claim`, and `medicalRecord` documents are always blocked in cloud.
- `source: "uploadExtracted"` is blocked in cloud for health-family policies until a later OCR safety phase.
- Free-text fields should run through a conservative detector for obvious forbidden terms before cloud save. This detector is a guardrail, not a compliance guarantee.

### 2. API Enforcement

Update `apps/api/src/server/handlers/financial-profile.ts` so `update` validates insurance policies before writing to Postgres or demo overlay.

Requirements:

- Use `withDemoOrAuth` as it already does for user-scoped financial profile reads/writes.
- Parse with `FinancialProfileDataSchema` first, then run insurance cloud validation.
- Return a typed 400 response for blocked insurance data. Do not silently strip user data.
- Log only the count of blocked policies and reason codes. Do not log policy names, provider names, notes, document names, member IDs, claim IDs, or raw payloads.
- Apply the same validation for demo overlay updates so demo mode does not become a bypass.

Longer-term cleanup that may be in the same Phase 2 PR if small:

- Move financial profile persistence/validation into a service so the handler does not own business logic.
- Keep the shared Zod schema as the source of truth; avoid duplicated API-local schemas.

### 3. Web UX Gates

Update the shared insurance UI with app-mode awareness instead of relying only on generic copy.

For web cloud:

- Hide or disable upload controls for health, dental, vision, disability, and long-term-care policies.
- Show a clear local-private path: "Use Moat Finance Private Desktop for health claims, EOBs, insurance cards, disability records, and medical documents."
- Prevent save when the form contains blocked cloud fields.
- Show field-level warnings near notes/person/document fields, not only a top banner.
- Do not add a generic file picker that accepts sensitive insurance documents in the web app.

Implementation shape:

- Keep the shared UI in `packages/features`.
- Pass an app/storage capability prop from web and desktop, for example `insuranceStorageMode="cloud" | "localPrivate"` or a richer capability object.
- Keep labels and type-specific policy editing shared, but branch upload/document controls by capability.
- Keep UI copy short and direct; the enforcement belongs in contracts/API.

### 4. Desktop Local-Private Path

Desktop is allowed to become the private-sensitive insurance surface, but it still needs controls before accepting real documents.

Before desktop stores health-family documents, implement or specify:

- Local-only persistence with no automatic cloud sync for `storageScope: "localPrivate"`.
- A sync filter that omits local-private insurance documents and highLocalOnly fields from any cloud sync path.
- Local encryption for sensitive document blobs and OCR text.
- File type and size limits.
- Malware scanning or a documented local scanning strategy before opening files.
- Per-document delete.
- Local export/delete behavior.
- Local audit events for document open, export, delete, and agent access. Audit entries must contain event type and IDs only, not raw sensitive content.
- A visible desktop trust/safety page explaining local-only storage, backup behavior, cloud sync exclusions, and AI access rules.

Desktop should not expose raw document contents through `contextBridge`; all access must stay behind typed IPC functions.

### 5. MCP And AI Boundaries

Insurance data is tempting for agents, so Phase 2 must define safe defaults before new tools appear.

Cloud MCP:

- Do not add cloud tools that return health-family document metadata, free-text notes, IDs, claims, EOBs, or person-level details.
- If an insurance summary tool is added later, use `moat.getInsuranceSummary`, require an explicit insurance read scope, and return minimized planning facts only.
- Do not include blocked insurance payloads in tool call logs, input summaries, output summaries, or Axiom structured context.

Desktop local MCP:

- Use separate scopes for local-private insurance access. Do not bundle sensitive insurance documents under a broad financial read scope.
- Read-only planning summaries can stay low-risk.
- Document/OCR access must require an explicit local-private scope, show a user-facing consent warning, and be audited locally.
- Agents must not mutate, upload, share, or delete insurance documents without confirmation.

AI processing:

- No training on insurance data by default.
- No third-party AI calls with health-family documents or OCR text until vendor review and contract review are complete.
- Prompt and output logs must be disabled or redacted for insurance-sensitive flows.
- The agent should receive only the fields needed for the user request.

### 6. Logging And Analytics

Apply the repo's no-PII/no-sensitive-logs rules strictly.

Do not log:

- Policy numbers.
- Member IDs.
- Group IDs.
- Claim numbers.
- SSNs or tax IDs.
- Document names if user-provided.
- OCR text.
- Notes.
- Beneficiary/dependent names.
- Provider, diagnosis, medication, procedure, or treatment text.
- Raw insurance API responses.

Analytics may include:

- Count of policies created.
- Policy type enum.
- Storage mode enum.
- Blocked reason enum.
- Whether a desktop-local handoff was shown.

Analytics must not include provider names, policy names, claim details, document names, notes, or raw financial/health values.

### 7. Trust And Safety Surfaces

Web and desktop can both talk about trust and safety, but they should not promise the same thing.

Web trust/safety messaging should say:

- Cloud insurance profile is for planning-grade policy facts.
- Health-family documents, claims, EOBs, insurance cards, medical records, and disability records are not accepted in web cloud for now.
- Use desktop local-private storage for sensitive documents.
- Moat Finance does not use sensitive insurance data for analytics payloads or session replay.

Desktop trust/safety messaging should say:

- Sensitive insurance documents stay local unless the user explicitly exports or shares them.
- Cloud sync excludes local-private insurance documents and highLocalOnly fields.
- Local agent access is scoped, consented, and audited.
- Local backups and OS-level disk encryption matter; document what Moat Finance does and does not control.

Marketing/trust pages must not imply Moat Finance can safely store full healthcare records in cloud. If marketing mentions health insurance, it should describe high-level planning context unless and until the product actually supports a compliant document vault.

## Implementation Sequence

### Step 1 - Contract Policy

- Add classification helpers and blocked reason types to `packages/contracts`.
- Add unit tests for health-family policy upload blocks, document type blocks, local-private rejection in cloud, and allowed manual planning fields.
- Export helpers from the package index.

### Step 2 - API Gate

- Call the contract cloud validator inside financial profile update before persistence.
- Return typed errors with reason codes.
- Add API tests for blocked health document upload, blocked EOB/claim/medical record references, and allowed manual health deductible/OOP max fields.

### Step 3 - Web Capability Mode

- Pass cloud capability into the shared financial profile page from the web app.
- Disable upload/document controls for blocked policy types.
- Prevent save with blocked cloud reason display.
- Add component tests for health-family upload block and allowed manual facts.

### Step 4 - Desktop Local-Private Mode

- Pass local-private capability into the shared financial profile page from desktop.
- Ensure any local-private fields/documents are excluded from cloud sync.
- Add IPC/runtime tests for local-private persistence and cloud sync omission.

### Step 5 - MCP/AI Scope Review

- Add insurance-specific MCP scope design before adding tools.
- Add audit/logging tests for no sensitive payload inclusion.
- Document cloud vs local MCP insurance behavior.

### Step 6 - Trust Surface Copy

- Update web settings/security or a dedicated trust section with insurance cloud limits.
- Update desktop trust/safety copy with local-private behavior.
- Review marketing language that mentions health insurance so it does not overpromise cloud storage.

## Acceptance Criteria

- Web cannot upload or retain health, dental, vision, disability, or long-term-care insurance documents.
- Web cannot save `InsurancePolicyV2` cloud payloads marked `highLocalOnly` or `forbidden`.
- API rejects blocked insurance payloads even when sent directly over HTTP.
- Health-family manual planning fields still work in web cloud.
- Desktop can distinguish local-private insurance data from cloud-safe profile data.
- Local-private insurance data is excluded from any cloud sync path.
- Logs and analytics contain only reason codes, counts, booleans, enums, and non-sensitive IDs.
- MCP/AI does not expose health-family documents, OCR text, IDs, claims, notes, or person-level sensitive details by default.
- User-facing copy clearly tells users why web blocks sensitive uploads and where private desktop storage fits.

## Open Decisions

- Should web cloud block all insurance document uploads until the redaction/document pipeline exists, or allow only future low-risk declarations-page uploads for property/auto after review?
- Should life insurance beneficiary names be allowed in cloud Phase 2, or local-private only until field-level encryption exists?
- Should policy numbers be blocked for every insurance type in cloud, or allowed for non-health policies only after field-level encryption?
- Does desktop need client-side encryption before storing any health-family document, or is OS-level disk encryption acceptable for an internal alpha?
- Which vendors, if any, will ever receive insurance OCR or AI payloads, and can they sign appropriate agreements?

## Non-Goals And Warnings

- Do not claim HIPAA compliance or HIPAA certification in product copy.
- Do not use session replay on insurance profile screens.
- Do not send insurance notes, document text, provider names, member IDs, or claim details to PostHog, Axiom, support tools, or AI logs.
- Do not allow support/admin tooling to reveal sensitive insurance data by default.
- Do not use production insurance data in dev.
- Do not store sensitive uploads in cloud object storage as a temporary shortcut.

## Commit Scope Recommendation

Phase 2 should be split into small PRs:

1. Contract helpers and tests.
2. API cloud enforcement.
3. Web UX gates.
4. Desktop local-private groundwork.
5. MCP/AI scope documentation.
6. Trust/safety copy updates.

Do not mix normalized insurance persistence, OCR, insurer integrations, or broad admin tooling into these PRs.