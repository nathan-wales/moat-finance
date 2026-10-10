import path from "node:path";
import {
	type ApplyCatalogResult,
	applyInstitutionCatalog,
} from "./institution-catalog-apply.service";
import {
	type FetchCatalogResult,
	fetchInstitutionCatalog,
	type SyncProvider,
} from "./institution-catalog-fetch.service";

export type { ApplyCatalogResult } from "./institution-catalog-apply.service";
export type {
	FetchCatalogResult,
	SyncProvider,
} from "./institution-catalog-fetch.service";

export type InstitutionCatalogSyncResult = {
	fetch: FetchCatalogResult;
	apply: ApplyCatalogResult;
};

const DEFAULT_SNAPSHOT_PATH = path.resolve(
	process.cwd(),
	"data/institution-catalog.json",
);

/**
 * Runs the full two-phase sync:
 *   1. Fetch institution catalogs from providers → write snapshot JSON.
 *   2. Read snapshot JSON → bulk-upsert into the database.
 */
export async function syncInstitutionCatalog(input?: {
	providers?: SyncProvider[];
	pageSize?: number;
	snapshotPath?: string;
}): Promise<InstitutionCatalogSyncResult> {
	const snapshotPath = input?.snapshotPath ?? DEFAULT_SNAPSHOT_PATH;

	const fetch = await fetchInstitutionCatalog(snapshotPath, {
		providers: input?.providers,
		pageSize: input?.pageSize,
	});

	const apply = await applyInstitutionCatalog(snapshotPath);

	return { fetch, apply };
}
