import { fuzzyScore } from "./utils";

export type HashtagPickerSuggestion = {
	name: string;
	selected: boolean;
};

const UNSELECTED_LIMIT = 6;

function matchingSelectedNames(
	selectedNames: string[],
	query: string,
): string[] {
	if (!query) return selectedNames;
	return selectedNames.filter((name) => fuzzyScore(name, query) !== null);
}

function matchingUnselectedNames(
	allHashtags: { name: string }[],
	selectedLower: Set<string>,
	query: string,
): string[] {
	const available = allHashtags.filter(
		(hashtag) => !selectedLower.has(hashtag.name.toLowerCase()),
	);
	if (!query) {
		return available.slice(0, UNSELECTED_LIMIT).map((hashtag) => hashtag.name);
	}
	return available
		.map((hashtag) => ({
			name: hashtag.name,
			score: fuzzyScore(hashtag.name, query),
		}))
		.filter(
			(item): item is { name: string; score: number } => item.score !== null,
		)
		.sort((a, b) => b.score - a.score)
		.slice(0, UNSELECTED_LIMIT)
		.map((item) => item.name);
}

export function getHashtagPickerSuggestions(
	allHashtags: { name: string }[],
	selectedNames: string[],
	rawQuery: string,
): HashtagPickerSuggestion[] {
	const query = rawQuery.trim().replace(/^#/, "");
	const selectedLower = new Set(
		selectedNames.map((name) => name.toLowerCase()),
	);
	return [
		...matchingSelectedNames(selectedNames, query).map((name) => ({
			name,
			selected: true as const,
		})),
		...matchingUnselectedNames(allHashtags, selectedLower, query).map(
			(name) => ({
				name,
				selected: false as const,
			}),
		),
	];
}

export function firstUnselectedSuggestionIndex(
	suggestions: HashtagPickerSuggestion[],
): number {
	const index = suggestions.findIndex((item) => !item.selected);
	if (index === -1) return 0;
	return index;
}
