#!/usr/bin/env node

import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgJson = require.resolve("better-sqlite3-multiple-ciphers/package.json");
const prebuilds = join(dirname(pkgJson), "prebuilds");
const dest = join(
	dirname(fileURLToPath(import.meta.url)),
	"../resources/sqlcipher-native",
);

function collectNodeAddons(dir, acc = []) {
	if (!statSync(dir).isDirectory()) return acc;
	for (const name of readdirSync(dir)) {
		const fullPath = join(dir, name);
		if (statSync(fullPath).isDirectory()) {
			collectNodeAddons(fullPath, acc);
			continue;
		}
		if (name.endsWith(".node")) acc.push(fullPath);
	}
	return acc;
}

function destNameForAddon(addonPath) {
	const relative = addonPath.slice(prebuilds.length + 1);
	const parts = relative.split(/[/\\]/);
	if (parts.length >= 2) {
		return `${parts[0]}.node`;
	}
	const match = relative.match(
		/\.(darwin|linux|win32)-(arm64|x64|ia32)\.node$/,
	);
	if (match) {
		return `${match[1]}-${match[2]}.node`;
	}
	return parts.at(-1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

if (!existsSync(prebuilds) || !statSync(prebuilds).isDirectory()) {
	throw new Error(
		`better-sqlite3-multiple-ciphers prebuilds not found at ${prebuilds}`,
	);
}

const addons = collectNodeAddons(prebuilds);
if (addons.length === 0) {
	throw new Error(
		`No .node addons found under ${prebuilds}. SQLCipher packaging requires native prebuilds.`,
	);
}

for (const addonPath of addons) {
	const name = destNameForAddon(addonPath);
	cpSync(addonPath, join(dest, name));
	console.log(`Copied ${addonPath} -> ${name}`);
}
