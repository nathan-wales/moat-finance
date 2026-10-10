#!/usr/bin/env bash
# Fully uninstall Moat Finance desktop from this Mac:
# app bundle, DMG(s), mounted volumes, userData, caches, prefs, keychain.
#
# Usage:
#   ./apps/desktop/scripts/wipe-local-install.sh           # interactive confirm
#   ./apps/desktop/scripts/wipe-local-install.sh --yes      # no prompt
#   ./apps/desktop/scripts/wipe-local-install.sh --dry-run  # print only
set -euo pipefail

DRY_RUN=0
ASSUME_YES=0

for arg in "$@"; do
	case "$arg" in
		--dry-run) DRY_RUN=1 ;;
		--yes|-y) ASSUME_YES=1 ;;
		--help|-h)
			sed -n '2,10p' "$0"
			exit 0
			;;
		*)
			echo "Unknown argument: $arg" >&2
			echo "Usage: $0 [--dry-run] [--yes]" >&2
			exit 1
			;;
	esac
done

APP_NAME="Moat Finance"
BUNDLE_ID="com.moatfinance.desktop"
# Current Electron userData name (app.setName). Keep legacy for old installs.
USER_DATA_NAMES=("moat-finance" "moat-finance-dev" "moat-desktop" "Moat Finance")
KEYCHAIN_SERVICES=(
	"moat-finance Safe Storage"
	"moat-finance-dev Safe Storage"
	"moat-desktop Safe Storage"
	"Moat Finance Safe Storage"
	"Moat Safe Storage"
	"Electron Safe Storage"
	"Chromium Safe Storage"
)

function run() {
	if [[ "$DRY_RUN" -eq 1 ]]; then
		printf '[dry-run] '
		printf '%q ' "$@"
		printf '\n'
		return 0
	fi
	"$@"
}

function remove_path() {
	local target="$1"
	if [[ ! -e "$target" && ! -L "$target" ]]; then
		echo "  skip (missing): $target"
		return 0
	fi
	echo "  remove: $target"
	run rm -rf "$target"
}

function remove_glob() {
	local pattern="$1"
	local matched=0
	local path
	while IFS= read -r -d '' path; do
		matched=1
		remove_path "$path"
	done < <(compgen -G "$pattern" | tr '\n' '\0' || true)
	if [[ "$matched" -eq 0 ]]; then
		echo "  skip (no matches): $pattern"
	fi
}

echo "Moat Finance desktop wipe"
echo "  dry-run: $DRY_RUN"
echo

if [[ "$ASSUME_YES" -ne 1 && "$DRY_RUN" -ne 1 ]]; then
	read -r -p "This permanently deletes the app and local data. Continue? [y/N] " reply
	case "$reply" in
		y|Y|yes|YES) ;;
		*)
			echo "Aborted."
			exit 1
			;;
	esac
	echo
fi

echo "0) Quit app if running"
if pgrep -f 'Moat Finance|com\.moatfinance\.desktop' >/dev/null 2>&1; then
	run osascript -e "quit app \"$APP_NAME\"" || true
	sleep 1
	if pgrep -f 'Moat Finance|com\.moatfinance\.desktop' >/dev/null 2>&1; then
		echo "  warning: app may still be running; quit it manually if deletes fail"
	else
		echo "  quit ok"
	fi
else
	echo "  not running"
fi
echo

echo "1) Eject mounted DMG volumes"
volume_found=0
shopt -s nullglob
for volume in /Volumes/Moat\ Finance*; do
	if [[ -d "$volume" ]]; then
		volume_found=1
		echo "  detach: $volume"
		run hdiutil detach "$volume" || true
	fi
done
shopt -u nullglob
if [[ "$volume_found" -eq 0 ]]; then
	echo "  none mounted"
fi
echo

echo "2) Remove installed app"
remove_path "/Applications/${APP_NAME}.app"
remove_path "$HOME/Applications/${APP_NAME}.app"
echo

echo "3) Remove DMGs from Downloads"
remove_glob "$HOME/Downloads/Moat_Finance*.dmg"
remove_glob "$HOME/Downloads/Moat Finance*.dmg"
echo

echo "4) Remove Application Support userData"
for name in "${USER_DATA_NAMES[@]}"; do
	remove_path "$HOME/Library/Application Support/$name"
done
echo

echo "5) Remove caches / prefs / state / logs leftovers"
for name in "${USER_DATA_NAMES[@]}" "$BUNDLE_ID"; do
	remove_path "$HOME/Library/Caches/$name"
	remove_path "$HOME/Library/Logs/$name"
	remove_path "$HOME/Library/HTTPStorages/$name"
	remove_path "$HOME/Library/HTTPStorages/${name}.binarycookies"
	remove_path "$HOME/Library/Saved Application State/${name}.savedState"
	remove_path "$HOME/Library/Preferences/${name}.plist"
done
echo

echo "6) Remove Electron safeStorage keychain entries"
for service in "${KEYCHAIN_SERVICES[@]}"; do
	if security find-generic-password -s "$service" >/dev/null 2>&1; then
		echo "  delete keychain: $service"
		run security delete-generic-password -s "$service" || true
	else
		echo "  skip (missing): $service"
	fi
done
echo

echo "7) Verify"
failures=0
function expect_gone() {
	local path="$1"
	if [[ -e "$path" || -L "$path" ]]; then
		echo "  still present: $path"
		failures=$((failures + 1))
	else
		echo "  gone: $path"
	fi
}

if [[ "$DRY_RUN" -eq 1 ]]; then
	echo "  (skipped verification in dry-run)"
else
	expect_gone "/Applications/${APP_NAME}.app"
	expect_gone "$HOME/Downloads/Moat_Finance.dmg"
	for name in "${USER_DATA_NAMES[@]}"; do
		expect_gone "$HOME/Library/Application Support/$name"
	done
	if ls /Volumes/Moat\ Finance* >/dev/null 2>&1; then
		echo "  still mounted:"
		ls -1 /Volumes/Moat\ Finance* || true
		failures=$((failures + 1))
	else
		echo "  gone: /Volumes/Moat Finance*"
	fi
	for service in "${KEYCHAIN_SERVICES[@]}"; do
		if security find-generic-password -s "$service" >/dev/null 2>&1; then
			echo "  still in keychain: $service"
			failures=$((failures + 1))
		else
			echo "  gone keychain: $service"
		fi
	done
fi
echo

if [[ "$failures" -gt 0 ]]; then
	echo "Wipe finished with $failures leftover(s). Inspect paths above."
	exit 1
fi

echo "Wipe complete. Packaged installs use ~/Library/Application Support/moat-finance; pnpm dev uses moat-finance-dev."
