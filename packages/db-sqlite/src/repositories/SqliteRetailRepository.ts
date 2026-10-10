import { randomUUID } from "node:crypto";
import { mapRetailOrderListItem } from "@moat/contracts";
import type {
	RetailOrderImportInput,
	RetailRepository,
	RetailSaveResult,
} from "@moat/data-access";
import {
	matchAmazonOrdersToTransactions,
	summarizeAmazonRetailDetection,
} from "@moat/domain";
import type { SqliteDbClient } from "../db-client";

function parseOptionalDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

type RetailOrderRow = {
	id: string;
	orderDate: Date | null;
	total: number | null;
	items: Array<{ id: string; transactionId: string | null }>;
};

export class SqliteRetailRepository implements RetailRepository {
	constructor(private db: SqliteDbClient) {}

	async upsertConnection(input: {
		userId: string;
		retailer: string;
		status: string;
		lastSyncedAt?: Date | null;
	}): Promise<void> {
		const now = new Date();
		await this.db.retailConnection.upsert({
			where: {
				userId_retailer: {
					userId: input.userId,
					retailer: input.retailer,
				},
			},
			create: {
				id: randomUUID(),
				userId: input.userId,
				retailer: input.retailer,
				status: input.status,
				lastSyncedAt: input.lastSyncedAt ?? null,
				createdAt: now,
				updatedAt: now,
			},
			update: {
				status: input.status,
				lastSyncedAt:
					input.lastSyncedAt === undefined ? undefined : input.lastSyncedAt,
				updatedAt: now,
			},
		});
	}

	async saveImport(input: {
		userId: string;
		retailer: string;
		orders: RetailOrderImportInput[];
	}): Promise<RetailSaveResult> {
		const orders = input.orders.filter(
			(order) => order.retailer === input.retailer,
		);
		let created = 0;
		let updated = 0;
		const skipped = input.orders.length - orders.length;

		for (const order of orders) {
			const existing = (await this.db.retailOrder.findUnique({
				where: {
					userId_retailer_externalOrderId: {
						userId: input.userId,
						retailer: order.retailer,
						externalOrderId: order.externalOrderId,
					},
				},
				select: { id: true },
			})) as { id: string } | null;

			const orderId = existing?.id ?? randomUUID();
			const now = new Date();

			if (existing) {
				await this.db.retailOrderItem.deleteMany({
					where: { retailOrderId: existing.id },
				});
				await this.db.retailOrder.update({
					where: { id: existing.id },
					data: {
						orderDate: parseOptionalDate(order.orderDate),
						orderUrl: order.orderUrl ?? null,
						currency: order.currency,
						subtotal: order.subtotal ?? null,
						tax: order.tax ?? null,
						shipping: order.shipping ?? null,
						discount: order.discount ?? null,
						total: order.total ?? null,
						sourceUrl: order.raw.sourceUrl,
						scrapedAt: new Date(order.raw.scrapedAt),
						parserVersion: order.raw.parserVersion,
						pageHash: order.raw.pageHash ?? null,
						updatedAt: now,
					},
				});
				updated += 1;
			} else {
				await this.db.retailOrder.create({
					data: {
						id: orderId,
						userId: input.userId,
						retailer: order.retailer,
						externalOrderId: order.externalOrderId,
						orderDate: parseOptionalDate(order.orderDate),
						orderUrl: order.orderUrl ?? null,
						currency: order.currency,
						subtotal: order.subtotal ?? null,
						tax: order.tax ?? null,
						shipping: order.shipping ?? null,
						discount: order.discount ?? null,
						total: order.total ?? null,
						sourceUrl: order.raw.sourceUrl,
						scrapedAt: new Date(order.raw.scrapedAt),
						parserVersion: order.raw.parserVersion,
						pageHash: order.raw.pageHash ?? null,
						createdAt: now,
						updatedAt: now,
					},
				});
				created += 1;
			}

			if (order.items.length > 0) {
				await this.db.retailOrderItem.createMany({
					data: order.items.map((item) => ({
						id: randomUUID(),
						retailOrderId: orderId,
						externalItemId: item.externalItemId ?? null,
						title: item.title,
						quantity: item.quantity ?? null,
						unitPrice: item.unitPrice ?? null,
						totalPrice: item.totalPrice ?? null,
						productUrl: item.productUrl ?? null,
						imageUrl: item.imageUrl ?? null,
						sku: item.sku ?? null,
						asin: item.asin ?? null,
						matchStatus: "unmatched",
						createdAt: now,
						updatedAt: now,
					})),
				});
			}
		}

		return { created, updated, skipped, orders };
	}

	async runAmazonMatching(input: {
		userId: string;
		transactionIds?: string[];
	}) {
		const orders = (await this.db.retailOrder.findMany({
			where: {
				userId: input.userId,
				retailer: "amazon",
				items: { some: { transactionId: null } },
			},
			include: { items: true },
			orderBy: { orderDate: "desc" },
			take: 200,
		})) as RetailOrderRow[];

		const transactions = (await this.db.transaction.findMany({
			where: {
				userId: input.userId,
				hidden: false,
				removedAt: null,
				type: "EXPENSE",
				...(input.transactionIds ? { id: { in: input.transactionIds } } : {}),
			},
			select: {
				id: true,
				amount: true,
				date: true,
				description: true,
				merchantName: true,
			},
		})) as Array<{
			id: string;
			amount: number;
			date: Date;
			description: string | null;
			merchantName: string | null;
		}>;

		const summary = matchAmazonOrdersToTransactions({
			orders: orders.map((order) => ({
				id: order.id,
				orderDate: order.orderDate,
				total: order.total,
				unlinkedItemIds: order.items
					.filter((item) => !item.transactionId)
					.map((item) => item.id),
			})),
			transactions,
		});

		const now = new Date();
		for (const decision of summary.decisions) {
			if (decision.status === "skipped") continue;
			if (decision.status === "linked") {
				await this.db.retailOrderItem.updateMany({
					where: {
						id: { in: decision.itemIds },
						transactionId: null,
					},
					data: {
						transactionId: decision.transactionId,
						matchStatus: "linked",
						matchConfidence: 1,
						matchedAt: now,
						matchReason: decision.matchReason,
						updatedAt: now,
					},
				});
				await this.db.transaction.updateMany({
					where: {
						id: decision.transactionId,
						amazonRetailEnrichedAt: null,
					},
					data: {
						amazonRetailEnrichedAt: now,
						updatedAt: now,
					},
				});
				continue;
			}

			await this.db.retailOrderItem.updateMany({
				where: {
					id: { in: decision.itemIds },
					transactionId: null,
				},
				data: {
					matchStatus: decision.status,
					matchReason: decision.matchReason,
					updatedAt: now,
				},
			});
		}

		return {
			linkedItems: summary.linkedItems,
			candidates: summary.candidates,
			skipped: summary.skipped,
		};
	}

	async detectAmazonCandidates(input: { userId: string; take?: number }) {
		const transactions = (await this.db.transaction.findMany({
			where: {
				userId: input.userId,
				hidden: false,
				removedAt: null,
			},
			select: {
				id: true,
				description: true,
				merchantName: true,
				retailOrderItems: { select: { id: true } },
			},
			take: input.take ?? 500,
		})) as Array<{
			id: string;
			description: string | null;
			merchantName: string | null;
			retailOrderItems: Array<{ id: string }>;
		}>;

		return summarizeAmazonRetailDetection(
			transactions.map((transaction) => ({
				id: transaction.id,
				description: transaction.description,
				merchantName: transaction.merchantName,
				linkedItemCount: transaction.retailOrderItems.length,
			})),
		);
	}

	async listItemsForTransactions(input: {
		userId: string;
		transactionIds: string[];
	}) {
		if (input.transactionIds.length === 0) return {};

		const items = (await this.db.retailOrderItem.findMany({
			where: {
				transactionId: { in: input.transactionIds },
				retailOrder: { userId: input.userId, retailer: "amazon" },
			},
			include: { retailOrder: true },
			orderBy: { createdAt: "asc" },
		})) as Array<{
			id: string;
			transactionId: string | null;
			title: string;
			quantity: number | null;
			totalPrice: number | null;
			unitPrice: number | null;
			imageUrl: string | null;
			retailOrder: {
				orderDate: Date | null;
				externalOrderId: string;
			};
		}>;

		const itemsByTransactionId: Record<
			string,
			Array<{
				id: string;
				retailer: "amazon";
				title: string;
				quantity: number | null;
				totalPrice: number | null;
				unitPrice: number | null;
				imageUrl: string | null;
				orderDate: string | null;
				externalOrderId: string;
			}>
		> = {};

		for (const item of items) {
			if (!item.transactionId) continue;
			const list = itemsByTransactionId[item.transactionId] ?? [];
			list.push({
				id: item.id,
				retailer: "amazon",
				title: item.title,
				quantity: item.quantity,
				totalPrice: item.totalPrice,
				unitPrice: item.unitPrice,
				imageUrl: item.imageUrl,
				orderDate: item.retailOrder.orderDate?.toISOString() ?? null,
				externalOrderId: item.retailOrder.externalOrderId,
			});
			itemsByTransactionId[item.transactionId] = list;
		}

		return itemsByTransactionId;
	}

	async listOrders(input: {
		userId: string;
		retailer?: string;
		limit: number;
		cursor: number;
	}) {
		const rows = (await this.db.retailOrder.findMany({
			where: {
				userId: input.userId,
				retailer: input.retailer,
			},
			include: { items: true },
			orderBy: [{ orderDate: "desc" }, { id: "desc" }],
			take: input.limit,
			skip: input.cursor,
		})) as Array<{
			id: string;
			retailer: string;
			externalOrderId: string;
			orderDate: Date | null;
			total: number | null;
			items: Array<{
				id: string;
				title: string;
				quantity: number | null;
				totalPrice: number | null;
				unitPrice: number | null;
				imageUrl: string | null;
				asin: string | null;
				transactionId: string | null;
				matchStatus: string;
			}>;
		}>;

		return {
			orders: rows.map((order) => mapRetailOrderListItem(order)),
			nextCursor:
				rows.length === input.limit ? input.cursor + input.limit : null,
		};
	}
}
