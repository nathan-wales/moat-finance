#!/bin/sh
set -eu
python - <<'PY'
from app.main import health
payload = health()
assert payload["status"] == "ok"
assert payload["parser"] == "docling"
print("ok")
PY
