export function parseCommunityTipSearchTerms(query: string | null | undefined): string[] {
	if (!query) return [];
	const seen = new Set<string>();
	const terms: string[] = [];
	for (const part of query.split(/[,\n]+/)) {
		const term = part.trim().toLowerCase();
		if (!term || seen.has(term)) continue;
		seen.add(term);
		terms.push(term);
	}
	return terms;
}

export function formatCommunityTipSearchQuery(terms: string[]): string {
	const unique: string[] = [];
	const seen = new Set<string>();
	for (const term of terms) {
		const normalized = term.trim().toLowerCase();
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		unique.push(normalized);
	}
	return unique.join(", ");
}

export function collectMatchedKeywords(
	tips: Array<{ matchedKeywords: string[]; keywords?: string[] }>,
	maxTerms = 12,
): string[] {
	const terms: string[] = [];
	const seen = new Set<string>();
	for (const tip of tips) {
		const source =
			tip.matchedKeywords.length > 0
				? tip.matchedKeywords
				: (tip.keywords ?? []);
		for (const keyword of source) {
			const normalized = keyword.trim().toLowerCase();
			if (!normalized || seen.has(normalized)) continue;
			seen.add(normalized);
			terms.push(normalized);
			if (terms.length >= maxTerms) return terms;
		}
	}
	return terms;
}

export function communityTipMatchesSearchQuery(
	fields: Array<string | null | undefined>,
	query: string | null | undefined,
): boolean {
	const terms = parseCommunityTipSearchTerms(query);
	if (terms.length === 0) return true;
	const haystack = fields
		.filter((field): field is string => typeof field === "string" && field.length > 0)
		.join(" ")
		.toLowerCase();
	return terms.some((term) => haystack.includes(term));
}
