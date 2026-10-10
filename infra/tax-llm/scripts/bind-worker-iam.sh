#!/usr/bin/env bash
set -euo pipefail

# Bind instance-scoped start/stop. Project-level IAM Conditions on
# compute.instances.stop are unreliable when the permission check has no
# instance resource.name, which leaves the worker unable to stop itself.

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
INSTANCE="${TAX_LLM_INSTANCE_NAME:-moat-tax-llm-worker}"
WORKER_SA="${WORKER_SA:-moat-tax-llm-worker}"
CONTROLLER_SA="${CONTROLLER_SA:-moat-tax-llm-controller}"
INSTANCE_START_ROLE="${INSTANCE_START_ROLE:-moatTaxLlmInstanceStart}"
INSTANCE_STOP_ROLE="${INSTANCE_STOP_ROLE:-moatTaxLlmInstanceStop}"
ZONE="${TAX_LLM_ZONE:-$(gcloud compute instances list --project="${PROJECT_ID}" --filter="name=${INSTANCE}" --format='value(zone)' | head -n1)}"

if [[ -z "${ZONE}" ]]; then
  echo "Instance ${INSTANCE} not found; skip instance IAM"
  exit 0
fi

echo "Binding instance IAM for ${INSTANCE} in ${ZONE}"

gcloud compute instances add-iam-policy-binding "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --member="serviceAccount:${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="projects/${PROJECT_ID}/roles/${INSTANCE_START_ROLE}"

gcloud compute instances add-iam-policy-binding "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --member="serviceAccount:${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="projects/${PROJECT_ID}/roles/${INSTANCE_STOP_ROLE}"

echo "Instance IAM bound"
