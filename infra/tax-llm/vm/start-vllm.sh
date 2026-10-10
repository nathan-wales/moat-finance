#!/usr/bin/env bash
set -euo pipefail
exec /opt/moat/venvs/vllm/bin/vllm serve /opt/moat/models/qwen3-8b \
  --served-model-name qwen3-8b-tax \
  --host 127.0.0.1 \
  --port 8000 \
  --dtype bfloat16 \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.90 \
  --default-chat-template-kwargs '{"enable_thinking":false}' \
  --no-enable-log-requests \
  --disable-uvicorn-access-log
