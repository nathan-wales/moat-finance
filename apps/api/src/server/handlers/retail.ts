import { mapRetailOrderListItem } from "@moat/contracts";
import {
	type CreateRetailImportRequest,
	createRetailHtmlImportRequestSchema,
	createRetailImportRequestSchema,
	dedupeRetailOrders,
	getRetailerParser,
	type RetailOrderImport,
	retailConnectionUpsertSchema,
	retailerSchema,
} from "@moat/retail-sync";
import { parseHTML } from "linkedom";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { createApiError } from "../api-context";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";
import { isAmazonRetailSyncEnabled } from "../services/retail-sync-feature-flag";
import {
	detectRetailTransactions,
	disabledRetailTransactionDetection,
	listRetailItemsForTransactions,
	runAmazonRetailMatching,
} from "../services/retail-transaction-matching.service";

const retailerInput = z.object({
	retailer: retailerSchema,
});

const retailTransactionFilterSchema = z.object({
	type: z.enum(["INCOME", "EXPENSE"]).optional(),
	search: z.string().optional(),
	hashtag: z.string().optional(),
	category: z.string().optional(),
	startDate: z.preprocess(
		(value) => (value ? new Date(String(value)) : undefined),
		z.date().optional(),
	),
	endDate: z.preprocess(
		(value) => (value ? new Date(String(value)) : undefined),
		z.date().optional(),
	),
});

const retailMatchingInputSchema = z.object({
	retailer: z.literal("amazon"),
	transactionIds: z.array(z.string()).min(1).max(100).optional(),
	syncRunId: z.string().optional(),
});

const retailItemsForTransactionsInputSchema = z.object({
	transactionIds: z.array(z.string()).min(1).max(100),
});

function parseOptionalDate(value: string | null): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function money(value: number | null | undefined): string | null {
	return value == null ? null : value.toFixed(2);
}

function isAmazonInvoiceUrl(value: string): boolean {
	try {
		return new URL(value).pathname.includes("/gp/css/summary/print.html");
	} catch {
		return false;
	}
}

async function filterIncrementalRetailOrders(input: {
	ctx: AuthenticatedContext;
	retailer: string;
	orders: RetailOrderImport[];
	sourceUrl?: string;
}): Promise<{
	orders: RetailOrderImport[];
	skipped: number;
	latestOrderDate: Date | null;
	existingOrderIds: number;
}> {
	if (
		input.retailer !== "amazon" ||
		(input.sourceUrl && isAmazonInvoiceUrl(input.sourceUrl))
	) {
		return {
			orders: input.orders,
			skipped: 0,
			latestOrderDate: null,
			existingOrderIds: 0,
		};
	}

	const latestOrder = await input.ctx.db.retailOrder.findFirst({
		where: {
			userId: input.ctx.userId,
			retailer: input.retailer,
			orderDate: { not: null },
		},
		orderBy: { orderDate: "desc" },
		select: { orderDate: true },
	});
	const latestOrderDate = latestOrder?.orderDate ?? null;

	const externalOrderIds = input.orders.map((order) => order.externalOrderId);
	const existingOrders = await input.ctx.db.retailOrder.findMany({
		where: {
			userId: input.ctx.userId,
			retailer: input.retailer,
			externalOrderId: { in: externalOrderIds },
		},
		select: { externalOrderId: true },
	});
	const existingOrderIds = new Set(
		existingOrders.map((order) => order.externalOrderId),
	);
	const orders = input.orders.filter(
		(order) => !existingOrderIds.has(order.externalOrderId),
	);

	return {
		orders,
		skipped: input.orders.length - orders.length,
		latestOrderDate,
		existingOrderIds: existingOrderIds.size,
	};
}

async function saveRetailImport(
	ctx: AuthenticatedContext,
	input: CreateRetailImportRequest,
): Promise<{
	created: number;
	updated: number;
	skipped: number;
	orders: RetailOrderImport[];
}> {
	const orders = dedupeRetailOrders(input.orders).filter(
		(order) => order.retailer === input.retailer,
	);

	let created = 0;
	let updated = 0;
	let skipped = input.orders.length - orders.length;

	for (const order of orders) {
		try {
			const existing = await ctx.db.retailOrder.findUnique({
				where: {
					userId_retailer_externalOrderId: {
						userId: ctx.userId,
						retailer: order.retailer,
						externalOrderId: order.externalOrderId,
					},
				},
				select: { id: true },
			});

			await ctx.db.retailOrder.upsert({
				where: {
					userId_retailer_externalOrderId: {
						userId: ctx.userId,
						retailer: order.retailer,
						externalOrderId: order.externalOrderId,
					},
				},
				create: {
					userId: ctx.userId,
					retailer: order.retailer,
					externalOrderId: order.externalOrderId,
					orderDate: parseOptionalDate(order.orderDate),
					orderUrl: order.orderUrl,
					currency: order.currency,
					subtotal: money(order.subtotal),
					tax: money(order.tax),
					shipping: money(order.shipping),
					discount: money(order.discount),
					total: money(order.total),
					sourceUrl: order.raw.sourceUrl,
					scrapedAt: new Date(order.raw.scrapedAt),
					parserVersion: order.raw.parserVersion,
					pageHash: order.raw.pageHash,
					items: {
						create: order.items.map((item) => ({
							externalItemId: item.externalItemId,
							title: item.title,
							quantity: item.quantity,
							unitPrice: money(item.unitPrice),
							totalPrice: money(item.totalPrice),
							productUrl: item.productUrl,
							imageUrl: item.imageUrl,
							sku: item.sku,
							asin: item.asin,
						})),
					},
				},
				update: {
					orderDate: parseOptionalDate(order.orderDate),
					orderUrl: order.orderUrl,
					currency: order.currency,
					subtotal: money(order.subtotal),
					tax: money(order.tax),
					shipping: money(order.shipping),
					discount: money(order.discount),
					total: money(order.total),
					sourceUrl: order.raw.sourceUrl,
					scrapedAt: new Date(order.raw.scrapedAt),
					parserVersion: order.raw.parserVersion,
					pageHash: order.raw.pageHash,
					items: {
						deleteMany: {},
						create: order.items.map((item) => ({
							externalItemId: item.externalItemId,
							title: item.title,
							quantity: item.quantity,
							unitPrice: money(item.unitPrice),
							totalPrice: money(item.totalPrice),
							productUrl: item.productUrl,
							imageUrl: item.imageUrl,
							sku: item.sku,
							asin: item.asin,
						})),
					},
				},
			});

			if (existing) updated += 1;
			else created += 1;
		} catch (error) {
			skipped += 1;
			logger.logError("Failed to upsert retail order", error, {
				feature: "retail-sync",
				operation: "createImport",
				userId: ctx.userId,
				retailer: order.retailer,
			});
		}
	}

	await ctx.db.retailConnection.upsert({
		where: {
			userId_retailer: {
				userId: ctx.userId,
				retailer: input.retailer,
			},
		},
		create: {
			userId: ctx.userId,
			retailer: input.retailer,
			status: "connected",
			lastSyncedAt: new Date(),
		},
		update: {
			status: "connected",
			lastSyncedAt: new Date(),
		},
	});

	if (input.retailer === "amazon") {
		const matchResult = await runAmazonRetailMatching({
			db: ctx.db,
			userId: ctx.userId,
		});
		await logger.info("Retail transaction matching completed", {
			feature: "retail-sync",
			operation: "matchImportedOrders",
			userId: ctx.userId,
			retailer: input.retailer,
			syncRunId: input.syncRunId,
			linkedItems: matchResult.linkedItems,
			candidates: matchResult.candidates,
			skipped: matchResult.skipped,
			warningCount: matchResult.warnings.length,
		});
	}

	return { created, updated, skipped, orders };
}

export const retail = {
	detectTransactions: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const amazonRetailSyncEnabled = await isAmazonRetailSyncEnabled({
				db: ctx.db,
				userId: ctx.userId,
			});
			if (!amazonRetailSyncEnabled) {
				return disabledRetailTransactionDetection();
			}

			const filters = retailTransactionFilterSchema.parse(body ?? {});
			return detectRetailTransactions({
				db: ctx.db,
				userId: ctx.userId,
				filters,
			});
		},
	),

	runMatching: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = retailMatchingInputSchema.parse(body);
		return runAmazonRetailMatching({
			db: ctx.db,
			userId: ctx.userId,
			transactionIds: input.transactionIds,
		});
	}),

	listItemsForTransactions: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = retailItemsForTransactionsInputSchema.parse(body);
			return listRetailItemsForTransactions({
				db: ctx.db,
				userId: ctx.userId,
				transactionIds: input.transactionIds,
			});
		},
	),

	listConnections: withAuth(async (ctx: AuthenticatedContext) => {
		const connections = await ctx.db.retailConnection.findMany({
			where: { userId: ctx.userId },
			orderBy: { retailer: "asc" },
		});

		return { connections };
	}),

	upsertConnection: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = retailConnectionUpsertSchema.parse(body);
			const connection = await ctx.db.retailConnection.upsert({
				where: {
					userId_retailer: {
						userId: ctx.userId,
						retailer: input.retailer,
					},
				},
				create: {
					userId: ctx.userId,
					retailer: input.retailer,
					status: input.status,
				},
				update: {
					status: input.status,
				},
			});

			return { connection };
		},
	),

	disconnectConnection: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = retailerInput.parse(body);
			const result = await ctx.db.retailConnection.deleteMany({
				where: { userId: ctx.userId, retailer: input.retailer },
			});

			return { deleted: result.count };
		},
	),

	listImports: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = z
			.object({
				retailer: retailerSchema.optional(),
				limit: z.coerce.number().int().min(1).max(100).default(15),
				cursor: z.coerce.number().int().min(0).default(0),
			})
			.parse(body);

		const orders = await ctx.db.retailOrder.findMany({
			where: {
				userId: ctx.userId,
				retailer: input.retailer,
			},
			include: { items: true },
			orderBy: [{ orderDate: "desc" }, { id: "desc" }],
			take: input.limit,
			skip: input.cursor,
		});

		return {
			orders: orders.map((order) => mapRetailOrderListItem(order)),
			nextCursor:
				orders.length === input.limit ? input.cursor + input.limit : null,
		};
	}),

	getImport: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = z.object({ id: z.string().min(1) }).parse(body);
		const order = await ctx.db.retailOrder.findFirst({
			where: { id: input.id, userId: ctx.userId },
			include: { items: true },
		});

		if (!order) throw createApiError("Retail import not found", 404);

		return { order };
	}),

	createImport: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = createRetailImportRequestSchema.parse(body);
		await logger.info("Retail import received", {
			feature: "retail-sync",
			operation: "createImport",
			userId: ctx.userId,
			retailer: input.retailer,
			syncRunId: input.syncRunId,
			ordersReceived: input.orders.length,
		});
		const { created, updated, skipped, orders } = await saveRetailImport(
			ctx,
			input,
		);

		await logger.info("Retail import saved", {
			feature: "retail-sync",
			operation: "createImport",
			userId: ctx.userId,
			retailer: input.retailer,
			syncRunId: input.syncRunId,
			ordersReceived: input.orders.length,
			ordersDeduped: orders.length,
			created,
			updated,
			skipped,
		});

		return { created, updated, skipped };
	}),

	createImportFromHtml: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = createRetailHtmlImportRequestSchema.parse(body);
			const parser = getRetailerParser(input.retailer);
			const { document } = parseHTML(input.html);
			const pageState = parser.detectState(document);
			const orders =
				pageState === "orders_page"
					? parser.parseOrders(document, input.sourceUrl)
					: [];
			const warnings =
				pageState === "orders_page" && orders.length === 0
					? [`No visible ${input.retailer} orders parsed on the server.`]
					: [];

			await logger.info("Retail HTML import parsed", {
				feature: "retail-sync",
				operation: "createImportFromHtml",
				userId: ctx.userId,
				retailer: input.retailer,
				syncRunId: input.syncRunId,
				htmlLength: input.html.length,
				pageState,
				ordersParsed: orders.length,
				parserVersion: parser.parserVersion,
			});

			if (pageState !== "orders_page" || orders.length === 0) {
				return {
					created: 0,
					updated: 0,
					skipped: 0,
					pageState,
					parserVersion: parser.parserVersion,
					orders,
					warnings,
				};
			}

			const incrementalFilter = await filterIncrementalRetailOrders({
				ctx,
				retailer: input.retailer,
				orders,
				sourceUrl: input.sourceUrl,
			});

			await logger.info("Retail HTML import incremental filter applied", {
				feature: "retail-sync",
				operation: "createImportFromHtml",
				userId: ctx.userId,
				retailer: input.retailer,
				syncRunId: input.syncRunId,
				ordersParsed: orders.length,
				ordersAccepted: incrementalFilter.orders.length,
				ordersSkippedByIncrementalFilter: incrementalFilter.skipped,
				existingOrderIds: incrementalFilter.existingOrderIds,
				latestOrderDate: incrementalFilter.latestOrderDate?.toISOString(),
				isInvoicePage: isAmazonInvoiceUrl(input.sourceUrl),
			});

			if (incrementalFilter.orders.length === 0) {
				return {
					created: 0,
					updated: 0,
					skipped: incrementalFilter.skipped,
					pageState,
					parserVersion: parser.parserVersion,
					orders: [],
					warnings,
				};
			}

			const saveResult = await saveRetailImport(ctx, {
				retailer: input.retailer,
				orders: incrementalFilter.orders,
				syncRunId: input.syncRunId,
			});

			await logger.info("Retail HTML import saved", {
				feature: "retail-sync",
				operation: "createImportFromHtml",
				userId: ctx.userId,
				retailer: input.retailer,
				syncRunId: input.syncRunId,
				ordersParsed: orders.length,
				ordersDeduped: saveResult.orders.length,
				created: saveResult.created,
				updated: saveResult.updated,
				skipped: saveResult.skipped + incrementalFilter.skipped,
			});

			return {
				created: saveResult.created,
				updated: saveResult.updated,
				skipped: saveResult.skipped + incrementalFilter.skipped,
				pageState,
				parserVersion: parser.parserVersion,
				orders: saveResult.orders,
				warnings,
			};
		},
	),
};
