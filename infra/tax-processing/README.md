# Tax document processing infrastructure

Private Docling parsing for Moat tax documents.

```text
User upload
  → Moat API (auth + ownership + 25 MB / 100 MB limits)
  → AES-256-GCM envelope in private Cloudflare R2 (`tax-documents`)
  → TaxDocument.processingState = processing
  → Cloud Scheduler (OIDC) → Cloud Run `/v1/drain-jobs`
  → Drain claims queued documents (`parseClaimedAt`, 20-minute lease, `SKIP LOCKED`)
  → Cloud Run fetches decrypted bytes from Moat internal API
  → Local Docling parse (no third-party AI)
  → Normalized ParsedTaxDocument posted back
  → TaxFacts persisted; scratch files deleted
```

Google Cloud is compute only. Documents are not sent to Google AI APIs, OpenAI, Anthropic, or Unstructured Cloud.

## Identifiers

| Resource | Value |
|----------|-------|
| GCP project | `moat-finance` (`418506358288`) |
| Region | `us-central1` |
| Cloud Run service | `moat-docling-tax-parser` |
| Cloud Run URL | `https://moat-docling-tax-parser-jixkw2ktva-uc.a.run.app` |
| Artifact Registry | `us-central1-docker.pkg.dev/moat-finance/moat-private-processing` |
| Image | `docling-tax-parser:<git-sha>` |
| Runtime SA | `moat-docling-runtime@moat-finance.iam.gserviceaccount.com` |
| Scheduler SA | `moat-docling-scheduler@moat-finance.iam.gserviceaccount.com` |
| Deployer SA | `moat-docling-deployer@moat-finance.iam.gserviceaccount.com` |
| Scheduler job | `moat-docling-drain` (`* * * * *`) |
| R2 bucket | `tax-documents` (private, no r2.dev, no custom domain) |
| Parser image | `ghcr.io/docling-project/docling-serve-cpu:v1.31.0` |

## Required APIs

- `run.googleapis.com`
- `artifactregistry.googleapis.com`
- `cloudbuild.googleapis.com`
- `iam.googleapis.com`
- `iamcredentials.googleapis.com`
- `secretmanager.googleapis.com`
- `logging.googleapis.com`
- `cloudscheduler.googleapis.com`

## IAM

| Identity | Role | Scope |
|----------|------|-------|
| `moat-docling-runtime` | `roles/logging.logWriter` | project |
| `moat-docling-scheduler` | `roles/run.invoker` | Cloud Run service only |
| `moat-docling-deployer` | `roles/artifactregistry.writer`, `roles/run.admin`, `roles/cloudscheduler.admin`, `roles/iam.serviceAccountUser` on runtime SA | deploy path |
| GitHub Actions via WIF | impersonates deployer SA | `tyler16smith/moat-finance` |

Do not grant Owner, Editor, or `allUsers` as Cloud Run Invoker.

The runtime SA does not receive R2 credentials or the document wrapping key. It fetches source bytes through the Moat API using a Google identity token.

## Secrets / env

Cloud Run:

- `MOAT_API_URL` (audience + API origin)
- `MOAT_PARSER_SCRATCH=/scratch`
- `HF_HUB_OFFLINE=1`
- `TRANSFORMERS_OFFLINE=1`

Moat API / Vercel:

- `TAX_R2_*` (existing private R2 token, bucket `tax-documents`)
- `ENCRYPTION_KEY` (current KEK; wrap per-document DEKs)
- `DOCLING_PARSER_URL`
- `DOCLING_RUNTIME_SERVICE_ACCOUNT`
- `DOCLING_PARSE_AUDIENCE` (API origin)

Production encryption currently reuses `ENCRYPTION_KEY` as the wrapping key. A KMS-backed KEK is the remaining production-security decision.

## Commands

One-time:

```bash
./infra/tax-processing/scripts/provision.sh
```

Deploy a revision:

```bash
./infra/tax-processing/scripts/deploy.sh
```

Rollback:

```bash
./infra/tax-processing/scripts/rollback.sh <revision>
```

Prove the service is private:

```bash
./infra/tax-processing/scripts/verify-private.sh
```

## Resource limits

- 8 vCPU / 16 GiB / concurrency 1 / min 0 / max 5 / timeout 900s
- In-memory scratch volume 2 GiB
- Per-file 25 MB, per-year 100 MB, max 150 pages
- Drain claims at most 3 `processing` documents, skipping already-claimed jobs for 20 minutes

## Incident / debug

Authenticated health:

```bash
gcloud run services proxy moat-docling-tax-parser --region=us-central1 --port=8088
curl http://127.0.0.1:8088/health
```

Logs must contain only `documentId`, status, duration, page count, parser version, and error codes. If a log line contains parsed text or tax values, treat it as an incident.

Unauthenticated `curl` of the Cloud Run URL must return 401/403.

## Go-live

1. Set production API env: `DOCLING_PARSER_URL`, `DOCLING_RUNTIME_SERVICE_ACCOUNT`, `DOCLING_PARSE_AUDIENCE` (see values printed by `deploy.sh`).
2. Deploy the API so `/api/internal/tax-parse/*` exists.
3. Resume the drain job:

```bash
gcloud scheduler jobs resume moat-docling-drain --location=us-central1 --project=moat-finance
```

4. For GitHub deploys, set secret `GCP_WIF_PROVIDER` to:

```text
projects/418506358288/locations/global/workloadIdentityPools/github-actions/providers/github-provider
```

The drain job is paused until those API routes are live so Cloud Run does not cold-start every minute against a 404.
