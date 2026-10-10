import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../../../generated/prisma";
import { runAmazonRetailMatching } from "./retail-transaction-matching.service";

type FakeOrderItem = {
	id: string;
	transactionId: string | null;
};

type FakeOrder = {
	id: string;
	userId: string;
	retailer: string;
	orderDate: Date | null;
	total: Prisma.Decimal | number | null;
	items: FakeOrderItem[];
};

type FakeTransaction = {
	id: string;
	userId: string;
	hidden: boolean;
	removedAt: Date | null;
	type: "INCOME" | "EXPENSE";
	date: Date;
	amount: Prisma.Decimal | number;
	description: string | null;
	originalDescription: string | null;
	merchantName: string | null;
	amazonRetailEnrichedAt: Date | null;
};

function createFakeDb(seed: {
	orders: FakeOrder[];
	transactions: FakeTransaction[];
}) {
	const orders = seed.orders.map((order) => ({
		...order,
		items: order.items.map((item) => ({ ...item })),
	}));
	const transactions = seed.transactions.map((transaction) => ({
		...transaction,
	}));
	const transactionCreates: unknown[] = [];

	return {
		transactionCreates,
		orders,
		transactions,
		retailOrder: {
			async findMany() {
				return orders.filter(
					(order) =>
						order.retailer === "amazon" &&
						order.items.some((item) => item.transactionId == null),
				);
			},
		},
		transaction: {
			async findMany(args: {
				where: {
					userId: string;
					hidden: boolean;
					removedAt: Date | null;
					type: string;
					date?: { gte: Date; lte: Date };
				};
				select: Record<string, boolean>;
			}) {
				return transactions
					.filter((transaction) => {
						if (transaction.userId !== args.where.userId) return false;
						if (transaction.hidden !== args.where.hidden) return false;
						if (transaction.removedAt !== args.where.removedAt) return false;
						if (transaction.type !== args.where.type) return false;
						const range = args.where.date;
						if (range) {
							if (
								transaction.date < range.gte ||
								transaction.date > range.lte
							) {
								return false;
							}
						}
						return true;
					})
					.map((transaction) => ({
						id: transaction.id,
						amount: transaction.amount,
						description: transaction.description,
						originalDescription: transaction.originalDescription,
						merchantName: transaction.merchantName,
					}));
			},
			async create(args: unknown) {
				transactionCreates.push(args);
				return args;
			},
			async updateMany(args: {
				where: { id: string; amazonRetailEnrichedAt: Date | null };
				data: { amazonRetailEnrichedAt: Date };
			}) {
				const transaction = transactions.find(
					(row) =>
						row.id === args.where.id &&
						row.amazonRetailEnrichedAt === args.where.amazonRetailEnrichedAt,
				);
				if (!transaction) return { count: 0 };
				transaction.amazonRetailEnrichedAt = args.data.amazonRetailEnrichedAt;
				return { count: 1 };
			},
		},
		retailOrderItem: {
			async updateMany(args: {
				where: { retailOrderId?: string; transactionId: string | null };
				data: {
					transactionId?: string;
					matchStatus: string;
					matchConfidence?: Prisma.Decimal;
					matchedAt?: Date;
					matchReason: string;
				};
			}) {
				const order = orders.find((row) => row.id === args.where.retailOrderId);
				if (!order) return { count: 0 };
				let count = 0;
				for (const item of order.items) {
					if (item.transactionId !== args.where.transactionId) continue;
					if (args.data.transactionId !== undefined) {
						item.transactionId = args.data.transactionId;
					}
					count += 1;
				}
				return { count };
			},
		},
	};
}

describe("runAmazonRetailMatching", () => {
	it("stamps amazonRetailEnrichedAt on the linked bank transaction", async () => {
		const db = createFakeDb({
			orders: [
				{
					id: "order-1",
					userId: "user-1",
					retailer: "amazon",
					orderDate: new Date("2026-08-01T12:00:00.000Z"),
					total: new Prisma.Decimal("42.50"),
					items: [{ id: "item-1", transactionId: null }],
				},
			],
			transactions: [
				{
					id: "tx-1",
					userId: "user-1",
					hidden: false,
					removedAt: null,
					type: "EXPENSE",
					date: new Date("2026-08-02T12:00:00.000Z"),
					amount: new Prisma.Decimal("-42.50"),
					description: "AMAZON MKTPLACE PMTS",
					originalDescription: null,
					merchantName: null,
					amazonRetailEnrichedAt: null,
				},
			],
		});

		const result = await runAmazonRetailMatching({
			db: db as never,
			userId: "user-1",
		});

		assert.equal(result.linkedItems, 1);
		assert.equal(db.transactionCreates.length, 0);
		assert.ok(db.transactions[0]?.amazonRetailEnrichedAt instanceof Date);
		assert.equal(db.orders[0]?.items[0]?.transactionId, "tx-1");
	});

	it("keeps the first amazonRetailEnrichedAt stamp on later matches", async () => {
		const firstStamp = new Date("2026-07-01T00:00:00.000Z");
		const db = createFakeDb({
			orders: [
				{
					id: "order-2",
					userId: "user-1",
					retailer: "amazon",
					orderDate: new Date("2026-08-01T12:00:00.000Z"),
					total: new Prisma.Decimal("10.00"),
					items: [{ id: "item-2", transactionId: null }],
				},
			],
			transactions: [
				{
					id: "tx-1",
					userId: "user-1",
					hidden: false,
					removedAt: null,
					type: "EXPENSE",
					date: new Date("2026-08-02T12:00:00.000Z"),
					amount: new Prisma.Decimal("-10.00"),
					description: "Amazon.com",
					originalDescription: null,
					merchantName: null,
					amazonRetailEnrichedAt: firstStamp,
				},
			],
		});

		const result = await runAmazonRetailMatching({
			db: db as never,
			userId: "user-1",
		});

		assert.equal(result.linkedItems, 1);
		assert.equal(db.transactions[0]?.amazonRetailEnrichedAt, firstStamp);
	});
});
