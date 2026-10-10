import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(
	fileURLToPath(new URL("../../api", import.meta.url)),
);

export function runApiGoldenCli(
	script: "golden:seed" | "golden:dump" | "golden:drive-historical",
	args: string[] = [],
): string {
	const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
	const env: NodeJS.ProcessEnv = {
		...process.env,
		DATABASE_URL: databaseUrl,
		DIRECT_URL: databaseUrl,
		SERVICE_DATABASE_URL: databaseUrl,
		MOAT_APP_DATABASE_URL: databaseUrl,
		MOAT_E2E: "1",
		CRON_SECRET: "",
	};
	delete env.AXIOM_TOKEN;
	delete env.AXIOM_DATASET;
	return execFileSync("pnpm", ["run", script, "--", ...args], {
		cwd: apiRoot,
		encoding: "utf8",
		env,
	});
}

export function parseCliJson<T>(stdout: string): T {
	const line = stdout
		.split("\n")
		.map((entry) => entry.trim())
		.filter((entry) => entry.startsWith("{"))
		.at(-1);
	if (!line) {
		throw new Error(`Golden CLI did not print JSON:\n${stdout}`);
	}
	return JSON.parse(line) as T;
}
