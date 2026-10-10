#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-moat-docling-tax-parser}"
BUCKET="${TAX_R2_BUCKET:-tax-documents}"

SERVICE_URL="$(gcloud run services describe "${SERVICE}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)')"
echo "Service URL: ${SERVICE_URL}"

echo "1. Unauthenticated request (expect 403)"
UNAUTH_STATUS="$(curl -sS -o /tmp/moat-docling-unauth.json -w '%{http_code}' "${SERVICE_URL}/health" || true)"
echo "   status=${UNAUTH_STATUS}"
if [ "${UNAUTH_STATUS}" != "403" ] && [ "${UNAUTH_STATUS}" != "401" ]; then
  echo "FAIL: unauthenticated request was not denied"
  cat /tmp/moat-docling-unauth.json || true
  exit 1
fi

echo "2. Confirm allUsers is not an invoker"
if gcloud run services get-iam-policy "${SERVICE}" --region="${REGION}" --project="${PROJECT_ID}" --format='json' | grep -q allUsers; then
  echo "FAIL: allUsers appears on the Cloud Run IAM policy"
  exit 1
fi

echo "3. Authenticated health check"
gcloud run services proxy "${SERVICE}" --region="${REGION}" --port=8088 >/tmp/moat-docling-proxy.log 2>&1 &
PROXY_PID=$!
cleanup() { kill "${PROXY_PID}" >/dev/null 2>&1 || true; }
trap cleanup EXIT
sleep 3
AUTH_STATUS="$(curl -sS -o /tmp/moat-docling-health.json -w '%{http_code}' http://127.0.0.1:8088/health || true)"
echo "   proxy health status=${AUTH_STATUS}"
if [ "${AUTH_STATUS}" != "200" ]; then
  echo "WARN: authenticated proxy health did not return 200 (status=${AUTH_STATUS})"
  cat /tmp/moat-docling-health.json || true
  cat /tmp/moat-docling-proxy.log || true
else
  python3 - <<'PY'
import json
payload = json.load(open("/tmp/moat-docling-health.json"))
assert payload.get("status") == "ok"
assert payload.get("parser") == "docling"
assert "version" in payload
print("   health payload ok")
PY
fi

echo "4. R2 bucket ${BUCKET} should not have a public r2.dev URL"
npx wrangler r2 bucket info "${BUCKET}"

echo "Private verification complete: unauthenticated parser access is denied."
