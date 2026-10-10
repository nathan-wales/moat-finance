import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GOLDEN_PLAID_MOCK_PORT } from "@moat/plaid-golden-ledger";
import { defineConfig, devices } from "@playwright/test";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webRoot, "../..");
const apiRoot = path.join(repoRoot, "apps/api");
const authDir = path.join(webRoot, "e2e/.auth");

const fromShell = new Set(Object.keys(process.env));

function loadEnvFile(filePath: string): void {
	if (!fs.existsSync(filePath)) return;
	for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq <= 0) continue;
		const key = trimmed.slice(0, eq).trim();
		if (fromShell.has(key)) continue;
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[key] = value;
	}
}

loadEnvFile(path.join(apiRoot, ".env"));
loadEnvFile(path.join(apiRoot, ".env.local"));
loadEnvFile(path.join(webRoot, ".env"));
loadEnvFile(path.join(webRoot, ".env.local"));

const ciDatabaseUrl =
	"postgresql://ci:ci@localhost:5432/moat_finance_ci?sslmode=disable";
const databaseUrl =
	process.env.DATABASE_URL ?? (process.env.CI ? ciDatabaseUrl : undefined);
if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is required for Playwright Golden. Set it or add apps/api/.env.",
	);
}

const authSecret = process.env.AUTH_SECRET ?? "ci-auth-secret";
const GOLDEN_ENCRYPTION_KEY =
	"0000000000000000000000000000000000000000000000000000000000000000";
const encryptionKey = /^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY ?? "")
	? (process.env.ENCRYPTION_KEY as string)
	: GOLDEN_ENCRYPTION_KEY;
const mockBaseUrl = `http://127.0.0.1:${GOLDEN_PLAID_MOCK_PORT}`;

const sharedEnv: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
	if (typeof value === "string") {
		sharedEnv[key] = value;
	}
}

Object.assign(sharedEnv, {
	AUTH_SECRET: authSecret,
	DATABASE_URL: databaseUrl,
	DIRECT_URL: process.env.DIRECT_URL ?? databaseUrl,
	SERVICE_DATABASE_URL: databaseUrl,
	MOAT_APP_DATABASE_URL: databaseUrl,
	ENCRYPTION_KEY: encryptionKey,
	SKIP_ENV_VALIDATION: "true",
	MOAT_E2E: "1",
	MOAT_DATABASE_ACTOR_TIMEOUT_MS: "120000",
	PLAID_CLIENT_ID: "golden-client-id",
	PLAID_SECRET: "golden-secret",
	PLAID_ENV: "sandbox",
	PLAID_BASE_PATH: mockBaseUrl,
	API_URL: "http://127.0.0.1:3101",
	NEXT_PUBLIC_API_URL: "http://localhost:3101",
	WEB_ORIGIN: "http://localhost:3100",
	NEXT_PUBLIC_E2E: "1",
	CRON_SECRET: "",
});

delete sharedEnv.AXIOM_TOKEN;
delete sharedEnv.AXIOM_DATASET;

for (const [key, value] of Object.entries(sharedEnv)) {
	process.env[key] = value;
}
delete process.env.AXIOM_TOKEN;
delete process.env.AXIOM_DATASET;

if (!process.env.CI && /neon\.(tech|build)/i.test(databaseUrl)) {
	throw new Error(
		"Playwright Golden refuses Neon DATABASE_URL. Point DATABASE_URL at local Postgres, e.g. postgresql://ci:ci@localhost:5437/moat_finance_ci?sslmode=disable",
	);
}

export default defineConfig({
	testDir: "./e2e",
	testMatch: "**/*.spec.ts",
	fullyParallel: false,
	workers: 1,
	timeout: 240_000,
	expect: { timeout: 20_000 },
	reporter: process.env.CI ? "github" : "list",
	globalSetup: "./e2e/global-setup.ts",
	use: {
		...devices["Desktop Chrome"],
		baseURL: "http://localhost:3100",
		storageState: path.join(authDir, "user.json"),
		trace: "retain-on-failure",
	},
	webServer: [
		{
			command: "pnpm start-mock:web",
			cwd: path.join(repoRoot, "packages/plaid-golden-ledger"),
			url: `${mockBaseUrl}/_golden/health`,
			reuseExistingServer: false,
			timeout: 60_000,
			env: sharedEnv,
		},
		{
			command: "pnpm exec next dev -H 127.0.0.1 -p 3101",
			cwd: apiRoot,
			url: "http://127.0.0.1:3101/api/health",
			reuseExistingServer: false,
			timeout: 180_000,
			env: sharedEnv,
		},
		{
			command: "pnpm exec next dev -p 3100",
			cwd: webRoot,
			url: "http://localhost:3100",
			reuseExistingServer: false,
			timeout: 180_000,
			env: sharedEnv,
		},
	],
});
