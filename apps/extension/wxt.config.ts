import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "wxt";

function resolveWxtMode(): "development" | "production" {
	const args = process.argv.slice(2);
	const modeIndex = args.indexOf("--mode");
	const flagged = modeIndex === -1 ? undefined : args[modeIndex + 1];
	if (flagged === "development" || flagged === "production") return flagged;

	const command = args.find((arg) => !arg.startsWith("-"));
	if (command === undefined || command === "dev") return "development";
	return "production";
}

function applyEnvFiles(mode: "development" | "production") {
	const configDir = fileURLToPath(new URL(".", import.meta.url));
	const files = [".env", `.env.${mode}`];
	for (const file of files) {
		const filePath = path.join(configDir, file);
		if (!existsSync(filePath)) continue;
		const parsed = parseEnv(readFileSync(filePath, "utf-8"));
		for (const [key, value] of Object.entries(parsed)) {
			process.env[key] = value;
		}
	}
}

function toHostPermissionPattern(value: string, fallback: string): string {
	const baseUrl = value || fallback;
	const url = new URL(baseUrl);
	return `${url.protocol}//${url.hostname}/*`;
}

applyEnvFiles(resolveWxtMode());

const apiHostPermission = toHostPermissionPattern(
	process.env.WXT_MOAT_API_URL ?? "",
	"http://localhost:3001",
);
const webHostPermission = toHostPermissionPattern(
	process.env.WXT_MOAT_WEB_URL ?? "",
	"http://localhost:3000",
);
const chromiumProfile = fileURLToPath(
	new URL(".wxt/chromium-profile", import.meta.url),
);

mkdirSync(chromiumProfile, { recursive: true });

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
	modules: ["@wxt-dev/module-react"],
	vite: () => ({
		resolve: {
			alias: {
				"@moat/features/retail-orders": path.resolve(
					repoRoot,
					"packages/features/src/retail-orders/index.ts",
				),
				"@moat/contracts": path.resolve(
					repoRoot,
					"packages/contracts/src/index.ts",
				),
			},
		},
	}),
	dev: {
		server: {
			port: 5000,
			origin: "http://localhost:5000",
			strictPort: true,
		},
	},
	webExt: {
		chromiumProfile,
		keepProfileChanges: true,
		startUrls: ["https://www.google.com/"],
	},
	hooks: {
		"build:manifestGenerated": (_wxt, manifest) => {
			if (manifest.action) {
				delete manifest.action.default_popup;
			}

			const optionalHosts = new Set(manifest.optional_host_permissions ?? []);
			if (manifest.host_permissions && optionalHosts.size > 0) {
				manifest.host_permissions = manifest.host_permissions.filter(
					(permission: string) => !optionalHosts.has(permission),
				);
			}
			if (manifest.content_scripts?.length === 0) {
				delete manifest.content_scripts;
			}
		},
	},
	manifest: {
		name: "Moat Finance - Retail Sync",
		description: "Browser-assisted retail purchase import for Moat Finance.",
		version: "0.1.0",
		permissions: ["storage", "scripting"],
		host_permissions: [apiHostPermission],
		optional_host_permissions: [
			"https://www.amazon.com/*",
			"https://smile.amazon.com/*",
			"https://www.walmart.com/*",
			"https://www.target.com/*",
			"http://127.0.0.1:3031/*",
		],
		externally_connectable: {
			matches: [webHostPermission],
		},
		icons: {
			16: "/icon-16.png",
			32: "/icon-32.png",
			48: "/icon-48.png",
			128: "/icon-128.png",
		},
		action: {
			default_title: "Moat Retail Sync",
			default_icon: {
				16: "/icon-16.png",
				32: "/icon-32.png",
				48: "/icon-48.png",
				128: "/icon-128.png",
			},
		},
		side_panel: {
			default_path: "sidepanel.html",
		},
		web_accessible_resources: [
			{
				resources: ["popup.html"],
				matches: [webHostPermission],
			},
		],
	},
});
