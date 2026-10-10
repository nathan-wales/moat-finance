#!/usr/bin/env bash
set -euo pipefail

# Idempotent VM bootstrap. Internet is required only while the feature-specific
# bootstrap NAT exists. After models and packages are cached locally, NAT is removed.

MODEL_DIR="${MODEL_DIR:-/opt/moat/models/qwen3-8b}"
VENV_DIR="${VENV_DIR:-/opt/moat/venvs/vllm}"
APP_DIR="${APP_DIR:-/opt/moat/tax-llm}"
VERSIONS_FILE="${VERSIONS_FILE:-${APP_DIR}/versions.env}"

if [[ -f "${VERSIONS_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${VERSIONS_FILE}"
fi

TAX_LLM_MODEL="${TAX_LLM_MODEL:-Qwen/Qwen3-8B}"
TAX_LLM_MODEL_REVISION="${TAX_LLM_MODEL_REVISION:-b968826d9c46dd6066d109eabc6255188de91218}"
VLLM_VERSION="${VLLM_VERSION:-0.10.2}"

id moat-tax-llm >/dev/null 2>&1 || useradd --system --home /opt/moat --shell /usr/sbin/nologin moat-tax-llm
mkdir -p /opt/moat/models /opt/moat/venvs "${APP_DIR}" /var/log/moat
chown -R moat-tax-llm:moat-tax-llm /opt/moat

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  python3 python3-venv python3-pip python3-dev \
  git git-lfs curl ca-certificates build-essential \
  linux-headers-$(uname -r) \
  gcc g++

if ! command -v nvidia-smi >/dev/null 2>&1; then
  curl -fsSL https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb -o /tmp/cuda-keyring.deb
  dpkg -i /tmp/cuda-keyring.deb
  apt-get update
  apt-get install -y --no-install-recommends nvidia-driver-550
  touch /opt/moat/.reboot-required
  echo "NVIDIA driver installed; reboot required before nvidia-smi"
  exit 0
fi
rm -f /opt/moat/.reboot-required

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y --no-install-recommends nodejs
fi

if [[ ! -x "${VENV_DIR}/bin/vllm" ]]; then
  python3 -m venv "${VENV_DIR}"
  "${VENV_DIR}/bin/pip" install --upgrade pip
  "${VENV_DIR}/bin/pip" install "vllm==${VLLM_VERSION}" "transformers==${TRANSFORMERS_VERSION:-4.57.1}"
fi

if [[ -f "${APP_DIR}/package.json" && ! -d "${APP_DIR}/node_modules/@google-cloud/pubsub" ]]; then
  (cd "${APP_DIR}" && npm install --omit=dev)
fi

if [[ ! -f "${MODEL_DIR}/config.json" ]]; then
  "${VENV_DIR}/bin/pip" install -q "huggingface_hub[cli]"
  if "${VENV_DIR}/bin/hf" download --help >/dev/null 2>&1; then
    "${VENV_DIR}/bin/hf" download "${TAX_LLM_MODEL}" \
      --revision "${TAX_LLM_MODEL_REVISION}" \
      --local-dir "${MODEL_DIR}"
  else
    "${VENV_DIR}/bin/huggingface-cli" download "${TAX_LLM_MODEL}" \
      --revision "${TAX_LLM_MODEL_REVISION}" \
      --local-dir "${MODEL_DIR}"
  fi
fi

"${VENV_DIR}/bin/pip" install -q "transformers==${TRANSFORMERS_VERSION:-4.57.1}"

mkdir -p /etc/environment.d
printf 'HF_HUB_OFFLINE=1\nTRANSFORMERS_OFFLINE=1\n' > /etc/environment.d/moat-tax-llm.conf
install -m 0644 -o root -g root /dev/null /etc/sysctl.d/99-moat-tax-llm.conf

systemctl daemon-reload
systemctl enable moat-tax-llm-vllm.service moat-tax-llm-worker.service || true

chown -R moat-tax-llm:moat-tax-llm /opt/moat
echo "bootstrap complete"
