import type { ProviderInstitution } from "../../core/types";

export function mapMxInstitution(input: {
	guid: string;
	name: string;
	url?: string | null;
	logo_url?: string | null;
	country_code?: string | null;
	products?: string[];
	oauth?: boolean | null;
	status?: string | null;
}): ProviderInstitution {
	return {
		provider: "MX",
		providerInstitutionId: input.guid,
		providerInstitutionName: input.name,
		providerInstitutionUrl: input.url ?? null,
		providerLogoUrl: input.logo_url ?? null,
		countryCodes: input.country_code ? [input.country_code] : [],
		supportedProducts: input.products ?? [],
		supportsOAuth: input.oauth ?? null,
		status: input.status ?? null,
		raw: input,
	};
}
