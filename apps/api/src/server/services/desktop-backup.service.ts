import {
	type InsurancePolicy,
	sanitizeInsurancePolicyForCloud,
} from "@moat/contracts";
import { logger } from "~/lib/logger";
import type { Prisma, PrismaClient } from "../../../generated/prisma";

export type DesktopBackupUpsertInput = {
	categories?: Array<{
		id: string;
		name: string;
		icon?: string | null;
		sortOrder?: number;
		isHidden?: boolean;
	}>;
	hashtags?: Array<{
		id: string;
		name: string;
		normalizedName: string;
	}>;
	rules?: Array<{
		id: string;
		name: string;
		isActive: boolean;
		priority: number;
		match?: "ALL" | "ANY";
		/** Omitted by older desktop clients, which only send flat `conditions`. */
		conditionGroups?: Array<{
			id: string;
			match?: "ALL" | "ANY";
			sortOrder: number;
			conditionIds: string[];
		}>;
		conditions: Array<{
			id: string;
			field:
				| "MERCHANT"
				| "DESCRIPTION"
				| "AMOUNT"
				| "CATEGORY"
				| "DATE"
				| "ACCOUNT"
				| "NOTES";
			operator:
				| "CONTAINS"
				| "NOT_CONTAINS"
				| "STARTS_WITH"
				| "ENDS_WITH"
				| "EQUALS"
				| "NOT_EQUALS"
				| "GREATER_THAN"
				| "GREATER_THAN_OR_EQUAL"
				| "LESS_THAN"
				| "LESS_THAN_OR_EQUAL"
				| "IS_EMPTY"
				| "IS_NOT_EMPTY"
				| "BEFORE"
				| "AFTER"
				| "ON"
				| "BETWEEN";
			valueText?: string | null;
			valueNumber?: number | null;
			valueDate?: string | null;
			secondValueText?: string | null;
			secondValueNumber?: number | null;
			secondValueDate?: string | null;
			sortOrder: number;
		}>;
		actions: Array<{
			id: string;
			type: "SET_CATEGORY" | "SET_DESCRIPTION" | "SET_TYPE" | "ADD_HASHTAG";
			valueText?: string | null;
			hashtagId?: string | null;
			hashtagName?: string | null;
			sortOrder: number;
		}>;
	}>;
	budgets?: Array<{
		id: string;
		categoryId: string;
		monthlyGoal: number;
	}>;
	scenarios?: Array<{
		id: string;
		name: string;
		type: "CONSERVATIVE" | "STANDARD" | "AGGRESSIVE" | "CUSTOM";
		investmentReturn: number;
		inflationRate: number;
		salaryGrowth: number;
		contributionChange: number;
		expenseGrowth: number;
		isActive: boolean;
	}>;
	financialProfileData?: {
		profile: Prisma.InputJsonValue;
		accounts: Prisma.InputJsonValue;
		incomeSources: Prisma.InputJsonValue;
		assets: Prisma.InputJsonValue;
		liabilities: Prisma.InputJsonValue;
		investments: Prisma.InputJsonValue;
		insurancePolicies: Prisma.InputJsonValue;
		taxProfile: Prisma.InputJsonValue;
		forecastAssumptions: Prisma.InputJsonValue;
		planningNotes: Prisma.InputJsonValue;
	};
	transactions?: Array<{
		id: string;
		date: string;
		postedDate?: string | null;
		amount: number;
		merchantName?: string | null;
		description?: string | null;
		type: "INCOME" | "EXPENSE";
		pending?: boolean;
		hidden?: boolean;
		source?: "CSV" | "MANUAL";
		account?: string | null;
		categoryId?: string | null;
		hashtagIds?: string[];
	}>;
};

export type DesktopBackupUpsertResult = {
	counts: {
		categories: number;
		hashtags: number;
		rules: number;
		budgets: number;
		scenarios: number;
		financialProfileData: number;
		transactions: number;
	};
};

export type DesktopBackupSummary = {
	systemCategories: Array<{ id: string; name: string; isHidden: boolean }>;
	counts: {
		categories: number;
		hashtags: number;
		rules: number;
		budgets: number;
		scenarios: number;
		transactions: number;
		hasFinancialProfileData: boolean;
	};
};

type TxClient = Prisma.TransactionClient;

function sanitizeFinancialProfileInsurance(
	value: Prisma.InputJsonValue,
): Prisma.InputJsonValue {
	if (!Array.isArray(value)) {
		return [];
	}
	const sanitized: InsurancePolicy[] = [];
	for (const item of value) {
		const policy = sanitizeInsurancePolicyForCloud(item as InsurancePolicy);
		if (policy) {
			sanitized.push(policy);
		}
	}
	return sanitized as unknown as Prisma.InputJsonValue;
}

async function loadOwnedCategoryIds(
	tx: TxClient,
	userId: string,
	ids: string[],
): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const unique = [...new Set(ids)];
	const rows = await tx.category.findMany({
		where: {
			id: { in: unique },
			OR: [{ userId: null }, { userId }],
		},
		select: { id: true },
	});
	return new Set(rows.map((row) => row.id));
}

async function upsertHashtags(
	tx: TxClient,
	userId: string,
	hashtags: NonNullable<DesktopBackupUpsertInput["hashtags"]>,
): Promise<Map<string, string>> {
	const idMap = new Map<string, string>();

	for (const hashtag of hashtags) {
		const existingByNormalized = await tx.hashtag.findUnique({
			where: {
				userId_normalizedName: {
					userId,
					normalizedName: hashtag.normalizedName,
				},
			},
			select: { id: true },
		});

		if (existingByNormalized) {
			await tx.hashtag.update({
				where: { id: existingByNormalized.id },
				data: { name: hashtag.name },
			});
			idMap.set(hashtag.id, existingByNormalized.id);
			continue;
		}

		const existingById = await tx.hashtag.findUnique({
			where: { id: hashtag.id },
			select: { userId: true },
		});
		if (existingById && existingById.userId !== userId) {
			continue;
		}

		await tx.hashtag.upsert({
			where: { id: hashtag.id },
			create: {
				id: hashtag.id,
				userId,
				name: hashtag.name,
				normalizedName: hashtag.normalizedName,
			},
			update: {
				name: hashtag.name,
				normalizedName: hashtag.normalizedName,
			},
		});
		idMap.set(hashtag.id, hashtag.id);
	}

	return idMap;
}

function remapHashtagId(
	idMap: Map<string, string>,
	hashtagId: string | null | undefined,
	hashtagName: string | null | undefined,
	nameToId: Map<string, string>,
): string | null {
	if (hashtagId) {
		const mapped = idMap.get(hashtagId);
		if (mapped) return mapped;
	}
	if (hashtagName) {
		const normalized = hashtagName.replace(/^#/, "").toLowerCase().trim();
		return nameToId.get(normalized) ?? null;
	}
	return null;
}

export async function getDesktopBackupSummary(
	db: PrismaClient,
	userId: string,
): Promise<DesktopBackupSummary> {
	const [
		systemCategories,
		categories,
		hashtags,
		rules,
		budgets,
		scenarios,
		transactions,
		financialProfileData,
	] = await Promise.all([
		db.category.findMany({
			where: { userId: null },
			select: { id: true, name: true, isHidden: true },
			orderBy: { name: "asc" },
		}),
		db.category.count({ where: { userId } }),
		db.hashtag.count({ where: { userId } }),
		db.transactionRule.count({ where: { userId } }),
		db.categoryBudget.count({ where: { userId } }),
		db.forecastScenario.count({ where: { userId } }),
		db.transaction.count({ where: { userId } }),
		db.financialProfileData.findUnique({
			where: { userId },
			select: { id: true },
		}),
	]);

	return {
		systemCategories,
		counts: {
			categories,
			hashtags,
			rules,
			budgets,
			scenarios,
			transactions,
			hasFinancialProfileData: Boolean(financialProfileData),
		},
	};
}

export async function upsertDesktopBackup(
	db: PrismaClient,
	userId: string,
	input: DesktopBackupUpsertInput,
): Promise<DesktopBackupUpsertResult> {
	const counts = {
		categories: 0,
		hashtags: 0,
		rules: 0,
		budgets: 0,
		scenarios: 0,
		financialProfileData: 0,
		transactions: 0,
	};

	const referencedCategoryIds = [
		...(input.budgets?.map((budget) => budget.categoryId) ?? []),
		...(input.transactions
			?.map((row) => row.categoryId)
			.filter((id): id is string => Boolean(id)) ?? []),
		...(input.rules
			?.flatMap((rule) =>
				rule.actions
					.filter((action) => action.type === "SET_CATEGORY")
					.map((action) => action.valueText),
			)
			.filter((id): id is string => Boolean(id)) ?? []),
	];

	await db.$transaction(
		async (tx) => {
			if (input.categories?.length) {
				for (const category of input.categories) {
					const existing = await tx.category.findUnique({
						where: { id: category.id },
						select: { userId: true },
					});
					if (existing?.userId != null && existing.userId !== userId) {
						continue;
					}
					if (existing?.userId == null && existing) {
						continue;
					}
					await tx.category.upsert({
						where: { id: category.id },
						create: {
							id: category.id,
							userId,
							name: category.name,
							icon: category.icon ?? null,
							sortOrder: category.sortOrder ?? 0,
							isHidden: category.isHidden ?? false,
							isDefault: false,
						},
						update: {
							name: category.name,
							icon: category.icon ?? null,
							sortOrder: category.sortOrder ?? 0,
							isHidden: category.isHidden ?? false,
						},
					});
					counts.categories += 1;
				}
			}

			const validCategoryIds = await loadOwnedCategoryIds(tx, userId, [
				...referencedCategoryIds,
				...(input.categories?.map((category) => category.id) ?? []),
			]);

			let hashtagIdMap = new Map<string, string>();
			if (input.hashtags?.length) {
				hashtagIdMap = await upsertHashtags(tx, userId, input.hashtags);
				counts.hashtags = hashtagIdMap.size;
			}

			const userHashtags = await tx.hashtag.findMany({
				where: { userId },
				select: { id: true, normalizedName: true },
			});
			const hashtagNameToId = new Map(
				userHashtags.map((hashtag) => [hashtag.normalizedName, hashtag.id]),
			);

			if (input.rules?.length) {
				for (const rule of input.rules) {
					const existing = await tx.transactionRule.findUnique({
						where: { id: rule.id },
						select: { userId: true },
					});
					if (existing && existing.userId !== userId) {
						continue;
					}

					const ruleMatch = rule.match === "ANY" ? "ANY" : "ALL";

					await tx.transactionRule.upsert({
						where: { id: rule.id },
						create: {
							id: rule.id,
							userId,
							name: rule.name,
							isActive: rule.isActive,
							priority: rule.priority,
							match: ruleMatch,
						},
						update: {
							name: rule.name,
							isActive: rule.isActive,
							priority: rule.priority,
							match: ruleMatch,
						},
					});

					await tx.transactionRuleCondition.deleteMany({
						where: { ruleId: rule.id },
					});
					await tx.transactionRuleConditionGroup.deleteMany({
						where: { ruleId: rule.id },
					});
					await tx.transactionRuleAction.deleteMany({
						where: { ruleId: rule.id },
					});

					if (rule.conditions.length > 0) {
						const conditionsById = new Map(
							rule.conditions.map((condition) => [condition.id, condition]),
						);
						const claimedConditionIds = new Set<string>();
						const backedUpGroups = (rule.conditionGroups ?? [])
							.map((group) => ({
								id: group.id,
								match:
									group.match === "ANY" ? ("ANY" as const) : ("ALL" as const),
								sortOrder: group.sortOrder,
								conditions: group.conditionIds.flatMap((conditionId) => {
									const condition = conditionsById.get(conditionId);
									if (!condition || claimedConditionIds.has(conditionId)) {
										return [];
									}
									claimedConditionIds.add(conditionId);
									return [condition];
								}),
							}))
							.filter((group) => group.conditions.length > 0);

						// Older clients send no groups, and any condition a client left
						// out of its groups still has to land somewhere.
						const ungrouped = rule.conditions.filter(
							(condition) => !claimedConditionIds.has(condition.id),
						);
						const groups =
							ungrouped.length > 0
								? [
										...backedUpGroups,
										{
											id: `rcg_${rule.id}`,
											match: "ALL" as const,
											sortOrder: backedUpGroups.length,
											conditions: ungrouped,
										},
									]
								: backedUpGroups;

						for (const [groupIndex, group] of groups.entries()) {
							const created = await tx.transactionRuleConditionGroup.create({
								data: {
									id: group.id,
									ruleId: rule.id,
									match: group.match,
									sortOrder: groupIndex,
								},
							});
							await tx.transactionRuleCondition.createMany({
								data: group.conditions.map((condition) => ({
									id: condition.id,
									ruleId: rule.id,
									groupId: created.id,
									field: condition.field,
									operator: condition.operator,
									valueText: condition.valueText ?? null,
									valueNumber: condition.valueNumber ?? null,
									valueDate: condition.valueDate
										? new Date(condition.valueDate)
										: null,
									secondValueText: condition.secondValueText ?? null,
									secondValueNumber: condition.secondValueNumber ?? null,
									secondValueDate: condition.secondValueDate
										? new Date(condition.secondValueDate)
										: null,
									sortOrder: condition.sortOrder,
								})),
							});
						}
					}

					if (rule.actions.length > 0) {
						await tx.transactionRuleAction.createMany({
							data: rule.actions.map((action) => {
								const valueText =
									action.type === "SET_CATEGORY"
										? action.valueText && validCategoryIds.has(action.valueText)
											? action.valueText
											: null
										: (action.valueText ?? null);
								const hashtagId =
									action.type === "ADD_HASHTAG"
										? remapHashtagId(
												hashtagIdMap,
												action.hashtagId,
												action.hashtagName,
												hashtagNameToId,
											)
										: null;
								return {
									id: action.id,
									ruleId: rule.id,
									type: action.type,
									valueText,
									hashtagId,
									sortOrder: action.sortOrder,
								};
							}),
						});
					}

					counts.rules += 1;
				}
			}

			if (input.budgets?.length) {
				for (const budget of input.budgets) {
					if (!validCategoryIds.has(budget.categoryId)) {
						continue;
					}

					const existingByPair = await tx.categoryBudget.findUnique({
						where: {
							userId_categoryId: {
								userId,
								categoryId: budget.categoryId,
							},
						},
						select: { id: true },
					});
					if (existingByPair) {
						await tx.categoryBudget.update({
							where: { id: existingByPair.id },
							data: { monthlyGoal: budget.monthlyGoal },
						});
						counts.budgets += 1;
						continue;
					}

					const existingById = await tx.categoryBudget.findUnique({
						where: { id: budget.id },
						select: { userId: true },
					});
					if (existingById && existingById.userId !== userId) {
						continue;
					}
					if (existingById) {
						await tx.categoryBudget.update({
							where: { id: budget.id },
							data: {
								categoryId: budget.categoryId,
								monthlyGoal: budget.monthlyGoal,
							},
						});
					} else {
						await tx.categoryBudget.create({
							data: {
								id: budget.id,
								userId,
								categoryId: budget.categoryId,
								monthlyGoal: budget.monthlyGoal,
							},
						});
					}
					counts.budgets += 1;
				}
			}

			if (input.scenarios?.length) {
				for (const scenario of input.scenarios) {
					const existing = await tx.forecastScenario.findUnique({
						where: { id: scenario.id },
						select: { userId: true },
					});
					if (existing && existing.userId !== userId) {
						continue;
					}
					await tx.forecastScenario.upsert({
						where: { id: scenario.id },
						create: {
							id: scenario.id,
							userId,
							name: scenario.name,
							type: scenario.type,
							investmentReturn: scenario.investmentReturn,
							inflationRate: scenario.inflationRate,
							salaryGrowth: scenario.salaryGrowth,
							contributionChange: scenario.contributionChange,
							expenseGrowth: scenario.expenseGrowth,
							isActive: scenario.isActive,
						},
						update: {
							name: scenario.name,
							type: scenario.type,
							investmentReturn: scenario.investmentReturn,
							inflationRate: scenario.inflationRate,
							salaryGrowth: scenario.salaryGrowth,
							contributionChange: scenario.contributionChange,
							expenseGrowth: scenario.expenseGrowth,
							isActive: scenario.isActive,
						},
					});
					counts.scenarios += 1;
				}
			}

			if (input.financialProfileData) {
				const financialProfileData = {
					...input.financialProfileData,
					insurancePolicies: sanitizeFinancialProfileInsurance(
						input.financialProfileData.insurancePolicies,
					),
				};
				await tx.financialProfileData.upsert({
					where: { userId },
					create: {
						userId,
						...financialProfileData,
					},
					update: {
						...financialProfileData,
					},
				});
				counts.financialProfileData = 1;
			}

			if (input.transactions?.length) {
				for (const row of input.transactions) {
					const existing = await tx.transaction.findUnique({
						where: { id: row.id },
						select: { userId: true },
					});
					if (existing && existing.userId !== userId) {
						continue;
					}
					const categoryId =
						row.categoryId && validCategoryIds.has(row.categoryId)
							? row.categoryId
							: null;
					await tx.transaction.upsert({
						where: { id: row.id },
						create: {
							id: row.id,
							userId,
							date: new Date(row.date),
							postedDate: row.postedDate ? new Date(row.postedDate) : null,
							amount: row.amount,
							merchantName: row.merchantName ?? null,
							description: row.description ?? null,
							type: row.type,
							pending: row.pending ?? false,
							hidden: row.hidden ?? false,
							source: row.source ?? "MANUAL",
							account: row.account ?? null,
							categoryId,
							category: "OTHER",
						},
						update: {
							date: new Date(row.date),
							postedDate: row.postedDate ? new Date(row.postedDate) : null,
							amount: row.amount,
							merchantName: row.merchantName ?? null,
							description: row.description ?? null,
							type: row.type,
							pending: row.pending ?? false,
							hidden: row.hidden ?? false,
							source: row.source ?? "MANUAL",
							account: row.account ?? null,
							categoryId,
						},
					});

					if (row.hashtagIds) {
						const ownedHashtagIds = [
							...new Set(
								row.hashtagIds
									.map((id) => hashtagIdMap.get(id) ?? id)
									.filter((id) =>
										userHashtags.some((hashtag) => hashtag.id === id),
									),
							),
						];
						await tx.transactionHashtag.deleteMany({
							where: { transactionId: row.id },
						});
						if (ownedHashtagIds.length > 0) {
							await tx.transactionHashtag.createMany({
								data: ownedHashtagIds.map((hashtagId) => ({
									transactionId: row.id,
									hashtagId,
								})),
								skipDuplicates: true,
							});
						}
					}

					counts.transactions += 1;
				}
			}
		},
		{
			maxWait: 15_000,
			timeout: 120_000,
		},
	);

	logger.info("Desktop backup upsert completed", {
		feature: "desktopBackup",
		operation: "upsert",
		userId,
		...counts,
	});

	return { counts };
}
