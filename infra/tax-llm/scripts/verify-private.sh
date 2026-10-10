#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
INSTANCE="${TAX_LLM_INSTANCE_NAME:-moat-tax-llm-worker}"
ZONE="${TAX_LLM_ZONE:-$(gcloud compute instances list --project="${PROJECT_ID}" --filter="name=${INSTANCE}" --format='value(zone)' | head -n1)}"

if [[ -z "${ZONE}" ]]; then
  echo "Could not resolve TAX_LLM_ZONE" >&2
  exit 1
fi

echo "Verifying ${INSTANCE} in ${ZONE}"

NAT_IP="$(gcloud compute instances describe "${INSTANCE}" --zone="${ZONE}" --project="${PROJECT_ID}" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"
if [[ -n "${NAT_IP}" ]]; then
  echo "FAIL: instance has external IP ${NAT_IP}" >&2
  exit 1
fi
echo "PASS: no external IP"

gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='
  set -euo pipefail
  echo "=== vLLM bind ==="
  ss -ltnp | grep 8000 || true
  if ss -ltnp | grep 8000 | grep -q 127.0.0.1; then
    echo "PASS: vLLM on 127.0.0.1"
  else
    echo "WARN: vLLM not listening yet (machine may be stopped or still booting)"
  fi
  echo "=== public HTTP ==="
  if curl -sS --max-time 8 https://example.com >/tmp/moat-egress-test 2>/tmp/moat-egress-err; then
    echo "FAIL: arbitrary internet succeeded" >&2
    exit 1
  fi
  echo "PASS: arbitrary internet blocked"
  echo "=== Private Google Access ==="
  if curl -sS --max-time 8 -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email >/dev/null; then
    echo "PASS: metadata server reachable"
  else
    echo "FAIL: metadata server unreachable" >&2
    exit 1
  fi
'

echo "Unauthenticated controller probe:"
CONTROLLER_URL="$(gcloud run services describe moat-tax-llm-controller --region=us-central1 --project="${PROJECT_ID}" --format='value(status.url)' 2>/dev/null || true)"
if [[ -n "${CONTROLLER_URL}" ]]; then
  CODE="$(curl -sS -o /dev/null -w "%{http_code}" "${CONTROLLER_URL}/health" || true)"
  echo "health without auth HTTP ${CODE}"
fi
