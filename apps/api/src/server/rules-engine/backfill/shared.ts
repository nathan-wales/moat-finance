import type { Prisma, PrismaClient } from "../../../../generated/prisma";
import type { MatchableTransaction } from "../conditionMatcher";
import { resolveMatchableCategory } from "../conditionMatcher";
import type { RuleWithDetails } from "../ruleRunner";

/**
 * Prisma `select` used when loading candidate transactions for backfill.
 * Includes everything `runRules` needs plus existing hashtags so we can
 * compute per-tx newly-added hashtags without an extra query.
 */
export const transactionMatchSelect = {
	id: true,
	description: true,
	account: true,
	amount: true,
	category: true,
	date: true,
	categoryRef: { select: { id: true, name: true } },
	hashtags: {
		select: {
			hashtag: { select: { id: true, normalizedName: true, name: true } },
		},
	},
} satisfies Prisma.TransactionSelect;

export type CandidateTransaction = Prisma.TransactionGetPayload<{
	select: typeof transactionMatchSelect;
}>;

export type MatchedCandidate = {
	tx: CandidateTransaction;
	existingHashtagNames: Set<string>;
};

export function toMatchableTransaction(
	tx: CandidateTransaction,
	overrideNamesByCategoryId?: Map<string, string>,
): MatchableTransaction {
	return {
		description: tx.description,
		account: tx.account,
		amount: Number(tx.amount),
		...resolveMatchableCategory({
			canonicalName: tx.categoryRef?.name,
			overrideName: tx.categoryRef
				? overrideNamesByCategoryId?.get(tx.categoryRef.id)
				: null,
			fallbackName: tx.category,
		}),
		date: tx.date,
	};
}

export type UpdatedTx = {
	id: string;
	description?: string | null;
	type?: string;
	category?: string;
	categoryRef?: { name: string } | null;
	addedHashtagNames?: string[];
	appliedRuleId?: string;
};

export type BackfillResult = {
	affected: number;
	deletedIds: string[];
	updates: UpdatedTx[];
};

export function emptyBackfillResult(): BackfillResult {
	return { affected: 0, deletedIds: [], updates: [] };
}

/**
 * Loads a single active rule with its conditions and actions.
 * Returns `null` if the rule does not exist, isn't active, or doesn't
 * belong to the user.
 */
export async function loadRule(
	db: PrismaClient,
	userId: string,
	ruleId: string,
): Promise<RuleWithDetails | null> {
	return db.transactionRule.findFirst({
		where: { id: ruleId, userId, isActive: true },
		include: {
			conditionGroups: {
				orderBy: { sortOrder: "asc" },
				include: {
					conditions: { orderBy: { sortOrder: "asc" } },
				},
			},
			conditions: { orderBy: { sortOrder: "asc" } },
			actions: {
				orderBy: { sortOrder: "asc" },
				include: { hashtag: true },
			},
		},
	});
}
