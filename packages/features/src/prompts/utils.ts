import type { PromptLibrarySource } from "@moat/contracts";
import type { PromptLibraryTab } from "./types";

export const PROMPT_PAGE_SIZE = 25;

export const PROMPT_QUERY_KEYS = {
	categories: ["promptCategories"] as const,
	mine: ["myPrompts"] as const,
	community: ["communityPrompts"] as const,
	pins: (source: PromptLibrarySource | "ALL") =>
		["promptPins", source] as const,
	launchCounts: (source: PromptLibrarySource) =>
		["promptLaunchCounts", source] as const,
	prompt: (id: string) => ["prompt", id] as const,
	communityPrompt: (id: string) => ["communityPrompt", id] as const,
	moderation: (filter: string) => ["promptModeration", filter] as const,
	aiConnection: ["promptAiConnection"] as const,
};

export function parsePromptTab(value: string | null): PromptLibraryTab {
	if (
		value === "all" ||
		value === "curated" ||
		value === "mine" ||
		value === "community"
	) {
		return value;
	}
	return "all";
}

export function tabToPromptSource(
	tab: Exclude<PromptLibraryTab, "all">,
): PromptLibrarySource {
	if (tab === "mine") return "MINE";
	if (tab === "community") return "COMMUNITY";
	return "CURATED";
}

export function pinKey(source: PromptLibrarySource, promptId: string): string {
	return `${source}:${promptId}`;
}

export function isCommunityMode(
	mode: "community" | "private-only" | undefined,
): boolean {
	return mode !== "private-only";
}

export function formatLaunchCount(count: number): string {
	return count === 1 ? "1 launch" : `${count} launches`;
}

export function sortByPinnedThenLaunchCount<T>(
	items: T[],
	pinnedIds: string[],
	getId: (item: T) => string,
	getLaunchCount: (item: T) => number,
): T[] {
	const pinnedSet = new Set(pinnedIds);
	const pinned: T[] = [];
	const unpinned: T[] = [];

	for (const item of items) {
		if (pinnedSet.has(getId(item))) {
			pinned.push(item);
		} else {
			unpinned.push(item);
		}
	}

	pinned.sort(
		(a, b) => pinnedIds.indexOf(getId(a)) - pinnedIds.indexOf(getId(b)),
	);

	unpinned.sort((a, b) => {
		const countDiff = getLaunchCount(b) - getLaunchCount(a);
		if (countDiff !== 0) return countDiff;
		return 0;
	});

	return [...pinned, ...unpinned];
}

/** @deprecated Prefer sortByPinnedThenLaunchCount */
export function sortByPinned<T>(
	items: T[],
	pinnedIds: string[],
	getId: (item: T) => string,
): T[] {
	return sortByPinnedThenLaunchCount(items, pinnedIds, getId, () => 0);
}
