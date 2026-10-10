# Insurance Policy Intake Wizard And Document-Assisted Extraction

## Status

Draft. Created May 30, 2026 after a repository assessment of the current financial profile insurance UI, shared contracts, cloud API persistence, desktop local persistence, retention jobs, upload patterns, and onboarding flow patterns.

This spec is a focused follow-on to `specs/features/insurance-profile/spec.md`. The existing insurance profile spec defines the core `InsurancePolicyV2` contract and cloud/local safety boundaries. This spec defines the user-facing policy intake flow, optional document-assisted extraction, LLM pass-through constraints, and 24-hour raw data deletion plan.

## Goal

Make adding an insurance policy from the Financial Profile page feel obvious, guided, and safe.

A user should first choose the policy type from a beautiful card grid, then choose whether to let Moat Finance help extract policy data from documents or skip directly to the manual form. If they opt into upload-assisted intake, Moat Finance should accept multiple images/documents, process each file, fill as much of the policy form as possible, explain what happened, and then require the user to verify every field before saving.

Success means:

- The add-policy flow is understandable without prior knowledge of insurance terms.
- The same shared intake component works in web cloud mode and desktop local-private mode through host-injected capabilities.
- Users can always skip assisted extraction and complete the current manual intake with a blank form.
- Upload-assisted extraction never saves a policy without explicit user review.
- LLM use is clearly disclosed before upload-assisted extraction begins.
- Raw uploaded files, raw extracted text, image URLs, and extraction staging records are deleted after 24 hours in both cloud and desktop.
- Cloud mode stays aligned with existing insurance cloud-safety rules and does not silently bypass `getInsuranceBlockedCloudReasons`.

## Product Context

Moat Finance is the financial data layer for users and their AI agents. Insurance matters because coverage, premiums, renewal timing, deductibles, and policy gaps affect cash-flow planning, risk exposure, goals, and agent-safe financial summaries.

Insurance documents are also unusually messy and sensitive. They can include policy numbers, member IDs, beneficiary names, dependent details, claim history, EOBs, medical terms, addresses, VINs, lienholder data, and other data that should not casually enter logs, analytics, long-lived cloud storage, or broad MCP responses.

The product posture for this feature is therefore:

- Help users extract structured planning data.
- Be very explicit when an LLM is used.
- Treat raw intake artifacts as temporary staging data, not profile data.
- Keep long-lived storage limited to the reviewed `InsurancePolicyV2` fields that pass the correct cloud/local safety rules.
- Prefer desktop local-private processing for high-sensitivity categories whenever cloud safety cannot be guaranteed.

## Current Repo Context

### Existing Financial Profile Surface

The Financial Profile page is rendered from `packages/features/src/financial-profile` and consumed by both:

- Web dashboard route: `apps/web/src/app/(dashboard)/financial-profile/financial-profile-client.tsx`
- Desktop renderer route: `apps/desktop/src/renderer/src/App.tsx`

The shared `FinancialProfilePage` injects `insuranceStorageMode` into `InsuranceSection`:

- Web uses `insuranceStorageMode="cloud"`.
- Desktop uses `insuranceStorageMode="localPrivate"`.

This is the right seam for the new intake flow. The wizard should replace or wrap the current `PolicyEditorDialog` inside the shared insurance section, with upload capabilities injected by host.

### Existing Insurance UI

Current files:

- `packages/features/src/financial-profile/section-components/insurance-section/index.tsx`
- `packages/features/src/financial-profile/section-components/insurance-section/policy-editor-dialog.tsx`
- `packages/features/src/financial-profile/section-components/insurance-section/policy-form-utils.ts`

Current behavior:

- A simple table lists policies.
- Add/edit opens a dialog.
- The dialog already has six manual steps: Type, Basics, Premium, People, Coverage, Review.
- The type step is a basic button grid, not the requested onboarding-style card experience.
- The footer currently shows Back, Next, Cancel, and Save policy together.
- There is no optional assisted extraction branch.
- There is no multi-file upload, document status, extraction staging, processing overlay, or education screen before review.
- The form model is flattened into `PolicyFormValues` fields like `detailA`, `detailB`, `flagA`, and `flagB`, which is manageable for manual entry but too lossy for extraction provenance, confidence, and field-by-field verification.

### Existing Insurance Contract

The shared contract lives in `packages/contracts/src/financial-profile-data.ts`.

It already includes:

- `InsurancePolicyV2`
- `InsurancePolicyType`
- `InsuranceStorageScope`
- `InsuranceSensitivityTier`
- `InsuranceCoverage`
- `InsuranceParty`
- `InsuranceCoveredAsset`
- `InsuranceDocumentReference`
- `InsuranceReviewState`
- `InsuranceTypedDetails`
- `normalizeInsurancePolicy`
- display helpers and legacy conversion helpers

This means the feature should not invent a parallel policy object. It should add intake/extraction-specific contracts around the existing `InsurancePolicyV2` target shape.

### Existing Cloud Safety Rules

Cloud safety lives in `packages/contracts/src/insurance-cloud-safety.ts`.

It currently blocks cloud storage when:

- `storageScope` is `localPrivate`.
- `sensitivityTier` is `highLocalOnly` or `forbidden`.
- policy type is in the health family: health, dental, vision, disability, long-term care.
- health-family source is `uploadExtracted`.
- document references are local-only, blocked, retained originals, or sensitive document types.
- free text looks like diagnoses, prescriptions, claims, member IDs, group IDs, DOBs, SSNs, medical records, procedure codes, or similar sensitive content.

The new flow must either honor these rules or explicitly propose a contract change before implementation. For this spec, cloud upload-assisted extraction is allowed only for cloud-safe policy types and cloud-safe document categories in Phase 1. Health-family upload-assisted extraction should route to desktop local-private mode until a separate reviewed safety plan says otherwise.

### Existing Persistence

Cloud:

- `apps/api/prisma/schema.prisma` stores `FinancialProfileData.insurancePolicies` as `Json`.
- `apps/api/src/server/handlers/financial-profile.ts` currently parses `FinancialProfileDataSchema`, blocks unsafe insurance cloud storage, and upserts the JSON directly.
- The handler already imports shared contract schemas, which is good.
- The handler still contains substantial business logic and direct Prisma access. Any new document extraction, staging, cleanup, or retry behavior should be implemented in services, not expanded inside this handler.

Desktop:

- `packages/db-sqlite/src/migrations.ts` stores `FinancialProfileData.insurancePolicies` as stringified JSON in a `TEXT` column.
- `packages/db-sqlite/src/repositories/SqliteFinancialProfileDataRepository.ts` reads/writes the stringified JSON.
- `apps/desktop/src/main/ipc/financial-profile-data.ts` exposes only get/update profile data.
- Desktop has no insurance document table, no intake staging table, no upload/extraction IPC channels, and no cleanup scheduler for insurance staging.

### Existing Upload Pattern

The only Vercel Blob pattern found is feedback screenshot upload:

- `apps/api/pages/api/v1/feedback/upload-screenshot.ts`

That route:

- Uses `@vercel/blob` `put`.
- Receives base64 image data.
- Requires auth.
- Returns a URL and path.
- Does not provide lifecycle tracking or blob deletion.

Insurance upload cannot copy this directly. It needs a storage service abstraction, retention metadata, deletion jobs, file type limits, scanning/classification, and no PII in logs.

### Existing Retention And Cron Pattern

Retention policy lives in `docs/data-retention-policy.md`.

Existing cron endpoints live in `apps/api/pages/api/cron/` and use a `CRON_SECRET` authorization pattern:

- `cleanup-demo-sessions.ts`
- `cleanup-expired-2fa-tokens.ts`
- `cleanup-expired-auth-sessions.ts`
- `cleanup-raw-webhook-payloads.ts`

`apps/api/vercel.json` currently has no `crons` array, so the endpoints are compatible with Vercel Cron or an external scheduler but are not wired in Vercel config yet.

This feature must add an insurance intake cleanup endpoint and update deployment configuration or explicitly document the external scheduler requirement.

### Existing Onboarding Pattern

The onboarding card-style flow lives in `apps/web/src/app/onboarding/onboarding-flow/`.

Useful references:

- `step-goals.tsx` for rounded selectable cards with icons.
- `onboarding-nav.tsx` for bottom Back/Continue navigation.
- `onboarding-store.ts` for focused Zustand selectors and plain `set` updates.

The shared insurance intake flow should use the same interaction language but live in `packages/features`, not `apps/web`, because desktop already consumes the shared financial profile page.

## UX Requirements

### Entry Point

In the Insurance section on Financial Profile:

- Replace the current `Policy` add button dialog trigger with a new `Add policy` intake wizard.
- Editing an existing policy can initially keep the current manual editor or reuse the wizard without the upload branch. Do not force the upload branch for edits.
- The table can remain after policies exist, but empty state copy should point to the guided wizard.

### Wizard Container

The wizard should be a dialog or sheet with enough width for a focused form, using shared `@moat/ui` primitives.

Required layout:

- Top: visual step counter made of horizontal line segments.
- Step names are not visible by default.
- Hover/focus on a segment shows a tooltip with the step name.
- Main content area is stable-height enough to avoid footer jump.
- Bottom-left: Back button only when the user is not on the first step.
- Bottom-right: preferred variant Next button until final submit step.
- Final step: bottom-right button says Submit or Save policy.
- The first step has no Back button.
- Avoid showing Cancel, Back, Next, and Submit all as competing primary choices.
- Closing the dialog should warn if staged uploads exist or extraction is in progress.

### Step Model

The flow should be finite. Assisted upload is optional, not a dynamic infinite branch.

Recommended canonical steps:

1. Policy type
2. Assisted intake consent
3. Upload documents, or skip state
4. Extraction processing
5. Extraction ready education
6. Policy basics
7. Premium and renewal
8. Covered people and assets
9. Coverage details
10. Review and submit

When the user skips assisted intake on step 2:

- Step 3 is marked skipped.
- Step 4 is skipped automatically.
- Step 5 is skipped automatically or replaced with a brief empty-form transition if needed.
- Steps 6 through 10 render the manual form blank for the selected policy type.
- The progress counter still uses the same finite step set and can mark skipped segments distinctly.

When the user uses assisted intake:

- Step 3 accepts multiple files.
- Step 4 shows extraction progress and form-filling progress.
- Step 5 explains that Moat Finance filled what it could and that the user must verify.
- Steps 6 through 10 render the same manual form prefilled with extracted values and field-level confidence/provenance hints.

### Step 1: Policy Type Cards

Use onboarding-style rounded cards for policy types.

Policy options should use `insurancePolicyTypeLabels` and stable `InsurancePolicyType` values:

- Auto
- Health
- Dental
- Vision
- Life
- Disability
- Homeowners
- Renters
- Long-term care
- Umbrella
- Boat
- Other

Card requirements:

- 2-column mobile grid when space allows, 3 or 4 columns on wider dialog widths.
- Each card has a lucide icon, label, and one short subtitle.
- Selected state is obvious with border, background, and icon color.
- Health-family cards can show a small local-private hint in cloud mode, but do not overwhelm the first screen.
- Next is disabled until a type is selected.

### Step 2: Assisted Intake Consent

After policy type selection, show a clear page:

Title direction:

> Insurance data is messy. Let us help you out.

Required choices:

- Use assisted intake
- Skip and enter manually

Required disclosure before enabling assisted intake:

- Moat Finance may use an LLM as a pass-through processor to extract structured fields from uploaded policy documents.
- Uploaded files and raw extracted text are temporary staging data.
- Moat Finance deletes temporary intake data after 24 hours.
- The policy will not be saved until the user reviews and submits the structured form.
- Do not upload claims, EOBs, medical records, prescriptions, provider visit notes, or insurance ID cards in cloud mode.
- For health, dental, vision, disability, or long-term-care documents in cloud mode, use manual entry or Moat Finance Private Desktop local-private mode.

Consent mechanics:

- `Use assisted intake` is disabled until the user checks an explicit consent checkbox.
- The checkbox label must be specific: `I understand these files may be processed by an LLM as pass-through intake data.`
- `Skip and enter manually` remains available without checking the LLM consent box.
- In cloud mode, if selected type is health, dental, vision, disability, or long-term care, assisted intake should be disabled with a local-private explanation unless the implementation introduces a reviewed cloud-safety exception.

Important copy nuance:

- The UI may say Moat Finance deletes temporary intake data after 24 hours only if our own staging database and blob cleanup enforce it.
- The UI must not claim the LLM provider deletes data after 24 hours unless the vendor contract confirms that exact behavior.
- The recommended provider posture is zero data retention or no-training/no-retention mode. This remains an implementation requirement to verify before launch.

### Step 3: Multi-File Upload

The upload step should accept multiple files, not just one.

Supported files for Phase 1 cloud:

- Images: `image/png`, `image/jpeg`, `image/webp`
- Documents: `application/pdf`
- Optional later: `text/plain`, `text/html`, office formats only after parser review

Cloud mode constraints:

- Limit file size, initially 10 MB per file and 40 MB per intake session unless product chooses stricter limits.
- Limit file count, initially 10 files per policy intake session.
- Block or warn on filenames that appear to be claims, EOBs, medical records, insurance cards, prescriptions, or member ID cards.
- Never log filenames.
- Display only client-side names in UI; logs should use file IDs and mime categories.

Desktop local-private constraints:

- Support the same file list UX.
- Prefer local file paths only in main process, never raw file paths in renderer state unless a scoped safe display name is needed.
- Store local staging files under the app data directory, not arbitrary user locations.
- Delete local staging files after 24 hours or on user cancel.

Per-file status states:

- queued
- uploading
- uploaded
- extractingText
- awaitingLlm
- mappingFields
- ready
- failed
- blocked
- deleted

The UI should show per-file progress, retry for failed files, remove for queued/uploaded files, and a clear blocked reason when applicable.

### Step 4: Processing Overlay

After upload, Next moves to a processing overlay.

This screen should show:

- File-level progress list.
- Overall extraction state.
- A visible state for `Filling out your policy form`.
- Non-sensitive status copy only. Do not echo raw extracted text.
- An error summary if some files failed while others succeeded.

The overlay should advance automatically only after extraction and field mapping are complete. If the operation takes longer than a reasonable threshold, it should keep the user on the overlay with a cancel option and a durable intake session state. A later phase can add background polling; Phase 1 can keep it in-dialog if processing is expected to finish quickly.

### Step 5: Extraction Ready Education

After processing, show a brief education screen before the form:

Required message:

- Moat Finance filled in what it could.
- Insurance documents can be inconsistent.
- The user must verify every field before submitting.
- Low-confidence fields are marked.
- Missing fields are normal and can be completed manually.

This is not a marketing page. Keep it short and action-oriented.

### Steps 6-9: Verification Form

Reuse and improve the current manual form steps:

- Basics
- Premium and renewal
- Covered people and assets
- Coverage details

Required improvements for extracted sessions:

- Show field-level provenance and confidence without exposing raw text by default.
- Low-confidence fields should be visually marked and listed in Review.
- Fields derived from blocked documents should not be inserted.
- Users can clear extracted values.
- Users can edit all values before submit.
- The form should generate an `InsurancePolicyV2` with `source: "uploadExtracted"` only if assisted intake contributed values; otherwise `source: "manual"`.

Form architecture gap:

- `PolicyFormValues` currently uses generic `detailA/detailB/detailC/detailD` fields. That makes extraction mapping and confidence display awkward.
- Before implementing extraction, introduce typed form state per `InsurancePolicyType`, or add a field registry that maps UI fields to canonical policy paths such as `premiumAmount`, `details.individualOutOfPocketMax`, or `coverages.0.deductibleAmount`.
- The registry should power labels, validation, extraction mapping, confidence display, and review missing fields.

### Step 10: Review And Submit

The final step should show:

- Type, provider, policy name, status.
- Premium amount and cadence.
- Renewal/effective dates.
- Coverage limits and deductibles.
- Covered people/assets labels.
- Missing required or recommended fields.
- Low-confidence extracted fields.
- Cloud/local safety classification.

Submit behavior:

- Run `FinancialProfileDataSchema` validation.
- Run cloud safety validation in cloud mode before optimistic UI save.
- Block cloud submit if `getInsuranceBlockedCloudReasons` returns reasons.
- Show a typed user-facing error and preserve form state.
- Save only the reviewed structured policy into `FinancialProfileData.insurancePolicies`.
- Do not save raw extracted text into `InsurancePolicyV2`.

## Architecture

### Shared Feature Boundary

The wizard belongs under:

`packages/features/src/financial-profile/section-components/insurance-section/`

Recommended split:

- `policy-intake-wizard/index.tsx`
- `policy-intake-wizard/intake-store.ts`
- `policy-intake-wizard/step-progress.tsx`
- `policy-intake-wizard/policy-type-step.tsx`
- `policy-intake-wizard/assisted-intake-step.tsx`
- `policy-intake-wizard/upload-step.tsx`
- `policy-intake-wizard/processing-step.tsx`
- `policy-intake-wizard/extraction-ready-step.tsx`
- `policy-intake-wizard/form-steps/`
- `policy-intake-wizard/review-step.tsx`
- `policy-intake-wizard/field-registry.ts`
- `policy-intake-wizard/extraction-confidence.tsx`
- `policy-intake-wizard/types.ts`

Keep files small. The current `policy-editor-dialog.tsx` is already large enough that expanding it directly would violate the repo's modularity guidance.

### Host-Injected Capabilities

`packages/features` must stay runtime-agnostic. It should not import Next.js APIs, Electron APIs, Vercel Blob, Prisma, filesystem APIs, or `@moat/client-ts` directly.

Add host-injected optional capabilities to `FinancialProfilePage` or `InsuranceSection`, for example:

```ts
type InsuranceIntakeCapabilities = {
  mode: "cloud" | "localPrivate";
  createSession(input: CreateInsuranceIntakeSessionInput): Promise<InsuranceIntakeSession>;
  uploadFile(input: UploadInsuranceIntakeFileInput): Promise<InsuranceIntakeFile>;
  processSession(input: ProcessInsuranceIntakeSessionInput): Promise<InsuranceIntakeExtractionResult>;
  deleteSession(input: DeleteInsuranceIntakeSessionInput): Promise<void>;
};
```

If capabilities are absent, the wizard should render manual-only mode with assisted intake disabled. This lets the UI ship before cloud/desktop upload plumbing is complete.

### Cloud API Shape

Add dedicated endpoints rather than overloading `financialProfile/update` with file and extraction behavior.

Recommended REST surface:

- `POST /api/v1/insurance-intake/sessions`
- `POST /api/v1/insurance-intake/sessions/{sessionId}/files`
- `POST /api/v1/insurance-intake/sessions/{sessionId}/process`
- `GET /api/v1/insurance-intake/sessions/{sessionId}`
- `DELETE /api/v1/insurance-intake/sessions/{sessionId}`
- `GET /api/cron/cleanup-insurance-intake-staging`

Implementation pattern:

- Route files in `apps/api/pages/api/v1/insurance-intake/...` should be thin.
- Handlers should use `withAuth` because uploads and extraction are user-specific writes. Demo mode should not upload real documents.
- Business logic belongs in `apps/api/src/server/services/insurance-intake.service.ts`.
- Storage behavior belongs behind an interface such as `insurance-intake-storage.service.ts` rather than inline Blob calls.
- OpenAPI spec must be updated in `packages/openapi/api-v1.yaml` and generated clients refreshed.

### Cloud Database Model

Do not store raw intake data inside `FinancialProfileData.insurancePolicies`.

Add staging tables with explicit retention:

```prisma
model InsuranceIntakeSession {
  id             String   @id @default(cuid())
  userId         String
  policyType     String
  storageMode    String   // cloud for API; localPrivate for desktop equivalent
  status         String
  llmConsentAt   DateTime?
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  files          InsuranceIntakeFile[]
  extraction     InsuranceIntakeExtraction?
  user           User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([expiresAt])
}

model InsuranceIntakeFile {
  id             String   @id @default(cuid())
  sessionId      String
  status         String
  mimeCategory   String
  mimeType       String
  sizeBytes      Int
  blobPath       String?
  blobUrl        String?
  textPath       String?
  errorCode      String?
  blockedReason  String?
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  session        InsuranceIntakeSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([expiresAt])
}

model InsuranceIntakeExtraction {
  id                   String   @id @default(cuid())
  sessionId            String   @unique
  status               String
  extractedPolicyDraft Json
  fieldConfidence      Json
  rawTextPath          String?
  rawLlmResponsePath   String?
  providerName         String
  providerRequestId    String?
  expiresAt            DateTime
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  deletedAt            DateTime?

  session              InsuranceIntakeSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([expiresAt])
}
```

Notes:

- `blobUrl` should be treated as temporary and never copied into the final policy.
- `rawTextPath` and `rawLlmResponsePath` should point to temporary storage, not durable profile JSON.
- If raw text is small enough to store in Postgres, it still needs `expiresAt`, cleanup, and encryption review. Blob/object storage with short-lived references is preferable.
- Never store filenames in logs. Database can store a sanitized display name only if product requires it, but the safer default is mime category plus file id.

### Desktop Local Database Model

Desktop needs equivalent staging, but local-private.

Recommended SQLite additions:

- `InsuranceIntakeSession`
- `InsuranceIntakeFile`
- `InsuranceIntakeExtraction`

Fields should mirror cloud where practical:

- `id`
- `userId`
- `policyType`
- `status`
- `llmConsentAt`
- `localPath` or encrypted app-data path, main process only
- `rawTextPath`, main process only
- `extractedPolicyDraft` as JSON text
- `fieldConfidence` as JSON text
- `expiresAt`
- `createdAt`
- `updatedAt`
- `deletedAt`

Renderer should interact through typed IPC only:

- `insuranceIntake:createSession`
- `insuranceIntake:addFiles`
- `insuranceIntake:processSession`
- `insuranceIntake:getSession`
- `insuranceIntake:deleteSession`
- `insuranceIntake:cleanupExpired`

Do not expose raw Node.js filesystem APIs, Prisma clients, or AppRuntime through `contextBridge`.

### Storage And Processing Pipeline

Cloud assisted intake pipeline:

1. Create intake session with policy type and consent timestamp.
2. Upload each file to temporary object storage under a path like `insurance-intake/{userId}/{sessionId}/{fileId}`.
3. Record each file with `expiresAt = createdAt + 24h`.
4. For images, upload to Vercel Blob and keep a temporary URL/path for processing.
5. For PDFs/documents, extract text through a structured document parser service.
6. Store raw text as temporary staging with 24-hour expiry.
7. Send only the minimum required text/image references to the LLM extractor.
8. Validate LLM output against a strict Zod schema.
9. Map validated output to an `InsurancePolicyV2` draft plus field confidence.
10. Run cloud safety classification on the draft.
11. Return only structured draft, field confidence, missing fields, and blocked reasons to the client.
12. Delete staging automatically after 24 hours, or immediately when the user submits/cancels if possible.

Desktop local-private pipeline:

1. Create local intake session.
2. Copy selected files into app data staging storage.
3. Extract text locally when possible.
4. If an LLM provider is used from desktop, require the same pass-through disclosure and keep an audit record that does not include file names or text.
5. Store raw text and extraction responses locally with 24-hour expiry.
6. Return structured draft to renderer through IPC.
7. Cleanup on schedule and on app startup.

### LLM Extraction Contract

Add a shared contract for extraction output. It should live in `packages/contracts` if both cloud and desktop use it.

Recommended shape:

```ts
type InsuranceIntakeExtractedField = {
  path: string;
  value: unknown;
  confidence: "high" | "medium" | "low";
  sourceFileIds: string[];
  needsReview: boolean;
};

type InsuranceIntakeExtractionResult = {
  sessionId: string;
  policyType: InsurancePolicyType;
  status: "ready" | "partial" | "failed" | "blocked";
  policyDraft: InsurancePolicyV2;
  fields: InsuranceIntakeExtractedField[];
  missingFields: string[];
  blockedReasons: string[];
  warnings: string[];
};
```

The LLM prompt must require:

- JSON only.
- No guessing when a field is absent.
- Null/omission for uncertain values rather than invented values.
- Confidence per field.
- No medical diagnosis, claim narrative, prescription, provider visit, SSN, DOB, member ID, group ID, policy number, VIN, account number, or full address extraction into the final structured policy unless a field is explicitly allowed.
- Output schema validation before any value enters form state.

Provider requirements before implementation:

- Use zero-data-retention or no-training/no-retention mode where available.
- Document vendor terms in `docs/security/vendor-inventory.md` before launch.
- Do not log prompts, raw text, images, or LLM responses.
- Log only operation, user id, session id, provider name, status, token/count metadata if safe, and error code.

### Form Field Registry

Introduce a typed field registry to connect UI, validation, extraction, and review.

Each field definition should include:

- canonical path
- label
- description or helper copy
- input type
- policy types where it applies
- required/recommended/optional
- cloud sensitivity tier
- local sensitivity tier
- transform from string input to structured value
- transform from extraction value to form value
- validation
- display format

Example:

```ts
type InsurancePolicyFieldDefinition = {
  path: string;
  label: string;
  input: "text" | "currency" | "percent" | "date" | "boolean" | "select";
  appliesTo: InsurancePolicyType[];
  importance: "required" | "recommended" | "optional";
  sensitivityTier: InsuranceSensitivityTier;
  cloudAllowed: boolean;
};
```

This avoids hard-coding extraction into `detailA` fields and makes future policy types easier.

## Privacy, Safety, And Compliance

### Data Classification

Temporary intake artifacts are high sensitivity even when the final policy fields are low or moderate.

High-sensitivity temporary data includes:

- uploaded files
- image URLs
- extracted raw text
- LLM prompts
- LLM raw responses
- parser raw outputs
- file names if user-provided and descriptive

Long-lived reviewed policy data remains governed by `InsurancePolicyV2` sensitivity tiers and cloud-safety rules.

### Cloud Mode Blocks

In cloud mode Phase 1, assisted upload should be disabled for:

- health
- dental
- vision
- disability
- long-term care

It should also block document types or file names that appear to be:

- EOB
- claim
- medical record
- prescription
- provider visit
- insurance ID card
- member ID card
- lab result
- diagnosis or treatment record

Manual entry for health-family policy planning fields can remain available if it passes the existing cloud-safety rules. Note that current rules classify all health-family policies as local-private only, so the spec implementation must reconcile product intent with `insurance-cloud-safety.ts` before cloud saving health-family policies.

### Retention Requirement

Temporary intake data must be deleted after 24 hours.

Cloud cleanup must delete or redact:

- Vercel Blob uploaded files
- temporary image URLs and blob paths
- raw extracted text
- raw parser output
- raw LLM response
- staging rows older than `expiresAt`

Desktop cleanup must delete:

- app-data staging files
- raw extracted text files
- raw LLM response files
- local staging rows older than `expiresAt`

Cleanup timing:

- Run on a scheduled daily cloud cron at minimum.
- Also run opportunistically after successful submit/cancel.
- Desktop runs cleanup on app startup and on an interval while open.
- Staging rows should use `expiresAt` so cleanup is deterministic and testable.

### Data Retention Policy Update

Update `docs/data-retention-policy.md` with a new category:

- Insurance intake staging data
- Examples: uploaded policy files, temporary blob URLs, OCR/parser text, LLM extraction prompts/responses, extraction field confidence
- Retention: 24 hours maximum
- Deletion trigger: submit/cancel best effort plus scheduled cleanup
- Sensitivity: high
- Notes: final reviewed `InsurancePolicyV2` profile data follows financial profile retention; staging data is not exported except possibly as final reviewed structured fields.

### Analytics

If analytics are added, event names should follow repo convention and include `{ userId?: string, demoUser?: boolean }`.

Allowed events:

- `insurance_intake_started`
- `insurance_type_selected`
- `insurance_intake_assist_selected`
- `insurance_intake_upload_completed`
- `insurance_intake_extraction_completed`
- `insurance_policy_created`
- `insurance_intake_cleanup_completed`

Allowed properties:

- policy type enum
- storage mode enum
- file count
- mime category counts
- success/failure enum
- blocked reason codes
- field count
- low confidence count
- duration bucket

Forbidden properties:

- provider names
- policy names
- policy numbers
- member IDs
- group IDs
- beneficiary names
- dependent names
- filenames
- blob URLs
- raw text
- LLM prompts or responses
- asset labels
- medical or claim details

### Logging

Use the shared logger in API code. Do not use raw `console.*`.

Logs may include:

- `userId`
- `feature: "insuranceIntake"`
- `operation`
- `sessionId`
- `fileId`
- mime category
- status
- error code
- blocked reason code
- counts

Logs must not include:

- raw request bodies
- filenames
- provider names from uploaded documents
- policy names
- policy numbers
- raw text
- prompts
- LLM responses
- blob URLs
- medical/claim content
- account numbers or tokens

## Security Requirements

- Use authenticated endpoints only. No public upload route.
- Use `withAuth` for cloud intake sessions and uploads.
- Associate every staging row with `userId` and scope reads/writes to that user.
- Enforce file count and file size limits server-side.
- Validate MIME type server-side, not just from browser metadata.
- Generate object storage paths server-side.
- Never accept caller-supplied blob paths.
- Prefer private or hard-to-guess blob paths. If Vercel Blob public URLs are used, treat URLs as sensitive and short-lived in app records.
- Add rate limiting or abuse limits before public launch.
- Ensure account deletion deletes active intake staging rows and blobs.
- Ensure cleanup failures are logged and retried.

## Implementation Plan

### Phase 0: Alignment And Safety Decisions

1. Confirm whether cloud Phase 1 can support any document-assisted extraction, or only non-health-family policy types.
2. Confirm LLM provider mode: zero-data-retention/no-training/no-retention required before launch.
3. Decide exact supported file types, size limits, and file count limits.
4. Decide whether Vercel Blob is acceptable for temporary images/PDFs or whether a private storage abstraction is required first.
5. Update `docs/security/vendor-inventory.md` with the LLM extraction processor before launch.
6. Update `docs/data-retention-policy.md` with insurance intake staging data.

Acceptance criteria:

- Product, engineering, and safety rules agree on which policy types can use cloud assisted extraction.
- User-facing LLM disclosure copy is approved.
- Provider retention assumptions are documented and do not overpromise.

### Phase 1: Shared Manual Wizard UX

Build the finite wizard without uploads first.

Work:

- Split current insurance editor into a `policy-intake-wizard` folder.
- Replace the type selector with onboarding-style policy type cards.
- Add segmented progress line with tooltips.
- Implement footer behavior: Back only after first step, Next on lower right, Submit on final step.
- Add assisted-intake consent step with manual skip path, but keep assisted action disabled if capabilities are absent.
- Preserve current manual policy creation behavior.
- Keep cloud safety blocking intact.

Acceptance criteria:

- Add policy starts with the card grid.
- Manual skip path reaches a blank form for the selected policy type.
- Web and desktop both render the shared wizard.
- Existing policy create/edit still saves valid `InsurancePolicyV2` records.
- `pnpm --filter @moat/features run typecheck`, web typecheck, and desktop typecheck pass.

### Phase 2: Intake Contracts And Field Registry

Work:

- Add shared intake session/file/extraction types and Zod schemas to `packages/contracts`.
- Add field registry for policy form fields and canonical paths.
- Replace generic extraction-facing use of `detailA/detailB/detailC/detailD` with path-aware state or adapters.
- Add conversion helpers from form state to `InsurancePolicyV2` and from extraction result to form state.
- Add unit tests for mapping and safety classification.

Acceptance criteria:

- Extraction result can prefill form fields without relying on positional generic detail fields.
- Low-confidence and missing fields can be calculated from shared metadata.
- Invalid extraction output is rejected by Zod before reaching UI state.

### Phase 3: Cloud Assisted Intake

Work:

- Add Prisma staging models and migration.
- Add `insurance-intake.service.ts` in API.
- Add storage abstraction around Vercel Blob or chosen object store.
- Add authenticated session, file upload, process, get, and delete endpoints.
- Update `packages/openapi/api-v1.yaml` and regenerate client.
- Inject cloud intake capabilities into `FinancialProfilePage` from web.
- Implement multi-file upload UI and processing overlay.
- Add cleanup endpoint and schedule configuration.

Acceptance criteria:

- A cloud user can create an intake session for an allowed policy type.
- Multiple files upload and show per-file status.
- Extraction returns a structured draft with confidence metadata.
- User must review before submit.
- Raw staging data is deleted on cancel/submit best effort and by cron after 24 hours.
- Cloud unsafe drafts are blocked with typed errors.
- Logs and analytics contain no forbidden data.

### Phase 4: Desktop Local-Private Assisted Intake

Work:

- Add SQLite staging tables and migrations.
- Add desktop repository methods and domain functions.
- Add IPC contracts and preload bridge methods.
- Add local staging file storage under app data.
- Add desktop processing implementation.
- Add desktop cleanup on startup and interval.
- Inject desktop intake capabilities into `FinancialProfilePage`.

Acceptance criteria:

- Desktop can accept health-family document-assisted extraction in local-private mode if provider/safety decisions allow it.
- Renderer never receives raw file paths unnecessarily.
- Local staging files and rows delete after 24 hours.
- Desktop policy submit saves final structured `InsurancePolicyV2` into the local profile.
- IPC tests and SQLite repository tests cover staging lifecycle.

### Phase 5: Hardening And Observability

Work:

- Add retry and partial-success behavior.
- Add blocked-file UX and service tests.
- Add account deletion cleanup coverage.
- Add retention job run tracking if not already available.
- Add Playwright coverage for the wizard in manual and assisted modes.
- Add accessibility pass for progress tooltips, card selection, keyboard navigation, and upload controls.

Acceptance criteria:

- Keyboard-only users can complete manual intake.
- Upload errors are recoverable.
- Cleanup job failures are observable.
- No raw sensitive data appears in logs, analytics, final profile JSON, or MCP outputs.

## Gaps To Resolve Before Build

### Product Gaps

- Decide exact copy for the LLM pass-through consent screen.
- Decide whether cloud assisted extraction is allowed for only auto/home/renters/life/umbrella/boat/other in Phase 1.
- Decide how strongly to route health-family upload flows to desktop local-private.
- Decide whether `Submit` or `Save policy` is preferred final button copy.
- Decide whether users can leave an assisted intake session and resume later within 24 hours.

### Contract Gaps

- No `InsuranceIntakeSession` contract exists.
- No extraction result schema exists.
- `InsuranceDocumentReference` exists, but it is final-policy metadata, not staging lifecycle data.
- The current policy form state is not path-aware enough for extraction provenance.
- Current cloud safety rules classify health-family policies as blocked, which may conflict with manual cloud entry expectations.

### API Gaps

- No insurance intake API endpoints exist.
- No insurance intake service exists.
- No storage abstraction exists for temporary insurance documents.
- Vercel Blob use is feedback-specific and has no lifecycle deletion pattern.
- `apps/api/vercel.json` does not configure cron schedules.
- Financial profile handler still has direct Prisma business logic that should not absorb extraction complexity.

### Desktop Gaps

- No insurance intake IPC channels exist.
- No local staging tables exist.
- No local document staging storage exists.
- No desktop cleanup scheduler exists for insurance staging.
- No desktop extraction pipeline exists.
- Existing desktop scheduler uses Plaid-specific code and raw console logging; insurance cleanup should follow repo logging and lifecycle conventions.

### UI Gaps

- Current `PolicyEditorDialog` is too large to keep expanding.
- Current type selector lacks card-style onboarding UX.
- Current progress UI exposes step names as buttons instead of line segments with tooltips.
- Current footer has too many simultaneous controls for the requested flow.
- No drag-and-drop upload component exists in shared UI/features.
- No per-file processing list exists.
- No extraction ready education screen exists.
- No field-level confidence/provenance UI exists.

### Safety Gaps

- Provider zero-data-retention/no-training mode is not confirmed in repo docs.
- Data retention policy does not yet include insurance intake staging.
- Vendor inventory has an open item to confirm OpenAI ZDR.
- No account deletion coverage for insurance staging exists.
- No rate limiting or abuse controls exist for document uploads.

## Testing Plan

### Unit Tests

- Field registry path mapping per policy type.
- Extraction result Zod validation.
- Extraction result to form state mapping.
- Form state to `InsurancePolicyV2` mapping.
- Cloud safety blocking of extracted health-family and sensitive document cases.
- Cleanup service deletes expired staging rows and files.
- Upload service blocks unsupported MIME types, oversize files, and blocked document categories.

### API Tests

- Auth required for all intake endpoints.
- Session create scopes to current user.
- File upload validates type/count/size.
- Process endpoint rejects sessions without consent.
- Process endpoint returns typed errors for blocked categories.
- Delete endpoint removes staging rows and blob objects.
- Cron endpoint requires `CRON_SECRET` and deletes only expired staging data.

### Desktop Tests

- IPC schemas parse create/upload/process/delete inputs.
- Renderer cannot access raw filesystem APIs.
- SQLite cleanup removes expired staging records.
- Local staging paths stay under app data.
- Local profile update preserves existing financial profile data.

### UI Tests

- Manual flow: type card -> skip -> blank form -> submit.
- Assisted flow: type card -> consent -> upload multiple files -> processing -> education -> prefilled form -> review -> submit.
- First step has no Back button.
- Later steps have Back button on lower left.
- Step segments show tooltips on hover/focus.
- Low-confidence fields are visible in form and review.
- Cloud-blocked assisted intake preserves user state and explains next action.
- Mobile/narrow dialog layout has no overlapping text or controls.

### Manual QA

- Web cloud allowed policy type, assisted intake happy path.
- Web cloud health-family type, assisted intake disabled/blocked.
- Web manual policy creation for all policy types.
- Desktop local-private manual policy creation.
- Desktop local-private assisted intake when implemented.
- Cancel during upload and verify cleanup behavior.
- Wait past 24 hours or simulate expired rows and verify cleanup deletes staging data.

## Rollout Plan

1. Ship manual wizard UI behind the existing Financial Profile feature flag if needed.
2. Keep assisted intake disabled until backend staging, retention, and provider agreements are ready.
3. Enable assisted intake for a narrow allowlist of cloud-safe policy types.
4. Monitor blocked reason counts, extraction failures, cleanup failures, and support feedback.
5. Add desktop local-private assisted intake after the local staging/storage pipeline is complete.
6. Revisit MCP insurance summaries only after final structured policies are reliable and safe.

## Non-Goals

- Carrier login or insurance provider API connections.
- Quote shopping or policy recommendations.
- Claims filing or claims tracking.
- Durable cloud storage of raw policy PDFs/images.
- Durable cloud storage of raw OCR text or LLM responses.
- Automatic submission without user review.
- MCP access to raw documents or extraction staging data.
- Replacing the broader `insurance-profile` spec.

## Open Questions

- Which LLM provider and retention tier will be used for extraction, and can we document zero data retention before launch?
- Should cloud assisted intake be disabled for all health-family types, or should manual cloud entry also be revisited because current safety rules block health-family policies broadly?
- Should images be uploaded to public Vercel Blob URLs, or should this feature wait for private/short-lived object access?
- Do we need malware scanning for uploaded documents before extraction?
- Should raw extracted text be stored in object storage or encrypted Postgres JSON with `expiresAt`?
- Should users be able to resume an in-progress intake session within the 24-hour window?
- Should desktop extraction use the same cloud LLM provider, a local model, or a user-configured provider?
- How should account deletion trigger blob deletion for staging objects that may already be expired?

## Recommended First PR

The safest first PR is UI-only and contract-light:

- Split the insurance dialog into a wizard folder.
- Add card-style type selection.
- Add line-segment progress with tooltips.
- Add consent/skip step with assisted intake disabled when capabilities are missing.
- Preserve the existing manual save path.
- Add TODO-free prop boundaries for future intake capabilities.

This gives users a clearer policy intake immediately while keeping document processing and LLM risk out of the first implementation slice.
