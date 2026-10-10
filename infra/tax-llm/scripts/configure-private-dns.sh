#!/usr/bin/env bash
set -euo pipefail

# Point Google API / Cloud Run hostnames at private.googleapis.com so the
# GPU VM can use Private Google Access without general internet egress.
# Hugging Face / NVIDIA / NodeSource are unaffected and still require the
# temporary bootstrap NAT during first install only.

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
NETWORK="${TAX_LLM_NETWORK:-moat-tax-llm-vpc}"
PRIVATE_GOOGLE_IPS=("199.36.153.8" "199.36.153.9" "199.36.153.10" "199.36.153.11")

ensure_zone() {
  local zone="$1"
  local dns_name="$2"
  if ! gcloud dns managed-zones describe "${zone}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud dns managed-zones create "${zone}" \
      --project="${PROJECT_ID}" \
      --dns-name="${dns_name}" \
      --description="Private Google Access for tax LLM VPC" \
      --visibility=private \
      --networks="${NETWORK}"
  fi
}

ensure_apex_a() {
  local zone="$1"
  local fqdn="$2"
  if gcloud dns record-sets describe "${fqdn}" --zone="${zone}" --type=A --project="${PROJECT_ID}" >/dev/null 2>&1; then
    return 0
  fi
  local rrdatas
  rrdatas="$(IFS=,; echo "${PRIVATE_GOOGLE_IPS[*]}")"
  gcloud dns record-sets create "${fqdn}" \
    --project="${PROJECT_ID}" \
    --zone="${zone}" \
    --type=A \
    --ttl=300 \
    --rrdatas="${rrdatas}"
}

ensure_wildcard_cname() {
  local zone="$1"
  local fqdn="$2"
  local target="$3"
  if gcloud dns record-sets describe "${fqdn}" --zone="${zone}" --type=CNAME --project="${PROJECT_ID}" >/dev/null 2>&1; then
    return 0
  fi
  gcloud dns record-sets create "${fqdn}" \
    --project="${PROJECT_ID}" \
    --zone="${zone}" \
    --type=CNAME \
    --ttl=300 \
    --rrdatas="${target}"
}

ensure_zone moat-tax-llm-googleapis googleapis.com.
ensure_apex_a moat-tax-llm-googleapis googleapis.com.
ensure_wildcard_cname moat-tax-llm-googleapis "*.googleapis.com." googleapis.com.

ensure_zone moat-tax-llm-runapp run.app.
ensure_apex_a moat-tax-llm-runapp run.app.
ensure_wildcard_cname moat-tax-llm-runapp "*.run.app." run.app.

ensure_zone moat-tax-llm-pkgdev pkg.dev.
ensure_apex_a moat-tax-llm-pkgdev pkg.dev.
ensure_wildcard_cname moat-tax-llm-pkgdev "*.pkg.dev." pkg.dev.

echo "Private DNS for googleapis.com, run.app, and pkg.dev is attached to ${NETWORK}"
