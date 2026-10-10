#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const assetsDir = process.argv[2];
const rawVersion = process.argv[3];

if (!assetsDir || !rawVersion) {
	console.error("Usage: node publish-downloads.mjs <assets-dir> <version>");
	process.exit(1);
}

const version = rawVersion.replace(/^desktop-v/, "").replace(/^v/, "");
const releasePrefix = `releases/${version}`;
const bucket = process.env.R2_BUCKET;
const endpoint = process.env.AWS_ENDPOINT_URL;
const downloadsBase =
	process.env.DOWNLOADS_BASE ?? "https://downloads.moatfinance.ai";
const releaseRetentionCount = Number.parseInt(
	process.env.RELEASE_RETENTION_COUNT ?? "6",
	10,
);

if (!bucket || !endpoint) {
	console.error("R2_BUCKET and AWS_ENDPOINT_URL are required.");
	process.exit(1);
}

function awsArgs(subcommandArgs) {
	return [...subcommandArgs, "--endpoint-url", endpoint];
}

function s3Cp(localPath, key, options = {}) {
	const args = awsArgs(["s3", "cp", localPath, `s3://${bucket}/${key}`]);
	if (options.contentType) {
		args.push("--content-type", options.contentType);
	}
	if (options.contentDisposition) {
		args.push("--content-disposition", options.contentDisposition);
	}
	execFileSync("aws", args, { stdio: "inherit" });
}

function s3RmRecursive(prefix) {
	execFileSync(
		"aws",
		awsArgs(["s3", "rm", `s3://${bucket}/${prefix}`, "--recursive"]),
		{ stdio: "inherit" },
	);
}

function s3Ls(prefix) {
	return execFileSync(
		"aws",
		awsArgs(["s3", "ls", `s3://${bucket}/${prefix}`]),
		{ encoding: "utf8" },
	);
}

const RELEASE_EXTENSIONS = new Set([
	".dmg",
	".zip",
	".exe",
	".appimage",
	".yml",
	".yaml",
	".blockmap",
]);

function listReleaseFiles(dir) {
	return readdirSync(dir)
		.map((entry) => join(dir, entry))
		.filter((fullPath) => {
			if (!statSync(fullPath).isFile()) {
				return false;
			}

			return RELEASE_EXTENSIONS.has(extname(fullPath).toLowerCase());
		});
}

function findDmg(files, arch) {
	const dmgs = files.filter((file) => file.toLowerCase().endsWith(".dmg"));
	if (arch === "arm64") {
		return (
			dmgs.find((file) => basename(file).toLowerCase().includes("arm64")) ??
			dmgs[0]
		);
	}
	return (
		dmgs.find((file) => !basename(file).toLowerCase().includes("arm64")) ??
		dmgs[0]
	);
}

function findExe(files) {
	return (
		files.find((file) => {
			const name = basename(file).toLowerCase();
			return name.endsWith(".exe") && name.includes("setup");
		}) ?? files.find((file) => basename(file).toLowerCase().endsWith(".exe"))
	);
}

function findAppImage(files) {
	return files.find((file) =>
		basename(file).toLowerCase().endsWith(".appimage"),
	);
}

function normalizeReleaseVersion(name) {
	return name.replace(/^v/, "");
}

function compareVersions(a, b) {
	const partsA = normalizeReleaseVersion(a).split(".").map(Number);
	const partsB = normalizeReleaseVersion(b).split(".").map(Number);
	const length = Math.max(partsA.length, partsB.length);

	for (let index = 0; index < length; index += 1) {
		const diff = (partsA[index] ?? 0) - (partsB[index] ?? 0);
		if (diff !== 0) {
			return diff;
		}
	}

	return 0;
}

function listReleaseVersions() {
	const output = s3Ls("releases/");
	const versions = [];

	for (const line of output.split("\n")) {
		const match = line.match(/\sPRE\s+(.+?)\/$/);
		if (match) {
			versions.push(match[1]);
		}
	}

	return versions;
}

function pruneOldReleases(currentVersion) {
	if (!Number.isFinite(releaseRetentionCount) || releaseRetentionCount < 1) {
		console.warn(
			"Skipping release pruning: RELEASE_RETENTION_COUNT must be a positive integer.",
		);
		return;
	}

	const versions = listReleaseVersions();
	const count = versions.length;

	console.log(
		`Found ${count} releases. Keeping the newest ${releaseRetentionCount}.`,
	);

	if (count <= releaseRetentionCount) {
		console.log("Nothing to delete.");
		return;
	}

	const sorted = [...versions].sort(compareVersions);
	const toDelete = sorted.slice(0, sorted.length - releaseRetentionCount);

	for (const releaseVersion of toDelete) {
		if (normalizeReleaseVersion(releaseVersion) === currentVersion) {
			continue;
		}

		console.log(`Deleting old release: ${releaseVersion}`);
		s3RmRecursive(`releases/${releaseVersion}/`);
	}
}

const files = listReleaseFiles(assetsDir);
if (files.length === 0) {
	console.error(`No release artifacts found in ${assetsDir}`);
	process.exit(1);
}
const macArm = findDmg(files, "arm64");
const macIntel = findDmg(files, "x64");
const windows = findExe(files);
const linux = findAppImage(files);

const DOWNLOAD_FILENAMES = {
	"latest/mac-arm64.dmg": "Moat_Finance.dmg",
	"latest/mac-x64.dmg": "Moat_Finance_Intel.dmg",
	"latest/windows.exe": "Moat_Finance_Setup.exe",
	"latest/linux.AppImage": "Moat_Finance.AppImage",
};

const latestAliases = [
	{ label: "macOS arm64", source: macArm, key: "latest/mac-arm64.dmg" },
	{ label: "macOS x64", source: macIntel, key: "latest/mac-x64.dmg" },
	{ label: "Windows", source: windows, key: "latest/windows.exe" },
	{ label: "Linux", source: linux, key: "latest/linux.AppImage" },
];

for (const { label, source } of latestAliases) {
	if (!source) {
		console.warn(`Warning: missing artifact for ${label}`);
	}
}

for (const file of files) {
	const name = basename(file);
	s3Cp(file, `${releasePrefix}/${name}`);
}

for (const { source, key } of latestAliases) {
	if (!source) {
		continue;
	}

	const downloadFilename = DOWNLOAD_FILENAMES[key];
	s3Cp(source, key, {
		contentDisposition: downloadFilename
			? `attachment; filename="${downloadFilename}"`
			: undefined,
	});
}

for (const file of files) {
	const name = basename(file);
	if (
		name.endsWith(".yml") ||
		name.endsWith(".yaml") ||
		name.endsWith(".blockmap") ||
		name.endsWith(".dmg") ||
		name.endsWith(".exe") ||
		name.endsWith(".AppImage") ||
		name.endsWith(".appimage") ||
		name.endsWith(".zip")
	) {
		s3Cp(file, `updates/${name}`);
	}
}

const manifest = {
	version,
	releasedAt: new Date().toISOString(),
	downloads: {
		macArm64: macArm ? `${downloadsBase}/latest/mac-arm64.dmg` : null,
		macX64: macIntel ? `${downloadsBase}/latest/mac-x64.dmg` : null,
		windows: windows ? `${downloadsBase}/latest/windows.exe` : null,
		linux: linux ? `${downloadsBase}/latest/linux.AppImage` : null,
	},
	filenames: {
		macArm64: macArm ? DOWNLOAD_FILENAMES["latest/mac-arm64.dmg"] : null,
		macX64: macIntel ? DOWNLOAD_FILENAMES["latest/mac-x64.dmg"] : null,
		windows: windows ? DOWNLOAD_FILENAMES["latest/windows.exe"] : null,
		linux: linux ? DOWNLOAD_FILENAMES["latest/linux.AppImage"] : null,
	},
};

const manifestPath = join(assetsDir, "manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
s3Cp(manifestPath, "latest/manifest.json", {
	contentType: "application/json",
});
s3Cp(manifestPath, `${releasePrefix}/manifest.json`, {
	contentType: "application/json",
});

pruneOldReleases(version);

console.log(`Published desktop v${version} to ${downloadsBase}`);
