import type { PrismaClient } from "../../../../generated/prisma";
import { loadCategoryOverrideNames } from "../../services/category.service";
import { resolveMatchableCategory } from "../conditionMatcher";
import { runRules } from "../ruleRunner";
import { compileRuleToTransactionWhere } from "./compile-rule-to-transaction-where";
import { loadRule } from "./shared";

/**
 * Counts how many transactions would be affected by a rule's conditions
 * without making any changes. Uses the compiled where clause to narrow the
 * candidate set, then runs the in-memory matcher as the source of truth.
 */
export async function previewBackfillCount(
	db: PrismaClient,
	userId: string,
	ruleId: string,
): Promise<number> {
	const rule = await loadRule(db, userId, ruleId);
	if (!rule) return 0;

	const { where } = compileRuleToTransactionWhere(userId, rule);

	const [candidates, overrideNames] = await Promise.all([
		db.transaction.findMany({
			where,
			select: {
				id: true,
				description: true,
				account: true,
				amount: true,
				category: true,
				date: true,
				categoryRef: { select: { id: true, name: true } },
			},
		}),
		loadCategoryOverrideNames(db, userId),
	]);

	let count = 0;
	for (const tx of candidates) {
		const matchable = {
			description: tx.description,
			account: tx.account,
			amount: Number(tx.amount),
			...resolveMatchableCategory({
				canonicalName: tx.categoryRef?.name,
				overrideName: tx.categoryRef
					? overrideNames.get(tx.categoryRef.id)
					: null,
				fallbackName: tx.category,
			}),
			date: tx.date,
		};
		const { matchedRuleIds } = runRules(matchable, [rule]);
		if (matchedRuleIds.length > 0) count++;
	}
	return count;
}
