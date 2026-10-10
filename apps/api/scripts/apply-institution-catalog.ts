/**
 * Reads the institution catalog snapshot JSON and bulk-upserts into the database.
 * Does NOT call any provider APIs.
 *
 * Usage:
 *   pnpm --filter moat-api run sync:apply
 *   pnpm --filter moat-api run sync:apply -- --snapshot=/path/to/catalog.json
 */

import path from "node:path";
import type {
	ApplyCatalogResult,
	SyncProvider,
} from "../src/server/services/institution-catalog-apply.service";
import { applyInstitutionCatalog } from "../src/server/services/institution-catalog-apply.service";

const DEFAULT_SNAPSHOT_PATH = path.resolve(
	process.cwd(),
	"data/institution-catalog.json",
);

async function main() {
	const args = process.argv.slice(2);
	const snapshotPath = parseFlag(args, "--snapshot=") ?? DEFAULT_SNAPSHOT_PATH;

	console.log(`Reading snapshot: ${snapshotPath}`);
	console.log("Applying to database...\n");

	const result = await applyInstitutionCatalog(snapshotPath);
	printSummary(result);
}

function parseFlag(args: string[], prefix: string): string | null {
	const arg = args.find((a) => a.startsWith(prefix));
	return arg ? arg.slice(prefix.length) : null;
}

function printSummary(result: ApplyCatalogResult) {
	console.log("Apply complete.");
	console.log(
		`  canonical_created=${result.canonicalCreated} mappings_created=${result.mappingsCreated} mappings_updated=${result.mappingsUpdated}`,
	);
	for (const [provider, stats] of Object.entries(result.providers) as [
		SyncProvider,
		ApplyCatalogResult["providers"][SyncProvider],
	][]) {
		console.log(
			`  ${provider}: created=${stats.created} updated=${stats.updated}`,
		);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
