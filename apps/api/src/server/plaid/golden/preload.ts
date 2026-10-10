import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	assertGoldenDatabaseIsNotSharedNeon,
	blockGoldenSideEffectEnv,
	GOLDEN_BLOCKED_ENV,
	GOLDEN_PINNED_DATABASE_ENV,
	pinGoldenDatabaseUrls,
} from "./block-side-effect-env";

Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV ?? "test" });
process.env.MOAT_E2E = "1";
process.env.SKIP_ENV_VALIDATION ??= "true";
process.env.PLAID_CLIENT_ID ??= "golden-client-id";
process.env.PLAID_SECRET ??= "golden-secret";
process.env.PLAID_ENV ??= "sandbox";
process.env.AUTH_SECRET ??= "ci-auth-secret-for-golden-ledger-tests";
const GOLDEN_ENCRYPTION_KEY =
	"0000000000000000000000000000000000000000000000000000000000000000";
if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY ?? "")) {
	process.env.ENCRYPTION_KEY = GOLDEN_ENCRYPTION_KEY;
}
process.env.WEB_ORIGIN ??= "http://localhost:3000";

const blockedEnv = new Set<string>([
	...GOLDEN_BLOCKED_ENV,
	...GOLDEN_PINNED_DATABASE_ENV,
]);
blockGoldenSideEffectEnv();

function loadEnvFile(filePath: string): void {
	if (!fs.existsSync(filePath)) return;
	for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq <= 0) continue;
		const key = trimmed.slice(0, eq).trim();
		if (blockedEnv.has(key) || process.env[key]) continue;
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

const apiRoot = path.resolve(
	fileURLToPath(new URL("../../../..", import.meta.url)),
);
loadEnvFile(path.join(apiRoot, ".env"));
pinGoldenDatabaseUrls();
assertGoldenDatabaseIsNotSharedNeon();
