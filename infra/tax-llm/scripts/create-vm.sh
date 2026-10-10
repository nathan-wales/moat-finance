#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
REGION="${GCP_REGION:-us-central1}"
PREFERRED_ZONE="${TAX_LLM_ZONE:-}"
NETWORK="${TAX_LLM_NETWORK:-moat-tax-llm-vpc}"
SUBNET="${TAX_LLM_SUBNET:-moat-tax-llm-us-central1}"
INSTANCE="${TAX_LLM_INSTANCE_NAME:-moat-tax-llm-worker}"
WORKER_SA="${WORKER_SA:-moat-tax-llm-worker}"
MACHINE="${TAX_LLM_MACHINE:-g2-standard-8}"

EXISTING_ZONE="$(gcloud compute instances list --project="${PROJECT_ID}" --filter="name=${INSTANCE}" --format='value(zone)' | head -n1)"
if [[ -n "${EXISTING_ZONE}" ]]; then
  echo "Instance ${INSTANCE} already exists in ${EXISTING_ZONE}"
  exit 0
fi

IMAGE_FAMILY="${TAX_LLM_IMAGE_FAMILY:-ubuntu-accelerator-2404-amd64-with-nvidia-580}"
IMAGE_PROJECT="${TAX_LLM_IMAGE_PROJECT:-ubuntu-os-accelerator-images}"
if ! gcloud compute images describe-from-family "${IMAGE_FAMILY}" --project="${IMAGE_PROJECT}" >/dev/null 2>&1; then
  IMAGE_FAMILY="ubuntu-accelerator-2404-amd64-with-nvidia-595"
fi
if ! gcloud compute images describe-from-family "${IMAGE_FAMILY}" --project="${IMAGE_PROJECT}" >/dev/null 2>&1; then
  IMAGE_FAMILY="ubuntu-2404-lts-amd64"
  IMAGE_PROJECT="ubuntu-os-cloud"
fi
if ! gcloud compute images describe-from-family "${IMAGE_FAMILY}" --project="${IMAGE_PROJECT}" >/dev/null 2>&1; then
  IMAGE_FAMILY="ubuntu-2404-lts"
  IMAGE_PROJECT="ubuntu-os-cloud"
fi
echo "Using image family ${IMAGE_FAMILY} from ${IMAGE_PROJECT}"

ZONES=(us-central1-a us-central1-b us-central1-c)
if [[ -n "${PREFERRED_ZONE}" ]]; then
  ZONES=("${PREFERRED_ZONE}" "${ZONES[@]}")
fi

CREATED_ZONE=""
for ZONE in "${ZONES[@]}"; do
  echo "Trying ${MACHINE} in ${ZONE}"
  if gcloud compute instances create "${INSTANCE}" \
    --project="${PROJECT_ID}" \
    --zone="${ZONE}" \
    --machine-type="${MACHINE}" \
    --image-family="${IMAGE_FAMILY}" \
    --image-project="${IMAGE_PROJECT}" \
    --boot-disk-size=100GB \
    --boot-disk-type=pd-balanced \
    --network-interface="network=${NETWORK},subnet=${SUBNET},no-address" \
    --maintenance-policy=TERMINATE \
    --provisioning-model=STANDARD \
    --restart-on-failure \
    --service-account="${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --metadata=enable-oslogin=TRUE \
    --labels=moat-feature=tax-llm,moat-role=gpu-worker \
    --tags=moat-tax-llm-worker \
    --quiet; then
    CREATED_ZONE="${ZONE}"
    break
  fi
done

if [[ -z "${CREATED_ZONE}" ]]; then
  echo "Could not create ${INSTANCE} in ${REGION}; L4 capacity is exhausted" >&2
  exit 1
fi

TAX_LLM_ZONE="${CREATED_ZONE}" "${ROOT}/infra/tax-llm/scripts/bind-worker-iam.sh"

echo "Created ${INSTANCE} in ${CREATED_ZONE} with no external IP"
echo "TAX_LLM_ZONE=${CREATED_ZONE}"
