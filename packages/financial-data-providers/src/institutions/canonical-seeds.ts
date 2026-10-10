import { INITIAL_PROVIDER_PREFERENCES } from "./provider-preferences";

export const CANONICAL_INSTITUTION_SEEDS = INITIAL_PROVIDER_PREFERENCES.map(
	(preference) => ({
		key: preference.key,
		displayName: preference.displayName,
		legalName: "legalName" in preference ? preference.legalName : undefined,
		aliases: preference.aliases,
		domains: preference.domains,
		category: preference.category,
		preferredProvider: preference.primaryProvider,
		fallbackProviders: preference.fallbackProviders,
	}),
);
