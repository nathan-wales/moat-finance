/**
 * Applies an institution catalog snapshot to the database.
 * This is step 2 of the two-phase sync:
 *   1. fetch → apps/api/data/institution-catalog.json
 *   2. apply → reads that file and bulk-upserts into the database
 *
 * Performance strategy:
 * - Load ALL existing CanonicalInstitution rows into memory (1 query).
 * - Load ALL existing InstitutionProviderMapping rows into memory (1 query).
 * - Process every snapshot entry in-memory to build insert/update buckets.
 * - Write new canonicals with createMany (batches of 500).
 * - Write new mappings with createMany (batches of 500).
 * - Write ALL existing mappings in batched $transaction[update] (groups of 100).
 * - Update appliedAt in the JSON file.
 *
 * Change detection lives in the snapshot: the fetch step stamps contentHash
 * per entry and tracks lastChangedAt / changeReason. The apply step updates
 * the DB from the current snapshot on every run (new canonicals + all mappings).
 *
 * For a full initial sync (~46 k institutions) this reduces ~230 k individual
 * round-trips to roughly 200 batched queries.
 */

import { readFile, writeFile } from "node:fs/promises";
import {
	normalizeDomain,
	normalizeInstitutionText,
} from "@moat/financial-data-providers";
import {
	type FinancialDataProvider,
	InstitutionCategory,
} from "../../../generated/prisma";
import { db } from "../db";
import type {
	CatalogSnapshot,
	SyncProvider,
} from "./institution-catalog-fetch.service";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ApplyCatalogResult = {
	canonicalCreated: number;
	mappingsCreated: number;
	mappingsUpdated: number;
	providers: Record<SyncProvider, { created: number; updated: number }>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CREATE_BATCH_SIZE = 500;
const UPDATE_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function applyInstitutionCatalog(
	snapshotPath: string,
): Promise<ApplyCatalogResult> {
	const snapshot = await loadSnapshot(snapshotPath);
	const { institutions } = snapshot;

	// ------------------------------------------------------------------
	// Phase 1: Load all existing data into memory (2 queries total).
	// ------------------------------------------------------------------
	const [existingCanonicals, existingMappings] = await Promise.all([
		db.canonicalInstitution.findMany({
			select: {
				id: true,
				key: true,
				domains: true,
				aliases: true,
				logoUrl: true,
				website: true,
				countryCode: true,
			},
		}),
		db.institutionProviderMapping.findMany({
			select: {
				provider: true,
				providerInstitutionId: true,
				canonicalInstitutionId: true,
			},
		}),
	]);

	// Build lookup maps.
	const canonicalByKey = new Map(existingCanonicals.map((c) => [c.key, c]));
	const canonicalByDomain = new Map(
		existingCanonicals.flatMap((c) => c.domains.map((d) => [d, c])),
	);
	const canonicalById = new Map(existingCanonicals.map((c) => [c.id, c]));
	const mappingKey = (provider: string, id: string) => `${provider}:${id}`;
	const mappingByKey = new Map(
		existingMappings.map((m) => [
			mappingKey(m.provider, m.providerInstitutionId),
			m,
		]),
	);

	// ------------------------------------------------------------------
	// Phase 2: Process entries in memory.
	// ------------------------------------------------------------------
	type NewCanonical = Parameters<
		typeof db.canonicalInstitution.create
	>[0]["data"];
	type NewMapping = Parameters<
		typeof db.institutionProviderMapping.create
	>[0]["data"];
	type UpdateMapping = {
		provider: FinancialDataProvider;
		providerInstitutionId: string;
		data: {
			canonicalInstitutionId: string;
			providerInstitutionName: string;
			providerInstitutionUrl: string | null;
			providerLogoUrl: string | null;
			countryCodes: string[];
			supportedProducts: string[];
			supportsOAuth: boolean | null;
			status: string | null;
			lastSeenAt: Date;
			lastSyncedAt: Date;
			isActive: boolean;
		};
	};

	const newCanonicals: NewCanonical[] = [];
	const newMappings: NewMapping[] = [];
	const updateMappings: UpdateMapping[] = [];

	const providerStats: ApplyCatalogResult["providers"] = {
		PLAID: { created: 0, updated: 0 },
		MX: { created: 0, updated: 0 },
		FINICITY: { created: 0, updated: 0 },
	};

	for (const entry of institutions) {
		const domain = entry.providerInstitutionUrl
			? normalizeDomain(entry.providerInstitutionUrl)
			: null;
		const key = createInstitutionKey(entry.providerInstitutionName, domain);
		const mKey = mappingKey(entry.provider, entry.providerInstitutionId);
		const existingMapping = mappingByKey.get(mKey);

		// Resolve or create canonical institution.
		let canonicalId: string;

		if (existingMapping?.canonicalInstitutionId) {
			// Already mapped to a canonical — use it.
			canonicalId = existingMapping.canonicalInstitutionId;
		} else {
			// Try to find by domain first, then by key.
			const matched =
				(domain ? canonicalByDomain.get(domain) : null) ??
				canonicalByKey.get(key);

			if (matched) {
				canonicalId = matched.id;
			} else {
				// Brand-new institution — create a canonical for it.
				const newId = crypto.randomUUID();
				const newCanonical = {
					id: newId,
					key,
					displayName: entry.providerInstitutionName,
					aliases: [] as string[],
					domains: domain ? [domain] : ([] as string[]),
					logoUrl: entry.providerLogoUrl ?? null,
					website: domain ? `https://${domain}` : null,
					category: classifyInstitution(entry.providerInstitutionName),
					countryCode: entry.countryCodes[0] ?? null,
					isActive: true,
				};
				newCanonicals.push(newCanonical);

				// Update in-memory maps so later entries from other providers
				// can find this canonical without hitting the DB.
				const inMemory = { ...newCanonical, domains: newCanonical.domains };
				canonicalById.set(newId, inMemory);
				canonicalByKey.set(key, inMemory);
				if (domain) canonicalByDomain.set(domain, inMemory);

				canonicalId = newId;
			}
		}

		const normalizedProducts = normalizeSupportedProducts(
			entry.supportedProducts,
		);

		if (!existingMapping) {
			// New mapping — will be created via createMany.
			newMappings.push({
				canonicalInstitutionId: canonicalId,
				provider: entry.provider as FinancialDataProvider,
				providerInstitutionId: entry.providerInstitutionId,
				providerInstitutionName: entry.providerInstitutionName,
				providerInstitutionUrl: entry.providerInstitutionUrl ?? null,
				providerLogoUrl: entry.providerLogoUrl ?? null,
				countryCodes: entry.countryCodes,
				supportedProducts: normalizedProducts,
				supportsOAuth: entry.supportsOAuth ?? null,
				status: entry.status ?? null,
				matchConfidence: "HIGH",
				matchMethod: "provider_catalog_sync",
				needsReview: false,
				raw: { source: "catalog_sync" },
				isActive: true,
			});
			providerStats[entry.provider].created++;
		} else {
			// Existing mapping — always refresh provider fields so data stays current.
			updateMappings.push({
				provider: entry.provider as FinancialDataProvider,
				providerInstitutionId: entry.providerInstitutionId,
				data: {
					canonicalInstitutionId: canonicalId,
					providerInstitutionName: entry.providerInstitutionName,
					providerInstitutionUrl: entry.providerInstitutionUrl ?? null,
					providerLogoUrl: entry.providerLogoUrl ?? null,
					countryCodes: entry.countryCodes,
					supportedProducts: normalizedProducts,
					supportsOAuth: entry.supportsOAuth ?? null,
					status: entry.status ?? null,
					lastSeenAt: new Date(),
					lastSyncedAt: new Date(),
					isActive: true,
				},
			});
			providerStats[entry.provider].updated++;
		}
	}

	// ------------------------------------------------------------------
	// Phase 3: Bulk writes.
	// ------------------------------------------------------------------

	// 3a. Create new canonical institutions.
	for (const batch of chunk(newCanonicals, CREATE_BATCH_SIZE)) {
		await db.canonicalInstitution.createMany({
			data: batch,
			skipDuplicates: true,
		});
	}

	// 3b. Create new mappings.
	for (const batch of chunk(newMappings, CREATE_BATCH_SIZE)) {
		await db.institutionProviderMapping.createMany({
			data: batch,
			skipDuplicates: true,
		});
	}

	// 3c. Update changed mappings in batched transactions.
	for (const batch of chunk(updateMappings, UPDATE_BATCH_SIZE)) {
		await db.$transaction(
			batch.map(({ provider, providerInstitutionId, data }) =>
				db.institutionProviderMapping.update({
					where: {
						provider_providerInstitutionId: {
							provider,
							providerInstitutionId,
						},
					},
					data,
				}),
			),
		);
	}

	// ------------------------------------------------------------------
	// Phase 4: Stamp appliedAt in the snapshot file.
	// ------------------------------------------------------------------
	await stampAppliedAt(snapshotPath);

	const canonicalCreated = newCanonicals.length;
	const mappingsCreated = newMappings.length;
	const mappingsUpdated = updateMappings.length;

	return {
		canonicalCreated,
		mappingsCreated,
		mappingsUpdated,
		providers: providerStats,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadSnapshot(path: string): Promise<CatalogSnapshot> {
	const raw = await readFile(path, "utf-8");
	return JSON.parse(raw) as CatalogSnapshot;
}

async function stampAppliedAt(path: string): Promise<void> {
	const raw = await readFile(path, "utf-8");
	const snapshot = JSON.parse(raw) as CatalogSnapshot;
	snapshot.appliedAt = new Date().toISOString();
	await writeFile(path, JSON.stringify(snapshot, null, 2), "utf-8");
}

function createInstitutionKey(name: string, domain: string | null): string {
	const base = domain?.split(".")[0] ?? normalizeInstitutionText(name);
	return (
		base
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_+|_+$/g, "") || "institution"
	);
}

function classifyInstitution(name: string): InstitutionCategory {
	const normalized = normalizeInstitutionText(name);
	if (normalized.includes("credit union"))
		return InstitutionCategory.CREDIT_UNION;
	if (/\b(card|credit card)\b/.test(normalized))
		return InstitutionCategory.CREDIT_CARD;
	if (
		/\b(vanguard|fidelity|schwab|etrade|investment|brokerage)\b/.test(
			normalized,
		)
	) {
		return InstitutionCategory.INVESTMENT;
	}
	if (/\b(coinbase|crypto)\b/.test(normalized))
		return InstitutionCategory.CRYPTO;
	if (/\b(loan|mortgage|student loan)\b/.test(normalized))
		return InstitutionCategory.LOAN;
	if (/\b(payroll|adp|paychex)\b/.test(normalized))
		return InstitutionCategory.PAYROLL;
	if (/\b(chime|sofi|paypal|venmo|cash app|cashapp)\b/.test(normalized)) {
		return InstitutionCategory.FINTECH;
	}
	return InstitutionCategory.BANK;
}

function normalizeSupportedProducts(products: string[]): string[] {
	const normalized = products.flatMap((product) => {
		const value = product.toLowerCase();
		if (value === "transactions" || value === "transaction_history")
			return ["transactions"];
		if (value === "investments") return ["investments"];
		if (value === "liabilities") return ["liabilities"];
		if (value === "identity" || value === "auth" || value === "voa")
			return ["identity"];
		if (value === "statements" || value === "statement") return ["statements"];
		return [];
	});
	return Array.from(new Set(normalized));
}

function chunk<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}
