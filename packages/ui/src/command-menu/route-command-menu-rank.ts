export type RankableRoute = {
	label: string;
	keywords?: string[];
	parentLabel?: string;
};

const LABEL_WEIGHT = 1;
const KEYWORD_WEIGHT = 0.6;
const PARENT_WEIGHT = 0.25;

function fieldScore(candidate: string, query: string): number | null {
	if (!query) return 0;

	const normalizedCandidate = candidate.toLowerCase();
	const normalizedQuery = query.toLowerCase();

	if (normalizedCandidate === normalizedQuery) return 1000;
	if (normalizedCandidate.startsWith(normalizedQuery)) {
		return 900 - Math.min(normalizedCandidate.length, 80);
	}
	if (normalizedQuery.length === 1) return null;

	const words = normalizedCandidate.split(/[^a-z0-9]+/).filter(Boolean);
	if (words.some((word) => word === normalizedQuery)) return 850;
	if (words.some((word) => word.startsWith(normalizedQuery))) return 800;
	if (normalizedCandidate.includes(normalizedQuery)) {
		return 700 - normalizedCandidate.indexOf(normalizedQuery);
	}

	return null;
}

function weightedScore(
	candidate: string | undefined,
	query: string,
	weight: number,
): number | null {
	if (!candidate) return null;
	const score = fieldScore(candidate, query);
	return score === null ? null : score * weight;
}

export function scoreRoute(route: RankableRoute, query: string): number | null {
	const trimmed = query.trim();
	if (!trimmed) return 0;

	const scores = [
		weightedScore(route.label, trimmed, LABEL_WEIGHT),
		weightedScore(route.parentLabel, trimmed, PARENT_WEIGHT),
		...(trimmed.length < 2
			? []
			: (route.keywords ?? []).map((keyword) =>
					weightedScore(keyword, trimmed, KEYWORD_WEIGHT),
				)),
	].filter((score): score is number => score !== null);

	if (scores.length === 0) return null;
	return Math.max(...scores);
}

export function rankRoutes<T extends RankableRoute>(
	routes: readonly T[],
	query: string,
): T[] {
	return routes
		.map((route, index) => ({
			route,
			index,
			score: scoreRoute(route, query),
		}))
		.filter(
			(entry): entry is { route: T; index: number; score: number } =>
				entry.score !== null,
		)
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			const aChild = a.route.parentLabel ? 1 : 0;
			const bChild = b.route.parentLabel ? 1 : 0;
			if (aChild !== bChild) return aChild - bChild;
			return a.index - b.index;
		})
		.map((entry) => entry.route);
}

export function groupRankedRoutes<T extends { group?: string }>(
	routes: readonly T[],
): { group: string | null; routes: T[] }[] {
	const groups: { group: string | null; routes: T[] }[] = [];
	const indexByGroup = new Map<string | null, number>();

	for (const route of routes) {
		const group = route.group ?? null;
		const existingIndex = indexByGroup.get(group);
		if (existingIndex !== undefined) {
			groups[existingIndex]?.routes.push(route);
			continue;
		}
		indexByGroup.set(group, groups.length);
		groups.push({ group, routes: [route] });
	}

	return groups;
}
