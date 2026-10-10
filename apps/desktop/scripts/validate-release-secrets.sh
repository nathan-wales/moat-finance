#!/usr/bin/env bash
set -euo pipefail

platform="${1:-}"
docs_path="apps/desktop/RELEASE.md"

missing=()
warnings=()

function check_required() {
	local name="$1"
	local value="${2:-}"

	if [ -z "$value" ]; then
		missing+=("$name")
		echo "::error title=Missing secret::${name} is not configured"
	else
		echo "✓ ${name}"
	fi
}

function check_optional() {
	local name="$1"
	local value="${2:-}"

	if [ -z "$value" ]; then
		warnings+=("$name")
		echo "::warning title=Missing secret::${name} is not configured"
	else
		echo "✓ ${name}"
	fi
}

function print_failure() {
	echo ""
	echo "Desktop release is missing required GitHub Actions secrets."
	echo "Add them under Settings → Secrets and variables → Actions."
	echo ""
	echo "Required for ${platform}:"
	for secret in "${missing[@]}"; do
		echo "  - ${secret}"
	done
	echo ""
	echo "See ${docs_path} for setup instructions."
}

function check_plaid() {
	echo "Checking Plaid secrets (baked into the desktop binary at build time)..."
	check_required "PLAID_CLIENT_ID" "${PLAID_CLIENT_ID_RAW:-}"
	check_required "PLAID_SECRET" "${PLAID_SECRET_RAW:-}"
	check_optional "PLAID_ENV" "${PLAID_ENV_RAW:-}"
}

case "$platform" in
mac)
	echo "Checking macOS signing and notarization secrets..."
	check_required "CSC_LINK" "${CSC_LINK_RAW:-}"
	check_required "CSC_KEY_PASSWORD" "${CSC_KEY_PASSWORD_RAW:-}"
	check_required "APPLE_ID" "${APPLE_ID_RAW:-}"
	check_required "APPLE_APP_SPECIFIC_PASSWORD" "${APPLE_APP_SPECIFIC_PASSWORD_RAW:-}"
	check_required "APPLE_TEAM_ID" "${APPLE_TEAM_ID_RAW:-}"
	check_plaid
	;;
win)
	echo "Checking Windows code signing secrets..."
	check_required "WIN_CSC_LINK" "${WIN_CSC_LINK_RAW:-}"
	check_required "WIN_CSC_KEY_PASSWORD" "${WIN_CSC_KEY_PASSWORD_RAW:-}"
	check_plaid
	;;
linux)
	check_plaid
	;;
publish)
	echo "Checking download CDN secrets..."
	check_required "R2_ACCOUNT_ID" "${R2_ACCOUNT_ID_RAW:-}"
	check_required "R2_ACCESS_KEY_ID" "${R2_ACCESS_KEY_ID_RAW:-}"
	check_required "R2_SECRET_ACCESS_KEY" "${R2_SECRET_ACCESS_KEY_RAW:-}"
	check_required "R2_BUCKET" "${R2_BUCKET_RAW:-}"
	;;
*)
	echo "::error::Unknown platform '${platform}'. Expected mac, win, linux, or publish."
	exit 1
	;;
esac

if [ "${#warnings[@]}" -gt 0 ]; then
	echo ""
	echo "Optional secrets not configured:"
	for secret in "${warnings[@]}"; do
		echo "  - ${secret}"
	done
fi

if [ "${#missing[@]}" -gt 0 ]; then
	print_failure
	exit 1
fi

echo ""
echo "All required ${platform} release secrets are configured."
