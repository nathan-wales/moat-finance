import type {
	PrismaClient,
	TransactionType,
} from "../../../../generated/prisma";
import type { RuleWithDetails } from "../ruleRunner";
import type { ResolvedMutationDependencies } from "./resolve-rule-mutation-dependencies";
import type { BackfillResult, MatchedCandidate, UpdatedTx } from "./shared";

type Args = {
	userId: string;
	rule: RuleWithDetails;
	matched: MatchedCandidate[];
	dependencies: ResolvedMutationDependencies;
};

/**
 * Performs all writes for a backfill in bulk:
 *  - one updateMany for the scalar mutation (category/description/type/appliedRuleId)
 *  - one updateMany for SKIP (hidden=true)
 *  - one createMany for new hashtag join rows (skipDuplicates)
 *  - one createMany for audit log rows (skipDuplicates)
 *
 * No per-tx queries happen here.
 */
export async function applyRuleMutationBulk(
	db: PrismaClient,
	{ userId, rule, matched, dependencies }: Args,
): Promise<BackfillResult> {
	const { mutation, category, hashtagsByName } = dependencies;
	const matchedIds = matched.map((m) => m.tx.id);

	// SKIP path — soft-hide and exit. Matches existing behavior:
	// no appliedRuleId, no hashtags, no audit log.
	if (mutation.type === "SKIP") {
		await db.transaction.updateMany({
			where: { id: { in: matchedIds }, userId },
			data: { hidden: true },
		});
		return {
			affected: matched.length,
			deletedIds: matchedIds,
			updates: [],
		};
	}

	const scalarUpdate: {
		appliedRuleId?: string;
		categoryId?: string;
		category?: string;
		description?: string;
		type?: TransactionType;
	} = { appliedRuleId: rule.id };

	if (category) {
		scalarUpdate.categoryId = category.id;
		scalarUpdate.category = category.name;
	}
	if (mutation.description !== undefined) {
		scalarUpdate.description = mutation.description;
	}
	if (mutation.type) {
		scalarUpdate.type = mutation.type as TransactionType;
	}

	// Per-tx hashtag rows to insert and per-tx addedHashtagNames lists.
	const hashtagRows: { transactionId: string; hashtagId: string }[] = [];
	const addedByTx = new Map<string, string[]>();

	if (mutation.hashtagsToAdd.length > 0) {
		for (const { tx, existingHashtagNames } of matched) {
			const newNames: string[] = [];
			for (const name of mutation.hashtagsToAdd) {
				if (existingHashtagNames.has(name)) continue;
				const hashtag = hashtagsByName.get(name);
				if (!hashtag) continue;
				hashtagRows.push({ transactionId: tx.id, hashtagId: hashtag.id });
				newNames.push(name);
			}
			if (newNames.length > 0) addedByTx.set(tx.id, newNames);
		}
	}

	const auditRows = matched.map(({ tx }) => ({
		id: `${tx.id}_${rule.id}`,
		transactionId: tx.id,
		ruleId: rule.id,
		wasHistoricalBackfill: true,
	}));

	await db.$transaction(async (tx) => {
		await tx.transaction.updateMany({
			where: { id: { in: matchedIds }, userId, hidden: false, removedAt: null },
			data: scalarUpdate,
		});

		if (hashtagRows.length > 0) {
			await tx.transactionHashtag.createMany({
				data: hashtagRows,
				skipDuplicates: true,
			});
		}

		if (auditRows.length > 0) {
			await tx.transactionRuleApplication.createMany({
				data: auditRows,
				skipDuplicates: true,
			});
		}
	});

	const updates: UpdatedTx[] = matched.map(({ tx }) => {
		const update: UpdatedTx = { id: tx.id, appliedRuleId: rule.id };
		if (category) {
			update.category = category.displayName;
			update.categoryRef = { name: category.displayName };
		}
		if (mutation.description !== undefined) {
			update.description = mutation.description;
		}
		if (mutation.type) {
			update.type = mutation.type;
		}
		const added = addedByTx.get(tx.id);
		if (added && added.length > 0) update.addedHashtagNames = added;
		return update;
	});

	return {
		affected: matched.length,
		deletedIds: [],
		updates,
	};
}
