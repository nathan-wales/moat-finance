#!/usr/bin/env node

/**
 * Fails the desktop release if the packaged app is missing the Prisma SQLite
 * client that createSqliteClient() loads from Resources/prisma-client.
 *
 * Usage:
 *   node scripts/validate-packaged-prisma.mjs [dist-dir]
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const distDir = process.argv[2] ?? join(process.cwd(), "dist");

function findMacApps(root) {
	if (!existsSync(root)) return [];
	const apps = [];
	for (const entry of readdirSync(root)) {
		const fullPath = join(root, entry);
		if (entry.endsWith(".app") && statSync(fullPath).isDirectory()) {
			apps.push(fullPath);
			continue;
		}
		if (!statSync(fullPath).isDirectory()) continue;
		// electron-builder may nest under mac / mac-arm64 / mac-universal
		if (entry.startsWith("mac")) {
			apps.push(...findMacApps(fullPath));
		}
	}
	return apps;
}

function validatePrismaClientDir(clientDir, label) {
	const indexPath = join(clientDir, "index.js");
	if (!existsSync(indexPath)) {
		throw new Error(`${label}: missing ${indexPath}`);
	}

	const engine = readdirSync(clientDir).find(
		(name) =>
			name.startsWith("libquery_engine") ||
			name.startsWith("query_engine") ||
			name.endsWith(".node") ||
			name.endsWith(".dll.node"),
	);
	if (!engine) {
		throw new Error(
			`${label}: missing Prisma query engine binary in ${clientDir}`,
		);
	}

	const runtimeLibrary = join(clientDir, "runtime", "library.js");
	if (!existsSync(runtimeLibrary)) {
		throw new Error(`${label}: missing ${runtimeLibrary}`);
	}

	console.log(`OK ${label}: prisma-client (+ ${engine})`);
}

function validateSqlcipherNative(resourcesDir, label) {
	const nativeDir = join(resourcesDir, "sqlcipher-native");
	if (!existsSync(nativeDir)) {
		throw new Error(`${label}: missing ${nativeDir}`);
	}
	const prebuild = readdirSync(nativeDir).find((name) =>
		name.endsWith(".node"),
	);
	if (!prebuild) {
		throw new Error(`${label}: missing SQLCipher native addon in ${nativeDir}`);
	}
	console.log(`OK ${label}: sqlcipher-native (+ ${prebuild})`);
}

const macApps = findMacApps(distDir);
const linuxAppImages = existsSync(distDir)
	? readdirSync(distDir).filter((name) =>
			name.toLowerCase().endsWith(".appimage"),
		)
	: [];
const winDirs = existsSync(distDir)
	? readdirSync(distDir)
			.map((name) => join(distDir, name))
			.filter(
				(fullPath) =>
					statSync(fullPath).isDirectory() &&
					(fullPath.includes("win") || fullPath.endsWith("win-unpacked")),
			)
	: [];

let checked = 0;

for (const appPath of macApps) {
	const resourcesDir = join(appPath, "Contents", "Resources");
	validatePrismaClientDir(join(resourcesDir, "prisma-client"), appPath);
	validateSqlcipherNative(resourcesDir, appPath);
	checked += 1;
}

for (const winDir of winDirs) {
	const clientDir = join(winDir, "resources", "prisma-client");
	if (!existsSync(clientDir)) continue;
	validatePrismaClientDir(clientDir, winDir);
	validateSqlcipherNative(join(winDir, "resources"), winDir);
	checked += 1;
}

// AppImage contents are not easily inspected here; mac/win unpacked dirs cover CI.
if (linuxAppImages.length > 0) {
	console.log(
		`Note: found ${linuxAppImages.length} AppImage(s); prisma-client is validated on mac/win unpacked outputs.`,
	);
}

if (checked === 0) {
	console.error(
		`No packaged app with Resources/prisma-client found under ${distDir}. ` +
			`Did electron-builder run, and is extraResources configured?`,
	);
	process.exit(1);
}

console.log(`Validated prisma-client in ${checked} packaged app(s).`);
