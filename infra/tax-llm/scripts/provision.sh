#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
REGION="${GCP_REGION:-us-central1}"
NETWORK="${TAX_LLM_NETWORK:-moat-tax-llm-vpc}"
SUBNET="${TAX_LLM_SUBNET:-moat-tax-llm-us-central1}"
SUBNET_RANGE="${TAX_LLM_SUBNET_RANGE:-10.48.0.0/24}"
TOPIC="${TAX_LLM_TOPIC:-moat-tax-llm-extraction}"
SUBSCRIPTION="${TAX_LLM_SUBSCRIPTION:-moat-tax-llm-extraction-worker}"
RESULTS_TOPIC="${TAX_LLM_RESULTS_TOPIC:-moat-tax-llm-results}"
TASKS_QUEUE="${TAX_LLM_TASKS_QUEUE:-moat-tax-llm-watchdog}"
SECRET_NAME="${TAX_LLM_SECRET_NAME:-tax-llm-encryption-key-v1}"
WORKER_SA="${WORKER_SA:-moat-tax-llm-worker}"
CONTROLLER_SA="${CONTROLLER_SA:-moat-tax-llm-controller}"
PUBLISHER_SA="${PUBLISHER_SA:-moat-tax-llm-publisher}"
TASKS_SA="${TASKS_SA:-moat-tax-llm-tasks}"
INSTANCE_ROLE="${INSTANCE_ROLE:-moatTaxLlmInstanceControl}"
INSTANCE_START_ROLE="${INSTANCE_START_ROLE:-moatTaxLlmInstanceStart}"
INSTANCE_STOP_ROLE="${INSTANCE_STOP_ROLE:-moatTaxLlmInstanceStop}"
REPO="${ARTIFACT_REPO:-moat-private-processing}"

echo "Provisioning tax LLM infra in ${PROJECT_ID} / ${REGION}"

gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable \
  compute.googleapis.com \
  pubsub.googleapis.com \
  cloudtasks.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  logging.googleapis.com \
  --project "${PROJECT_ID}"

if ! gcloud compute networks describe "${NETWORK}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud compute networks create "${NETWORK}" \
    --subnet-mode=custom \
    --bgp-routing-mode=regional \
    --project="${PROJECT_ID}"
fi

if ! gcloud compute networks subnets describe "${SUBNET}" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud compute networks subnets create "${SUBNET}" \
    --network="${NETWORK}" \
    --region="${REGION}" \
    --range="${SUBNET_RANGE}" \
    --enable-private-ip-google-access \
    --project="${PROJECT_ID}"
else
  gcloud compute networks subnets update "${SUBNET}" \
    --region="${REGION}" \
    --enable-private-ip-google-access \
    --project="${PROJECT_ID}" >/dev/null
fi

create_sa() {
  local name="$1"
  local display="$2"
  if ! gcloud iam service-accounts describe "${name}@${PROJECT_ID}.iam.gserviceaccount.com" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud iam service-accounts create "${name}" \
      --display-name="${display}" \
      --project="${PROJECT_ID}"
  fi
}

create_sa "${WORKER_SA}" "Moat tax LLM GPU worker"
create_sa "${CONTROLLER_SA}" "Moat tax LLM controller"
create_sa "${PUBLISHER_SA}" "Moat tax LLM API publisher"
create_sa "${TASKS_SA}" "Moat tax LLM Cloud Tasks"

ensure_role() {
  local name="$1"
  local title="$2"
  local permissions="$3"
  if gcloud iam roles describe "${name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud iam roles update "${name}" \
      --project="${PROJECT_ID}" \
      --title="${title}" \
      --description="Tax LLM instance control" \
      --permissions="${permissions}" >/dev/null
  else
    gcloud iam roles create "${name}" \
      --project="${PROJECT_ID}" \
      --title="${title}" \
      --description="Tax LLM instance control" \
      --permissions="${permissions}"
  fi
}

ensure_role "${INSTANCE_ROLE}" "Moat tax LLM instance control" "compute.instances.get,compute.instances.start,compute.instances.stop,compute.zoneOperations.get"
ensure_role "${INSTANCE_START_ROLE}" "Moat tax LLM instance start" "compute.instances.get,compute.instances.start,compute.zoneOperations.get"
ensure_role "${INSTANCE_STOP_ROLE}" "Moat tax LLM instance stop" "compute.instances.get,compute.instances.stop,compute.zoneOperations.get"

if ! gcloud pubsub topics describe "${TOPIC}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud pubsub topics create "${TOPIC}" --project="${PROJECT_ID}"
fi
if ! gcloud pubsub topics describe "${RESULTS_TOPIC}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud pubsub topics create "${RESULTS_TOPIC}" --project="${PROJECT_ID}"
fi
if ! gcloud pubsub subscriptions describe "${SUBSCRIPTION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud pubsub subscriptions create "${SUBSCRIPTION}" \
    --topic="${TOPIC}" \
    --ack-deadline=600 \
    --expiration-period=never \
    --message-retention-duration=24h \
    --no-retain-acked-messages \
    --enable-exactly-once-delivery \
    --min-retry-delay=10s \
    --max-retry-delay=60s \
    --project="${PROJECT_ID}"
else
  gcloud pubsub subscriptions update "${SUBSCRIPTION}" \
    --message-retention-duration=24h \
    --no-retain-acked-messages \
    --project="${PROJECT_ID}"
fi

TASKS_RETRY=(
  --location="${REGION}"
  --project="${PROJECT_ID}"
  --max-attempts=5
  --max-retry-duration=180s
  --min-backoff=5s
  --max-backoff=30s
)
if ! gcloud tasks queues describe "${TASKS_QUEUE}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud tasks queues create "${TASKS_QUEUE}" "${TASKS_RETRY[@]}"
else
  gcloud tasks queues update "${TASKS_QUEUE}" "${TASKS_RETRY[@]}"
fi

if ! gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  KEY="$(openssl rand -base64 32)"
  printf '%s' "${KEY}" | gcloud secrets create "${SECRET_NAME}" \
    --data-file=- \
    --replication-policy=automatic \
    --project="${PROJECT_ID}"
  echo "Created Secret Manager secret ${SECRET_NAME}. Copy the v1 key into Vercel as TAX_LLM_ENCRYPTION_KEY_v1."
else
  echo "Secret ${SECRET_NAME} already exists; not rotating."
fi

gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
  --member="serviceAccount:${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project="${PROJECT_ID}" >/dev/null

gcloud pubsub topics add-iam-policy-binding "${TOPIC}" \
  --member="serviceAccount:${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher" \
  --project="${PROJECT_ID}" >/dev/null

gcloud pubsub topics add-iam-policy-binding "${TOPIC}" \
  --member="serviceAccount:${PUBLISHER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher" \
  --project="${PROJECT_ID}" >/dev/null

gcloud pubsub subscriptions add-iam-policy-binding "${SUBSCRIPTION}" \
  --member="serviceAccount:${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber" \
  --project="${PROJECT_ID}" >/dev/null

gcloud pubsub topics add-iam-policy-binding "${RESULTS_TOPIC}" \
  --member="serviceAccount:${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher" \
  --project="${PROJECT_ID}" >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter" \
  --condition=None >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter" \
  --condition=None >/dev/null

INSTANCE_CONDITION='expression=resource.type != "compute.googleapis.com/Instance" || resource.name.endsWith("/instances/moat-tax-llm-worker"),title=tax_llm_worker_only,description=Only the tax LLM GPU worker VM'

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="projects/${PROJECT_ID}/roles/${INSTANCE_START_ROLE}" \
  --condition="${INSTANCE_CONDITION}" >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="projects/${PROJECT_ID}/roles/${INSTANCE_STOP_ROLE}" \
  --condition="${INSTANCE_CONDITION}" >/dev/null

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if gcloud compute instances list --project="${PROJECT_ID}" --filter="name=moat-tax-llm-worker" --format='value(name)' | grep -q .; then
  "${SCRIPT_DIR}/bind-worker-iam.sh"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer" \
  --condition=None >/dev/null

gcloud iam service-accounts add-iam-policy-binding \
  "${TASKS_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}" >/dev/null

if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Private Moat document-processing containers" \
    --project="${PROJECT_ID}"
fi

echo "Provisioned tax LLM APIs, VPC ${NETWORK}, Pub/Sub, tasks, secret, and service accounts."
