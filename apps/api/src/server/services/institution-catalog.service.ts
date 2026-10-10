import {
	type FinancialDataProvider,
	type FinancialProduct,
	INITIAL_PROVIDER_PREFERENCES,
	type InstitutionMatchConfidence,
	normalizeDomain,
	rankInstitutionSearchResults,
} from "@moat/financial-data-providers";
import { db } from "~/server/db";
import {
	captureCurrentDatabaseActor,
	isDatabaseActorContextEnabled,
	serviceDatabaseActor,
	withDatabaseActor,
	withElevatedServiceActor,
} from "~/server/db-actor";
import { databaseActorStore } from "~/server/db-actor-store";
import { getServiceSessionClient } from "~/server/service-db";

let seedPromise: Promise<void> | null = null;

export type InstitutionSearchResult = {
	canonicalInstitutionId: string;
	displayName: string;
	legalName?: string | null;
	aliases: string[];
	logoUrl?: string | null;
	website?: string | null;
	category?: string;
	recommendedProvider: FinancialDataProvider;
	availableProviders: FinancialDataProvider[];
	recommendationReason?: string;
	confidence: Exclude<InstitutionMatchConfidence, "UNMATCHED">;
	supportedProducts: {
		transactions: boolean;
		investments: boolean;
		liabilities: boolean;
		identity: boolean;
		statements: boolean;
	};
	providerMappings: Array<{
		provider: FinancialDataProvider;
		providerInstitutionId: string;
		providerInstitutionName: string;
		status?: string | null;
		supportsOAuth?: boolean | null;
	}>;
};

/**
 * Catalog tables are world-readable but service-only for writes under RLS.
 * Search / link-session run as user/demo actors, so cold-start seeding must
 * elevate (or use the session-scoped service pool) and restore afterward.
 */
export async function ensureInitialInstitutionCatalog(): Promise<void> {
	if (!seedPromise) {
		seedPromise = seedInitialInstitutionCatalog().catch((error) => {
			seedPromise = null;
			throw error;
		});
	}
	await seedPromise;
}

async function seedInitialInstitutionCatalog(): Promise<void> {
	const runSeed = () => writeInitialInstitutionCatalog();

	if (!isDatabaseActorContextEnabled()) {
		await runSeed();
		return;
	}

	// Prefer a dedicated service session so catalog upserts commit outside the
	// caller’s user transaction and stay visible to concurrent requests.
	const sessionClient = await getServiceSessionClient();
	if (sessionClient) {
		await databaseActorStore.run(sessionClient, runSeed);
		return;
	}

	const restoreTo = await captureCurrentDatabaseActor();
	if (restoreTo) {
		await withElevatedServiceActor(restoreTo, runSeed);
		return;
	}

	await withDatabaseActor(serviceDatabaseActor(), runSeed);
}

async function writeInitialInstitutionCatalog(): Promise<void> {
	for (const seed of INITIAL_PROVIDER_PREFERENCES) {
		const legalName = "legalName" in seed ? seed.legalName : null;
		const canonical = await db.canonicalInstitution.upsert({
			where: { key: seed.key },
			create: {
				key: seed.key,
				displayName: seed.displayName,
				legalName,
				aliases: seed.aliases,
				domains: seed.domains,
				website: seed.domains[0] ? `https://${seed.domains[0]}` : null,
				category: seed.category,
				countryCode: "US",
			},
			update: {
				displayName: seed.displayName,
				legalName,
				aliases: seed.aliases,
				domains: seed.domains,
				website: seed.domains[0] ? `https://${seed.domains[0]}` : null,
				category: seed.category,
				countryCode: "US",
				isActive: true,
			},
			select: { id: true },
		});

		await db.institutionProviderPreference.upsert({
			where: {
				canonicalInstitutionId_productSet: {
					canonicalInstitutionId: canonical.id,
					productSet: "transactions",
				},
			},
			create: {
				canonicalInstitutionId: canonical.id,
				productSet: "transactions",
				primaryProvider: seed.primaryProvider,
				fallbackProviders: [...seed.fallbackProviders],
				confidence: seed.confidence,
				reason: seed.reason,
			},
			update: {
				primaryProvider: seed.primaryProvider,
				fallbackProviders: [...seed.fallbackProviders],
				confidence: seed.confidence,
				reason: seed.reason,
				isActive: true,
			},
		});

		const providers = [
			seed.primaryProvider,
			...seed.fallbackProviders.filter(
				(provider) => provider !== seed.primaryProvider,
			),
		];
		for (const provider of providers) {
			await db.institutionProviderMapping.upsert({
				where: {
					provider_providerInstitutionId: {
						provider,
						providerInstitutionId: `${provider.toLowerCase()}:${seed.key}`,
					},
				},
				create: {
					canonicalInstitutionId: canonical.id,
					provider,
					providerInstitutionId: `${provider.toLowerCase()}:${seed.key}`,
					providerInstitutionName: seed.displayName,
					providerInstitutionUrl: seed.domains[0] ?? null,
					countryCodes: ["US"],
					supportedProducts: ["transactions", "identity"],
					supportsOAuth: null,
					status: "SEEDED",
					matchConfidence: seed.confidence,
					matchMethod: "initial_top_institution_seed",
					needsReview: true,
					raw: {
						source: "INITIAL_PROVIDER_PREFERENCES",
						institutionKey: seed.key,
					},
				},
				update: {
					canonicalInstitutionId: canonical.id,
					providerInstitutionName: seed.displayName,
					providerInstitutionUrl: seed.domains[0] ?? null,
					countryCodes: ["US"],
					supportedProducts: ["transactions", "identity"],
					status: "SEEDED",
					matchConfidence: seed.confidence,
					matchMethod: "initial_top_institution_seed",
					isActive: true,
				},
			});
		}
	}
}

export async function searchCanonicalInstitutions(input: {
	query: string;
	limit?: number;
}): Promise<InstitutionSearchResult[]> {
	await ensureInitialInstitutionCatalog();
	const query = input.query.trim();
	if (query.length < 2) return [];
	const domainQuery = normalizeDomain(query);

	const institutions = await db.canonicalInstitution.findMany({
		where: {
			isActive: true,
			OR: [
				{ displayName: { contains: query, mode: "insensitive" } },
				{ legalName: { contains: query, mode: "insensitive" } },
				{ aliases: { has: query } },
				...(domainQuery ? [{ domains: { has: domainQuery } }] : []),
				{
					providerMappings: {
						some: {
							isActive: true,
							providerInstitutionName: {
								contains: query,
								mode: "insensitive",
							},
						},
					},
				},
			],
		},
		include: {
			providerMappings: { where: { isActive: true } },
			providerPreferences: {
				where: { isActive: true, productSet: "transactions" },
				orderBy: [{ isManualOverride: "desc" }, { updatedAt: "desc" }],
			},
		},
		take: 500,
	});

	const ranked = rankInstitutionSearchResults(
		query,
		institutions.map((institution) => ({
			...institution,
			providerNames: institution.providerMappings.map(
				(mapping) => mapping.providerInstitutionName,
			),
		})),
	).slice(0, input.limit ?? 10);

	return ranked.map((institution) => toSearchResult(institution));
}

export async function chooseProviderForInstitution(input: {
	canonicalInstitutionId: string;
	requestedProvider?: FinancialDataProvider;
	products: FinancialProduct[];
	userId: string;
}) {
	await ensureInitialInstitutionCatalog();
	const institution = await db.canonicalInstitution.findFirstOrThrow({
		where: { id: input.canonicalInstitutionId, isActive: true },
		include: {
			providerMappings: { where: { isActive: true } },
			providerPreferences: {
				where: { isActive: true, productSet: "transactions" },
				orderBy: [{ isManualOverride: "desc" }, { updatedAt: "desc" }],
			},
		},
	});

	const allMappedProviders = uniqueProviders(
		institution.providerMappings.map((mapping) => mapping.provider),
	);
	const availableProviders = enabledProviders(allMappedProviders);

	if (input.requestedProvider) {
		if (!allMappedProviders.includes(input.requestedProvider)) {
			throw new Error(
				"Requested provider is not available for this institution",
			);
		}
		return {
			provider: input.requestedProvider,
			reason: "Provider selected from advanced connection options.",
			confidence: "MANUAL" as const,
			availableProviders,
		};
	}

	const preference = institution.providerPreferences[0];
	const preferredProvider = preference
		? [preference.primaryProvider, ...preference.fallbackProviders].find(
				(provider) => availableProviders.includes(provider),
			)
		: undefined;
	if (preference && preferredProvider) {
		return {
			provider: preferredProvider,
			reason:
				preferredProvider === preference.primaryProvider
					? (preference.reason ??
						"Preferred provider from Moat institution routing table.")
					: "Preferred provider is not enabled, so Moat will use an enabled fallback provider.",
			confidence: preference.confidence as Exclude<
				InstitutionMatchConfidence,
				"UNMATCHED"
			>,
			availableProviders,
		};
	}

	return {
		provider: availableProviders.includes("PLAID")
			? "PLAID"
			: (availableProviders[0] ?? "PLAID"),
		reason: "Default provider for general transaction sync.",
		confidence: "LOW" as const,
		availableProviders,
	};
}

type CatalogInstitution = {
	id: string;
	displayName: string;
	legalName: string | null;
	aliases: string[];
	logoUrl: string | null;
	website: string | null;
	category: string;
	providerMappings: Array<{
		provider: FinancialDataProvider;
		providerInstitutionId: string;
		providerInstitutionName: string;
		status: string | null;
		supportsOAuth: boolean | null;
		supportedProducts: string[];
	}>;
	providerPreferences: Array<{
		primaryProvider: FinancialDataProvider;
		fallbackProviders: FinancialDataProvider[];
		confidence: InstitutionMatchConfidence;
		reason: string | null;
	}>;
};

function toSearchResult(
	institution: CatalogInstitution,
): InstitutionSearchResult {
	const preference = institution.providerPreferences[0];
	const mappedProviders = uniqueProviders(
		institution.providerMappings.map((mapping) => mapping.provider),
	);
	const availableProviders = enabledProviders(mappedProviders);
	const recommendedProvider = preference
		? [preference.primaryProvider, ...preference.fallbackProviders].find(
				(provider) => availableProviders.includes(provider),
			)
		: undefined;
	const providerMappings = institution.providerMappings.filter((mapping) =>
		availableProviders.includes(mapping.provider),
	);
	const supportedProductNames = new Set(
		providerMappings.flatMap((mapping) => mapping.supportedProducts),
	);

	return {
		canonicalInstitutionId: institution.id,
		displayName: institution.displayName,
		legalName: institution.legalName,
		aliases: institution.aliases,
		logoUrl: institution.logoUrl,
		website: institution.website,
		category: institution.category,
		recommendedProvider:
			recommendedProvider ??
			(availableProviders.includes("PLAID")
				? "PLAID"
				: (availableProviders[0] ?? "PLAID")),
		availableProviders,
		recommendationReason:
			recommendedProvider === preference?.primaryProvider
				? (preference?.reason ?? undefined)
				: undefined,
		confidence:
			preference?.confidence && preference.confidence !== "UNMATCHED"
				? preference.confidence
				: "LOW",
		supportedProducts: {
			transactions:
				supportedProductNames.size === 0 ||
				supportedProductNames.has("transactions"),
			investments: supportedProductNames.has("investments"),
			liabilities: supportedProductNames.has("liabilities"),
			identity: supportedProductNames.has("identity"),
			statements: supportedProductNames.has("statements"),
		},
		providerMappings: providerMappings.map((mapping) => ({
			provider: mapping.provider,
			providerInstitutionId: mapping.providerInstitutionId,
			providerInstitutionName: mapping.providerInstitutionName,
			status: mapping.status,
			supportsOAuth: mapping.supportsOAuth,
		})),
	};
}

function uniqueProviders(
	providers: FinancialDataProvider[],
): FinancialDataProvider[] {
	return Array.from(new Set(providers.length > 0 ? providers : ["PLAID"]));
}

function enabledProviders(
	providers: FinancialDataProvider[],
): FinancialDataProvider[] {
	const enabled = new Set<FinancialDataProvider>(["PLAID"]);
	if (process.env.ENABLE_MX_CONNECTIONS === "true") enabled.add("MX");
	if (process.env.ENABLE_FINICITY_CONNECTIONS === "true") {
		enabled.add("FINICITY");
	}
	return uniqueProviders(providers.filter((provider) => enabled.has(provider)));
}
