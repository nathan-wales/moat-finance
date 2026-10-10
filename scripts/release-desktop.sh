#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=release-helpers.sh
source "$ROOT/scripts/release-helpers.sh"

PKG_JSON="apps/desktop/package.json"
TAG_PREFIX="desktop-v"

require_git_repo
require_clean_worktree

echo "==> Fetching origin"
git fetch origin --tags

load_last_green_staging
GREEN_SHORT="$(git rev-parse --short "$GREEN_SHA")"

echo "==> Last green staging: ${GREEN_SHORT} (${GREEN_SHA})"
echo "    ${GREEN_URL}"
print_main_vs_green_warning

prepare_release_tag "$PKG_JSON" "$TAG_PREFIX" "release: desktop"
create_and_push_tag "$RELEASE_TAG" "$RELEASE_SHA"

echo "==> Desktop release v${RELEASE_VERSION} complete"
echo "    Tag: ${RELEASE_TAG}"
echo "    SHA: ${RELEASE_SHA}"
echo "    GitHub Actions will build and publish when the tag is processed."
