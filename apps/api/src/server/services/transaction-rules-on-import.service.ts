import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import type { TransactionType } from "../../../generated/prisma";
import type { TransactionMutation } from "../rules-engine/actionExecutor";
import { resolveMatchableCategory } from "../rules-engine/conditionMatcher";
import { loadRules, runRules } from "../rules-engine/ruleRunner";
import {
	findCategoryByDisplayName,
	loadCategoryOverrideNames,
} from "./category.service";

type EvaluatedTransaction = {
	txId: string;
	matchedRuleIds: string[];
	mutation: TransactionMutation;
	existingHashtagNames: Set<string>;
};

type ScalarUpdateGroup = {
	txIds: string[];
	data: {
		appliedRuleId?: string;
		categoryId?: string;
		category?: string;
		description?: string;
		type?: TransactionType;
	};
};

export async function applyRulesToSyncedTransactions(
	userId: string,
	externalTransactionIds: string[],
): Promise<void> {
	if (externalTransactionIds.length === 0) return;

	const transactions = (await db.transaction.findMany({
		where: {
			userId,
			externalTransactionId: { in: externalTransactionIds },
			removedAt: null,
		},
		select: importRuleTransactionSelect,
	})) as ImportRuleTransaction[];

	await applyRulesToTransactionRows(userId, transactions, {
		operation: "applyRulesToSyncedTransactions",
		lookupCount: externalTransactionIds.length,
	});
}

export async function applyRulesToImportedTransactions(
	userId: string,
	transactionIds: string[],
): Promise<void> {
	if (transactionIds.length === 0) return;

	for (let i = 0; i < transactionIds.length; i += 500) {
		const chunk = transactionIds.slice(i, i + 500);
		const transactions = (await db.transaction.findMany({
			where: {
				userId,
				id: { in: chunk },
				removedAt: null,
			},
			select: importRuleTransactionSelect,
		})) as ImportRuleTransaction[];
		await applyRulesToTransactionRows(userId, transactions, {
			operation: "applyRulesToImportedTransactions",
			lookupCount: chunk.length,
		});
	}
}

const importRuleTransactionSelect = {
	id: true,
	description: true,
	account: true,
	amount: true,
	category: true,
	categoryRef: { select: { id: true, name: true } },
	date: true,
	hashtags: { include: { hashtag: true } },
} as const;

type ImportRuleTransaction = {
	id: string;
	description: string | null;
	account: string | null;
	amount: { toNumber(): number } | number;
	category: string;
	categoryRef: { id: string; name: string } | null;
	date: Date;
	hashtags: Array<{ hashtag: { normalizedName: string } }>;
};

async function applyRulesToTransactionRows(
	userId: string,
	transactions: ImportRuleTransaction[],
	log: { operation: string; lookupCount: number },
): Promise<void> {
	if (transactions.length === 0) return;

	const rulesStartedAt = Date.now();
	const rules = await loadRules(db, userId);
	if (rules.length === 0) return;

	const overrideNames = await loadCategoryOverrideNames(db, userId);

	const evaluated: EvaluatedTransaction[] = [];

	for (const tx of transactions) {
		const matchable = {
			description: tx.description,
			account: tx.account,
			amount: Number(tx.amount),
			...resolveMatchableCategory({
				canonicalName: tx.categoryRef?.name,
				overrideName: tx.categoryRef
					? overrideNames.get(tx.categoryRef.id)
					: null,
				fallbackName: tx.category ?? "OTHER",
			}),
			date: tx.date,
		};

		const { mutation, matchedRuleIds } = runRules(matchable, rules);
		if (matchedRuleIds.length === 0) continue;

		evaluated.push({
			txId: tx.id,
			matchedRuleIds,
			mutation,
			existingHashtagNames: new Set(
				tx.hashtags.map((hashtag) => hashtag.hashtag.normalizedName),
			),
		});
	}

	if (evaluated.length === 0) return;

	const skipIds = evaluated
		.filter((entry) => entry.mutation.type === "SKIP")
		.map((entry) => entry.txId);

	const nonSkipEvaluated = evaluated.filter(
		(entry) => entry.mutation.type !== "SKIP",
	);

	const categoryNames = new Set<string>();
	for (const entry of nonSkipEvaluated) {
		if (entry.mutation.category) {
			categoryNames.add(entry.mutation.category);
		}
	}
	const categoryByLowerName = await resolveCategoriesByName(
		userId,
		categoryNames,
	);

	const scalarGroups = new Map<string, ScalarUpdateGroup>();
	const hashtagRows: { transactionId: string; hashtagId: string }[] = [];
	const auditRows: {
		transactionId: string;
		ruleId: string;
		wasHistoricalBackfill: boolean;
	}[] = [];

	const allHashtagNames = new Set<string>();
	for (const entry of nonSkipEvaluated) {
		for (const normalizedName of entry.mutation.hashtagsToAdd) {
			allHashtagNames.add(normalizedName);
		}
	}
	const hashtagsByName = await resolveHashtagsByName(
		userId,
		Array.from(allHashtagNames),
	);

	for (const entry of nonSkipEvaluated) {
		const appliedRuleId = entry.matchedRuleIds[0];
		const scalarUpdate = buildScalarUpdate({
			mutation: entry.mutation,
			appliedRuleId,
			categoryByLowerName,
		});

		if (Object.keys(scalarUpdate).length > 0) {
			const groupKey = JSON.stringify(scalarUpdate);
			const existingGroup = scalarGroups.get(groupKey);
			if (existingGroup) {
				existingGroup.txIds.push(entry.txId);
			} else {
				scalarGroups.set(groupKey, {
					txIds: [entry.txId],
					data: scalarUpdate,
				});
			}
		}

		if (entry.mutation.hashtagsToAdd.length > 0) {
			for (const normalizedName of entry.mutation.hashtagsToAdd) {
				if (entry.existingHashtagNames.has(normalizedName)) continue;
				const hashtag = hashtagsByName.get(normalizedName);
				if (!hashtag) continue;
				hashtagRows.push({
					transactionId: entry.txId,
					hashtagId: hashtag.id,
				});
			}
		}

		for (const ruleId of entry.matchedRuleIds) {
			auditRows.push({
				transactionId: entry.txId,
				ruleId,
				wasHistoricalBackfill: false,
			});
		}
	}

	await db.$transaction(async (tx) => {
		if (skipIds.length > 0) {
			await tx.transaction.updateMany({
				where: { id: { in: skipIds }, userId },
				data: { hidden: true },
			});
		}

		for (const group of scalarGroups.values()) {
			await tx.transaction.updateMany({
				where: { id: { in: group.txIds }, userId },
				data: group.data,
			});
		}

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

	logger.info("Applied import rules to transactions", {
		feature: "transaction_rules",
		operation: log.operation,
		userId,
		transactionCount: log.lookupCount,
		matchedCount: evaluated.length,
		rulesMs: Date.now() - rulesStartedAt,
	});
}

function buildScalarUpdate(input: {
	mutation: TransactionMutation;
	appliedRuleId?: string;
	categoryByLowerName: Map<string, { id: string; name: string }>;
}): ScalarUpdateGroup["data"] {
	const scalarUpdate: ScalarUpdateGroup["data"] = {};

	if (input.appliedRuleId) {
		scalarUpdate.appliedRuleId = input.appliedRuleId;
	}

	if (input.mutation.category) {
		const category = input.categoryByLowerName.get(
			input.mutation.category.toLowerCase(),
		);
		if (category) {
			scalarUpdate.categoryId = category.id;
			scalarUpdate.category = category.name;
		}
	}

	if (input.mutation.description !== undefined) {
		scalarUpdate.description = input.mutation.description;
	}

	if (input.mutation.type) {
		scalarUpdate.type = input.mutation.type as TransactionType;
	}

	return scalarUpdate;
}

async function resolveCategoriesByName(
	userId: string,
	categoryNames: Set<string>,
): Promise<Map<string, { id: string; name: string }>> {
	const categoryByLowerName = new Map<string, { id: string; name: string }>();
	if (categoryNames.size === 0) return categoryByLowerName;

	for (const categoryName of categoryNames) {
		const found = await findCategoryByDisplayName(db, userId, categoryName);
		const category = found
			? { id: found.id, name: found.name }
			: await db.category.create({
					data: { userId, name: categoryName },
					select: { id: true, name: true },
				});

		categoryByLowerName.set(categoryName.toLowerCase(), category);
	}

	return categoryByLowerName;
}

async function resolveHashtagsByName(
	userId: string,
	hashtagNames: string[],
): Promise<Map<string, { id: string; normalizedName: string }>> {
	const hashtagsByName = new Map<
		string,
		{ id: string; normalizedName: string }
	>();
	if (hashtagNames.length === 0) return hashtagsByName;

	const uniqueNames = Array.from(new Set(hashtagNames));
	const existing = await db.hashtag.findMany({
		where: {
			userId,
			normalizedName: { in: uniqueNames },
		},
		select: { id: true, normalizedName: true },
	});

	for (const hashtag of existing) {
		hashtagsByName.set(hashtag.normalizedName, hashtag);
	}

	const missing = uniqueNames.filter((name) => !hashtagsByName.has(name));
	if (missing.length > 0) {
		await db.hashtag.createMany({
			data: missing.map((normalizedName) => ({
				userId,
				name: normalizedName,
				normalizedName,
			})),
			skipDuplicates: true,
		});

		const created = await db.hashtag.findMany({
			where: { userId, normalizedName: { in: missing } },
			select: { id: true, normalizedName: true },
		});
		for (const hashtag of created) {
			hashtagsByName.set(hashtag.normalizedName, hashtag);
		}
	}

	return hashtagsByName;
}
