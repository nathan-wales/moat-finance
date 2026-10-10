import type { RuleActionType } from "../../../generated/prisma";

export type RuleActionInput = {
	type: RuleActionType;
	valueText: string | null;
	hashtagId: string | null;
	// Resolved hashtag name for ADD_HASHTAG
	hashtagName?: string | null;
};

export type TransactionMutation = {
	category?: string;
	description?: string;
	type?: "INCOME" | "EXPENSE" | "SKIP";
	hashtagsToAdd: string[]; // normalized names
};

/**
 * Merges a single action into an accumulated mutation object.
 * - SET_CATEGORY / SET_DESCRIPTION: last-rule-wins (overwrite)
 * - ADD_HASHTAG: accumulate uniquely
 */
export function applyAction(
	mutation: TransactionMutation,
	action: RuleActionInput,
): TransactionMutation {
	switch (action.type) {
		case "SET_CATEGORY":
			return { ...mutation, category: action.valueText ?? undefined };
		case "SET_DESCRIPTION":
			return { ...mutation, description: action.valueText ?? undefined };
		case "SET_TYPE":
			return {
				...mutation,
				type: (action.valueText as "INCOME" | "EXPENSE" | "SKIP") ?? undefined,
			};
		case "ADD_HASHTAG": {
			const name = (action.hashtagName ?? action.valueText ?? "")
				.replace(/^#/, "")
				.toLowerCase()
				.trim();
			if (!name) return mutation;
			const existing = new Set(mutation.hashtagsToAdd);
			existing.add(name);
			return { ...mutation, hashtagsToAdd: Array.from(existing) };
		}
	}
}

export function emptyMutation(): TransactionMutation {
	return { hashtagsToAdd: [] };
}
