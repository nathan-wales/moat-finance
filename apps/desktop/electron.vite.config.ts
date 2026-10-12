import { createRequire } from "node:module";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin, loadEnv } from "electron-vite";

const require = createRequire(import.meta.url);
const linkedomCanvasShim = path.join(
	path.dirname(require.resolve("linkedom/package.json")),
	"commonjs/canvas-shim.cjs",
);

const DEFAULT_POSTHOG_HOST = "https://us.posthog.com";

function firstNonEmpty(...values: Array<string | undefined>): string {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) return trimmed;
	}
	return "";
}

export default defineConfig(({ mode }) => {
	const repoRoot = path.resolve(__dirname, "../..");
	const env = loadEnv(mode, __dirname, "");
	// Desktop has no PostHog keys of its own. Reuse the public project key from
	// web/api so email-targeted flags evaluate the same as the web app locally.
	const webEnv = loadEnv(mode, path.join(repoRoot, "apps/web"), "");
	const apiEnv = loadEnv(mode, path.join(repoRoot, "apps/api"), "");
	const defaultMoatApiUrl =
		mode === "development"
			? "http://localhost:3001"
			: "https://api.moatfinance.ai";
	const moatApiUrl =
		env.MOAT_API_URL?.trim() ||
		process.env.MOAT_API_URL?.trim() ||
		defaultMoatApiUrl;
	// Optional build-time override for desktop → browser link-outs. Empty keeps
	// the runtime fallbacks in src/main/lib/moat-web-url.ts.
	const moatWebUrl = firstNonEmpty(env.MOAT_WEB_URL, process.env.MOAT_WEB_URL);
	const moatRetailExtensionId = (
		env.MOAT_RETAIL_EXTENSION_ID ??
		process.env.MOAT_RETAIL_EXTENSION_ID ??
		env.NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID ??
		process.env.NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID ??
		""
	).trim();
	const viteMoatApiUrl =
		env.VITE_MOAT_API_URL?.trim() ||
		process.env.VITE_MOAT_API_URL?.trim() ||
		moatApiUrl;
	const posthogApiKey = firstNonEmpty(
		env.POSTHOG_API_KEY,
		process.env.POSTHOG_API_KEY,
		env.VITE_POSTHOG_KEY,
		process.env.VITE_POSTHOG_KEY,
		env.NEXT_PUBLIC_POSTHOG_KEY,
		process.env.NEXT_PUBLIC_POSTHOG_KEY,
		webEnv.VITE_POSTHOG_KEY,
		webEnv.NEXT_PUBLIC_POSTHOG_KEY,
		apiEnv.POSTHOG_API_KEY,
		apiEnv.VITE_POSTHOG_KEY,
		apiEnv.NEXT_PUBLIC_POSTHOG_KEY,
	);
	const posthogHost = firstNonEmpty(
		env.POSTHOG_HOST,
		process.env.POSTHOG_HOST,
		env.VITE_POSTHOG_HOST,
		process.env.VITE_POSTHOG_HOST,
		env.NEXT_PUBLIC_POSTHOG_HOST,
		process.env.NEXT_PUBLIC_POSTHOG_HOST,
		webEnv.VITE_POSTHOG_HOST,
		webEnv.NEXT_PUBLIC_POSTHOG_HOST,
		apiEnv.POSTHOG_HOST,
		apiEnv.VITE_POSTHOG_HOST,
		apiEnv.NEXT_PUBLIC_POSTHOG_HOST,
		DEFAULT_POSTHOG_HOST,
	);
	const plaidClientId = (
		env.PLAID_CLIENT_ID ??
		process.env.PLAID_CLIENT_ID ??
		""
	).trim();
	const plaidSecret = (
		env.PLAID_SECRET ??
		process.env.PLAID_SECRET ??
		""
	).trim();
	const plaidEnv = (env.PLAID_ENV ?? process.env.PLAID_ENV ?? "sandbox").trim();
	const remoteMcpDevOverride =
		mode === "production"
			? ""
			: (
					env.MOAT_DESKTOP_REMOTE_MCP ??
					process.env.MOAT_DESKTOP_REMOTE_MCP ??
					""
				).trim();
	const remoteMcpTunnelUrl = (
		env.REMOTE_MCP_TUNNEL_URL ??
		process.env.REMOTE_MCP_TUNNEL_URL ??
		""
	).trim();

	// Production bundles inline these via `define`. Empty values get constant-folded
	// into an unconditional throw at runtime — fail the build instead of shipping that.
	if (mode === "production" && (!plaidClientId || !plaidSecret)) {
		throw new Error(
			"PLAID_CLIENT_ID and PLAID_SECRET must be set for production desktop builds. " +
				"Add them to apps/desktop/.env (local) or GitHub Actions secrets (CI).",
		);
	}

	return {
		main: {
			define: {
				"process.env.PLAID_CLIENT_ID": JSON.stringify(plaidClientId),
				"process.env.PLAID_SECRET": JSON.stringify(plaidSecret),
				"process.env.PLAID_ENV": JSON.stringify(plaidEnv),
				"process.env.MOAT_API_URL": JSON.stringify(moatApiUrl),
				"process.env.MOAT_WEB_URL": JSON.stringify(moatWebUrl),
				"process.env.MOAT_RETAIL_EXTENSION_ID": JSON.stringify(
					moatRetailExtensionId,
				),
				"process.env.POSTHOG_API_KEY": JSON.stringify(posthogApiKey),
				"process.env.POSTHOG_HOST": JSON.stringify(posthogHost),
				"process.env.MOAT_DESKTOP_REMOTE_MCP":
					JSON.stringify(remoteMcpDevOverride),
				"process.env.REMOTE_MCP_TUNNEL_URL": JSON.stringify(remoteMcpTunnelUrl),
			},
			// Only production `dependencies` (electron-updater) stay external.
			// Everything else is bundled so electron-builder does not ship a fat
			// node_modules tree. The Prisma query engine is copied separately via
			// extraResources (see package.json build.extraResources).
			plugins: [externalizeDepsPlugin()],
			resolve: {
				alias: {
					// linkedom optionally requires native `canvas`; Vite turns that into a
					// top-level throw. Point at linkedom's own no-op shim instead.
					canvas: linkedomCanvasShim,
					"@moat/logging": path.resolve(
						__dirname,
						"../../packages/logging/src/index.ts",
					),
					"@moat/mcp-contracts": path.resolve(
						__dirname,
						"../../packages/mcp-contracts/src/index.ts",
					),
					"@moat/contracts/feature-flags": path.resolve(
						__dirname,
						"../../packages/contracts/src/feature-flags.ts",
					),
					"@moat/contracts": path.resolve(
						__dirname,
						"../../packages/contracts/src/index.ts",
					),
					"@moat/category-mapping": path.resolve(
						__dirname,
						"../../packages/category-mapping/src/index.ts",
					),
					"@moat/db-sqlite": path.resolve(
						__dirname,
						"../../packages/db-sqlite/src/index.ts",
					),
					"@moat/plaid-golden-ledger": path.resolve(
						__dirname,
						"../../packages/plaid-golden-ledger/src/index.ts",
					),
					"@moat/domain/retirement-compute": path.resolve(
						__dirname,
						"../../packages/domain/src/retirement/compute-jobs.ts",
					),
					"@moat/domain": path.resolve(
						__dirname,
						"../../packages/domain/src/index.ts",
					),
					"@moat/data-access": path.resolve(
						__dirname,
						"../../packages/data-access/src/index.ts",
					),
					"@moat/financial-data-providers/plaid-investments": path.resolve(
						__dirname,
						"../../packages/financial-data-providers/src/providers/plaid/investments/index.ts",
					),
					"@moat/financial-data-providers": path.resolve(
						__dirname,
						"../../packages/financial-data-providers/src/index.ts",
					),
					"@moat/retail-sync": path.resolve(
						__dirname,
						"../../packages/retail-sync/src/index.ts",
					),
					"@moat/reports/validation": path.resolve(
						__dirname,
						"../../packages/reports/src/validation/validate-moat-report-document.ts",
					),
					"@moat/reports": path.resolve(
						__dirname,
						"../../packages/reports/src/index.ts",
					),
				},
			},
			build: {
				rollupOptions: {
					input: {
						index: path.join(__dirname, "src/main/index.ts"),
						"compute-worker": path.join(
							__dirname,
							"src/main/retirement/compute-worker.ts",
						),
					},
					external: [
						/packages[\\/]db-sqlite[\\/]src[\\/]generated/,
						"better-sqlite3-multiple-ciphers",
					],
				},
			},
		},
		preload: {
			// Bundle preload deps (needed for Electron sandbox).
			plugins: [
				externalizeDepsPlugin({
					exclude: ["@moat/contracts", "@moat/mcp-contracts"],
				}),
			],
			resolve: {
				alias: {
					"@moat/mcp-contracts": path.resolve(
						__dirname,
						"../../packages/mcp-contracts/src/index.ts",
					),
					"@moat/contracts/feature-flags": path.resolve(
						__dirname,
						"../../packages/contracts/src/feature-flags.ts",
					),
					"@moat/contracts": path.resolve(
						__dirname,
						"../../packages/contracts/src/index.ts",
					),
				},
			},
		},
		renderer: {
			plugins: [tailwindcss(), react()],
			define: {
				"import.meta.env.VITE_MOAT_API_URL": JSON.stringify(viteMoatApiUrl),
				"import.meta.env.VITE_POSTHOG_KEY": JSON.stringify(posthogApiKey),
				"import.meta.env.VITE_POSTHOG_HOST": JSON.stringify(posthogHost),
				"import.meta.env.VITE_MOAT_DESKTOP_REMOTE_MCP":
					JSON.stringify(remoteMcpDevOverride),
			},
			resolve: {
				alias: {
					"~": path.resolve(__dirname, "src/renderer/src"),
					"@moat/features/transactions": path.resolve(
						__dirname,
						"../../packages/features/src/transactions/index.ts",
					),
					"@moat/features/rules": path.resolve(
						__dirname,
						"../../packages/features/src/rules/index.ts",
					),
					"@moat/features/moat-mode": path.resolve(
						__dirname,
						"../../packages/features/src/moat-mode/index.ts",
					),
					"@moat/features/appearance": path.resolve(
						__dirname,
						"../../packages/features/src/appearance/index.ts",
					),
					"@moat/features/profile-switcher": path.resolve(
						__dirname,
						"../../packages/features/src/profile-switcher/index.ts",
					),
					"@moat/features/onboarding": path.resolve(
						__dirname,
						"../../packages/features/src/onboarding/index.ts",
					),
					"@moat/features/notifications": path.resolve(
						__dirname,
						"../../packages/features/src/notifications/index.ts",
					),
					"@moat/features/mcp": path.resolve(
						__dirname,
						"../../packages/features/src/mcp/index.ts",
					),
					"@moat/features/setup-guide": path.resolve(
						__dirname,
						"../../packages/features/src/setup-guide/index.ts",
					),
					"@moat/features/financial-profile": path.resolve(
						__dirname,
						"../../packages/features/src/financial-profile/index.ts",
					),
					"@moat/features/investments": path.resolve(
						__dirname,
						"../../packages/features/src/investments/index.ts",
					),
					"@moat/features/retirement": path.resolve(
						__dirname,
						"../../packages/features/src/retirement/index.ts",
					),
					"@moat/features/taxes": path.resolve(
						__dirname,
						"../../packages/features/src/taxes/index.ts",
					),
					"@moat/features/import": path.resolve(
						__dirname,
						"../../packages/features/src/import/index.ts",
					),
					"@moat/features/retail-orders": path.resolve(
						__dirname,
						"../../packages/features/src/retail-orders/index.ts",
					),
					"@moat/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
					"@moat/charts": path.resolve(
						__dirname,
						"../../packages/charts/src/index.ts",
					),
					"@moat/features": path.resolve(
						__dirname,
						"../../packages/features/src/index.ts",
					),
					"@moat/contracts/feature-flags": path.resolve(
						__dirname,
						"../../packages/contracts/src/feature-flags.ts",
					),
					"@moat/contracts": path.resolve(
						__dirname,
						"../../packages/contracts/src/index.ts",
					),
					"@moat/domain/real-estate-projection": path.resolve(
						__dirname,
						"../../packages/domain/src/forecasts/real-estate-projection.ts",
					),
					"@moat/domain/retirement-constants": path.resolve(
						__dirname,
						"../../packages/domain/src/retirement/constants.ts",
					),
					"@moat/domain/federal-rules": path.resolve(
						__dirname,
						"../../packages/domain/src/federal-rules/index.ts",
					),
					"@moat/domain/retirement-levers": path.resolve(
						__dirname,
						"../../packages/domain/src/retirement/default-lever.ts",
					),
					"@moat/domain/retirement-social-security": path.resolve(
						__dirname,
						"../../packages/domain/src/retirement/social-security.ts",
					),
					"@moat/domain/retirement-standing-rules": path.resolve(
						__dirname,
						"../../packages/domain/src/retirement/standing-rules/registry.ts",
					),
					"@moat/domain/retirement-taxes": path.resolve(
						__dirname,
						"../../packages/domain/src/retirement/taxes.ts",
					),
					"@moat/domain/scheduling": path.resolve(
						__dirname,
						"../../packages/domain/src/scheduling/anniversary.ts",
					),
					"@moat/domain/asset-history": path.resolve(
						__dirname,
						"../../packages/domain/src/dashboard/rollup-monthly-last.ts",
					),
					"@moat/reports/validation": path.resolve(
						__dirname,
						"../../packages/reports/src/validation/validate-moat-report-document.ts",
					),
					"@moat/reports": path.resolve(
						__dirname,
						"../../packages/reports/src/index.ts",
					),
				},
			},
		},
	};
});
