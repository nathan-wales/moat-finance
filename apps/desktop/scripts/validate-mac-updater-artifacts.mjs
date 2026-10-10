#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const artifactsDir = process.argv[2];

if (!artifactsDir) {
	console.error(
		"Usage: node validate-mac-updater-artifacts.mjs <artifacts-dir>",
	);
	process.exit(1);
}

const entries = readdirSync(artifactsDir);
const zips = entries.filter((name) => name.toLowerCase().endsWith(".zip"));
const ymlPath = join(artifactsDir, "latest-mac.yml");

if (zips.length === 0) {
	console.error(
		"macOS auto-update requires .zip artifacts for electron-updater (Squirrel.Mac).",
	);
	console.error(`No .zip files found in ${artifactsDir}`);
	process.exit(1);
}

if (!existsSync(ymlPath)) {
	console.error(`Missing latest-mac.yml in ${artifactsDir}`);
	process.exit(1);
}

const yml = readFileSync(ymlPath, "utf8");
const zipInFeed = zips.some((name) => yml.includes(name));

if (!zipInFeed) {
	console.error("latest-mac.yml does not reference any staged .zip artifact.");
	console.error(`Staged zips: ${zips.join(", ")}`);
	process.exit(1);
}

console.log(
	`Validated macOS updater artifacts (${zips.length} zip file(s) referenced in latest-mac.yml).`,
);
