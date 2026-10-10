#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PBXPROJ="apps/ios/Moat.xcodeproj/project.pbxproj"
TAG_PREFIX="ios-v"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "Error: not inside a git repository"
	exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
	echo "Error: working tree is not clean"
	echo "Commit or stash local changes before releasing:"
	git status --short
	exit 1
fi

echo "==> Switching to main"
git switch main

if [ "$(git branch --show-current)" != "main" ]; then
	echo "Error: expected to be on main after switching, but on $(git branch --show-current)"
	exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
	echo "Error: working tree is not clean after switching to main"
	echo "Commit or stash local changes before releasing:"
	git status --short
	exit 1
fi

echo "==> Reading current version from ${PBXPROJ}"
CURRENT_VERSION="$(grep -m1 'MARKETING_VERSION' "$PBXPROJ" | sed -E 's/.*MARKETING_VERSION = ([^;]+);/\1/')"
CURRENT_BUILD="$(grep -m1 'CURRENT_PROJECT_VERSION' "$PBXPROJ" | sed -E 's/.*CURRENT_PROJECT_VERSION = ([^;]+);/\1/')"
echo "    Current version: ${CURRENT_VERSION} (${CURRENT_BUILD})"

echo "==> Incrementing patch version and build number"
NEW_VERSION="$(node -e "
	const parts = process.argv[1].split('.').map(Number);
	if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
		console.error('Invalid semver (expected major.minor.patch):', process.argv[1]);
		process.exit(1);
	}
	parts[2] += 1;
	console.log(parts.join('.'));
" "$CURRENT_VERSION")"
NEW_BUILD="$((CURRENT_BUILD + 1))"
echo "    New version: ${NEW_VERSION} (${NEW_BUILD})"

TAG="${TAG_PREFIX}${NEW_VERSION}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
	echo "Error: tag ${TAG} already exists locally"
	exit 1
fi

echo "==> Updating ${PBXPROJ}"
node -e "
	const fs = require('node:fs');
	const path = process.argv[1];
	const newVersion = process.argv[2];
	const newBuild = process.argv[3];
	let content = fs.readFileSync(path, 'utf8');
	content = content.replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = ' + newVersion + ';');
	content = content.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, 'CURRENT_PROJECT_VERSION = ' + newBuild + ';');
	fs.writeFileSync(path, content);
" "$PBXPROJ" "$NEW_VERSION" "$NEW_BUILD"

echo "==> Committing version bump"
git add "$PBXPROJ"
git commit -m "release: ios v${NEW_VERSION}"

echo "==> Creating tag ${TAG}"
git tag "$TAG"

if ! git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
	echo "Error: current branch has no upstream; set one with: git push -u origin <branch>"
	exit 1
fi

UPSTREAM="$(git rev-parse --abbrev-ref @{u})"
echo "==> Pushing commit to ${UPSTREAM}"
git push

echo "==> Pushing tag ${TAG} to origin"
git push origin "$TAG"

echo "==> iOS release v${NEW_VERSION} complete"
echo "    Tag: ${TAG}"
echo "    GitHub Actions will build and upload to TestFlight when the tag is processed."
echo "    After Apple finishes processing, submit the build for App Store review in App Store Connect."
