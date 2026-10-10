#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WEB_ENV="$ROOT/apps/web/.env"
SECRETS_XCCONFIG="$ROOT/apps/ios/Moat/Config/Secrets.xcconfig"

if [[ ! -f "$WEB_ENV" ]]; then
	echo "Missing $WEB_ENV — create it from apps/web/.env.example first." >&2
	exit 1
fi

LOGO_KEY="$(grep -E '^NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY=' "$WEB_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"

if [[ -z "$LOGO_KEY" ]]; then
	echo "NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY is empty in $WEB_ENV." >&2
	exit 1
fi

mkdir -p "$(dirname "$SECRETS_XCCONFIG")"

touch "$SECRETS_XCCONFIG"

if grep -q '^LOGO_DEV_PUBLISHABLE_KEY' "$SECRETS_XCCONFIG"; then
	sed -i '' "s|^LOGO_DEV_PUBLISHABLE_KEY =.*|LOGO_DEV_PUBLISHABLE_KEY = $LOGO_KEY|" "$SECRETS_XCCONFIG"
else
	cat >> "$SECRETS_XCCONFIG" <<EOF

// Synced from apps/web/.env via scripts/sync-secrets-from-web-env.sh
LOGO_DEV_PUBLISHABLE_KEY = $LOGO_KEY
EOF
fi

echo "Updated LOGO_DEV_PUBLISHABLE_KEY in $SECRETS_XCCONFIG"
echo "Rebuild the iOS app in Xcode for logos to load."
