#!/usr/bin/env bash
set -euo pipefail

# Runs a synthetic W-2 extraction against localhost vLLM on the GPU VM.
# Uses only the committed synthetic fixture identifiers.

PROJECT_ID="${GCP_PROJECT_ID:-moat-finance}"
INSTANCE="${TAX_LLM_INSTANCE_NAME:-moat-tax-llm-worker}"
ZONE="${TAX_LLM_ZONE:-$(gcloud compute instances list --project="${PROJECT_ID}" --filter="name=${INSTANCE}" --format='value(zone)' | head -n1)}"

if [[ -z "${ZONE}" ]]; then
  echo "Could not resolve TAX_LLM_ZONE" >&2
  exit 1
fi

gcloud compute ssh "${INSTANCE}" --tunnel-through-iap --zone="${ZONE}" --project="${PROJECT_ID}" --command='
set -euo pipefail
python3 - <<'"'"'PY'"'"'
import json, time, urllib.request

redacted = """Form W-2 Wage and Tax Statement 2025
a Employee'\''s social security number
<SSN_1>
b Employer identification number
<EIN_1>
c Employer'\''s name, address, and ZIP code
Northwind Paper Co
100 Mill Road
Springfield, IL 62701
e Employee'\''s name, address, and ZIP code
Alex Rivera
55 Oak Street
Springfield, IL 62702
1 Wages, tips, other compensation
81234.56
2 Federal income tax withheld
14200.00
"""

schema = {
  "type": "object",
  "additionalProperties": False,
  "properties": {
    "taxYear": {"type": ["integer", "null"]},
    "employerName": {"type": ["string", "null"]},
    "employerEin": {"type": ["string", "null"]},
    "employeeName": {"type": ["string", "null"]},
    "employeeSsn": {"type": ["string", "null"]},
    "wages": {"type": ["number", "null"]},
    "federalWithholding": {"type": ["number", "null"]},
  },
  "required": [
    "taxYear", "employerName", "employerEin", "employeeName",
    "employeeSsn", "wages", "federalWithholding",
  ],
}

payload = {
  "model": "qwen3-8b-tax",
  "temperature": 0.1,
  "max_tokens": 1024,
  "messages": [
    {"role": "system", "content": "Extract W-2 fields. Preserve <SSN_n> and <EIN_n> tokens exactly. Never guess."},
    {"role": "user", "content": "Extract a W-2 from this document text:\\n\\n" + redacted},
  ],
  "chat_template_kwargs": {"enable_thinking": False},
  "response_format": {
    "type": "json_schema",
    "json_schema": {"name": "w2_extraction", "strict": True, "schema": schema},
  },
}

started = time.time()
req = urllib.request.Request(
  "http://127.0.0.1:8000/v1/chat/completions",
  data=json.dumps(payload).encode(),
  headers={"content-type": "application/json"},
  method="POST",
)
with urllib.request.urlopen(req, timeout=180) as resp:
  body = json.loads(resp.read().decode())
elapsed_ms = int((time.time() - started) * 1000)
content = body["choices"][0]["message"]["content"]
parsed = json.loads(content)
print(json.dumps({
  "inferenceMs": elapsed_ms,
  "hasSsnToken": "<SSN_1>" in json.dumps(parsed),
  "hasEinToken": "<EIN_1>" in json.dumps(parsed),
  "leakedSyntheticSsn": "123-45-6789" in json.dumps(parsed) or "123456789" in json.dumps(parsed),
  "leakedSyntheticEin": "87-1234567" in json.dumps(parsed) or "871234567" in json.dumps(parsed),
  "employerName": parsed.get("employerName"),
  "wages": parsed.get("wages"),
  "federalWithholding": parsed.get("federalWithholding"),
}, indent=2))
if "123-45-6789" in content or "87-1234567" in content:
  raise SystemExit("FAIL: model output contained raw synthetic identifiers")
if "<SSN_1>" not in content or "<EIN_1>" not in content:
  raise SystemExit("FAIL: model did not preserve sentinel tokens")
print("PASS: synthetic extraction preserved tokens and did not return raw identifiers")
PY
'
