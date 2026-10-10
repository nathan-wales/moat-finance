# Private Tax File Parsing Infra using Docling on Google Cloud Run

Build and deploy Moat’s private tax-document parsing infrastructure using Docling on Google Cloud Run, and integrate it into the existing Moat tax-document pipeline.

The goals are:

1. Very private
2. Very easy to maintain
3. Very cost-effective
4. No third-party AI/document processing
5. Zero intentional parser retention
6. Same parser contract should eventually support both:
   - Moat Private Cloud processing
   - local-only desktop processing

You have access to:
- the Moat codebase
- `gcloud`
- Docker
- `wrangler` / Cloudflare CLI if needed
- existing Cloudflare R2 infrastructure
- existing app/database infrastructure

Do as much as possible yourself using CLIs and code.

Do NOT stop for clarification unless:
- Google requires interactive billing/account approval
- Cloudflare requires interactive account authorization
- you need me to choose between materially different production-security options
- you need a secret/credential that is not already available

Before making destructive or expensive infrastructure changes, print exactly what you intend to change and why.

==================================================
ARCHITECTURE TARGET
==================================================

Build this architecture:

User
  ↓
Moat API
  ↓
Encrypted tax-document storage in Cloudflare R2
  ↓
Create parse job
  ↓
Private Google Cloud Run Docling service
  ↓
Decrypt transiently inside worker
  ↓
Docling parse
  ↓
Normalize into Moat ParsedTaxDocument
  ↓
Tax extraction / TaxFacts
  ↓
Persist structured results
  ↓
Delete all temporary plaintext

Important trust-boundary requirements:

- Raw tax documents MUST NOT be sent to OpenAI, Anthropic, Unstructured Cloud, Google AI APIs, or another third-party parsing/LLM provider.
- Google Cloud is being used only as infrastructure for running our own Docling container.
- Docling must run locally inside our container.
- Do not enable external LLM-backed Docling features.
- Do not use remote model inference.
- Production runtime should not need to download models dynamically.
- Original tax files remain in Moat-controlled R2.
- Parser workers must not intentionally retain source documents.
- Do not log extracted document contents.
- Do not log SSNs, EINs, account numbers, addresses, or tax values.
- Do not make the Cloud Run service publicly callable.

==================================================
PHASE 0 — INSPECT EXISTING MOAT INFRASTRUCTURE
==================================================

Before changing anything:

Inspect:
- existing Cloudflare R2 usage
- existing object-storage abstractions
- existing encryption utilities
- existing job/background-worker infrastructure
- existing secrets patterns
- existing Google Cloud resources if any
- existing deployment scripts
- existing tax-document feature code
- existing packages shared by web/desktop
- existing MCP tax architecture
- existing observability/logging stack

Prefer existing Moat conventions over introducing parallel abstractions.

Determine:
- whether an R2 tax bucket already exists
- whether application-level encryption already exists
- whether there is already a job queue
- how production environment variables/secrets are handled
- which GCP project should be used if one is already configured

Do not create duplicate resources when suitable ones already exist.

==================================================
PHASE 1 — VERIFY LOCAL TOOLING / AUTH
==================================================

Check:

gcloud --version
gcloud auth list
gcloud config get-value project
docker --version
npx wrangler --version

If GCP auth is missing, ask me to run/approve:

gcloud auth login
gcloud auth application-default login

If no GCP project is selected, identify available projects:

gcloud projects list

Do not create a random project without asking if multiple plausible production projects exist.

If Cloudflare access is needed:

npx wrangler whoami

If authentication is missing, ask me to approve:

npx wrangler login

Do not ask me to manually perform CLI work you can perform yourself.

==================================================
PHASE 2 — GOOGLE CLOUD PROJECT SETUP
==================================================

Use a dedicated production-safe GCP project or the existing project appropriate for Moat.

Recommended region:
us-central1

Prefer keeping:
- Artifact Registry
- Cloud Run
- logs
- secrets

in the same region where possible.

Enable only required APIs.

Likely APIs:

run.googleapis.com
artifactregistry.googleapis.com
cloudbuild.googleapis.com
iam.googleapis.com
secretmanager.googleapis.com
logging.googleapis.com

Use:

gcloud services enable ...

Do not enable unnecessary APIs.

Document exactly which APIs are enabled.

==================================================
PHASE 3 — CREATE ARTIFACT REGISTRY
==================================================

Create a dedicated Docker repository if one does not already exist.

Suggested:

Repository:
moat-private-processing

Region:
us-central1

Example:

gcloud artifacts repositories create moat-private-processing \
  --repository-format=docker \
  --location=us-central1 \
  --description="Private Moat document-processing containers"

Configure Docker authentication:

gcloud auth configure-docker us-central1-docker.pkg.dev

Do not make the repository public.

==================================================
PHASE 4 — CREATE DEDICATED SERVICE IDENTITIES
==================================================

Create narrowly scoped service accounts.

At minimum:

1. Docling runtime identity

Suggested name:
moat-docling-runtime

Purpose:
identity used by the Cloud Run Docling service

2. If needed, deployer/build identity
Reuse existing CI/deployment identity if appropriate.

Runtime identity should have only the permissions it actually needs.

Do NOT grant:
- Owner
- Editor
- broad project admin

unless absolutely unavoidable.

The Docling runtime may not need broad GCP permissions at all if:
- R2 access comes from credentials supplied through Secret Manager
- output goes back through an authenticated Moat API

Prefer least privilege.

==================================================
PHASE 5 — CLOUDFLARE R2
==================================================

Inspect existing R2 infrastructure first.

If a dedicated tax-document bucket does not exist, create one.

Suggested name:

moat-tax-documents-prod

Use Cloudflare’s R2 CLI / Wrangler.

Example:

npx wrangler r2 bucket create moat-tax-documents-prod \
  --jurisdiction us

Cloudflare R2 buckets are private by default. Do NOT:
- enable r2.dev public access
- attach a public custom domain
- enable CDN caching

R2 supports the S3-compatible API, so use an S3-compatible client from application code where appropriate. :contentReference[oaicite:0]{index=0}

If separate staging infrastructure is already the project convention, create:

moat-tax-documents-staging

Do NOT mix production and development tax documents.

If application-level encryption does not already exist, do NOT silently invent a production cryptographic scheme.

Instead:
- implement the encryption abstraction
- use a proper AEAD algorithm such as AES-256-GCM
- use random per-document data-encryption keys
- design envelope encryption
- stop and clearly identify the master-key/KMS decision that needs review before production

If Moat already has envelope encryption, reuse it.

==================================================
PHASE 6 — BUILD DOCLING CONTAINER
==================================================

Use Docling / docling-serve as the parser.

Prefer a pinned version, not `latest`.

Create something similar to:

infra/docling/
  Dockerfile
  README.md
  scripts/
  healthcheck/
  config/

Use a production Docker image.

Important:

- pin Docling/docling-serve versions
- install model artifacts at image build time when possible
- avoid runtime downloads
- disable UI
- disable unnecessary endpoints/features
- do not enable remote LLM integrations
- do not expose debug output
- use production logging
- make all processing transient

Docling Serve supports local and distributed engines and is designed to run as a service; use its supported environment configuration rather than hacking around its internals. :contentReference[oaicite:1]{index=1}

Build for Cloud Run’s expected architecture.

Example image path:

us-central1-docker.pkg.dev/${PROJECT_ID}/moat-private-processing/docling-tax-parser:${VERSION}

Build/push using one of:

docker buildx
gcloud builds submit

Choose the simplest approach consistent with the existing repo.

==================================================
PHASE 7 — MOAT PARSER WRAPPER
==================================================

Do NOT let the application depend directly on Docling-specific response shapes.

Create or extend:

TaxDocumentParser

Conceptually:

interface TaxDocumentParser {
  parse(input: ParseTaxDocumentInput): Promise<ParsedTaxDocument>
}

Implement:

DoclingCloudParser

Future:
DoclingLocalParser

ParsedTaxDocument should be a Moat-owned normalized type.

Include useful structures such as:

- text blocks
- tables
- pages
- page numbers
- bounding boxes / provenance
- detected form hints
- confidence where available
- parser name
- parser version
- parse timestamp

Do not make Markdown the canonical parsed representation.

Preserve richer structured output.

==================================================
PHASE 8 — CLOUD RUN SERVICE
==================================================

Deploy Docling to Cloud Run.

Service name:

moat-docling-tax-parser

Region:

us-central1

Start CPU-only.

Initial recommendation:

CPU:
8 vCPU

Memory:
16 GiB

Concurrency:
1

Min instances:
0

Max instances:
5

Timeout:
set high enough for large tax packages; start around 10–15 minutes if supported/appropriate

CPU allocation:
favor full CPU during request processing

Do not add GPU initially.

Cloud Run services are private by default when unauthenticated access is not allowed; explicitly deploy with authentication required. :contentReference[oaicite:2]{index=2}

Use:

--no-allow-unauthenticated

Do NOT add `allUsers` as Cloud Run Invoker.

Attach:

--service-account moat-docling-runtime@...

Use Artifact Registry for the image. :contentReference[oaicite:3]{index=3}

==================================================
PHASE 9 — AUTHENTICATION
==================================================

Do not use a static shared API key as the primary service authentication mechanism if Google service-to-service identity is available.

Preferred:

Moat backend obtains a Google-signed identity token for the Cloud Run audience and invokes the service.

Grant only the appropriate backend service identity:

roles/run.invoker

on the specific Docling service.

If Moat’s backend runs outside GCP and service-account key material would otherwise be required, evaluate the cleanest supported authentication mechanism.

Prefer:
- workload identity federation
- short-lived credentials

over:
- long-lived downloaded service-account JSON keys

If existing Moat infrastructure makes this difficult, stop and present the available secure choices rather than committing a long-lived production key.

==================================================
PHASE 10 — PARSE JOB MODEL
==================================================

Parsing should be asynchronous from the user’s perspective.

A document upload should not require one giant request to remain open.

Desired flow:

Upload
→ create TaxDocument
→ status = uploaded
→ enqueue parse
→ status = processing
→ invoke Docling
→ normalize result
→ run extraction
→ status = parsed / needs_review / failed

Reuse existing Moat background-job infrastructure if present.

Do not add Redis just because Docling supports Redis/RQ if Moat already has a suitable queue.

If no queue exists, choose the simplest managed solution.

Potential options:
- Google Cloud Tasks
- existing DB-backed job queue

Prefer low operational burden.

Avoid Kubernetes.

==================================================
PHASE 11 — TRANSIENT DOCUMENT HANDLING
==================================================

This is a security-critical requirement.

The parser should:

1. Receive document identifier/job details
2. Obtain encrypted source
3. Create isolated temporary workspace
4. Decrypt only when necessary
5. Parse
6. Return/write normalized structured result
7. Explicitly remove plaintext temporary files
8. Remove intermediate extracted artifacts
9. End request/job

Do not persist raw PDFs in:
- container image filesystem
- persistent disk
- parser DB
- Redis payloads
- logs
- crash dumps

Cloud Run’s local filesystem is ephemeral, but explicitly clean temporary files anyway.

Prefer an in-memory volume for particularly sensitive temp data if practical and within memory limits.

==================================================
PHASE 12 — LOGGING / OBSERVABILITY
==================================================

Audit every log statement in the parsing pipeline.

Allowed logging examples:

documentId
taxYear
parserVersion
pageCount
processingDurationMs
jobId
status
errorCode

Do NOT log:

file contents
parsed text
TaxFacts
SSNs
EINs
names
addresses
account numbers
routing numbers
income
tax withholding
presigned URLs
encryption keys
R2 secrets

Create a log-sanitization helper if useful.

Ensure exception handlers do not dump request bodies.

Disable overly verbose Docling/debug logs in production.

==================================================
PHASE 13 — R2 ACCESS CREDENTIALS
==================================================

If Cloud Run needs direct R2 access:

create a narrowly scoped R2 API token/credential that can access only the intended bucket.

Do not give:
- account-wide admin privileges
- unrelated bucket access

Store R2 credentials in Google Secret Manager or use an existing secure Moat secret-management pattern.

Do not put secrets in:
- Docker image
- repository
- environment files committed to git
- CI logs

R2 uses an S3-compatible endpoint of the form:

https://<ACCOUNT_ID>.r2.cloudflarestorage.com

Use an S3-compatible SDK rather than shelling out to Wrangler at runtime. :contentReference[oaicite:4]{index=4}

==================================================
PHASE 14 — HEALTH CHECKS
==================================================

Expose a very small internal health endpoint.

It should reveal only things like:

{
  "status": "ok",
  "parser": "docling",
  "version": "..."
}

Do not expose:
- environment variables
- models directory listing
- host info
- secrets
- document state

Test private invocation using Google’s recommended authenticated Cloud Run tooling/proxy. :contentReference[oaicite:5]{index=5}

==================================================
PHASE 15 — SECURITY TESTS
==================================================

Verify all of the following:

1. Unauthenticated request to parser fails.
2. Browser cannot invoke parser directly.
3. Authorized backend can invoke parser.
4. Wrong service identity cannot invoke parser.
5. R2 bucket is private.
6. No `r2.dev` public endpoint.
7. Original document cannot be fetched without authorization.
8. Parser logs contain no document contents.
9. Failed parsing does not leave plaintext artifacts.
10. Temporary workspace is deleted after success.
11. Temporary workspace is deleted after failure.
12. Runtime performs no external model downloads.
13. No third-party AI API is called.
14. Large document limits are enforced.
15. Unsupported file types are rejected.
16. User/profile ownership is checked before processing.
17. Tax year cannot be used to access another user’s documents.

==================================================
PHASE 16 — RESOURCE / ABUSE LIMITS
==================================================

Add limits.

Current product assumptions:

Per-file maximum:
25 MB initially

Per-tax-year storage:
100 MB per profile

Make these constants/configurable.

Also consider:
- maximum page count
- parsing timeout
- maximum concurrent documents per user
- queue rate limits

Return user-friendly errors.

Do not allow a PDF decompression bomb or malformed image to consume unbounded resources.

==================================================
PHASE 17 — BENCHMARK
==================================================

Create a benchmark suite.

Use synthetic/public/non-sensitive sample documents.

Include:

- W-2 born-digital
- scanned W-2
- rotated W-2
- 1099-INT
- 1099-DIV
- 1099-B
- consolidated brokerage 1099
- mortgage 1098
- 5498-SA
- K-1
- prior 1040
- multi-page brokerage statement
- low-quality scan

Measure:

- page count
- wall-clock processing time
- CPU
- memory
- output correctness
- monetary-value extraction accuracy
- table extraction quality
- provenance quality
- cold-start latency

Generate a report.

Do not optimize for OCR prose accuracy alone.

Primary metric:

Can Moat recover the exact correct tax value and prove where it came from?

==================================================
PHASE 18 — COST INSTRUMENTATION
==================================================

Add enough metrics to estimate:

cost/document
cost/page
seconds/page
failure rate
cold-start frequency

Do not store sensitive values in metrics.

After benchmark/load testing, recommend whether:

8 CPU / 16 GB

should be lowered.

Prefer the lowest-cost configuration that reliably processes tax documents.

Do not enable a GPU unless benchmarks demonstrate a meaningful need.

==================================================
PHASE 19 — LOCAL DESKTOP FUTURE-PROOFING
==================================================

Do NOT implement the full downloadable local Docling runtime unless straightforward and within scope.

But make sure cloud architecture supports this future implementation:

TaxDocumentParser
├── DoclingCloudParser
└── DoclingLocalParser

Both must return identical:

ParsedTaxDocument

Desktop-local future flow:

Electron main
→ local sidecar
→ Docling
→ ParsedTaxDocument
→ SQLite

No renderer-direct parsing.

Do not bake a multi-gigabyte parser into the base desktop app.

Future local processor should be downloadable on demand.

==================================================
PHASE 20 — CI/CD
==================================================

Add a simple deployment path.

Prefer:
- existing CI platform if present
- immutable image tags
- Git commit SHA tags
- no `latest` in production

Example:

docling-tax-parser:<git-sha>

Deployment should:
1. build image
2. run tests
3. push to Artifact Registry
4. deploy new Cloud Run revision
5. run health check
6. stop on failure

Do not automatically grant IAM permissions during every deployment.

Separate one-time infrastructure provisioning from regular application deployment.

==================================================
PHASE 21 — INFRASTRUCTURE AS CODE / REPRODUCIBILITY
==================================================

Even if you use `gcloud` CLI initially, do not leave the system as undocumented console state.

Create:

infra/tax-processing/README.md

Include:
- architecture
- project ID
- region
- service names
- service accounts
- Artifact Registry repo
- R2 bucket
- required APIs
- deployment commands
- rollback commands
- IAM relationships
- secrets names
- resource limits
- incident/debug instructions

If the repo already uses Terraform/Pulumi/etc., define these resources there.

If it does not, do NOT introduce a giant Terraform setup just for this unless clearly beneficial.

Shell scripts with idempotent checks are acceptable for the first version.

==================================================
PHASE 22 — THINGS YOU MUST NOT DO
==================================================

Do not:

- make Cloud Run public
- enable unauthenticated invocation
- send documents to third-party AI APIs
- add Unstructured Cloud
- use OpenAI/Anthropic for document extraction
- store plaintext PDFs in Postgres
- put R2 credentials in code
- put service-account JSON in git
- grant broad Owner/Editor permissions
- persist parsing temp files
- log document contents
- enable runtime model telemetry containing user content
- add Kubernetes
- provision always-on GPU VMs
- expose raw Docling APIs directly to web/mobile clients
- let desktop renderer invoke Docling directly
- silently create expensive infrastructure

==================================================
PHASE 23 — MANUAL ACTIONS FOR ME
==================================================

Do everything you can yourself.

At the end, identify ONLY the actions I genuinely need to perform.

Likely examples:

- approving Google Cloud billing
- authenticating `gcloud`
- authenticating Wrangler
- creating/approving a production encryption master key
- approving final production IAM
- entering a secret that is intentionally unavailable to the agent

Do not give me a giant setup checklist of things the CLI can do.

==================================================
FINAL DELIVERABLE
==================================================

When finished, provide:

1. Architecture implemented
2. GCP project and region used
3. Cloud Run service
4. Cloud Run configuration
5. Artifact Registry repository
6. Service accounts created
7. IAM roles granted
8. R2 bucket used
9. Secrets created/referenced
10. Parser versions pinned
11. App code added/changed
12. Queue/job flow
13. Security controls
14. Logging/redaction controls
15. Benchmark results
16. Approximate cost per:
    - page
    - normal tax document
    - typical tax user/year
17. Tests performed
18. CI/CD workflow
19. Any actions still required from me
20. Any security concerns that should block production

Most importantly:

Do not tell me the deployment is secure merely because it works.

Actively verify the service is private and attempt an unauthenticated request to prove that it is denied.