#!/usr/bin/env bash
set -euo pipefail

: "${BUILD_CERTIFICATE_BASE64:?}"
: "${P12_PASSWORD:?}"
: "${PROVISIONING_PROFILE_BASE64:?}"
: "${KEYCHAIN_PASSWORD:?}"

CERT_PATH="$RUNNER_TEMP/build_certificate.p12"
PROFILE_PATH="$RUNNER_TEMP/build_pp.mobileprovision"
KEYCHAIN_PATH="$RUNNER_TEMP/app-signing.keychain-db"

echo "$BUILD_CERTIFICATE_BASE64" | base64 --decode > "$CERT_PATH"
echo "$PROVISIONING_PROFILE_BASE64" | base64 --decode > "$PROFILE_PATH"

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

security import "$CERT_PATH" -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security list-keychain -d user -s "$KEYCHAIN_PATH"

PROFILES_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$PROFILES_DIR"
UUID="$(/usr/libexec/PlistBuddy -c 'Print UUID' /dev/stdin <<< "$(security cms -D -i "$PROFILE_PATH")")"
cp "$PROFILE_PATH" "$PROFILES_DIR/$UUID.mobileprovision"

echo "Installed signing certificate and profile ($UUID)"
