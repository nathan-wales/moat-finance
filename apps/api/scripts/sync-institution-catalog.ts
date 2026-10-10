import path from "node:path";
import {
	type ApplyCatalogResult,
	type FetchCatalogResult,
	type InstitutionCatalogSyncResult,
	type SyncProvider,
	syncInstitutionCatalog,
} from "../src/server/services/institution-catalog-sync.service";

const VALID_PROVIDERS = ["PLAID", "MX", "FINICITY"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

const DEFAULT_SNAPSHOT_PATH = path.resolve(
	process.cwd(),
	"data/institution-catalog.json",
);

async function main() {
	const providers = parseProviders(process.argv.slice(2));
	const snapshotPath =
		parseFlag(process.argv.slice(2), "--snapshot=") ?? DEFAULT_SNAPSHOT_PATH;

	console.log(`Snapshot: ${snapshotPath}`);
	console.log(`Providers: ${providers.join(", ")}`);

	const result = await syncInstitutionCatalog({ providers, snapshotPath });
	printSummary(result);
}

function parseProviders(args: string[]): Provider[] {
	const providerArg = args.find((arg) => arg.startsWith("--providers="));
	if (!providerArg) return [...VALID_PROVIDERS];

	const requested = providerArg
		.replace("--providers=", "")
		.split(",")
		.map((provider) => provider.trim().toUpperCase())
		.filter((provider) => provider.length > 0);

	const providers: Provider[] = [];
	for (const provider of requested) {
		if (!isProvider(provider)) {
			throw new Error(
				`Unknown provider "${provider}". Expected one of: ${VALID_PROVIDERS.join(", ")}`,
			);
		}
		providers.push(provider);
	}
	return providers.length > 0 ? providers : [...VALID_PROVIDERS];
}

function parseFlag(args: string[], prefix: string): string | null {
	const arg = args.find((a) => a.startsWith(prefix));
	return arg ? arg.slice(prefix.length) : null;
}

function isProvider(value: string): value is Provider {
	return VALID_PROVIDERS.some((provider) => provider === value);
}

function printSummary(result: InstitutionCatalogSyncResult) {
	console.log("\n--- Fetch ---");
	printFetchSummary(result.fetch);
	console.log("\n--- Apply ---");
	printApplySummary(result.apply);
}

function printFetchSummary(result: FetchCatalogResult) {
	console.log(`Snapshot written to: ${result.snapshotPath}`);
	for (const [provider, stats] of Object.entries(result.results) as [
		SyncProvider,
		FetchCatalogResult["results"][SyncProvider],
	][]) {
		console.log(
			`  ${provider}: fetched=${stats.fetched} added=${stats.added} updated=${stats.updated} removed=${stats.removed}`,
		);
	}
}

function printApplySummary(result: ApplyCatalogResult) {
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
