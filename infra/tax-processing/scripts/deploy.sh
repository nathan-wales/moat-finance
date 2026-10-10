#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
REGION="${GCP_REGION:-us-central1}"
REPO="${ARTIFACT_REPO:-moat-private-processing}"
RUNTIME_SA="${RUNTIME_SA:-moat-docling-runtime}"
SCHEDULER_SA="${SCHEDULER_SA:-moat-docling-scheduler}"
SERVICE="${CLOUD_RUN_SERVICE:-moat-docling-tax-parser}"
MOAT_API_URL="${MOAT_API_URL:-https://api.moatfinance.ai}"
TAG="${IMAGE_TAG:-$(git -C "${ROOT}" rev-parse --short HEAD)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/docling-tax-parser:${TAG}"

echo "Building ${IMAGE}"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
gcloud builds submit \
  --project "${PROJECT_ID}" \
  --tag "${IMAGE}" \
  --timeout=3600s \
  --machine-type=E2_HIGHCPU_8 \
  "${ROOT}/infra/docling"

echo "Deploying ${SERVICE}"
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --service-account "${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --no-allow-unauthenticated \
  --ingress all \
  --cpu 8 \
  --memory 16Gi \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 900 \
  --cpu-boost \
  --execution-environment gen2 \
  --add-volume=name=scratch,type=in-memory,size-limit=2048Mi \
  --add-volume-mount=volume=scratch,mount-path=/scratch \
  --set-env-vars="MOAT_API_URL=${MOAT_API_URL},MOAT_PARSER_SCRATCH=/scratch,HF_HUB_OFFLINE=1,TRANSFORMERS_OFFLINE=1,DOCLING_SERVE_ENABLE_UI=false,DOCLING_SERVE_ENABLE_REMOTE_SERVICES=false,DOCLING_PARSER_VERSION=${TAG}" \
  --port 8080 \
  --quiet

SERVICE_URL="$(gcloud run services describe "${SERVICE}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)')"

gcloud run services add-iam-policy-binding "${SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --quiet >/dev/null

if ! gcloud scheduler jobs describe moat-docling-drain --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud scheduler jobs create http moat-docling-drain \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --schedule="* * * * *" \
    --uri="${SERVICE_URL}/v1/drain-jobs" \
    --http-method=POST \
    --oidc-service-account-email="${SCHEDULER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --oidc-token-audience="${SERVICE_URL}" \
    --attempt-deadline=800s
else
  gcloud scheduler jobs update http moat-docling-drain \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --schedule="* * * * *" \
    --uri="${SERVICE_URL}/v1/drain-jobs" \
    --http-method=POST \
    --oidc-service-account-email="${SCHEDULER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --oidc-token-audience="${SERVICE_URL}" \
    --attempt-deadline=800s
fi

echo "Deployed ${SERVICE}"
echo "  url: ${SERVICE_URL}"
echo "  image: ${IMAGE}"
echo "Set API env:"
echo "  DOCLING_PARSER_URL=${SERVICE_URL}"
echo "  DOCLING_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "  DOCLING_PARSE_AUDIENCE=${MOAT_API_URL}"
