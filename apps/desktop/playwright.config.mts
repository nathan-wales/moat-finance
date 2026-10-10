import path from "node:path";
import { fileURLToPath } from "node:url";
import { GOLDEN_PLAID_MOCK_PORT } from "@moat/plaid-golden-ledger";
import { defineConfig } from "@playwright/test";

const desktopRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(desktopRoot, "../..");
const mockBaseUrl = `http://127.0.0.1:${GOLDEN_PLAID_MOCK_PORT}`;

export default defineConfig({
	testDir: "./e2e",
	testMatch: "**/*.spec.mts",
	fullyParallel: false,
	workers: 1,
	timeout: 300_000,
	expect: { timeout: 30_000 },
	reporter: process.env.CI ? "github" : "list",
	webServer: {
		command: "pnpm start-mock:desktop",
		cwd: path.join(repoRoot, "packages/plaid-golden-ledger"),
		url: `${mockBaseUrl}/_golden/health`,
		reuseExistingServer: false,
		timeout: 60_000,
	},
});
