#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=release-helpers.sh
source "$ROOT/scripts/release-helpers.sh"

CLOUD_PKG_JSON="package.json"
DESKTOP_PKG_JSON="apps/desktop/package.json"
CLOUD_TAG_PREFIX="cloud-v"
DESKTOP_TAG_PREFIX="desktop-v"
CONFIRM_PHRASE="PUSH TO PRODUCTION"

require_git_repo
require_clean_worktree

echo "==> Fetching origin"
git fetch origin --tags

echo "==> Emergency production release"
echo "    This ships origin/main to production cloud AND desktop."
echo "    It does NOT wait for staging CI."
print_main_vs_green_warning
echo
echo "    Type ${CONFIRM_PHRASE} to continue:"

if [ -t 0 ]; then
	read -r phrase
else
	read -r phrase < /dev/tty
fi

if [ "$phrase" != "$CONFIRM_PHRASE" ]; then
	echo "Aborted."
	exit 1
fi

echo "==> Switching to main"
git switch main

if [ "$(git branch --show-current)" != "main" ]; then
	echo "Error: expected to be on main after switching, but on $(git branch --show-current)"
	exit 1
fi

require_clean_worktree

echo "==> Pulling latest main"
git pull --ff-only origin main

CLOUD_CURRENT="$(node -p "require('./${CLOUD_PKG_JSON}').version")"
DESKTOP_CURRENT="$(node -p "require('./${DESKTOP_PKG_JSON}').version")"
CLOUD_VERSION="$(increment_patch_version "$CLOUD_CURRENT")"
DESKTOP_VERSION="$(increment_patch_version "$DESKTOP_CURRENT")"
CLOUD_TAG="${CLOUD_TAG_PREFIX}${CLOUD_VERSION}"
DESKTOP_TAG="${DESKTOP_TAG_PREFIX}${DESKTOP_VERSION}"

echo "    Cloud:   ${CLOUD_CURRENT} → ${CLOUD_VERSION} (${CLOUD_TAG})"
echo "    Desktop: ${DESKTOP_CURRENT} → ${DESKTOP_VERSION} (${DESKTOP_TAG})"

assert_tag_available "$CLOUD_TAG"
assert_tag_available "$DESKTOP_TAG"

update_package_json_version "$CLOUD_PKG_JSON" "$CLOUD_VERSION"
update_package_json_version "$DESKTOP_PKG_JSON" "$DESKTOP_VERSION"

echo "==> Committing version bumps"
git add "$CLOUD_PKG_JSON" "$DESKTOP_PKG_JSON"
git commit -m "release: emergency cloud v${CLOUD_VERSION} desktop v${DESKTOP_VERSION}"

echo "==> Creating tags"
git tag "$CLOUD_TAG"
git tag "$DESKTOP_TAG"

if ! git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
	echo "Error: current branch has no upstream; set one with: git push -u origin main"
	exit 1
fi

UPSTREAM="$(git rev-parse --abbrev-ref @{u})"
echo "==> Pushing commit to ${UPSTREAM}"
git push

echo "==> Pushing tags to origin"
git push origin "$CLOUD_TAG" "$DESKTOP_TAG"

echo "==> Emergency release complete"
echo "    ${CLOUD_TAG}  →  production cloud (api, mcp, web, marketing)"
echo "    ${DESKTOP_TAG}  →  signed desktop builds"
echo "    Staging was not updated. Run pnpm sync:branches when you want CI to catch up."
