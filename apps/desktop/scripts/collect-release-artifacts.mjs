#!/usr/bin/env node

import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const sourceDir = process.argv[2];
const destDir = process.argv[3];

if (!sourceDir || !destDir) {
	console.error(
		"Usage: node collect-release-artifacts.mjs <source-dir> <dest-dir>",
	);
	process.exit(1);
}

const ALLOWED_EXTENSIONS = new Set([
	".dmg",
	".zip",
	".exe",
	".appimage",
	".yml",
	".yaml",
	".blockmap",
]);

mkdirSync(destDir, { recursive: true });

const staged = [];

for (const entry of readdirSync(sourceDir)) {
	const sourcePath = join(sourceDir, entry);
	if (!statSync(sourcePath).isFile()) {
		continue;
	}

	const extension = extname(entry).toLowerCase();
	if (!ALLOWED_EXTENSIONS.has(extension)) {
		continue;
	}

	const destPath = join(destDir, entry);
	copyFileSync(sourcePath, destPath);
	staged.push(entry);
}

if (staged.length === 0) {
	console.error(`No release artifacts found in ${sourceDir}`);
	process.exit(1);
}

staged.sort();
console.log(`Staged ${staged.length} release artifact(s):`);
for (const name of staged) {
	console.log(`  ${name}`);
}
