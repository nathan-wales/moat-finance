#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
REGION="${GCP_REGION:-us-central1}"
ROUTER="${TAX_LLM_BOOTSTRAP_ROUTER:-moat-tax-llm-bootstrap-router}"
NAT="${TAX_LLM_BOOTSTRAP_NAT:-moat-tax-llm-bootstrap-nat}"

if gcloud compute routers nats describe "${NAT}" --router="${ROUTER}" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud compute routers nats delete "${NAT}" \
    --router="${ROUTER}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --quiet
fi

if gcloud compute routers describe "${ROUTER}" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud compute routers delete "${ROUTER}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --quiet
fi

echo "Removed feature-specific bootstrap NAT/router if they existed."
