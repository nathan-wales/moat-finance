import {
	COMMUNITY_TIP_GENERATED_KEYWORDS_MAX,
	COMMUNITY_TIP_STOP_WORDS,
} from "../constants";

export function normalizeKeyword(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9.+&\-\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function normalizeKeywordList(
	values: string[],
	max = COMMUNITY_TIP_GENERATED_KEYWORDS_MAX,
): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const normalized = normalizeKeyword(value);
		if (!normalized) continue;
		if (COMMUNITY_TIP_STOP_WORDS.has(normalized)) continue;
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
		if (result.length >= max) break;
	}
	return result;
}

export function extractKeywordsFromText(
	text: string,
	max = COMMUNITY_TIP_GENERATED_KEYWORDS_MAX,
): string[] {
	const tokens = normalizeKeyword(text)
		.split(" ")
		.filter(
			(token) => token.length >= 3 && !COMMUNITY_TIP_STOP_WORDS.has(token),
		);

	const phrases: string[] = [];
	for (let i = 0; i < tokens.length - 1; i++) {
		const left = tokens[i];
		const right = tokens[i + 1];
		if (!left || !right) continue;
		phrases.push(`${left} ${right}`);
	}

	return normalizeKeywordList([...phrases, ...tokens], max);
}

export function mergeKeywordSources(sources: string[][]): string[] {
	return normalizeKeywordList(sources.flat());
}
