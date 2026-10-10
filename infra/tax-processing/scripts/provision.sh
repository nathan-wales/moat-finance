#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
REGION="${GCP_REGION:-us-central1}"
REPO="${ARTIFACT_REPO:-moat-private-processing}"
RUNTIME_SA="${RUNTIME_SA:-moat-docling-runtime}"
SCHEDULER_SA="${SCHEDULER_SA:-moat-docling-scheduler}"
DEPLOYER_SA="${DEPLOYER_SA:-moat-docling-deployer}"
SERVICE="${CLOUD_RUN_SERVICE:-moat-docling-tax-parser}"
GITHUB_ORG="${GITHUB_ORG:-tyler16smith}"
GITHUB_REPO="${GITHUB_REPO:-moat-finance}"
MOAT_API_URL="${MOAT_API_URL:-https://api.moatfinance.ai}"

echo "Provisioning tax-processing infra in ${PROJECT_ID} / ${REGION}"
echo "This enables Cloud Run, Artifact Registry, Cloud Build, IAM, Scheduler, and logging APIs."
echo "It creates private Artifact Registry, least-privilege service accounts, and IAM bindings."
echo "It does not make Cloud Run public and does not create GPU resources."

gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  cloudscheduler.googleapis.com \
  --project "${PROJECT_ID}"

if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Private Moat document-processing containers" \
    --project="${PROJECT_ID}"
fi

gcloud artifacts repositories describe "${REPO}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null

create_sa() {
  local name="$1"
  local display="$2"
  if ! gcloud iam service-accounts describe "${name}@${PROJECT_ID}.iam.gserviceaccount.com" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud iam service-accounts create "${name}" \
      --display-name="${display}" \
      --project="${PROJECT_ID}"
  fi
}

create_sa "${RUNTIME_SA}" "Moat Docling Cloud Run runtime"
create_sa "${SCHEDULER_SA}" "Moat Docling Cloud Scheduler invoker"
create_sa "${DEPLOYER_SA}" "Moat Docling image deployer"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter" \
  --condition=None >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" \
  --condition=None >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin" \
  --condition=None >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudscheduler.admin" \
  --condition=None >/dev/null

gcloud iam service-accounts add-iam-policy-binding \
  "${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}" >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
gcloud iam service-accounts add-iam-policy-binding \
  "${SCHEDULER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}" >/dev/null

POOL="${WIF_POOL:-github-actions}"
PROVIDER="${WIF_PROVIDER:-github-provider}"
if ! gcloud iam workload-identity-pools describe "${POOL}" --location="global" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${POOL}" \
    --location="global" \
    --display-name="GitHub Actions" \
    --project="${PROJECT_ID}"
fi
if ! gcloud iam workload-identity-pools providers describe "${PROVIDER}" --location="global" --workload-identity-pool="${POOL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER}" \
    --location="global" \
    --workload-identity-pool="${POOL}" \
    --display-name="GitHub" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository=='${GITHUB_ORG}/${GITHUB_REPO}'" \
    --project="${PROJECT_ID}"
fi

gcloud iam service-accounts add-iam-policy-binding \
  "${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}" \
  --project="${PROJECT_ID}" >/dev/null

echo "Provisioned:"
echo "  project: ${PROJECT_ID}"
echo "  region: ${REGION}"
echo "  artifact repo: ${REPO}"
echo "  runtime SA: ${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "  scheduler SA: ${SCHEDULER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "  deployer SA: ${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "  WIF pool: ${POOL}"
echo "Next: run infra/tax-processing/scripts/deploy.sh after billing is enabled."
echo "Set Vercel/API env DOCLING_PARSER_URL after the first deploy prints the Cloud Run URL."
echo "Set DOCLING_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "Set DOCLING_PARSE_AUDIENCE=${MOAT_API_URL}"
