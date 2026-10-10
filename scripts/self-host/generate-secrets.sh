#!/usr/bin/env bash
# Fill in the required self-hosting secrets in .env (repo root) when they are
# missing or empty. Existing non-empty values are never overwritten.
#
#   ./scripts/self-host/generate-secrets.sh            # update ./.env
#   ./scripts/self-host/generate-secrets.sh path/.env  # update another file
#   ./scripts/self-host/generate-secrets.sh --print    # only print fresh values
#
# Formats:
#   AUTH_SECRET       base64, 32 random bytes
#   ENCRYPTION_KEY    64 hex chars (32 bytes) — required by apps/api/src/server/lib/encryption.ts
#   CRON_SECRET       64 hex chars
#   MCP_TOKEN_PEPPER  64 hex chars (API requires >= 32 chars)
#   POSTGRES_PASSWORD 48 hex chars (URL-safe, used inside DATABASE_URL)
set -euo pipefail

hex() { openssl rand -hex "$1"; }
b64() { openssl rand -base64 "$1" | tr -d '\n'; }

if ! command -v openssl >/dev/null 2>&1; then
	echo "openssl is required" >&2
	exit 1
fi

generate() {
	case "$1" in
		AUTH_SECRET) b64 32 ;;
		ENCRYPTION_KEY | CRON_SECRET | MCP_TOKEN_PEPPER) hex 32 ;;
		POSTGRES_PASSWORD) hex 24 ;;
	esac
}

KEYS=(POSTGRES_PASSWORD AUTH_SECRET ENCRYPTION_KEY CRON_SECRET MCP_TOKEN_PEPPER)

if [[ "${1:-}" == "--print" ]]; then
	for key in "${KEYS[@]}"; do
		echo "${key}=$(generate "$key")"
	done
	exit 0
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${1:-$repo_root/.env}"

if [[ ! -f "$env_file" ]]; then
	if [[ -f "$repo_root/.env.self-host.example" ]]; then
		cp "$repo_root/.env.self-host.example" "$env_file"
		echo "Created $env_file from .env.self-host.example"
	else
		touch "$env_file"
	fi
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

for key in "${KEYS[@]}"; do
	# Current value: last uncommented assignment, quotes stripped.
	current="$(grep -E "^${key}=" "$env_file" | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true)"
	if [[ -n "$current" ]]; then
		echo "  kept      $key"
		continue
	fi
	value="$(generate "$key")"
	if grep -qE "^${key}=" "$env_file"; then
		# Replace the empty assignment in place (value has no '|' characters).
		awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k && !done {print k "=" v; done=1; next} {print}' "$env_file" >"$tmp"
		cat "$tmp" >"$env_file"
	else
		printf '%s=%s\n' "$key" "$value" >>"$env_file"
	fi
	echo "  generated $key"
done

chmod 600 "$env_file" 2>/dev/null || true
echo "Secrets are in $env_file. Back up ENCRYPTION_KEY: data encrypted with it cannot be recovered without it."
