import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCategoryBudgetAlertsForUser } from "./category-budget-alert.service";

type Tx = {
	id: string;
	date: Date;
	type: string;
	amount: number;
	merchantName: string | null;
	description: string | null;
	categoryId: string | null;
	category: string | null;
	categoryRef: { name: string } | null;
	hashtags: [];
	financialAccountId: string | null;
	pending: boolean;
};

type BudgetRow = {
	userId: string;
	categoryId: string;
	monthlyGoal: number;
	alertsEnabled: boolean;
	alertThresholds: number[];
	category: { id: string; name: string };
};

type DeliveryRow = {
	id: string;
	evaluationWindow: string;
	dedupeKey: string;
	channels: string[];
	title: string;
	body: string;
	stateHash: string;
};

function expense(input: {
	id: string;
	date: string;
	amount: number;
	categoryId: string;
	categoryName: string;
	merchantName: string;
}): Tx {
	return {
		id: input.id,
		date: new Date(input.date),
		type: "EXPENSE",
		amount: input.amount,
		merchantName: input.merchantName,
		description: input.merchantName,
		categoryId: input.categoryId,
		category: input.categoryName,
		categoryRef: { name: input.categoryName },
		hashtags: [],
		financialAccountId: "acct-1",
		pending: false,
	};
}

function budget(input: {
	categoryId: string;
	name: string;
	monthlyGoal: number;
	alertThresholds?: number[];
}): BudgetRow {
	return {
		userId: "user-1",
		categoryId: input.categoryId,
		monthlyGoal: input.monthlyGoal,
		alertsEnabled: true,
		alertThresholds: input.alertThresholds ?? [75, 100],
		category: { id: input.categoryId, name: input.name },
	};
}

function createMockDb(options: {
	budgets: BudgetRow[];
	transactions: Tx[];
	existingWindows?: string[];
}) {
	const created: DeliveryRow[] = [];
	const existing: DeliveryRow[] = (options.existingWindows ?? []).map(
		(evaluationWindow, index) => ({
			id: `existing-${index}`,
			evaluationWindow,
			dedupeKey: `adhoc::${evaluationWindow}`,
			channels: ["EMAIL", "IN_APP"],
			title: "prior",
			body: "prior",
			stateHash: "{}",
		}),
	);

	const db = {
		categoryBudget: {
			findMany: async () => options.budgets,
		},
		notificationPreference: {
			upsert: async () => ({
				userId: "user-1",
				timezone: "UTC",
				emailEnabled: true,
				inAppEnabled: true,
				pushEnabled: false,
				pushPrivacyLevel: "SHOW_AMOUNTS",
			}),
		},
		user: {
			findUnique: async () => ({ email: "user@example.com" }),
		},
		transaction: {
			findMany: async (args?: { where?: { categoryId?: string } }) => {
				const categoryId = args?.where?.categoryId;
				if (!categoryId) return options.transactions;
				return options.transactions.filter(
					(row) => row.categoryId === categoryId,
				);
			},
			count: async () => 0,
		},
		financialAccount: {
			findMany: async () => [],
		},
		financialConnection: {
			findMany: async () => [],
		},
		expectedRecurringEvent: {
			findMany: async () => [],
		},
		profileLink: {
			findMany: async () => [],
		},
		balanceSnapshot: {
			count: async () => 1,
			findFirst: async () => null,
			findMany: async () => [],
		},
		notificationDelivery: {
			findMany: async () =>
				[...existing, ...created].map((row) => ({
					evaluationWindow: row.evaluationWindow,
				})),
			findUnique: async ({ where }: { where: { dedupeKey: string } }) =>
				[...existing, ...created].find(
					(row) => row.dedupeKey === where.dedupeKey,
				) ?? null,
			create: async ({ data }: { data: Omit<DeliveryRow, "id"> }) => {
				const row = { id: `del-${created.length + 1}`, ...data };
				created.push(row);
				return row;
			},
		},
		$queryRaw: async () => [],
	};

	return { db, created };
}

const now = new Date("2026-09-17T07:00:00.000Z");

describe("evaluateCategoryBudgetAlertsForUser", () => {
	it("alerts only the highest crossed threshold", async () => {
		const { db, created } = createMockDb({
			budgets: [
				budget({
					categoryId: "cat-dining",
					name: "Dining",
					monthlyGoal: 400,
				}),
			],
			transactions: [
				expense({
					id: "tx-1",
					date: "2026-09-10T12:00:00.000Z",
					amount: 520,
					categoryId: "cat-dining",
					categoryName: "Dining",
					merchantName: "Sushi Place",
				}),
			],
		});

		const result = await evaluateCategoryBudgetAlertsForUser(
			db as never,
			"user-1",
			now,
		);

		assert.equal(result.delivered, 1);
		assert.equal(created.length, 1);
		assert.equal(created[0]?.title, "Dining is over budget");
		assert.deepEqual(created[0]?.channels, ["EMAIL", "IN_APP"]);
		assert.equal(
			created[0]?.evaluationWindow,
			"budget-alert:cat-dining:2026-09",
		);
		assert.equal(JSON.parse(created[0]?.stateHash ?? "{}").threshold, 100);
	});

	it("sends one digest email and one in-app row per firing budget", async () => {
		const { db, created } = createMockDb({
			budgets: [
				budget({
					categoryId: "cat-dining",
					name: "Dining",
					monthlyGoal: 400,
				}),
				budget({
					categoryId: "cat-groceries",
					name: "Groceries",
					monthlyGoal: 200,
				}),
			],
			transactions: [
				expense({
					id: "tx-1",
					date: "2026-09-10T12:00:00.000Z",
					amount: 520,
					categoryId: "cat-dining",
					categoryName: "Dining",
					merchantName: "Sushi Place",
				}),
				expense({
					id: "tx-2",
					date: "2026-09-08T12:00:00.000Z",
					amount: 160,
					categoryId: "cat-groceries",
					categoryName: "Groceries",
					merchantName: "Costco",
				}),
			],
		});

		const result = await evaluateCategoryBudgetAlertsForUser(
			db as never,
			"user-1",
			now,
		);

		assert.equal(result.delivered, 2);
		assert.equal(created.length, 2);
		assert.equal(created[0]?.title, "Dining is over budget");
		assert.deepEqual(created[0]?.channels, ["EMAIL", "IN_APP"]);
		assert.equal(created[1]?.title, "Groceries reached 75% of its budget");
		assert.deepEqual(created[1]?.channels, ["IN_APP"]);
	});

	it("does not re-alert a category that already fired this month", async () => {
		const { db, created } = createMockDb({
			budgets: [
				budget({
					categoryId: "cat-dining",
					name: "Dining",
					monthlyGoal: 400,
				}),
				budget({
					categoryId: "cat-groceries",
					name: "Groceries",
					monthlyGoal: 200,
				}),
			],
			transactions: [
				expense({
					id: "tx-1",
					date: "2026-09-10T12:00:00.000Z",
					amount: 520,
					categoryId: "cat-dining",
					categoryName: "Dining",
					merchantName: "Sushi Place",
				}),
				expense({
					id: "tx-2",
					date: "2026-09-08T12:00:00.000Z",
					amount: 160,
					categoryId: "cat-groceries",
					categoryName: "Groceries",
					merchantName: "Costco",
				}),
			],
			existingWindows: ["budget-alert:cat-dining:75:2026-09"],
		});

		const result = await evaluateCategoryBudgetAlertsForUser(
			db as never,
			"user-1",
			now,
		);

		assert.equal(result.deduped, 1);
		assert.equal(result.delivered, 1);
		assert.equal(created.length, 1);
		assert.equal(created[0]?.title, "Groceries reached 75% of its budget");
		assert.deepEqual(created[0]?.channels, ["EMAIL", "IN_APP"]);
	});
});
