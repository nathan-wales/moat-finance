#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
TOKEN="$(gcloud auth print-access-token)"

gcloud services enable cloudquotas.googleapis.com --project="${PROJECT_ID}" --quiet

curl -sS -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  "https://cloudquotas.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/quotaPreferences?quotaPreferenceId=moat-tax-llm-gpus-all-regions-1" \
  -d '{
    "service": "compute.googleapis.com",
    "quotaId": "GPUS-ALL-REGIONS-per-project",
    "quotaConfig": { "preferredValue": "1" },
    "justification": "One on-demand NVIDIA L4 (g2-standard-8) in us-central1 for private self-hosted Qwen3-8B W-2 extraction. The VM is stopped after 120s idle.",
    "contactEmail": "'"${CONTACT_EMAIL:?Set CONTACT_EMAIL}"'"
  }'
