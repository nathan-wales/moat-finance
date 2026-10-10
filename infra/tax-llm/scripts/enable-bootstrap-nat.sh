#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
REGION="${GCP_REGION:-us-central1}"
NETWORK="${TAX_LLM_NETWORK:-moat-tax-llm-vpc}"
ROUTER="${TAX_LLM_BOOTSTRAP_ROUTER:-moat-tax-llm-bootstrap-router}"
NAT="${TAX_LLM_BOOTSTRAP_NAT:-moat-tax-llm-bootstrap-nat}"

gcloud services enable iap.googleapis.com dns.googleapis.com --project="${PROJECT_ID}"

if ! gcloud compute firewall-rules describe moat-tax-llm-iap-ssh --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud compute firewall-rules create moat-tax-llm-iap-ssh \
    --project="${PROJECT_ID}" \
    --network="${NETWORK}" \
    --allow=tcp:22 \
    --source-ranges=35.235.240.0/20 \
    --target-tags=moat-tax-llm-worker \
    --description="IAP SSH to the private tax LLM worker only"
fi

if ! gcloud compute routers describe "${ROUTER}" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud compute routers create "${ROUTER}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --network="${NETWORK}" \
    --description="Temporary bootstrap router for tax LLM model install"
fi

if ! gcloud compute routers nats describe "${NAT}" --router="${ROUTER}" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud compute routers nats create "${NAT}" \
    --project="${PROJECT_ID}" \
    --router="${ROUTER}" \
    --region="${REGION}" \
    --nat-all-subnet-ip-ranges \
    --auto-allocate-nat-external-ips
fi

echo "Bootstrap NAT ${NAT} is enabled on ${NETWORK}. Remove it after model install."
