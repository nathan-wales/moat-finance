import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { transactionSplitService } from "./transaction-split.service";

type TxRow = {
	id: string;
	userId: string;
	date: Date;
	postedDate: Date | null;
	authorizedDate: Date | null;
	amount: number;
	isoCurrencyCode: string | null;
	unofficialCurrencyCode: string | null;
	type: "INCOME" | "EXPENSE";
	category: string;
	categoryId: string | null;
	description: string | null;
	originalDescription: string | null;
	notes: string | null;
	merchantName: string | null;
	account: string | null;
	paymentChannel: string | null;
	source: string;
	pending: boolean;
	hidden: boolean;
	plaidAccountId: string | null;
	plaidItemId: string | null;
	appleFinanceKitAccountId: string | null;
	financialConnectionId: string | null;
	financialAccountId: string | null;
	dataProvider: string | null;
	providerAccountId: string | null;
	sourceAccountId: string | null;
	importBatchId: string | null;
	location: unknown;
	raw: unknown;
	appliedRuleId: string | null;
	splitGroupId: string | null;
	splitParentId: string | null;
	splitOriginalAmount: number | null;
	createdAt: Date;
};

type CategoryRow = {
	id: string;
	userId: string | null;
	name: string;
};

function matchesWhere(row: TxRow, where: Record<string, unknown>): boolean {
	if (where.id && row.id !== where.id) return false;
	if (where.userId && row.userId !== where.userId) return false;
	if (where.splitGroupId && row.splitGroupId !== where.splitGroupId) {
		return false;
	}
	if (
		where.id &&
		typeof where.id === "object" &&
		where.id &&
		"in" in where.id
	) {
		const ids = (where.id as { in: string[] }).in;
		if (!ids.includes(row.id)) return false;
	}
	return true;
}

function createFakeDb(seed: {
	transactions: TxRow[];
	categories?: CategoryRow[];
}) {
	const transactions = seed.transactions.map((row) => ({ ...row }));
	const categories = [...(seed.categories ?? [])];
	const hashtags: Array<{
		id: string;
		userId: string;
		name: string;
		normalizedName: string;
	}> = [];
	const transactionHashtags: Array<{
		transactionId: string;
		hashtagId: string;
	}> = [];
	let idCounter = 1;

	const api: {
		transaction: Record<string, unknown>;
		category: Record<string, unknown>;
		categoryOverride: Record<string, unknown>;
		hashtag: Record<string, unknown>;
		transactionHashtag: Record<string, unknown>;
		$transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
		transactions: TxRow[];
	} = {
		transaction: {
			async findFirst({ where }: { where: Record<string, unknown> }) {
				return transactions.find((row) => matchesWhere(row, where)) ?? null;
			},
			async findMany({
				where,
			}: {
				where: Record<string, unknown>;
				orderBy?: unknown;
				include?: unknown;
			}) {
				return transactions
					.filter((row) => matchesWhere(row, where))
					.map((row) => ({
						...row,
						hashtags: transactionHashtags
							.filter((link) => link.transactionId === row.id)
							.map((link) => {
								const hashtag = hashtags.find(
									(item) => item.id === link.hashtagId,
								);
								return { hashtag };
							}),
						categoryRef: row.categoryId
							? {
									id: row.categoryId,
									name:
										categories.find(
											(category) => category.id === row.categoryId,
										)?.name ?? row.category,
									isHidden: false,
									isDefault: false,
									overrides: [],
								}
							: null,
						plaidAccount: row.account ? { name: row.account } : null,
					}));
			},
			async update({
				where,
				data,
			}: {
				where: { id: string };
				data: Partial<TxRow>;
			}) {
				const row = transactions.find((item) => item.id === where.id);
				if (!row) throw new Error("missing");
				Object.assign(row, data);
				if (data.amount != null) row.amount = Number(data.amount);
				if (data.splitOriginalAmount != null) {
					row.splitOriginalAmount = Number(data.splitOriginalAmount);
				}
				return row;
			},
			async create({ data }: { data: Partial<TxRow> & { userId: string } }) {
				const row: TxRow = {
					id: `tx-${idCounter++}`,
					date: data.date ?? new Date("2026-09-14"),
					postedDate: data.postedDate ?? null,
					authorizedDate: data.authorizedDate ?? null,
					amount: Number(data.amount),
					isoCurrencyCode: data.isoCurrencyCode ?? null,
					unofficialCurrencyCode: data.unofficialCurrencyCode ?? null,
					type: data.type ?? "EXPENSE",
					category: data.category ?? "Uncategorized",
					categoryId: data.categoryId ?? null,
					description: data.description ?? null,
					originalDescription: data.originalDescription ?? null,
					notes: data.notes ?? null,
					merchantName: data.merchantName ?? null,
					account: data.account ?? null,
					paymentChannel: data.paymentChannel ?? null,
					source: data.source ?? "MANUAL",
					pending: data.pending ?? false,
					hidden: data.hidden ?? false,
					plaidAccountId: data.plaidAccountId ?? null,
					plaidItemId: data.plaidItemId ?? null,
					appleFinanceKitAccountId: data.appleFinanceKitAccountId ?? null,
					financialConnectionId: data.financialConnectionId ?? null,
					financialAccountId: data.financialAccountId ?? null,
					dataProvider: data.dataProvider ?? null,
					providerAccountId: data.providerAccountId ?? null,
					sourceAccountId: data.sourceAccountId ?? null,
					importBatchId: data.importBatchId ?? null,
					location: data.location ?? null,
					raw: data.raw ?? null,
					appliedRuleId: data.appliedRuleId ?? null,
					splitGroupId: data.splitGroupId ?? null,
					splitParentId: data.splitParentId ?? null,
					splitOriginalAmount:
						data.splitOriginalAmount == null
							? null
							: Number(data.splitOriginalAmount),
					createdAt: new Date(),
					userId: data.userId,
				};
				transactions.push(row);
				return row;
			},
			async deleteMany({ where }: { where: Record<string, unknown> }) {
				const ids =
					where.id && typeof where.id === "object" && "in" in where.id
						? (where.id as { in: string[] }).in
						: [];
				let count = 0;
				for (let index = transactions.length - 1; index >= 0; index--) {
					const row = transactions[index];
					if (!row) continue;
					if (ids.includes(row.id) && row.userId === where.userId) {
						transactions.splice(index, 1);
						count += 1;
					}
				}
				return { count };
			},
		},
		category: {
			async findMany({
				where,
			}: {
				where: { name?: { equals: string }; OR?: unknown };
			}) {
				const name =
					typeof where.name === "object" ? where.name.equals : undefined;
				if (!name)
					return categories.map((category) => ({ ...category, overrides: [] }));
				return categories
					.filter(
						(category) => category.name.toLowerCase() === name.toLowerCase(),
					)
					.map((category) => ({ ...category, overrides: [] }));
			},
			async create({ data }: { data: { userId: string; name: string } }) {
				const row = { id: `cat-${idCounter++}`, ...data };
				categories.push(row);
				return row;
			},
		},
		categoryOverride: {
			async findFirst() {
				return null;
			},
		},
		hashtag: {
			async upsert({
				where,
				create,
			}: {
				where: {
					userId_normalizedName: { userId: string; normalizedName: string };
				};
				create: { userId: string; name: string; normalizedName: string };
			}) {
				const existing = hashtags.find(
					(hashtag) =>
						hashtag.userId === where.userId_normalizedName.userId &&
						hashtag.normalizedName ===
							where.userId_normalizedName.normalizedName,
				);
				if (existing) return existing;
				const created = { id: `tag-${idCounter++}`, ...create };
				hashtags.push(created);
				return created;
			},
		},
		transactionHashtag: {
			async deleteMany({ where }: { where: { transactionId: string } }) {
				for (let index = transactionHashtags.length - 1; index >= 0; index--) {
					if (
						transactionHashtags[index]?.transactionId === where.transactionId
					) {
						transactionHashtags.splice(index, 1);
					}
				}
			},
			async createMany({
				data,
			}: {
				data: Array<{ transactionId: string; hashtagId: string }>;
			}) {
				transactionHashtags.push(...data);
			},
		},
		async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
			return fn(api);
		},
		transactions,
	};

	return api;
}

function seedParent(overrides?: Partial<TxRow>): TxRow {
	return {
		id: "parent-1",
		userId: "user-1",
		date: new Date("2026-09-14"),
		postedDate: new Date("2026-09-14"),
		authorizedDate: null,
		amount: 100,
		isoCurrencyCode: "USD",
		unofficialCurrencyCode: null,
		type: "EXPENSE",
		category: "Shopping",
		categoryId: "cat-shop",
		description: "Costco",
		originalDescription: "COSTCO WHSE",
		notes: null,
		merchantName: "Costco",
		account: "Robinhood Credit Card",
		paymentChannel: null,
		source: "PLAID",
		pending: false,
		hidden: false,
		plaidAccountId: "acct-1",
		plaidItemId: "item-1",
		appleFinanceKitAccountId: "fk-acct-1",
		financialConnectionId: null,
		financialAccountId: null,
		dataProvider: null,
		providerAccountId: null,
		sourceAccountId: null,
		importBatchId: null,
		location: null,
		raw: null,
		appliedRuleId: null,
		splitGroupId: null,
		splitParentId: null,
		splitOriginalAmount: null,
		createdAt: new Date("2026-09-14"),
		...overrides,
	};
}

describe("transactionSplitService", () => {
	it("creates n child rows and keeps the parent amount", async () => {
		const db = createFakeDb({
			transactions: [seedParent()],
			categories: [{ id: "cat-shop", userId: "user-1", name: "Shopping" }],
		});

		const result = await transactionSplitService.split(db as never, "user-1", {
			id: "parent-1",
			type: "EXPENSE",
			legs: [
				{
					description: "Sensodyne",
					amount: 27.93,
					categoryName: "Personal Care",
					hashtags: ["health"],
					notes: "Toothpaste",
				},
				{
					description: "Baby wipes",
					amount: 17.18,
					categoryName: "Baby Supplies",
					hashtags: [],
				},
				{
					description: "Groceries",
					amount: 54.89,
					categoryName: "Groceries",
					hashtags: ["shared"],
					hidden: true,
				},
			],
		});

		const parent = db.transactions.find((row) => row.id === "parent-1");
		assert.equal(parent?.amount, 100);
		assert.equal(parent?.splitGroupId, "parent-1");
		assert.equal(parent?.splitParentId, null);
		assert.equal(result.splitIds.length, 3);
		assert.equal(db.transactions.filter((row) => row.splitParentId).length, 3);
		assert.equal(
			db.transactions.find((row) => row.description === "Groceries")?.hidden,
			true,
		);
		assert.equal(
			db.transactions.find((row) => row.splitParentId)
				?.appleFinanceKitAccountId,
			"fk-acct-1",
		);
	});

	it("writes a per-leg date onto child rows", async () => {
		const db = createFakeDb({
			transactions: [seedParent()],
			categories: [{ id: "cat-shop", userId: "user-1", name: "Shopping" }],
		});
		const firstDate = "2026-04-01";
		const secondDate = "2026-04-15";

		await transactionSplitService.split(db as never, "user-1", {
			id: "parent-1",
			type: "EXPENSE",
			legs: [
				{
					description: "Deposit",
					amount: 40,
					categoryName: "Savings",
					hashtags: [],
					date: firstDate,
				},
				{
					description: "Remainder",
					amount: 60,
					categoryName: "Shopping",
					hashtags: [],
					date: secondDate,
				},
			],
		});

		assert.equal(
			db.transactions
				.find((row) => row.description === "Deposit")
				?.date.toISOString(),
			"2026-04-01T12:00:00.000Z",
		);
		assert.equal(
			db.transactions
				.find((row) => row.description === "Remainder")
				?.date.toISOString(),
			"2026-04-15T12:00:00.000Z",
		);
		assert.equal(
			db.transactions
				.find((row) => row.description === "Deposit")
				?.postedDate?.toISOString(),
			"2026-04-01T12:00:00.000Z",
		);
	});

	it("rejects legs that do not sum to the original", async () => {
		const db = createFakeDb({ transactions: [seedParent()] });
		await assert.rejects(
			() =>
				transactionSplitService.split(db as never, "user-1", {
					id: "parent-1",
					type: "EXPENSE",
					legs: [
						{
							description: "A",
							amount: 40,
							categoryName: "Shopping",
							hashtags: [],
						},
						{
							description: "B",
							amount: 40,
							categoryName: "Shopping",
							hashtags: [],
						},
					],
				}),
			/add up to the original amount/,
		);
	});

	it("unsplits n children and restores the original", async () => {
		const db = createFakeDb({
			transactions: [
				seedParent({
					splitGroupId: "parent-1",
					splitOriginalAmount: 100,
				}),
				seedParent({
					id: "child-a",
					amount: 60,
					description: "A",
					source: "MANUAL",
					splitGroupId: "parent-1",
					splitParentId: "parent-1",
					splitOriginalAmount: 100,
				}),
				seedParent({
					id: "child-b",
					amount: 40,
					description: "B",
					source: "MANUAL",
					splitGroupId: "parent-1",
					splitParentId: "parent-1",
					splitOriginalAmount: 100,
				}),
			],
		});

		const result = await transactionSplitService.unsplit(
			db as never,
			"user-1",
			"child-a",
		);
		assert.equal(result.restoredId, "parent-1");
		assert.deepEqual(result.removedIds.sort(), ["child-a", "child-b"]);
		const parent = db.transactions.find((row) => row.id === "parent-1");
		assert.equal(parent?.splitGroupId, null);
		assert.equal(parent?.amount, 100);
		assert.equal(db.transactions.length, 1);
	});

	it("updateSplit adds and removes legs while keeping ids", async () => {
		const db = createFakeDb({
			transactions: [
				seedParent({
					splitGroupId: "parent-1",
					splitOriginalAmount: 100,
				}),
				seedParent({
					id: "child-a",
					amount: 60,
					description: "A",
					source: "MANUAL",
					splitGroupId: "parent-1",
					splitParentId: "parent-1",
					splitOriginalAmount: 100,
					category: "Shopping",
					categoryId: "cat-shop",
				}),
				seedParent({
					id: "child-b",
					amount: 40,
					description: "B",
					source: "MANUAL",
					splitGroupId: "parent-1",
					splitParentId: "parent-1",
					splitOriginalAmount: 100,
					category: "Shopping",
					categoryId: "cat-shop",
				}),
			],
			categories: [{ id: "cat-shop", userId: "user-1", name: "Shopping" }],
		});

		const result = await transactionSplitService.updateSplit(
			db as never,
			"user-1",
			{
				id: "child-a",
				type: "EXPENSE",
				legs: [
					{
						id: "child-a",
						description: "A updated",
						amount: 50,
						categoryName: "Shopping",
						hashtags: [],
					},
					{
						description: "C",
						amount: 50,
						categoryName: "Groceries",
						hashtags: ["new"],
					},
				],
			},
		);

		assert.ok(result.splitIds.includes("child-a"));
		assert.equal(result.splitIds.length, 2);
		assert.equal(
			db.transactions.find((row) => row.id === "child-b"),
			undefined,
		);
		assert.equal(
			db.transactions.find((row) => row.id === "child-a")?.description,
			"A updated",
		);
	});

	it("updateSplit rejects legs that do not belong to the group", async () => {
		const db = createFakeDb({
			transactions: [
				seedParent({
					splitGroupId: "parent-1",
					splitOriginalAmount: 100,
				}),
				seedParent({
					id: "child-a",
					amount: 60,
					description: "A",
					source: "MANUAL",
					splitGroupId: "parent-1",
					splitParentId: "parent-1",
					splitOriginalAmount: 100,
				}),
				seedParent({
					id: "child-b",
					amount: 40,
					description: "B",
					source: "MANUAL",
					splitGroupId: "parent-1",
					splitParentId: "parent-1",
					splitOriginalAmount: 100,
				}),
			],
		});

		await assert.rejects(
			() =>
				transactionSplitService.updateSplit(db as never, "user-1", {
					id: "child-a",
					type: "EXPENSE",
					legs: [
						{
							id: "child-a",
							description: "A",
							amount: 50,
							categoryName: "Shopping",
							hashtags: [],
						},
						{
							id: "other-tx",
							description: "Other",
							amount: 50,
							categoryName: "Shopping",
							hashtags: [],
						},
					],
				}),
			/Split leg was not found/,
		);
	});
});
