import { randomUUID } from "node:crypto";
import { CANONICAL_DEFAULT_CATEGORIES } from "@moat/category-mapping";
import {
	GOLDEN_ACCOUNT_IDS,
	GOLDEN_COSTCO_RULE,
	GOLDEN_ITEM_ID,
	RECONNECT_ACCOUNT_IDS_A,
	RECONNECT_ACCOUNT_IDS_B,
	RECONNECT_ITEM_ID_A,
	RECONNECT_ITEM_ID_B,
} from "@moat/plaid-golden-ledger";
import { db } from "~/server/db";

export async function seedGoldenCategories(): Promise<void> {
	for (const cat of CANONICAL_DEFAULT_CATEGORIES) {
		const existing = await db.category.findFirst({
			where: { userId: null, name: cat.name },
		});
		if (existing) continue;
		await db.category.create({
			data: {
				userId: null,
				name: cat.name,
				isDefault: true,
				isHidden: cat.isHidden ?? false,
				sortOrder: cat.sortOrder,
				parentCategory: cat.parentCategory ?? null,
			},
		});
	}
}

export async function cleanupGoldenWebhookEvents(): Promise<void> {
	await db.providerWebhookEvent.deleteMany({
		where: {
			provider: "PLAID",
			providerConnectionId: GOLDEN_ITEM_ID,
		},
	});
}

export async function cleanupGoldenFixtureResidue(): Promise<void> {
	await cleanupGoldenWebhookEvents();
	await db.user.deleteMany({
		where: {
			email: { startsWith: "golden-", endsWith: "@example.test" },
		},
	});
	await db.plaidItem.deleteMany({
		where: {
			plaidItemId: {
				in: [GOLDEN_ITEM_ID, RECONNECT_ITEM_ID_A, RECONNECT_ITEM_ID_B],
			},
		},
	});
	await db.plaidAccount.deleteMany({
		where: {
			plaidAccountId: {
				in: [
					...Object.values(GOLDEN_ACCOUNT_IDS),
					...Object.values(RECONNECT_ACCOUNT_IDS_A),
					...Object.values(RECONNECT_ACCOUNT_IDS_B),
				],
			},
		},
	});
	await db.financialConnection.deleteMany({
		where: {
			provider: "PLAID",
			providerConnectionId: {
				in: [GOLDEN_ITEM_ID, RECONNECT_ITEM_ID_A, RECONNECT_ITEM_ID_B],
			},
		},
	});
}

export async function createGoldenUser(): Promise<{
	id: string;
	email: string;
}> {
	const email = `golden-${randomUUID()}@example.test`;
	const user = await db.user.create({
		data: { email },
		select: { id: true, email: true },
	});
	return { id: user.id, email: user.email ?? email };
}

export async function seedGoldenCostcoRule(userId: string): Promise<void> {
	const rule = await db.transactionRule.create({
		data: {
			userId,
			name: "Costco to Shopping",
			priority: 1,
			isActive: true,
			match: "ALL",
			actions: {
				create: [
					{
						sortOrder: 0,
						type: "SET_CATEGORY",
						valueText: GOLDEN_COSTCO_RULE.setCategory,
					},
				],
			},
		},
	});
	const group = await db.transactionRuleConditionGroup.create({
		data: { ruleId: rule.id, match: "ALL", sortOrder: 0 },
	});
	await db.transactionRuleCondition.create({
		data: {
			ruleId: rule.id,
			groupId: group.id,
			sortOrder: 0,
			field: "DESCRIPTION",
			operator: "CONTAINS",
			valueText: GOLDEN_COSTCO_RULE.descriptionContains,
		},
	});
}

export async function applyGoldenUserCategoryOverride(
	userId: string,
	providerTransactionId: string,
	categoryName: string,
): Promise<void> {
	const category = await db.category.findFirst({
		where: { name: categoryName, OR: [{ userId: null }, { userId }] },
		select: { id: true },
	});
	if (!category) {
		throw new Error(`Golden category ${categoryName} was not seeded`);
	}
	await db.transaction.updateMany({
		where: { userId, externalTransactionId: providerTransactionId },
		data: { categoryId: category.id, category: categoryName },
	});
}

export async function deleteGoldenUser(userId: string): Promise<void> {
	await db.user.deleteMany({ where: { id: userId } });
}
