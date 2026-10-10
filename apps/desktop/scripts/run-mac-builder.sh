#!/usr/bin/env bash
set -euo pipefail

# electron-builder 26.x creates a temp keychain with a random password, then
# calls `security set-key-partition-list -k` with the .p12 import password
# instead. macOS 26 rejects that and signing dies with SecKeychainUnlock.
# https://github.com/electron-userland/electron-builder/issues/10066
#
# Import the identity ourselves, then let electron-builder discover it.

if [ "$#" -eq 0 ]; then
	echo "usage: run-mac-builder.sh <command> [args...]" >&2
	exit 1
fi

if [ -z "${CSC_LINK:-}" ]; then
	exec "$@"
fi

cert_path="$CSC_LINK"
if [ ! -f "$cert_path" ]; then
	echo "CSC_LINK is not a readable .p12 file: ${cert_path}" >&2
	exit 1
fi

p12_password="${CSC_KEY_PASSWORD:-}"
p12_password="${p12_password%"${p12_password##*[![:space:]]}"}"

keychain_password="$(openssl rand -base64 32)"
keychain_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
keychain_path="${keychain_dir%/}/moat-desktop-signing.keychain-db"

function cleanup() {
	if [ -f "$keychain_path" ]; then
		security delete-keychain "$keychain_path" >/dev/null 2>&1 || true
	fi
}
trap cleanup EXIT

rm -f "$keychain_path"
security create-keychain -p "$keychain_password" "$keychain_path"
security set-keychain-settings -lut 21600 "$keychain_path"
security unlock-keychain -p "$keychain_password" "$keychain_path"
security import "$cert_path" \
	-P "$p12_password" \
	-A \
	-t cert \
	-f pkcs12 \
	-k "$keychain_path"
security set-key-partition-list -S apple-tool:,apple: -s -k "$keychain_password" "$keychain_path"

keychains=("$keychain_path")
while IFS= read -r line; do
	line="${line#"${line%%[![:space:]]*}"}"
	line="${line%"${line##*[![:space:]]}"}"
	line="${line#\"}"
	line="${line%\"}"
	if [ -n "$line" ] && [ "$line" != "$keychain_path" ]; then
		keychains+=("$line")
	fi
done < <(security list-keychains -d user)
security list-keychains -d user -s "${keychains[@]}"

if ! security find-identity -v -p codesigning "$keychain_path" | grep -q "Developer ID Application"; then
	echo "No Developer ID Application identity found after importing CSC_LINK" >&2
	security find-identity -v -p codesigning "$keychain_path" >&2 || true
	exit 1
fi

echo "Imported Developer ID identity; electron-builder will sign via keychain discovery"
unset CSC_LINK CSC_KEY_PASSWORD
export CSC_IDENTITY_AUTO_DISCOVERY=true

"$@"
