import type { PrismaClient } from "../../../../generated/prisma";
import { loadCategoryOverrideNames } from "../../services/category.service";
import { runRules } from "../ruleRunner";
import { applyRuleMutationBulk } from "./apply-rule-mutation-bulk";
import { compileRuleToTransactionWhere } from "./compile-rule-to-transaction-where";
import { resolveRuleMutationDependencies } from "./resolve-rule-mutation-dependencies";
import {
	type BackfillResult,
	emptyBackfillResult,
	loadRule,
	type MatchedCandidate,
	toMatchableTransaction,
	transactionMatchSelect,
} from "./shared";

/**
 * Applies a single rule to all matching historical transactions for a user
 * using a compile → narrow → bulk-write pipeline.
 *
 * Returns affected count, soft-deleted IDs, and per-tx field updates so the
 * client can patch its cache.
 */
export async function runHistoricalBackfill(
	db: PrismaClient,
	userId: string,
	ruleId: string,
): Promise<BackfillResult> {
	const rule = await loadRule(db, userId, ruleId);
	if (!rule) return emptyBackfillResult();

	const { where } = compileRuleToTransactionWhere(userId, rule);

	const [candidates, overrideNames] = await Promise.all([
		db.transaction.findMany({ where, select: transactionMatchSelect }),
		loadCategoryOverrideNames(db, userId),
	]);

	const matched: MatchedCandidate[] = [];
	const matchedIds = new Set<string>();
	for (const tx of candidates) {
		const { matchedRuleIds } = runRules(
			toMatchableTransaction(tx, overrideNames),
			[rule],
		);
		if (matchedRuleIds.length === 0) continue;
		matched.push({
			tx,
			existingHashtagNames: new Set(
				tx.hashtags.map((h) => h.hashtag.normalizedName),
			),
		});
		matchedIds.add(tx.id);
	}

	// Also cascade to transactions already linked to this rule that don't match
	// the new conditions. This handles edits where conditions have changed —
	// previously-applied transactions still get the updated actions.
	const alreadyApplied = await db.transaction.findMany({
		where: {
			appliedRuleId: ruleId,
			userId,
			id: { notIn: [...matchedIds] },
		},
		select: transactionMatchSelect,
	});

	for (const tx of alreadyApplied) {
		matched.push({
			tx,
			existingHashtagNames: new Set(
				tx.hashtags.map((h) => h.hashtag.normalizedName),
			),
		});
	}

	if (matched.length === 0) return emptyBackfillResult();

	const dependencies = await resolveRuleMutationDependencies(db, userId, rule);

	return applyRuleMutationBulk(db, {
		userId,
		rule,
		matched,
		dependencies,
	});
}
