#!/usr/bin/env bash
set -euo pipefail

docs_path="apps/ios/RELEASE.md"
missing=()

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

echo "Checking iOS TestFlight release secrets..."
check_required "APPLE_TEAM_ID" "${APPLE_TEAM_ID_RAW:-}"
check_required "APP_STORE_CONNECT_KEY_ID" "${APP_STORE_CONNECT_KEY_ID_RAW:-}"
check_required "APP_STORE_CONNECT_ISSUER_ID" "${APP_STORE_CONNECT_ISSUER_ID_RAW:-}"
check_required "APP_STORE_CONNECT_PRIVATE_KEY" "${APP_STORE_CONNECT_PRIVATE_KEY_RAW:-}"
check_required "BUILD_CERTIFICATE_BASE64" "${BUILD_CERTIFICATE_BASE64_RAW:-}"
check_required "P12_PASSWORD" "${P12_PASSWORD_RAW:-}"
check_required "PROVISIONING_PROFILE_BASE64" "${PROVISIONING_PROFILE_BASE64_RAW:-}"
check_required "KEYCHAIN_PASSWORD" "${KEYCHAIN_PASSWORD_RAW:-}"

if [ "${#missing[@]}" -gt 0 ]; then
	echo ""
	echo "iOS release is missing required GitHub Actions secrets."
	echo "Add them under Settings → Secrets and variables → Actions."
	echo ""
	for secret in "${missing[@]}"; do
		echo "  - ${secret}"
	done
	echo ""
	echo "See ${docs_path} for setup instructions."
	exit 1
fi

echo ""
echo "All required iOS release secrets are configured."
