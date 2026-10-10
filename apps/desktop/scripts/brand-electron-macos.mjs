/**
 * Brand the macOS Electron.dev binary so Keychain prompts say "Moat Finance"
 * instead of "Electron", and so Always Allow can stick across `pnpm dev` launches.
 *
 * Unsigned Electron.app rebuilds invalidate Keychain ACLs. Renaming the bundle and
 * aligning CFBundleIdentifier with the packaged app gives a stable identity for
 * local development. electron-builder already brands production builds.
 *
 * Safe to re-run: no-ops when already branded. Re-run after Electron upgrades.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const PRODUCT_NAME = "Moat Finance";
const BUNDLE_ID = "com.moatfinance.desktop";
const TARGET_APP_NAME = `${PRODUCT_NAME}.app`;

if (process.platform !== "darwin") {
	process.exit(0);
}

const require = createRequire(import.meta.url);
const electronPkgJson = require.resolve("electron/package.json");
const electronPkgDir = dirname(electronPkgJson);
const distDir = join(electronPkgDir, "dist");
const pathFile = join(electronPkgDir, "path.txt");

if (!existsSync(pathFile)) {
	console.warn(
		"[brand-electron-macos] electron/path.txt missing — skip branding",
	);
	process.exit(0);
}

const relativeExecPath = readFileSync(pathFile, "utf8").trim();
const slashIndex = relativeExecPath.indexOf("/");
if (slashIndex < 0) {
	console.warn(
		`[brand-electron-macos] unexpected path.txt value: ${relativeExecPath}`,
	);
	process.exit(0);
}

const currentAppName = relativeExecPath.slice(0, slashIndex);
const execSuffix = relativeExecPath.slice(slashIndex);
const currentAppDir = join(distDir, currentAppName);
const targetAppDir = join(distDir, TARGET_APP_NAME);

if (!existsSync(currentAppDir) && !existsSync(targetAppDir)) {
	console.warn(
		"[brand-electron-macos] Electron macOS app bundle not found — skip branding",
	);
	process.exit(0);
}

if (currentAppName !== TARGET_APP_NAME) {
	if (existsSync(targetAppDir)) {
		console.warn(
			`[brand-electron-macos] both ${currentAppName} and ${TARGET_APP_NAME} exist — skip rename`,
		);
	} else {
		renameSync(currentAppDir, targetAppDir);
		writeFileSync(pathFile, `${TARGET_APP_NAME}${execSuffix}`);
		console.log(
			`[brand-electron-macos] renamed ${currentAppName} → ${TARGET_APP_NAME}`,
		);
	}
} else if (
	readFileSync(pathFile, "utf8").trim() !== `${TARGET_APP_NAME}${execSuffix}`
) {
	writeFileSync(pathFile, `${TARGET_APP_NAME}${execSuffix}`);
}

const appDir = existsSync(targetAppDir) ? targetAppDir : currentAppDir;
const infoPlist = join(appDir, "Contents", "Info.plist");

function plutilReplace(plistPath, key, value) {
	const result = spawnSync(
		"plutil",
		["-replace", key, "-string", value, plistPath],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) {
		throw new Error(
			`plutil -replace ${key} failed: ${result.stderr || result.stdout}`,
		);
	}
}

if (!existsSync(infoPlist)) {
	console.warn("[brand-electron-macos] Info.plist missing — skip plist patch");
	process.exit(0);
}

plutilReplace(infoPlist, "CFBundleName", PRODUCT_NAME);
plutilReplace(infoPlist, "CFBundleDisplayName", PRODUCT_NAME);
plutilReplace(infoPlist, "CFBundleIdentifier", BUNDLE_ID);

const lsregister =
	"/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
if (existsSync(lsregister)) {
	spawnSync(lsregister, ["-f", appDir], { stdio: "ignore" });
}

console.log(`[brand-electron-macos] branded as ${PRODUCT_NAME} (${BUNDLE_ID})`);
