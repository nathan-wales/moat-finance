import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();

const scanRoots = [
	join(repoRoot, "apps/web/src"),
	join(repoRoot, "apps/mcp/src"),
	join(repoRoot, "apps/desktop/src"),
];

const allowedFiles = new Set([
	"apps/web/src/lib/analytics.ts",
	"apps/web/src/lib/posthog.ts",
	"apps/mcp/src/lib/analytics.ts",
	"apps/desktop/src/renderer/src/lib/analytics.ts",
	"apps/desktop/src/renderer/src/lib/posthog.ts",
	"apps/desktop/src/main/lib/analytics.ts",
]);

const ignoredDirs = new Set(["node_modules", ".next", "dist", "build", "out"]);

const forbiddenPatterns = [
	/\bposthog\.capture\s*\(/,
	/\bposthog\.identify\s*\(/,
	/\busePostHog\s*\(/,
	/import\s+\{?\s*posthog\s*\}?\s+from\s+["'][^"']+["']/,
	/import\s+\{\s*usePostHog\s*\}\s+from\s+["']posthog-js\/react["']/,
	/\bPostHog\b.*\.capture\s*\(/,
	/new\s+PostHog\s*\(/,
];

const checkedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

function extensionOf(filePath) {
	const match = filePath.match(/\.[^.]+$/);
	return match?.[0] ?? "";
}

function walk(dir) {
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!ignoredDirs.has(entry.name)) {
				files.push(...walk(join(dir, entry.name)));
			}
			continue;
		}

		const filePath = join(dir, entry.name);
		if (checkedExtensions.has(extensionOf(filePath))) {
			files.push(filePath);
		}
	}
	return files;
}

const violations = [];

for (const scanRoot of scanRoots) {
	for (const filePath of walk(scanRoot)) {
		const relativePath = relative(repoRoot, filePath);
		if (allowedFiles.has(relativePath)) continue;

		const content = readFileSync(filePath, "utf8");
		const lines = content.split(/\r?\n/);
		for (const [index, line] of lines.entries()) {
			if (forbiddenPatterns.some((pattern) => pattern.test(line))) {
				violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
			}
		}
	}
}

if (violations.length > 0) {
	console.error(
		"Direct PostHog capture/identify usage is not allowed. Use the platform analytics wrapper instead.\n",
	);
	for (const violation of violations) {
		console.error(violation);
	}
	process.exit(1);
}

console.log("Analytics usage check passed.");
