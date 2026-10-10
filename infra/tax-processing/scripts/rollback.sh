#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-moat-docling-tax-parser}"
REVISION="${1:-}"

if [ -z "${REVISION}" ]; then
  echo "Usage: rollback.sh <revision-name>"
  gcloud run revisions list --service="${SERVICE}" --region="${REGION}" --project="${PROJECT_ID}"
  exit 1
fi

gcloud run services update-traffic "${SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --to-revisions="${REVISION}=100"
echo "Rolled ${SERVICE} to ${REVISION}"
