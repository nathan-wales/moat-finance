#!/usr/bin/env bash
set -euo pipefail

# End-to-end idle shutdown:
# last job (or a clean idle start) → 120s idle → STOPPING → TERMINATED
# and the VM stays TERMINATED for at least 5 minutes.

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
INSTANCE="${TAX_LLM_INSTANCE_NAME:-moat-tax-llm-worker}"
SUBSCRIPTION="${TAX_LLM_SUBSCRIPTION:-moat-tax-llm-extraction-worker}"
ZONE="${TAX_LLM_ZONE:-$(gcloud compute instances list --project="${PROJECT_ID}" --filter="name=${INSTANCE}" --format='value(zone)' | head -n1)}"
HOLD_TERMINATED_SECONDS="${HOLD_TERMINATED_SECONDS:-300}"
IDLE_GRACE_SECONDS="${IDLE_GRACE_SECONDS:-180}"

if [[ -z "${ZONE}" ]]; then
  echo "Could not resolve TAX_LLM_ZONE" >&2
  exit 1
fi

instance_status() {
  gcloud compute instances describe "${INSTANCE}" \
    --project="${PROJECT_ID}" \
    --zone="${ZONE}" \
    --format='get(status)'
}

undelivered_count() {
  gcloud pubsub subscriptions describe "${SUBSCRIPTION}" \
    --project="${PROJECT_ID}" \
    --format='value(numUndeliveredMessages)'
}

wait_for_status() {
  local wanted="$1"
  local timeout_s="$2"
  local started
  started="$(date +%s)"
  while true; do
    local current
    current="$(instance_status)"
    echo "$(date -u +%H:%M:%S) status=${current}"
    if [[ "${current}" == "${wanted}" ]]; then
      return 0
    fi
    if (( "$(date +%s)" - started >= timeout_s )); then
      echo "Timed out waiting for ${wanted}; last status=${current}" >&2
      return 1
    fi
    sleep 5
  done
}

echo "Applying instance-scoped stop IAM"
"${ROOT}/infra/tax-llm/scripts/bind-worker-iam.sh"

STATUS="$(instance_status)"
echo "Initial status=${STATUS}"
if [[ "${STATUS}" == "TERMINATED" || "${STATUS}" == "STOPPED" ]]; then
  echo "Starting ${INSTANCE}"
  gcloud compute instances start "${INSTANCE}" --project="${PROJECT_ID}" --zone="${ZONE}"
  wait_for_status RUNNING 180
elif [[ "${STATUS}" == "STOPPING" ]]; then
  wait_for_status TERMINATED 180
  echo "Starting ${INSTANCE} after a previous stop"
  gcloud compute instances start "${INSTANCE}" --project="${PROJECT_ID}" --zone="${ZONE}"
  wait_for_status RUNNING 180
fi

echo "Waiting for SSH"
for _ in $(seq 1 36); do
  if gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='true' >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

BACKLOG="$(undelivered_count || echo 0)"
echo "Pub/Sub undelivered=${BACKLOG}"

gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='
  set -euo pipefail
  echo "--- systemd ---"
  systemctl is-active moat-tax-llm-worker.service moat-tax-llm-vllm.service
  echo "--- recent worker journal ---"
  journalctl -u moat-tax-llm-worker.service -n 40 --no-pager
'

wait_for_model_healthy() {
  gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='
    set -euo pipefail
    for _ in $(seq 1 180); do
      if journalctl -u moat-tax-llm-worker.service -n 40 --no-pager | grep -q "model healthy"; then
        echo "model healthy"
        exit 0
      fi
      sleep 5
    done
    echo "worker did not become healthy" >&2
    journalctl -u moat-tax-llm-worker.service -n 80 --no-pager
    exit 1
  '
}

if [[ "${BACKLOG}" != "0" && -n "${BACKLOG}" ]]; then
  echo "Waiting for queued jobs to finish"
  for _ in $(seq 1 120); do
    BACKLOG="$(undelivered_count || echo 0)"
    echo "$(date -u +%H:%M:%S) undelivered=${BACKLOG}"
    if [[ "${BACKLOG}" == "0" ]]; then
      break
    fi
    sleep 5
  done
  if [[ "${BACKLOG}" != "0" ]]; then
    echo "Queue did not drain; not forcing idle" >&2
    exit 1
  fi
  echo "Last job completed; idle window starts now"
else
  echo "No queued jobs; restarting worker to start a clean 120s idle window"
  gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='sudo systemctl restart moat-tax-llm-worker.service'
  echo "Waiting for model healthy before starting the idle clock"
  wait_for_model_healthy
fi

IDLE_STARTED="$(date +%s)"
echo "Watching for STOPPING after ~120s idle"
STOPPING_AT=""
TERMINATED_AT=""
while true; do
  STATUS="$(instance_status)"
  NOW="$(date +%s)"
  ELAPSED=$((NOW - IDLE_STARTED))
  echo "$(date -u +%H:%M:%S) +${ELAPSED}s status=${STATUS}"
  if [[ "${STATUS}" == "STOPPING" && -z "${STOPPING_AT}" ]]; then
    STOPPING_AT="${ELAPSED}"
    echo "PASS: entered STOPPING at ${STOPPING_AT}s"
  fi
  if [[ "${STATUS}" == "TERMINATED" ]]; then
    TERMINATED_AT="${ELAPSED}"
    echo "PASS: entered TERMINATED at ${TERMINATED_AT}s"
    break
  fi
  if (( ELAPSED > IDLE_GRACE_SECONDS + 180 )); then
    echo "FAIL: VM did not stop after ${ELAPSED}s" >&2
    gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='journalctl -u moat-tax-llm-worker.service -n 80 --no-pager' || true
    exit 1
  fi
  sleep 5
done

if [[ -z "${STOPPING_AT}" ]]; then
  echo "WARN: missed STOPPING sample; saw TERMINATED at ${TERMINATED_AT}s"
fi

echo "Holding TERMINATED for ${HOLD_TERMINATED_SECONDS}s"
HOLD_STARTED="$(date +%s)"
while (( "$(date +%s)" - HOLD_STARTED < HOLD_TERMINATED_SECONDS )); do
  STATUS="$(instance_status)"
  echo "$(date -u +%H:%M:%S) hold status=${STATUS}"
  if [[ "${STATUS}" != "TERMINATED" ]]; then
    echo "FAIL: VM left TERMINATED (${STATUS}); watchdog or controller restarted it" >&2
    exit 1
  fi
  sleep 15
done

echo "=== stop audit after test ==="
gcloud logging read \
  "resource.type=gce_instance AND protoPayload.methodName=v1.compute.instances.stop AND protoPayload.resourceName:instances/${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --limit=5 \
  --format='table(timestamp,protoPayload.authenticationInfo.principalEmail,protoPayload.status.code)'

echo "PASS: idle shutdown stopped ${INSTANCE} and it stayed TERMINATED for ${HOLD_TERMINATED_SECONDS}s"
