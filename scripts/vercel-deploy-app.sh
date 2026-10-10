#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:?app directory required}"
ENVIRONMENT="${2:?environment required (production or preview)}"
VERCEL_PROJECT_ID="${3:?project id required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d "$APP_DIR" ]; then
	echo "App directory not found: $APP_DIR" >&2
	exit 1
fi

export VERCEL_ORG_ID="${VERCEL_ORG_ID:?VERCEL_ORG_ID required}"
export VERCEL_TOKEN="${VERCEL_TOKEN:?VERCEL_TOKEN required}"
export VERCEL_PROJECT_ID

# Sequential deploys in one CI job share the workspace. Clear prior project
# link/env files so vercel pull cannot keep another app's Preview vars.
rm -rf "$ROOT/.vercel" "$ROOT/$APP_DIR/.vercel"

echo "==> Vercel pull (${APP_DIR}, ${ENVIRONMENT})"
pnpm dlx vercel@latest pull --yes --environment="$ENVIRONMENT" --token="$VERCEL_TOKEN"

echo "==> Vercel build (${APP_DIR}, ${ENVIRONMENT})"
if [ "$ENVIRONMENT" = "production" ]; then
	pnpm dlx vercel@latest build --prod --token="$VERCEL_TOKEN"
else
	pnpm dlx vercel@latest build --token="$VERCEL_TOKEN"
fi

echo "==> Vercel deploy (${APP_DIR}, ${ENVIRONMENT})"
if [ "$ENVIRONMENT" = "production" ]; then
	pnpm dlx vercel@latest deploy --prebuilt --prod --token="$VERCEL_TOKEN"
else
	pnpm dlx vercel@latest deploy --prebuilt --token="$VERCEL_TOKEN"
fi
