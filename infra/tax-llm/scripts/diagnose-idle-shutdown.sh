#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
INSTANCE="${TAX_LLM_INSTANCE_NAME:-moat-tax-llm-worker}"
WORKER_SA="${WORKER_SA:-moat-tax-llm-worker}"
CONTROLLER_SA="${CONTROLLER_SA:-moat-tax-llm-controller}"
SUBSCRIPTION="${TAX_LLM_SUBSCRIPTION:-moat-tax-llm-extraction-worker}"
TASKS_QUEUE="${TAX_LLM_TASKS_QUEUE:-moat-tax-llm-watchdog}"
REGION="${GCP_REGION:-us-central1}"
ZONE="${TAX_LLM_ZONE:-$(gcloud compute instances list --project="${PROJECT_ID}" --filter="name=${INSTANCE}" --format='value(zone)' | head -n1)}"

if [[ -z "${ZONE}" ]]; then
  echo "Could not resolve TAX_LLM_ZONE" >&2
  exit 1
fi

WORKER_EMAIL="${WORKER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
CONTROLLER_EMAIL="${CONTROLLER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== instance ==="
gcloud compute instances describe "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --format='yaml(name,status,statusMessage,lastStartTimestamp,lastStopTimestamp,scheduling.automaticRestart,serviceAccounts,networkInterfaces[0].accessConfigs)'

echo "=== worker testIamPermissions ==="
gcloud compute instances test-iam-permissions "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --impersonate-service-account="${WORKER_EMAIL}" \
  --permissions=compute.instances.get,compute.instances.stop,compute.instances.start

echo "=== instance IAM policy ==="
gcloud compute instances get-iam-policy "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --format=json

echo "=== project bindings for worker stop role ==="
gcloud projects get-iam-policy "${PROJECT_ID}" \
  --flatten="bindings[]" \
  --filter="bindings.members:${WORKER_EMAIL} AND bindings.role:(moatTaxLlmInstanceStop OR compute.)" \
  --format="table(bindings.role,bindings.members,bindings.condition.expression)"

echo "=== pubsub backlog ==="
gcloud pubsub subscriptions describe "${SUBSCRIPTION}" \
  --project="${PROJECT_ID}" \
  --format='yaml(name,messageRetentionDuration,retainAckedMessages,numUndeliveredMessages,ackDeadlineSeconds)'

echo "=== cloud tasks queue ==="
gcloud tasks queues describe "${TASKS_QUEUE}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='yaml(name,state,retryConfig,rateLimits)'

echo "=== recent stop audit ==="
gcloud logging read \
  "resource.type=gce_instance AND protoPayload.methodName=v1.compute.instances.stop AND protoPayload.resourceName:instances/${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --limit=10 \
  --format='table(timestamp,protoPayload.authenticationInfo.principalEmail,protoPayload.status.code,protoPayload.status.message,protoPayload.methodName)'

echo "=== recent start audit ==="
gcloud logging read \
  "resource.type=gce_instance AND protoPayload.methodName=v1.compute.instances.start AND protoPayload.resourceName:instances/${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --limit=10 \
  --format='table(timestamp,protoPayload.authenticationInfo.principalEmail,protoPayload.status.code,protoPayload.methodName)'

echo "=== controller ensure-running logs ==="
gcloud logging read \
  'resource.type=cloud_run_revision AND resource.labels.service_name=moat-tax-llm-controller AND jsonPayload.feature="tax-llm"' \
  --project="${PROJECT_ID}" \
  --limit=20 \
  --format='table(timestamp,jsonPayload.message,jsonPayload.operation,jsonPayload.status)'

if gcloud compute instances describe "${INSTANCE}" --project="${PROJECT_ID}" --zone="${ZONE}" --format='get(status)' | grep -qx RUNNING; then
  echo "=== worker journal ==="
  gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='
    set -euo pipefail
    echo "--- systemd ---"
    systemctl is-active moat-tax-llm-worker.service moat-tax-llm-vllm.service || true
    echo "--- worker journal ---"
    journalctl -u moat-tax-llm-worker.service -n 80 --no-pager
  '
else
  echo "Instance is not RUNNING; skip journal"
fi
