#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
INSTANCE="${TAX_LLM_INSTANCE_NAME:-moat-tax-llm-worker}"
ZONE="${TAX_LLM_ZONE:-$(gcloud compute instances list --project="${PROJECT_ID}" --filter="name=${INSTANCE}" --format='value(zone)' | head -n1)}"
MOAT_API_URL="${MOAT_API_URL:-https://api.moatfinance.ai}"
CONTROLLER_URL="${TAX_LLM_CONTROLLER_URL:-$(gcloud run services describe moat-tax-llm-controller --region=us-central1 --project="${PROJECT_ID}" --format='value(status.url)' 2>/dev/null || true)}"

if [[ -z "${ZONE}" ]]; then
  echo "Could not resolve TAX_LLM_ZONE" >&2
  exit 1
fi

cd "${ROOT}"
pnpm --filter @moat/tax-llm install
pnpm --filter @moat/tax-llm run build:worker

TMP="$(mktemp -d)"
cp "${ROOT}/infra/tax-llm/dist/worker.cjs" "${TMP}/worker.cjs"
cp "${ROOT}/infra/tax-llm/runtime-package.json" "${TMP}/package.json"
cp "${ROOT}/infra/tax-llm/versions.env" "${TMP}/versions.env"
cp "${ROOT}/infra/tax-llm/vm/start-vllm.sh" "${TMP}/start-vllm.sh"
cp "${ROOT}/infra/tax-llm/vm/vllm.service" "${TMP}/moat-tax-llm-vllm.service"
cp "${ROOT}/infra/tax-llm/vm/tax-llm-worker.service" "${TMP}/moat-tax-llm-worker.service"
cp "${ROOT}/infra/tax-llm/vm/bootstrap.sh" "${TMP}/bootstrap.sh"
chmod +x "${TMP}/start-vllm.sh" "${TMP}/bootstrap.sh"

# shellcheck disable=SC1091
source "${ROOT}/infra/tax-llm/versions.env"

cat > "${TMP}/runtime.env" <<EOF
GCP_PROJECT_ID=${PROJECT_ID}
GCP_REGION=us-central1
TAX_LLM_ZONE=${ZONE}
TAX_LLM_INSTANCE_NAME=${INSTANCE}
TAX_LLM_TOPIC=moat-tax-llm-extraction
TAX_LLM_SUBSCRIPTION=moat-tax-llm-extraction-worker
MOAT_API_URL=${MOAT_API_URL}
TAX_LLM_CONTROLLER_URL=${CONTROLLER_URL}
TAX_LLM_SECRET_NAME=tax-llm-encryption-key-v1
TAX_LLM_ENCRYPTION_KEY_VERSION=v1
VLLM_VERSION=${VLLM_VERSION:-}
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
EOF

gcloud compute scp --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" \
  "${TMP}/worker.cjs" "${TMP}/package.json" "${TMP}/versions.env" "${TMP}/runtime.env" "${TMP}/start-vllm.sh" \
  "${TMP}/moat-tax-llm-vllm.service" "${TMP}/moat-tax-llm-worker.service" "${TMP}/bootstrap.sh" \
  "${INSTANCE}:/tmp/"

gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='
  set -euo pipefail
  sudo mkdir -p /opt/moat/tax-llm /etc/systemd/system /var/log/moat
  sudo mv /tmp/worker.cjs /tmp/package.json /tmp/versions.env /tmp/runtime.env /tmp/start-vllm.sh /opt/moat/tax-llm/
  sudo mv /tmp/bootstrap.sh /opt/moat/tax-llm/bootstrap.sh
  sudo mv /tmp/moat-tax-llm-vllm.service /etc/systemd/system/moat-tax-llm-vllm.service
  sudo mv /tmp/moat-tax-llm-worker.service /etc/systemd/system/moat-tax-llm-worker.service
  sudo chmod +x /opt/moat/tax-llm/start-vllm.sh /opt/moat/tax-llm/bootstrap.sh
  sudo /opt/moat/tax-llm/bootstrap.sh
'

if gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='test -f /opt/moat/.reboot-required'; then
  echo "Rebooting ${INSTANCE} so NVIDIA drivers load"
  gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='sudo reboot' || true
  for _ in $(seq 1 36); do
    sleep 10
    if gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='true' >/dev/null 2>&1; then
      break
    fi
  done
  gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='sudo /opt/moat/tax-llm/bootstrap.sh'
fi

gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='
  set -euo pipefail
  sudo systemctl daemon-reload
  sudo systemctl enable moat-tax-llm-vllm.service moat-tax-llm-worker.service
  sudo systemctl restart moat-tax-llm-vllm.service moat-tax-llm-worker.service
'

rm -rf "${TMP}"
echo "Worker and vLLM installed on ${INSTANCE} (${ZONE})"
