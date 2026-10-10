#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
REGION="${GCP_REGION:-us-central1}"
REPO="${ARTIFACT_REPO:-moat-private-processing}"
SERVICE="${TAX_LLM_CONTROLLER_SERVICE:-moat-tax-llm-controller}"
CONTROLLER_SA="${CONTROLLER_SA:-moat-tax-llm-controller}"
PUBLISHER_SA="${PUBLISHER_SA:-moat-tax-llm-publisher}"
TASKS_SA="${TASKS_SA:-moat-tax-llm-tasks}"
WORKER_SA="${WORKER_SA:-moat-tax-llm-worker}"
MOAT_API_URL="${MOAT_API_URL:-https://api.moatfinance.ai}"
TAG="${IMAGE_TAG:-$(git -C "${ROOT}" rev-parse --short HEAD)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/tax-llm-controller:${TAG}"

cd "${ROOT}"
pnpm --filter @moat/tax-llm install
pnpm --filter @moat/tax-llm run build:controller

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
gcloud builds submit \
  --project "${PROJECT_ID}" \
  --tag "${IMAGE}" \
  --timeout=1200s \
  --ignore-file "${ROOT}/infra/tax-llm/.gcloudignore" \
  "${ROOT}/infra/tax-llm"

ZONE="$(gcloud compute instances list --project="${PROJECT_ID}" --filter="name=moat-tax-llm-worker" --format='value(zone)' | head -n1)"
if [[ -z "${ZONE}" ]]; then
  ZONE="${TAX_LLM_ZONE:-us-central1-a}"
fi

ALLOWED="${PUBLISHER_SA}@${PROJECT_ID}.iam.gserviceaccount.com,${TASKS_SA}@${PROJECT_ID}.iam.gserviceaccount.com,${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com,${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --service-account "${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --no-allow-unauthenticated \
  --ingress all \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 20 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 120 \
  --set-env-vars="^|^GCP_PROJECT_ID=${PROJECT_ID}|GCP_REGION=${REGION}|TAX_LLM_ZONE=${ZONE}|TAX_LLM_INSTANCE_NAME=moat-tax-llm-worker|TAX_LLM_TOPIC=moat-tax-llm-extraction|TAX_LLM_TASKS_QUEUE=moat-tax-llm-watchdog|TAX_LLM_TASKS_SA=${TASKS_SA}@${PROJECT_ID}.iam.gserviceaccount.com|MOAT_API_URL=${MOAT_API_URL}|TAX_LLM_ALLOWED_INVOKERS=${ALLOWED}" \
  --quiet

SERVICE_URL="$(gcloud run services describe "${SERVICE}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)')"

gcloud run services update "${SERVICE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --update-env-vars="TAX_LLM_CONTROLLER_URL=${SERVICE_URL}" \
  --quiet

for member in "${PUBLISHER_SA}" "${TASKS_SA}" "${WORKER_SA}"; do
  gcloud run services add-iam-policy-binding "${SERVICE}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${member}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/run.invoker" \
    --quiet >/dev/null
done

echo "Deployed ${SERVICE}"
echo "  url: ${SERVICE_URL}"
echo "Set API env TAX_LLM_CONTROLLER_URL=${SERVICE_URL}"
echo "Set TAX_LLM_RUNTIME_SERVICE_ACCOUNT=${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com,${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
