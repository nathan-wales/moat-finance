import type { ProviderInstitution } from "../../core/types";

export function mapPlaidInstitution(input: {
	institution_id: string;
	name: string;
	url?: string | null;
	logo?: string | null;
	country_codes?: string[];
	products?: string[];
	oauth?: boolean | null;
	status?: unknown;
}): ProviderInstitution {
	return {
		provider: "PLAID",
		providerInstitutionId: input.institution_id,
		providerInstitutionName: input.name,
		providerInstitutionUrl: input.url ?? null,
		providerLogoUrl: input.logo ?? null,
		countryCodes: input.country_codes ?? [],
		supportedProducts: input.products ?? [],
		supportsOAuth: input.oauth ?? null,
		status: input.status ? JSON.stringify(input.status) : null,
		raw: input,
	};
}
