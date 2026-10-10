#!/usr/bin/env bash
set -euo pipefail

IOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_BUDDY="/usr/libexec/PlistBuddy"
ARCHIVE_PATH="${1:-$RUNNER_TEMP/Moat.xcarchive}"
EXPORT_PATH="${2:-$RUNNER_TEMP/export}"
EXPORT_OPTIONS_PLIST="$RUNNER_TEMP/ExportOptions.plist"

export APP_STORE_CONNECT_KEY_ID="${APP_STORE_CONNECT_KEY_ID:?APP_STORE_CONNECT_KEY_ID required}"
export APP_STORE_CONNECT_ISSUER_ID="${APP_STORE_CONNECT_ISSUER_ID:?APP_STORE_CONNECT_ISSUER_ID required}"
export APP_STORE_CONNECT_PRIVATE_KEY="${APP_STORE_CONNECT_PRIVATE_KEY:?APP_STORE_CONNECT_PRIVATE_KEY required}"

AUTH_KEY_PATH="${RUNNER_TEMP:-/tmp}/AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8"
printf '%s\n' "$APP_STORE_CONNECT_PRIVATE_KEY" > "$AUTH_KEY_PATH"
chmod 600 "$AUTH_KEY_PATH"

AUTH_ARGS=(
	-authenticationKeyPath "$AUTH_KEY_PATH"
	-authenticationKeyID "$APP_STORE_CONNECT_KEY_ID"
	-authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID"
)

cat > "$EXPORT_OPTIONS_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>${APPLE_TEAM_ID:?APPLE_TEAM_ID required}</string>
	<key>uploadSymbols</key>
	<true/>
	<key>destination</key>
	<string>export</string>
	<key>signingStyle</key>
	<string>manual</string>
	<key>provisioningProfiles</key>
	<dict>
		<key>com.moatfinance.app</key>
		<string>Moat Finance App Store</string>
	</dict>
</dict>
</plist>
EOF

cd "$IOS_DIR"

function require_ios_sdk_26_or_later() {
	local sdk_name="$1"
	local sdk_major="${sdk_name#iphoneos}"
	sdk_major="${sdk_major%%.*}"

	echo "DTSDKName: ${sdk_name}"
	if [ -z "$sdk_major" ] || [ "$sdk_major" -lt 26 ]; then
		echo "Built with ${sdk_name}; App Store Connect requires the iOS 26 SDK or later"
		exit 1
	fi
}

echo "==> Archiving Moat (Release)"
xcodebuild \
	-scheme Moat \
	-configuration Release \
	-destination "generic/platform=iOS" \
	-archivePath "$ARCHIVE_PATH" \
	archive

APP_INFO_PLIST="$(find "$ARCHIVE_PATH/Products/Applications" -maxdepth 2 -name Info.plist | head -n 1)"
if [ -z "$APP_INFO_PLIST" ]; then
	echo "No Info.plist found in archive at ${ARCHIVE_PATH}"
	exit 1
fi
require_ios_sdk_26_or_later "$("$PLIST_BUDDY" -c 'Print :DTSDKName' "$APP_INFO_PLIST")"

echo "==> Exporting App Store IPA"
xcodebuild \
	-exportArchive \
	-archivePath "$ARCHIVE_PATH" \
	-exportPath "$EXPORT_PATH" \
	-exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
	-allowProvisioningUpdates \
	"${AUTH_ARGS[@]}"

IPA_PATH="$(find "$EXPORT_PATH" -maxdepth 1 -name '*.ipa' | head -n 1)"
if [ -z "$IPA_PATH" ]; then
	echo "No IPA found in ${EXPORT_PATH}"
	exit 1
fi

IPA_INFO_PLIST="$(mktemp)"
unzip -p "$IPA_PATH" Payload/*.app/Info.plist > "$IPA_INFO_PLIST"
require_ios_sdk_26_or_later "$("$PLIST_BUDDY" -c 'Print :DTSDKName' "$IPA_INFO_PLIST")"
rm -f "$IPA_INFO_PLIST"

echo "Built IPA: ${IPA_PATH}"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
	echo "IPA_PATH=$IPA_PATH" >> "$GITHUB_OUTPUT"
fi
