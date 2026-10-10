import {
	FIELDS,
	NO_VALUE_OPS,
	NUMBER_OPERATORS,
	TEXT_OPERATORS,
} from "./constants";
import type {
	ActionRow,
	ConditionGroupRow,
	ConditionRow,
	PreviewTx,
	RuleField,
	RuleMatch,
} from "./types";

export function fuzzyScore(candidate: string, query: string): number | null {
	if (!query) return null;
	const c = candidate.toLowerCase();
	const q = query.toLowerCase();
	if (c === q) return 1000;
	if (c.startsWith(q)) return 900 - c.length;
	let ci = 0;
	let qi = 0;
	while (ci < c.length && qi < q.length) {
		if (c[ci] === q[qi]) qi++;
		ci++;
	}
	if (qi < q.length) return null;
	return 500 - ci;
}

export function rankByFuzzyScore(
	candidates: string[],
	query: string,
	limit: number,
): string[] {
	const trimmed = query.trim();
	if (!trimmed) return candidates.slice(0, limit);
	return candidates
		.map((name) => ({ name, score: fuzzyScore(name, trimmed) }))
		.filter(
			(entry): entry is { name: string; score: number } => entry.score !== null,
		)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((entry) => entry.name);
}

export const RECENT_HASHTAG_SUGGESTION_LIMIT = 5;

/** Empty query: newest-first names, capped. Typing: fuzzy-match the full list. */
export function suggestHashtags(
	names: string[],
	query: string,
	recentLimit = RECENT_HASHTAG_SUGGESTION_LIMIT,
): string[] {
	const trimmed = query.trim().replace(/^#/, "");
	if (!trimmed) return names.slice(0, recentLimit);
	return rankByFuzzyScore(names, trimmed, names.length);
}

export function getOperators(field: RuleField) {
	const match = FIELDS.find((f) => f.value === field);
	if (match?.kind === "number") return NUMBER_OPERATORS;
	return TEXT_OPERATORS;
}

export function getFieldKind(field: RuleField) {
	return FIELDS.find((f) => f.value === field)?.kind ?? "text";
}

export function uid() {
	return Math.random().toString(36).slice(2);
}

export function emptyCondition(): ConditionRow {
	return {
		id: uid(),
		field: "DESCRIPTION",
		operator: "CONTAINS",
		valueText: "",
		valueNumber: "",
		secondValueNumber: "",
	};
}

export function emptyGroup(match: RuleMatch = "ALL"): ConditionGroupRow {
	return {
		id: uid(),
		match,
		conditions: [emptyCondition()],
	};
}

export function emptyAction(): ActionRow {
	return {
		id: uid(),
		type: "SET_CATEGORY",
		valueText: "",
		hashtagId: null,
		hashtagEntries: [],
	};
}

export function buildConditionsForQuery(rows: ConditionRow[]) {
	return rows
		.filter((c) => {
			if (NO_VALUE_OPS.has(c.operator)) return true;
			const kind = getFieldKind(c.field);
			if (kind === "number") {
				if (c.operator === "BETWEEN")
					return c.valueNumber !== "" && c.secondValueNumber !== "";
				return c.valueNumber !== "";
			}
			return c.valueText.trim() !== "";
		})
		.map(buildConditionForApi);
}

export function buildConditionForApi(c: ConditionRow) {
	const kind = getFieldKind(c.field);
	return {
		field: c.field,
		operator: c.operator,
		valueText: kind === "text" ? c.valueText || null : null,
		valueNumber:
			kind === "number"
				? parseFloat(c.valueNumber.replace(/,/g, "")) || null
				: null,
		valueDate: null,
		secondValueNumber:
			kind === "number" && c.operator === "BETWEEN"
				? parseFloat(c.secondValueNumber.replace(/,/g, "")) || null
				: null,
		secondValueDate: null,
	};
}

export function buildGroupsForQuery(groups: ConditionGroupRow[]) {
	return groups
		.map((group) => ({
			match: group.match,
			conditions: buildConditionsForQuery(group.conditions),
		}))
		.filter((group) => group.conditions.length > 0);
}

export function committedPreviewFromState(
	match: RuleMatch,
	groups: ConditionGroupRow[],
) {
	const builtGroups = buildGroupsForQuery(groups);
	return {
		match,
		groups: builtGroups,
		conditions: builtGroups.flatMap((group) => group.conditions),
	};
}

export function flattenGroupConditions(groups: ConditionGroupRow[]) {
	return groups.flatMap((g) => g.conditions);
}

export function applyActionsToPreview(
	tx: PreviewTx,
	actions: ActionRow[],
): PreviewTx {
	let result = { ...tx, hashtags: [...tx.hashtags] };
	for (const a of actions) {
		if (a.type === "SET_CATEGORY" && a.valueText)
			result = { ...result, category: a.valueText };
		if (a.type === "SET_DESCRIPTION" && a.valueText)
			result = { ...result, description: a.valueText };
		if (a.type === "SET_TYPE" && a.valueText)
			result = { ...result, type: a.valueText };
		if (a.type === "ADD_HASHTAG") {
			for (const entry of a.hashtagEntries) {
				const tag = entry.name.replace(/^#/, "").trim();
				if (tag && !result.hashtags.includes(tag))
					result = { ...result, hashtags: [...result.hashtags, tag] };
			}
		}
	}
	return result;
}

export function hasActionsSet(actions: ActionRow[]) {
	return actions.some(
		(a) => a.valueText.trim() || a.hashtagId || a.hashtagEntries.length > 0,
	);
}

export function connectorWord(match: RuleMatch) {
	return match === "ANY" ? "or" : "and";
}

export type RuleDraftSnapshot = {
	name: string;
	match: RuleMatch;
	groups: ConditionGroupRow[];
	actions: ActionRow[];
};

export function serializeRuleDraft(draft: RuleDraftSnapshot): string {
	return JSON.stringify({
		name: draft.name.trim(),
		match: draft.match,
		groups: draft.groups.map((group) => ({
			match: group.match,
			conditions: group.conditions.map((condition) => ({
				field: condition.field,
				operator: condition.operator,
				valueText: condition.valueText,
				valueNumber: condition.valueNumber,
				secondValueNumber: condition.secondValueNumber,
			})),
		})),
		actions: draft.actions.map((action) => ({
			type: action.type,
			valueText: action.valueText,
			hashtagId: action.hashtagId ?? null,
			hashtagEntries: action.hashtagEntries.map((entry) => ({
				name: entry.name,
				id: entry.id,
			})),
		})),
	});
}

export function renameSerializedRuleDraft(
	serialized: string,
	name: string,
): string {
	const parsed = JSON.parse(serialized) as { name: string };
	return JSON.stringify({ ...parsed, name: name.trim() });
}

export function suggestedRuleName(
	actions: ActionRow[],
	groups: ConditionGroupRow[],
): string {
	const descriptionAction = actions.find(
		(action) => action.type === "SET_DESCRIPTION" && action.valueText.trim(),
	);
	if (descriptionAction) return descriptionAction.valueText.trim();

	for (const group of groups) {
		const descriptionCondition = group.conditions.find(
			(condition) =>
				condition.field === "DESCRIPTION" && condition.valueText.trim(),
		);
		if (descriptionCondition) return descriptionCondition.valueText.trim();
	}

	return "";
}
