# Private Qwen 8B tax extraction

> Parked with the Taxes product (`TAXES_PRODUCT_ENABLED` / iOS
> `ProductFlags.taxesEnabled`). Do not start this VM or set
> `TAX_LLM_EXTRACTION_ENABLED` unless a human explicitly asks to restore
> Taxes. Extraction was close but never fully proven E2E; bring the GPU VM
> back, fix it, and verify the pipeline before turning the env flag on.
> Leave the VM **STOPPED** until then.

Self-hosted W-2 extraction on a private GPU VM. Docling still parses PDFs. This pipeline only replaces structured W-2 field extraction.

```text
Docling parsed text
  → AES-256-GCM in API memory
  → Pub/Sub (ciphertext only)
  → ensure GPU VM running
  → worker decrypts in memory
  → SSN/EIN tokenization
  → Qwen3-8B / vLLM on 127.0.0.1:8000
  → Zod validation + token restore
  → persist TaxFormExtraction / TaxFact
  → ACK
  → stop VM after 120s idle
```

## Identifiers

| Resource | Value |
|----------|-------|
| GCP project | `moat-finance` (`418506358288`) |
| Region | `us-central1` (same as Docling) |
| VPC / subnet | `moat-tax-llm-vpc` / `moat-tax-llm-us-central1` |
| GPU VM | `moat-tax-llm-worker` (`g2-standard-8`, L4, no external IP) |
| Model | `Qwen/Qwen3-8B` revision `b968826d9c46dd6066d109eabc6255188de91218` |
| Topic | `moat-tax-llm-extraction` |
| Subscription | `moat-tax-llm-extraction-worker` |
| Cloud Run | `moat-tax-llm-controller` |
| Secret | `tax-llm-encryption-key-v1` |

## Commands

```bash
./infra/tax-llm/scripts/provision.sh
./infra/tax-llm/scripts/configure-private-dns.sh
./infra/tax-llm/scripts/create-vm.sh
./infra/tax-llm/scripts/enable-bootstrap-nat.sh
./infra/tax-llm/scripts/deploy-controller.sh
./infra/tax-llm/scripts/deploy-worker.sh
./infra/tax-llm/scripts/eval-synthetic-on-vm.sh
./infra/tax-llm/scripts/disable-bootstrap-nat.sh
./infra/tax-llm/scripts/verify-private.sh
```

Leave the VM **STOPPED** when idle. Disk/model cache stay.

## Current GCP status (2026-09-18)

Provisioned in `moat-finance` / `us-central1`:

- Dedicated VPC `moat-tax-llm-vpc` and subnet `moat-tax-llm-us-central1` (`10.48.0.0/24`, Private Google Access)
- Private DNS for `googleapis.com`, `run.app`, and `pkg.dev` → `private.googleapis.com`
- GPU VM `moat-tax-llm-worker` in **us-central1-c** (`g2-standard-8`, 1x L4, 100 GB pd-balanced, **no external IP**, currently **TERMINATED**)
- Local Qwen3-8B at `/opt/moat/models/qwen3-8b` (revision `b968826d9c46dd6066d109eabc6255188de91218`)
- vLLM 0.10.2 + Transformers 4.57.1, bound to `127.0.0.1:8000`
- Pub/Sub topic `moat-tax-llm-extraction` (no topic retention)
- Pull subscription `moat-tax-llm-extraction-worker` (exactly-once, 600s ack, 24h retention, no retained acks, 10–60s retry)
- Cloud Tasks queue `moat-tax-llm-watchdog`
- Cloud Run `moat-tax-llm-controller` (`https://moat-tax-llm-controller-jixkw2ktva-uc.a.run.app`, unauthenticated 403)
- Secret `tax-llm-encryption-key-v1`
- Service accounts `moat-tax-llm-worker`, `moat-tax-llm-controller`, `moat-tax-llm-publisher`, `moat-tax-llm-tasks`
- Custom role `moatTaxLlmInstanceControl` (`compute.instances.get/start/stop`)
- IAP SSH firewall `moat-tax-llm-iap-ssh` only
- Feature-specific bootstrap NAT/router **removed**

Verified on the production VM after NAT removal:

- No external IP
- vLLM listens on `127.0.0.1:8000` only
- `https://example.com` and `https://huggingface.co` time out
- Secret Manager access and Cloud Run (`run.app` 403) still work via Private Google Access
- Worker stopped the VM after ~120s idle (`STOPPING` at 132s)

`us-central1-a`/`b` were L4 stockouts during create. A later start of the stopped VM in `us-central1-c` also hit `ZONE_RESOURCE_POOL_EXHAUSTED`. Retry `gcloud compute instances start moat-tax-llm-worker --zone=us-central1-c` when capacity returns; do not recreate the disk.

## API env

```text
TAX_LLM_EXTRACTION_ENABLED=true
TAX_LLM_CONTROLLER_URL=https://moat-tax-llm-controller-....run.app
TAX_LLM_ENCRYPTION_KEY_VERSION=v1
TAX_LLM_ENCRYPTION_KEY_v1=<base64 32 bytes, same as Secret Manager>
TAX_LLM_RUNTIME_SERVICE_ACCOUNT=moat-tax-llm-controller@...,moat-tax-llm-worker@...
TAX_LLM_PARSE_AUDIENCE=https://api.moatfinance.ai
TAX_LLM_GCP_CLIENT_EMAIL=moat-tax-llm-publisher@moat-finance.iam.gserviceaccount.com
TAX_LLM_GCP_PRIVATE_KEY=...
```

Do not put the encryption key or SA JSON in git.

## Logging

Allowed: job id, status, model healthy, idle, shutdown.
Forbidden: parsed text, prompts, model output, SSN/EIN, keys.
