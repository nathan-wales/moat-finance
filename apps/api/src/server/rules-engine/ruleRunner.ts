import type { PrismaClient } from "../../../generated/prisma";
import type { TransactionMutation } from "./actionExecutor";
import { applyAction, emptyMutation } from "./actionExecutor";
import type { MatchableTransaction } from "./conditionMatcher";
import { matchRuleConditions } from "./conditionMatcher";

export type RuleWithDetails = Awaited<ReturnType<typeof loadRules>>[number];

async function loadRules(db: PrismaClient, userId: string) {
	return db.transactionRule.findMany({
		where: { userId, isActive: true },
		orderBy: { priority: "asc" },
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

/**
 * Runs all active rules for a user against a single transaction.
 * Returns the accumulated mutation (may be empty if no rules matched).
 * Also returns the list of rule IDs that matched, for audit logging.
 */
export function runRules(
	tx: MatchableTransaction,
	rules: RuleWithDetails[],
): { mutation: TransactionMutation; matchedRuleIds: string[] } {
	let mutation = emptyMutation();
	const matchedRuleIds: string[] = [];

	for (const rule of rules) {
		if (
			matchRuleConditions(tx, {
				match: rule.match,
				conditions: rule.conditions,
				conditionGroups: rule.conditionGroups.map((g) => ({
					match: g.match,
					conditions: g.conditions,
				})),
			})
		) {
			matchedRuleIds.push(rule.id);
			for (const action of rule.actions) {
				mutation = applyAction(mutation, {
					type: action.type,
					valueText: action.valueText,
					hashtagId: action.hashtagId,
					hashtagName: action.hashtag?.name ?? null,
				});
			}
		}
	}

	return { mutation, matchedRuleIds };
}

export { loadRules };
