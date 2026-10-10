#!/usr/bin/env bash

require_git_repo() {
	if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		echo "Error: not inside a git repository"
		exit 1
	fi
}

require_clean_worktree() {
	if [ -n "$(git status --porcelain)" ]; then
		echo "Error: working tree is not clean"
		echo "Commit or stash local changes first:"
		git status --short
		exit 1
	fi
}

require_gh() {
	if ! command -v gh >/dev/null 2>&1; then
		echo "Error: GitHub CLI (gh) is not installed"
		echo "Install from https://cli.github.com/ and run: gh auth login"
		exit 1
	fi

	if ! gh auth status >/dev/null 2>&1; then
		echo "Error: GitHub CLI is not authenticated"
		echo "Run: gh auth login"
		exit 1
	fi
}

increment_patch_version() {
	node -e "
		const parts = process.argv[1].split('.').map(Number);
		if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
			console.error('Invalid semver (expected major.minor.patch):', process.argv[1]);
			process.exit(1);
		}
		parts[2] += 1;
		console.log(parts.join('.'));
	" "$1"
}

update_package_json_version() {
	local path="$1"
	local new_version="$2"
	node -e "
		const fs = require('node:fs');
		const path = process.argv[1];
		const newVersion = process.argv[2];
		const content = fs.readFileSync(path, 'utf8');
		const updated = content.replace(
			/\"version\":\\s*\"[^\"]+\"/,
			'\"version\": \"' + newVersion + '\"',
		);
		if (!updated.includes('\"version\": \"' + newVersion + '\"')) {
			console.error('Failed to update version in ' + path);
			process.exit(1);
		}
		fs.writeFileSync(path, updated);
	" "$path" "$new_version"
}

version_at_sha() {
	local file="$1"
	local sha="$2"
	git show "${sha}:${file}" | node -e "
		let s = '';
		process.stdin.on('data', (chunk) => {
			s += chunk;
		});
		process.stdin.on('end', () => {
			const pkg = JSON.parse(s);
			if (!pkg.version) {
				console.error('No version in ${file}');
				process.exit(1);
			}
			console.log(pkg.version);
		});
	"
}

tag_exists_locally() {
	git rev-parse "$1" >/dev/null 2>&1
}

tag_exists_on_origin() {
	git ls-remote --tags origin "refs/tags/${1}" | grep -q .
}

tag_is_available() {
	if tag_exists_locally "$1"; then
		return 1
	fi
	if tag_exists_on_origin "$1"; then
		return 1
	fi
	return 0
}

assert_tag_available() {
	local tag="$1"
	if tag_exists_locally "$tag"; then
		echo "Error: tag ${tag} already exists locally"
		echo "    Bump the version on main, sync to staging, and retry."
		exit 1
	fi
	if tag_exists_on_origin "$tag"; then
		echo "Error: tag ${tag} already exists on origin"
		echo "    Bump the version on main, sync to staging, and retry."
		exit 1
	fi
}

package_json_version_on_disk() {
	node -e "
		const fs = require('node:fs');
		const pkg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
		if (!pkg.version) {
			console.error('No version in ' + process.argv[1]);
			process.exit(1);
		}
		console.log(pkg.version);
	" "$1"
}

switch_to_main_and_pull() {
	echo "==> Switching to main"
	git switch main

	if [ "$(git branch --show-current)" != "main" ]; then
		echo "Error: expected to be on main after switching, but on $(git branch --show-current)"
		exit 1
	fi

	require_clean_worktree

	echo "==> Pulling latest main"
	git pull --ff-only origin main
}

# Sets RELEASE_VERSION, RELEASE_TAG, and RELEASE_SHA.
# Tags last green staging when that version is free. If the tag already exists,
# bumps the patch on main and tags HEAD so the release completes.
prepare_release_tag() {
	local pkg_json="$1"
	local tag_prefix="$2"
	local bump_commit_prefix="$3"

	local green_version
	green_version="$(version_at_sha "$pkg_json" "$GREEN_SHA")"
	local green_tag="${tag_prefix}${green_version}"
	echo "    Version at that SHA: ${green_version}"

	if tag_is_available "$green_tag"; then
		RELEASE_VERSION="$green_version"
		RELEASE_TAG="$green_tag"
		RELEASE_SHA="$GREEN_SHA"
		return 0
	fi

	echo "==> Tag ${green_tag} already exists; bumping patch version on main"
	switch_to_main_and_pull
	require_clean_worktree

	local current_version
	current_version="$(package_json_version_on_disk "$pkg_json")"
	local new_version="$current_version"
	while ! tag_is_available "${tag_prefix}${new_version}"; do
		echo "    Tag ${tag_prefix}${new_version} already exists"
		new_version="$(increment_patch_version "$new_version")"
	done

	if [ "$new_version" != "$current_version" ]; then
		echo "    ${current_version} → ${new_version}"
		update_package_json_version "$pkg_json" "$new_version"
		git add "$pkg_json"
		git commit -m "${bump_commit_prefix} v${new_version}"
		echo "==> Pushing version bump to origin/main"
		git push origin main
	else
		echo "    Using existing main version ${new_version}"
	fi

	RELEASE_VERSION="$new_version"
	RELEASE_TAG="${tag_prefix}${new_version}"
	RELEASE_SHA="$(git rev-parse HEAD)"

	if [ "$RELEASE_SHA" != "$GREEN_SHA" ]; then
		echo "    Tagging HEAD ${RELEASE_SHA:0:7} (ahead of last green ${GREEN_SHA:0:7})"
	fi
}

create_and_push_tag() {
	local tag="$1"
	local sha="$2"
	echo "==> Creating tag ${tag} on ${sha}"
	git tag "$tag" "$sha"
	echo "==> Pushing tag ${tag} to origin"
	git push origin "$tag"
}

load_last_green_staging() {
	require_gh

	local run_info
	run_info="$(gh run list \
		--workflow=deploy-staging.yml \
		--branch=staging \
		--limit=50 \
		--json conclusion,headSha,status,url)"

	eval "$(node -e "
		const runs = JSON.parse(process.argv[1]);
		if (!Array.isArray(runs) || runs.length === 0) {
			console.error('Error: no Deploy Staging runs found');
			process.exit(1);
		}
		const success = runs.find((run) => run.status === 'completed' && run.conclusion === 'success');
		if (!success || !success.headSha) {
			console.error('Error: no successful Deploy Staging run found');
			console.error('    Sync main to staging and wait for the pipeline to pass.');
			process.exit(1);
		}
		const fields = {
			GREEN_SHA: success.headSha,
			GREEN_URL: success.url ?? '',
		};
		for (const [key, value] of Object.entries(fields)) {
			const escaped = String(value).replace(/'/g, \"'\\\\''\");
			console.log(\`\${key}='\${escaped}'\`);
		}
	" "$run_info")"

	if [ -z "${GREEN_SHA:-}" ]; then
		echo "Error: failed to resolve last green staging SHA"
		exit 1
	fi

	if ! git cat-file -e "${GREEN_SHA}^{commit}" 2>/dev/null; then
		echo "Error: last green staging SHA ${GREEN_SHA} is not in this repo"
		echo "    Run: git fetch origin"
		exit 1
	fi
}

try_load_last_green_staging() {
	GREEN_SHA=""
	GREEN_URL=""
	if ! command -v gh >/dev/null 2>&1; then
		return 1
	fi
	if ! gh auth status >/dev/null 2>&1; then
		return 1
	fi

	local run_info
	if ! run_info="$(gh run list \
		--workflow=deploy-staging.yml \
		--branch=staging \
		--limit=50 \
		--json conclusion,headSha,status,url 2>/dev/null)"; then
		return 1
	fi

	eval "$(node -e "
		const runs = JSON.parse(process.argv[1]);
		if (!Array.isArray(runs) || runs.length === 0) {
			process.exit(0);
		}
		const success = runs.find((run) => run.status === 'completed' && run.conclusion === 'success');
		if (!success || !success.headSha) {
			process.exit(0);
		}
		const fields = {
			GREEN_SHA: success.headSha,
			GREEN_URL: success.url ?? '',
		};
		for (const [key, value] of Object.entries(fields)) {
			const escaped = String(value).replace(/'/g, \"'\\\\''\");
			console.log(\`\${key}='\${escaped}'\`);
		}
	" "$run_info")"

	if [ -z "${GREEN_SHA:-}" ]; then
		return 1
	fi
	return 0
}

print_main_vs_green_warning() {
	local main_sha
	main_sha="$(git rev-parse origin/main)"
	if [ -z "${GREEN_SHA:-}" ]; then
		if ! try_load_last_green_staging; then
			echo "    Could not resolve last green staging SHA."
			return 0
		fi
	fi

	if [ "$main_sha" = "$GREEN_SHA" ]; then
		echo "    origin/main matches last green staging (${GREEN_SHA:0:7})"
		return 0
	fi

	local ahead
	ahead="$(git rev-list --count "${GREEN_SHA}..origin/main")"
	echo "    origin/main is ${ahead} commit(s) ahead of last green staging ${GREEN_SHA:0:7}"
	if [ -n "${GREEN_URL:-}" ]; then
		echo "    ${GREEN_URL}"
	fi
}
