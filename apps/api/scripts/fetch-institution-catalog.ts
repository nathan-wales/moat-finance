/**
 * Fetches institution catalogs from provider APIs and writes the snapshot JSON.
 * Does NOT touch the database.
 *
 * Usage:
 *   pnpm --filter moat-api run sync:fetch
 *   pnpm --filter moat-api run sync:fetch -- --providers=PLAID,MX
 *   pnpm --filter moat-api run sync:fetch -- --snapshot=/path/to/catalog.json
 */

import path from "node:path";
import type {
	FetchCatalogResult,
	SyncProvider,
} from "../src/server/services/institution-catalog-fetch.service";
import { fetchInstitutionCatalog } from "../src/server/services/institution-catalog-fetch.service";

const VALID_PROVIDERS = ["PLAID", "MX", "FINICITY"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

const DEFAULT_SNAPSHOT_PATH = path.resolve(
	process.cwd(),
	"data/institution-catalog.json",
);

async function main() {
	const args = process.argv.slice(2);
	const providers = parseProviders(args);
	const snapshotPath = parseFlag(args, "--snapshot=") ?? DEFAULT_SNAPSHOT_PATH;

	console.log(`Snapshot: ${snapshotPath}`);
	console.log(`Providers: ${providers.join(", ")}`);
	console.log("Fetching from provider APIs...\n");

	const result = await fetchInstitutionCatalog(snapshotPath, { providers });
	printSummary(result);
}

function parseProviders(args: string[]): Provider[] {
	const providerArg = args.find((arg) => arg.startsWith("--providers="));
	if (!providerArg) return [...VALID_PROVIDERS];

	const requested = providerArg
		.replace("--providers=", "")
		.split(",")
		.map((p) => p.trim().toUpperCase())
		.filter((p) => p.length > 0);

	const providers: Provider[] = [];
	for (const p of requested) {
		if (!VALID_PROVIDERS.some((v) => v === p)) {
			throw new Error(
				`Unknown provider "${p}". Expected one of: ${VALID_PROVIDERS.join(", ")}`,
			);
		}
		providers.push(p as Provider);
	}
	return providers.length > 0 ? providers : [...VALID_PROVIDERS];
}

function parseFlag(args: string[], prefix: string): string | null {
	const arg = args.find((a) => a.startsWith(prefix));
	return arg ? arg.slice(prefix.length) : null;
}

function printSummary(result: FetchCatalogResult) {
	console.log(`Snapshot written to: ${result.snapshotPath}\n`);
	for (const [provider, stats] of Object.entries(result.results) as [
		SyncProvider,
		FetchCatalogResult["results"][SyncProvider],
	][]) {
		console.log(
			`  ${provider}: fetched=${stats.fetched} added=${stats.added} updated=${stats.updated} removed=${stats.removed}`,
		);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
