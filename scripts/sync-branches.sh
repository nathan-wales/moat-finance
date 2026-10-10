#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=release-helpers.sh
source "$ROOT/scripts/release-helpers.sh"

MAIN_BRANCH="main"
STAGING_BRANCH="staging"

restore_original_branch() {
	local current
	current="$(git branch --show-current)"
	if [ "$current" != "$ORIGINAL_BRANCH" ]; then
		echo "==> Switching back to ${ORIGINAL_BRANCH}"
		git switch "$ORIGINAL_BRANCH"
	fi
}

require_git_repo
require_clean_worktree

ORIGINAL_BRANCH="$(git branch --show-current)"

echo "==> Fetching origin"
git fetch origin

if ! git rev-parse --verify "origin/${MAIN_BRANCH}" >/dev/null 2>&1; then
	echo "Error: origin/${MAIN_BRANCH} does not exist"
	exit 1
fi

if ! git rev-parse --verify "origin/${STAGING_BRANCH}" >/dev/null 2>&1; then
	echo "Error: origin/${STAGING_BRANCH} does not exist"
	exit 1
fi

MAIN_SHA="$(git rev-parse "origin/${MAIN_BRANCH}")"
STAGING_SHA="$(git rev-parse "origin/${STAGING_BRANCH}")"
MAIN_SHORT="$(git rev-parse --short "origin/${MAIN_BRANCH}")"
STAGING_SHORT="$(git rev-parse --short "origin/${STAGING_BRANCH}")"

echo "    origin/${MAIN_BRANCH}: ${MAIN_SHORT}"
echo "    origin/${STAGING_BRANCH}: ${STAGING_SHORT}"

if [ "$MAIN_SHA" = "$STAGING_SHA" ]; then
	echo "==> Already in sync"
	echo "    staging already points at ${MAIN_BRANCH}@${MAIN_SHORT}"
	exit 0
fi

echo "==> Switching to ${STAGING_BRANCH}"
git switch "$STAGING_BRANCH"

if [ "$(git branch --show-current)" != "$STAGING_BRANCH" ]; then
	echo "Error: expected to be on ${STAGING_BRANCH} after switching, but on $(git branch --show-current)"
	exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
	echo "Error: working tree is not clean after switching to ${STAGING_BRANCH}"
	git status --short
	exit 1
fi

echo "==> Resetting ${STAGING_BRANCH} to origin/${MAIN_BRANCH} (${MAIN_SHORT})"
echo "    staging is a pointer; unique staging commits are discarded"
git reset --hard "origin/${MAIN_BRANCH}"

if ! git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
	echo "Error: ${STAGING_BRANCH} has no upstream; set one with: git push -u origin ${STAGING_BRANCH}"
	restore_original_branch
	exit 1
fi

echo "==> Force-pushing ${STAGING_BRANCH} to origin (force-with-lease)"
git push --force-with-lease origin "$STAGING_BRANCH"

SYNCED_SHORT="$(git rev-parse --short HEAD)"
echo "==> Synced ${MAIN_BRANCH}@${MAIN_SHORT} → ${STAGING_BRANCH}@${SYNCED_SHORT}"
echo "    deploy-staging.yml will run unit, integration, and Playwright goldens"
echo "    Staging deploys only if that pipeline passes"

restore_original_branch
