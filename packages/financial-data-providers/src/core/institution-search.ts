import { scoreInstitutionNameMatch } from "./institution-canonicalization";

export type SearchableInstitution = {
	id: string;
	displayName: string;
	legalName?: string | null;
	aliases?: string[];
	domains?: string[];
	providerNames?: string[];
};

export function rankInstitutionSearchResults<T extends SearchableInstitution>(
	query: string,
	institutions: T[],
): T[] {
	return institutions
		.map((institution) => ({
			institution,
			score: scoreInstitutionNameMatch({
				query,
				displayName: institution.displayName,
				legalName: institution.legalName,
				aliases: institution.aliases,
				domains: institution.domains,
				providerNames: institution.providerNames,
			}),
		}))
		.filter((result) => result.score > 0)
		.sort(
			(a, b) =>
				b.score - a.score ||
				a.institution.displayName.localeCompare(b.institution.displayName),
		)
		.map((result) => result.institution);
}
