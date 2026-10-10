import type { ActiveRule, DashboardTransaction } from "@moat/data-access";
import type { MatchableTransaction } from "@moat/domain";
import { evaluateRules, matchRuleConditions } from "@moat/domain";
import type { AppRuntime } from "@moat/runtime";

export function toMatchable(tx: DashboardTransaction): MatchableTransaction {
	return {
		description: tx.description ?? null,
		amount: tx.amount,
		category: tx.category ?? "Uncategorized",
		date: tx.date instanceof Date ? tx.date : new Date(tx.date),
		account: tx.account ?? null,
	};
}

export async function listCandidateTransactions(appRuntime: AppRuntime) {
	const { userId, repositories } = appRuntime;
	const items: DashboardTransaction[] = [];
	let cursor: number | null = 0;

	while (cursor !== null) {
		const page = await repositories.transactions.listPaginated({
			userId,
			limit: 100,
			cursor,
			sortField: "date",
			sortDir: "desc",
		});
		items.push(...page.items);
		cursor = page.nextCursor;
	}

	return items;
}

export async function previewRuleMatches(
	appRuntime: AppRuntime,
	rule: ActiveRule,
) {
	const transactions = await listCandidateTransactions(appRuntime);
	const matched = transactions.filter((tx) => {
		const result = evaluateRules(toMatchable(tx), [rule]);
		return result.matchedRuleIds.includes(rule.id);
	});
	return { matched, truncatedAt: transactions.length };
}

export async function previewConditions(
	appRuntime: AppRuntime,
	input: {
		match?: ActiveRule["match"];
		conditions: ActiveRule["conditions"];
		conditionGroups?: ActiveRule["conditionGroups"];
		appliedRuleId?: string;
	},
) {
	if (input.appliedRuleId && repositoriesHasListByAppliedRule(appRuntime)) {
		const linked =
			await appRuntime.repositories.transactions.listByAppliedRuleId?.({
				userId: appRuntime.userId,
				appliedRuleId: input.appliedRuleId,
			});
		return {
			matched: linked ?? [],
			truncatedAt: linked?.length ?? 0,
		};
	}

	const transactions = await listCandidateTransactions(appRuntime);
	const matched = transactions.filter((tx) =>
		matchRuleConditions(toMatchable(tx), {
			match: input.match,
			conditions: input.conditions,
			conditionGroups: input.conditionGroups,
		}),
	);
	return { matched, truncatedAt: transactions.length };
}

function repositoriesHasListByAppliedRule(appRuntime: AppRuntime) {
	return (
		typeof appRuntime.repositories.transactions.listByAppliedRuleId ===
		"function"
	);
}

export type RuleApplyUpdate = {
	id: string;
	description?: string | null;
	type?: string;
	category?: string;
	categoryRef?: { name: string } | null;
	addedHashtagNames?: string[];
};

export async function applyRuleToMatches(
	appRuntime: AppRuntime,
	rule: ActiveRule,
	matched: DashboardTransaction[],
): Promise<{
	affected: number;
	deletedIds: string[];
	updates: RuleApplyUpdate[];
}> {
	const { userId, repositories } = appRuntime;
	let affected = 0;
	const deletedIds: string[] = [];
	const updates: RuleApplyUpdate[] = [];

	for (const tx of matched) {
		const result = evaluateRules(toMatchable(tx), [rule]);
		if (!result.matchedRuleIds.includes(rule.id)) continue;

		const mutation = result.mutation;
		if (mutation.type === "SKIP") {
			await repositories.transactions.update({
				userId,
				transactionId: tx.id,
				data: { appliedRuleId: rule.id },
			});
			if (repositories.transactions.hide) {
				await repositories.transactions.hide({
					userId,
					transactionId: tx.id,
				});
			}
			deletedIds.push(tx.id);
			affected += 1;
			continue;
		}

		const addedHashtagNames = mutation.hashtagsToAdd;
		await repositories.transactions.update({
			userId,
			transactionId: tx.id,
			data: {
				...(mutation.category !== undefined
					? { categoryName: mutation.category }
					: {}),
				...(mutation.description !== undefined
					? { description: mutation.description }
					: {}),
				...(mutation.type === "INCOME" || mutation.type === "EXPENSE"
					? { type: mutation.type }
					: {}),
				...(addedHashtagNames.length > 0
					? { hashtags: [...(tx.hashtags ?? []), ...addedHashtagNames] }
					: {}),
				appliedRuleId: rule.id,
			},
		});

		const update: RuleApplyUpdate = { id: tx.id };
		if (mutation.description !== undefined) {
			update.description = mutation.description;
		}
		if (mutation.type === "INCOME" || mutation.type === "EXPENSE") {
			update.type = mutation.type;
		}
		if (mutation.category !== undefined) {
			update.category = mutation.category;
			update.categoryRef = { name: mutation.category };
		}
		if (addedHashtagNames.length > 0) {
			update.addedHashtagNames = addedHashtagNames;
		}
		updates.push(update);
		affected += 1;
	}

	return { affected, deletedIds, updates };
}

export async function applyActiveRulesToTransactions(
	appRuntime: AppRuntime,
	transactionIds: string[],
): Promise<void> {
	if (transactionIds.length === 0) return;

	const { userId, repositories } = appRuntime;
	const rules = await repositories.rules.listActive({ userId });
	if (rules.length === 0) return;

	for (let i = 0; i < transactionIds.length; i += 50) {
		const chunk = transactionIds.slice(i, i + 50);
		const loaded = await Promise.all(
			chunk.map((transactionId) =>
				repositories.transactions.findById({ userId, transactionId }),
			),
		);

		for (const tx of loaded) {
			if (!tx) continue;
			const result = evaluateRules(toMatchable(tx), rules);
			if (result.matchedRuleIds.length === 0) continue;

			const appliedRuleId = result.matchedRuleIds[0];
			const mutation = result.mutation;
			if (mutation.type === "SKIP") {
				await repositories.transactions.update({
					userId,
					transactionId: tx.id,
					data: { appliedRuleId },
				});
				if (repositories.transactions.hide) {
					await repositories.transactions.hide({
						userId,
						transactionId: tx.id,
					});
				}
				continue;
			}

			const addedHashtagNames = mutation.hashtagsToAdd;
			await repositories.transactions.update({
				userId,
				transactionId: tx.id,
				data: {
					...(mutation.category !== undefined
						? { categoryName: mutation.category }
						: {}),
					...(mutation.description !== undefined
						? { description: mutation.description }
						: {}),
					...(mutation.type === "INCOME" || mutation.type === "EXPENSE"
						? { type: mutation.type }
						: {}),
					...(addedHashtagNames.length > 0
						? { hashtags: [...(tx.hashtags ?? []), ...addedHashtagNames] }
						: {}),
					appliedRuleId,
				},
			});
		}
	}
}

export async function linkRuleToTransaction(
	appRuntime: AppRuntime,
	input: { ruleId: string; transactionId: string },
) {
	const { userId, repositories } = appRuntime;
	const [rule, transaction] = await Promise.all([
		repositories.rules.findById({ userId, ruleId: input.ruleId }),
		repositories.transactions.findById({
			userId,
			transactionId: input.transactionId,
		}),
	]);
	if (!rule) throw new Error("Rule not found");
	if (!transaction) throw new Error("Transaction not found");

	await repositories.transactions.update({
		userId,
		transactionId: input.transactionId,
		data: { appliedRuleId: input.ruleId },
	});
}

export function toPreviewTransactions(
	matched: DashboardTransaction[],
	limit = 3,
) {
	return {
		preview: matched.slice(0, limit).map((tx) => ({
			id: tx.id,
			date: tx.date instanceof Date ? tx.date.toISOString() : String(tx.date),
			description: tx.description ?? null,
			amount: tx.amount,
			type: tx.type,
			category: tx.category,
			account: tx.account ?? null,
			hashtags: tx.hashtags ?? [],
		})),
		totalCount: matched.length,
	};
}
