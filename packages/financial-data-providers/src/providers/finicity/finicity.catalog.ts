import type { ProviderInstitution } from "../../core/types";

export function mapFinicityInstitution(input: {
	id: string | number;
	name: string;
	url?: string | null;
	logo?: string | null;
	country?: string | null;
	products?: string[];
	oauth?: boolean | null;
	status?: string | null;
}): ProviderInstitution {
	return {
		provider: "FINICITY",
		providerInstitutionId: String(input.id),
		providerInstitutionName: input.name,
		providerInstitutionUrl: input.url ?? null,
		providerLogoUrl: input.logo ?? null,
		countryCodes: input.country ? [input.country] : [],
		supportedProducts: input.products ?? [],
		supportsOAuth: input.oauth ?? null,
		status: input.status ?? null,
		raw: input,
	};
}
