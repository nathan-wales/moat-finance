/**
 * Fetches institution catalogs from all configured providers and writes a
 * snapshot JSON file. This is step 1 of the two-phase sync:
 *   1. fetch → apps/api/data/institution-catalog.json
 *   2. apply → reads that file and bulk-upserts into the database
 *
 * Design notes:
 * - No DB writes happen here. Provider API credentials are required.
 * - Plaid base64 logos are skipped (data: URIs would bloat the file by 100s of MB).
 * - A content hash is computed per institution so the apply step can skip unchanged rows.
 * - The snapshot carries metadata (syncedAt, per-provider stats, change reasons) that
 *   would be lost in a direct provider→DB approach.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ProviderInstitution } from "@moat/financial-data-providers";
import {
	mapFinicityInstitution,
	mapMxInstitution,
	mapPlaidInstitution,
} from "@moat/financial-data-providers";
import { CountryCode, type Institution as PlaidInstitution } from "plaid";
import { getPlaidClient } from "~/server/lib/plaidClient";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SyncProvider = "PLAID" | "MX" | "FINICITY";

export type CatalogEntry = {
	provider: SyncProvider;
	providerInstitutionId: string;
	providerInstitutionName: string;
	providerInstitutionUrl: string | null;
	/** Null for Plaid (base64 logos are excluded to keep file size reasonable). */
	providerLogoUrl: string | null;
	countryCodes: string[];
	supportedProducts: string[];
	supportsOAuth: boolean | null;
	status: string | null;
	/** SHA-256 of the stable fields above — used by the apply step to skip unchanged rows. */
	contentHash: string;
	/** ISO timestamp — set when this entry first appeared in the snapshot. */
	firstSeenAt: string;
	/** ISO timestamp — updated whenever contentHash changes. */
	lastChangedAt: string;
	/** Human-readable description of what changed since the previous snapshot. */
	changeReason: string | null;
};

export type ProviderFetchStats = {
	total: number;
	added: number;
	updated: number;
	removed: number;
};

export type CatalogSnapshot = {
	version: number;
	/** When provider APIs were last fetched. */
	syncedAt: string;
	/** When the DB was last updated from this file (set by the apply step). */
	appliedAt: string | null;
	stats: Record<SyncProvider, ProviderFetchStats>;
	institutions: CatalogEntry[];
};

export type FetchCatalogResult = {
	results: Record<
		SyncProvider,
		{ fetched: number; added: number; updated: number; removed: number }
	>;
	snapshotPath: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 500;
const MX_DEFAULT_BASE_URL = "https://api.mx.com";
const FINICITY_DEFAULT_BASE_URL = "https://api.finicity.com";
const SNAPSHOT_VERSION = 1;

const PLAID_COUNTRY_CODES: Record<string, CountryCode> = {
	AT: CountryCode.At,
	BE: CountryCode.Be,
	CA: CountryCode.Ca,
	DE: CountryCode.De,
	DK: CountryCode.Dk,
	EE: CountryCode.Ee,
	ES: CountryCode.Es,
	FI: CountryCode.Fi,
	FR: CountryCode.Fr,
	GB: CountryCode.Gb,
	IE: CountryCode.Ie,
	IT: CountryCode.It,
	LT: CountryCode.Lt,
	LV: CountryCode.Lv,
	NL: CountryCode.Nl,
	NO: CountryCode.No,
	PL: CountryCode.Pl,
	PT: CountryCode.Pt,
	SE: CountryCode.Se,
	US: CountryCode.Us,
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function fetchInstitutionCatalog(
	snapshotPath: string,
	input?: {
		providers?: SyncProvider[];
		pageSize?: number;
	},
): Promise<FetchCatalogResult> {
	const providers = input?.providers ?? ["PLAID", "MX", "FINICITY"];
	const pageSize = input?.pageSize ?? DEFAULT_PAGE_SIZE;
	const now = new Date().toISOString();

	// Load existing snapshot so we can diff against it.
	const existing = await loadSnapshot(snapshotPath);
	const existingByKey = buildExistingMap(existing?.institutions ?? []);

	const allInstitutions: CatalogEntry[] = [];
	const results = {} as FetchCatalogResult["results"];

	for (const provider of providers) {
		const fetched = await fetchProvider(provider, pageSize);
		const { entries, added, updated, removed } = diffInstitutions(
			provider,
			fetched,
			existingByKey,
			now,
		);
		allInstitutions.push(...entries);
		results[provider] = { fetched: fetched.length, added, updated, removed };
	}

	// Preserve entries from providers that were NOT re-fetched this run.
	for (const provider of (["PLAID", "MX", "FINICITY"] as SyncProvider[]).filter(
		(p) => !providers.includes(p),
	)) {
		const preserved = (existing?.institutions ?? []).filter(
			(e) => e.provider === provider,
		);
		allInstitutions.push(...preserved);
	}

	const snapshot: CatalogSnapshot = {
		version: SNAPSHOT_VERSION,
		syncedAt: now,
		appliedAt: existing?.appliedAt ?? null,
		stats: {
			PLAID: results.PLAID
				? toProviderStats(
						results.PLAID.fetched,
						results.PLAID.added,
						results.PLAID.updated,
						results.PLAID.removed,
					)
				: (existing?.stats.PLAID ?? emptyStats()),
			MX: results.MX
				? toProviderStats(
						results.MX.fetched,
						results.MX.added,
						results.MX.updated,
						results.MX.removed,
					)
				: (existing?.stats.MX ?? emptyStats()),
			FINICITY: results.FINICITY
				? toProviderStats(
						results.FINICITY.fetched,
						results.FINICITY.added,
						results.FINICITY.updated,
						results.FINICITY.removed,
					)
				: (existing?.stats.FINICITY ?? emptyStats()),
		},
		institutions: allInstitutions,
	};

	await writeSnapshot(snapshotPath, snapshot);

	return { results, snapshotPath };
}

// ---------------------------------------------------------------------------
// Provider fetchers
// ---------------------------------------------------------------------------

async function fetchProvider(
	provider: SyncProvider,
	pageSize: number,
): Promise<ProviderInstitution[]> {
	if (provider === "PLAID") return fetchPlaid(pageSize);
	if (provider === "MX") return fetchMx(pageSize);
	return fetchFinicity(pageSize);
}

async function fetchPlaid(pageSize: number): Promise<ProviderInstitution[]> {
	const client = getPlaidClient();
	const countryCodes = parsePlaidCountryCodes(
		process.env.PLAID_COUNTRY_CODES ?? "US",
	);
	let offset = 0;
	let total = Number.POSITIVE_INFINITY;
	const all: ProviderInstitution[] = [];

	while (offset < total) {
		const response = await client.institutionsGet({
			count: pageSize,
			offset,
			country_codes: countryCodes,
			options: { include_optional_metadata: true },
		});
		const institutions = response.data.institutions.map((institution) =>
			mapPlaidInstitution(toPlaidCatalogInput(institution)),
		);
		all.push(...institutions);
		total = response.data.total;
		offset += pageSize;
		if (institutions.length === 0) break;
	}

	return all;
}

async function fetchMx(pageSize: number): Promise<ProviderInstitution[]> {
	const baseUrl = trimTrailingSlash(
		process.env.MX_BASE_URL ?? MX_DEFAULT_BASE_URL,
	);
	const clientId = requireEnv("MX_CLIENT_ID");
	const apiKey = requireEnv("MX_API_KEY");
	let page = 1;
	let totalPages = Number.POSITIVE_INFINITY;
	const all: ProviderInstitution[] = [];

	while (page <= totalPages) {
		const url = new URL(`${baseUrl}/institutions`);
		url.searchParams.set("page", String(page));
		url.searchParams.set("records_per_page", String(pageSize));
		const body = await fetchJsonRecord(url, {
			headers: {
				Accept: "application/vnd.mx.api.v1+json",
				Authorization: `Basic ${Buffer.from(`${clientId}:${apiKey}`).toString("base64")}`,
			},
		});
		const institutions = readRecordArray(body, "institutions")
			.map(toMxCatalogInput)
			.filter((institution) => institution !== null)
			.map(mapMxInstitution);
		all.push(...institutions);

		const pagination = readRecord(body, "pagination");
		totalPages = readNumber(pagination, "total_pages") ?? page;
		page++;
		if (institutions.length === 0) break;
	}

	return all;
}

async function fetchFinicity(pageSize: number): Promise<ProviderInstitution[]> {
	const baseUrl = trimTrailingSlash(
		process.env.FINICITY_BASE_URL ?? FINICITY_DEFAULT_BASE_URL,
	);
	const token = await getFinicityAppToken(baseUrl);
	const appKey = requireEnv("FINICITY_APP_KEY");
	let start = 1;
	const all: ProviderInstitution[] = [];

	while (true) {
		const url = new URL(`${baseUrl}/institution/v2/institutions`);
		url.searchParams.set("start", String(start));
		url.searchParams.set("limit", String(pageSize));
		const body = await fetchJsonRecord(url, {
			headers: {
				Accept: "application/json",
				"Finicity-App-Key": appKey,
				"Finicity-App-Token": token,
			},
		});
		const institutions = readRecordArray(body, "institutions")
			.map(toFinicityCatalogInput)
			.filter((institution) => institution !== null)
			.map(mapFinicityInstitution);
		all.push(...institutions);

		if (!readBoolean(body, "moreAvailable") || institutions.length === 0) break;
		start += institutions.length;
	}

	return all;
}

async function getFinicityAppToken(baseUrl: string): Promise<string> {
	const body = await fetchJsonRecord(
		new URL(`${baseUrl}/aggregation/v2/partners/authentication`),
		{
			body: JSON.stringify({
				partnerId: requireEnv("FINICITY_PARTNER_ID"),
				partnerSecret: requireEnv("FINICITY_PARTNER_SECRET"),
			}),
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"Finicity-App-Key": requireEnv("FINICITY_APP_KEY"),
			},
			method: "POST",
		},
	);
	const token = readString(body, "token");
	if (!token) throw new Error("Finicity authentication did not return a token");
	return token;
}

// ---------------------------------------------------------------------------
// Diffing & catalog entry construction
// ---------------------------------------------------------------------------

function diffInstitutions(
	provider: SyncProvider,
	fetched: ProviderInstitution[],
	existingByKey: Map<string, CatalogEntry>,
	now: string,
): {
	entries: CatalogEntry[];
	added: number;
	updated: number;
	removed: number;
} {
	const entries: CatalogEntry[] = [];
	let added = 0;
	let updated = 0;

	const seenKeys = new Set<string>();

	for (const institution of fetched) {
		const entryKey = `${institution.provider}:${institution.providerInstitutionId}`;
		seenKeys.add(entryKey);

		// Skip Plaid base64 logos — they are data: URIs that would add hundreds
		// of MB to the snapshot file. Real URLs from MX/Finicity are kept.
		const logoUrl =
			institution.providerLogoUrl?.startsWith("data:") === true
				? null
				: (institution.providerLogoUrl ?? null);

		const hash = computeContentHash(institution);
		const existing = existingByKey.get(entryKey);

		if (!existing) {
			entries.push({
				provider,
				providerInstitutionId: institution.providerInstitutionId,
				providerInstitutionName: institution.providerInstitutionName,
				providerInstitutionUrl: institution.providerInstitutionUrl ?? null,
				providerLogoUrl: logoUrl,
				countryCodes: institution.countryCodes,
				supportedProducts: institution.supportedProducts,
				supportsOAuth: institution.supportsOAuth ?? null,
				status: institution.status ?? null,
				contentHash: hash,
				firstSeenAt: now,
				lastChangedAt: now,
				changeReason: null,
			});
			added++;
		} else if (existing.contentHash !== hash) {
			entries.push({
				...existing,
				providerInstitutionName: institution.providerInstitutionName,
				providerInstitutionUrl: institution.providerInstitutionUrl ?? null,
				providerLogoUrl: logoUrl,
				countryCodes: institution.countryCodes,
				supportedProducts: institution.supportedProducts,
				supportsOAuth: institution.supportsOAuth ?? null,
				status: institution.status ?? null,
				contentHash: hash,
				lastChangedAt: now,
				changeReason: buildChangeReason(existing, institution),
			});
			updated++;
		} else {
			// Unchanged — carry forward as-is.
			entries.push(existing);
		}
	}

	// Count entries that existed before but were not returned this time.
	const removed = [...existingByKey.keys()].filter(
		(key) => key.startsWith(`${provider}:`) && !seenKeys.has(key),
	).length;

	return { entries, added, updated, removed };
}

function buildChangeReason(
	prev: CatalogEntry,
	next: ProviderInstitution,
): string {
	const reasons: string[] = [];
	if (prev.providerInstitutionName !== next.providerInstitutionName) {
		reasons.push("name updated");
	}
	if (prev.providerInstitutionUrl !== (next.providerInstitutionUrl ?? null)) {
		reasons.push("url updated");
	}
	if (
		JSON.stringify([...prev.supportedProducts].sort()) !==
		JSON.stringify([...next.supportedProducts].sort())
	) {
		reasons.push("products updated");
	}
	if (prev.supportsOAuth !== (next.supportsOAuth ?? null)) {
		reasons.push("oauth updated");
	}
	if (prev.status !== (next.status ?? null)) {
		reasons.push("status updated");
	}
	return reasons.length > 0 ? reasons.join(", ") : "fields updated";
}

function computeContentHash(institution: ProviderInstitution): string {
	const payload = JSON.stringify({
		id: institution.providerInstitutionId,
		name: institution.providerInstitutionName,
		url: institution.providerInstitutionUrl ?? null,
		codes: [...institution.countryCodes].sort(),
		products: [...institution.supportedProducts].sort(),
		oauth: institution.supportsOAuth ?? null,
		status: institution.status ?? null,
	});
	return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Snapshot I/O
// ---------------------------------------------------------------------------

async function loadSnapshot(path: string): Promise<CatalogSnapshot | null> {
	if (!existsSync(path)) return null;
	try {
		const raw = await readFile(path, "utf-8");
		return JSON.parse(raw) as CatalogSnapshot;
	} catch {
		return null;
	}
}

async function writeSnapshot(
	path: string,
	snapshot: CatalogSnapshot,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, JSON.stringify(snapshot, null, 2), "utf-8");
}

function buildExistingMap(entries: CatalogEntry[]): Map<string, CatalogEntry> {
	const map = new Map<string, CatalogEntry>();
	for (const entry of entries) {
		map.set(`${entry.provider}:${entry.providerInstitutionId}`, entry);
	}
	return map;
}

// ---------------------------------------------------------------------------
// Provider input adapters (identical to the original sync service)
// ---------------------------------------------------------------------------

function toPlaidCatalogInput(institution: PlaidInstitution) {
	return {
		institution_id: institution.institution_id,
		name: institution.name,
		url: institution.url,
		// Pass the raw base64 through — computeContentHash never touches logos,
		// and the diffing step strips data: URIs before writing to JSON.
		logo: institution.logo ? `data:image/png;base64,${institution.logo}` : null,
		country_codes: institution.country_codes,
		products: institution.products,
		oauth: institution.oauth,
		status: institution.status,
	};
}

function toMxCatalogInput(record: JsonRecord) {
	const guid = readString(record, "guid");
	const name = readString(record, "name");
	if (!guid || !name) return null;
	return {
		guid,
		name,
		url: readString(record, "url") ?? readString(record, "website"),
		logo_url:
			readString(record, "logo_url") ??
			readString(record, "medium_logo_url") ??
			readString(record, "small_logo_url"),
		country_code: readString(record, "country_code"),
		products: mxProducts(record),
		oauth: readBoolean(record, "supports_oauth"),
		status: readString(record, "status"),
	};
}

function toFinicityCatalogInput(record: JsonRecord) {
	const id = readString(record, "id") ?? readNumber(record, "id");
	const name = readString(record, "name");
	if (!id || !name) return null;
	return {
		id,
		name,
		url:
			readString(record, "url") ??
			readString(record, "homeUrl") ??
			readString(record, "urlHomeApp"),
		logo: readString(record, "logo") ?? readString(record, "logoUrl"),
		country: readString(record, "country") ?? readString(record, "countryCode"),
		products: finicityProducts(record),
		oauth: readBoolean(record, "oauthEnabled"),
		status: readString(record, "status"),
	};
}

function mxProducts(record: JsonRecord): string[] {
	const products = readStringArray(record, "products");
	if (products.length > 0) return products;
	return [
		readBoolean(record, "supports_transaction_history") ? "transactions" : null,
		readBoolean(record, "supports_account_identification") ? "identity" : null,
		readBoolean(record, "supports_account_verification") ? "identity" : null,
		readBoolean(record, "supports_account_statement") ? "statements" : null,
	].filter((product) => product !== null);
}

function finicityProducts(record: JsonRecord): string[] {
	const products = readStringArray(record, "products");
	if (products.length > 0) return products;
	return [
		readBoolean(record, "transAgg") ? "transactions" : null,
		readBoolean(record, "accountOwner") ? "identity" : null,
		readBoolean(record, "voa") ? "identity" : null,
		readBoolean(record, "voi") ? "identity" : null,
		readBoolean(record, "ach") ? "identity" : null,
		readBoolean(record, "stateAgg") ? "statements" : null,
	].filter((product) => product !== null);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePlaidCountryCodes(value: string): CountryCode[] {
	const parsed = value
		.split(",")
		.map((code) => PLAID_COUNTRY_CODES[code.trim().toUpperCase()])
		.filter((code) => code !== undefined);
	return parsed.length > 0 ? parsed : [CountryCode.Us];
}

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value)
		throw new Error(`${name} must be set to fetch institution catalog`);
	return value;
}

function emptyStats(): ProviderFetchStats {
	return { total: 0, added: 0, updated: 0, removed: 0 };
}

function toProviderStats(
	fetched: number,
	added: number,
	updated: number,
	removed: number,
): ProviderFetchStats {
	return { total: fetched, added, updated, removed };
}

type JsonRecord = Record<string, unknown>;

async function fetchJsonRecord(
	url: URL,
	init: RequestInit,
): Promise<JsonRecord> {
	const response = await fetch(url, init);
	if (!response.ok) {
		throw new Error(
			`Provider catalog request failed: ${response.status} ${response.statusText}`,
		);
	}
	const body: unknown = await response.json();
	if (!isRecord(body))
		throw new Error("Provider catalog response was not an object");
	return body;
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(record: JsonRecord, key: string): JsonRecord | null {
	const value = record[key];
	return isRecord(value) ? value : null;
}

function readRecordArray(record: JsonRecord, key: string): JsonRecord[] {
	const value = record[key];
	if (!Array.isArray(value)) return [];
	return value.filter(isRecord);
}

function readString(record: JsonRecord | null, key: string): string | null {
	if (!record) return null;
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(record: JsonRecord | null, key: string): number | null {
	if (!record) return null;
	const value = record[key];
	return typeof value === "number" ? value : null;
}

function readBoolean(record: JsonRecord, key: string): boolean | null {
	const value = record[key];
	return typeof value === "boolean" ? value : null;
}

function readStringArray(record: JsonRecord, key: string): string[] {
	const value = record[key];
	if (!Array.isArray(value)) return [];
	return value.filter((item) => typeof item === "string");
}
