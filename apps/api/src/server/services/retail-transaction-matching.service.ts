import { detectAmazonRetailTransaction } from "@moat/domain";
import { addDays, subDays } from "date-fns";
import { Prisma, type PrismaClient } from "../../../generated/prisma";
import {
	buildCategoryNameFilter,
	buildTransactionWhere,
} from "../../lib/transaction-scope";

type RetailTransactionFilterInput = {
	search?: string;
	category?: string;
	hashtag?: string;
	startDate?: Date;
	endDate?: Date;
	type?: "INCOME" | "EXPENSE";
};

export type RetailTransactionDetectionResponse = {
	retailer: "amazon";
	detectedCount: number;
	unlinkedDetectedCount: number;
	linkedItemCount: number;
	hasActionableSync: boolean;
	extensionStatus: "unknown" | "connected" | "not_connected";
	candidates: Array<{
		transactionId: string;
		confidence: "high" | "medium" | "low";
		linkedItemCount: number;
		needsSync: boolean;
	}>;
};

export function disabledRetailTransactionDetection(): RetailTransactionDetectionResponse {
	return {
		retailer: "amazon",
		detectedCount: 0,
		unlinkedDetectedCount: 0,
		linkedItemCount: 0,
		hasActionableSync: false,
		extensionStatus: "unknown",
		candidates: [],
	};
}

export type RetailMatchingResult = {
	linkedItems: number;
	candidates: number;
	skipped: number;
	warnings: string[];
};

export type RetailItemsForTransactionsResponse = {
	itemsByTransactionId: Record<
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
	>;
};

function moneyToNumber(value: Prisma.Decimal | number | null): number | null {
	if (value == null) return null;
	return Number(value);
}

function amountsMatch(
	left: Prisma.Decimal | number | null,
	right: Prisma.Decimal | number | null,
) {
	const leftNumber = moneyToNumber(left);
	const rightNumber = moneyToNumber(right);
	if (leftNumber == null || rightNumber == null) return false;
	return Math.abs(Math.abs(leftNumber) - Math.abs(rightNumber)) <= 0.01;
}

function buildRetailDetectionWhere(
	userId: string,
	input: RetailTransactionFilterInput,
): Prisma.TransactionWhereInput {
	const baseWhere = buildTransactionWhere({
		userId,
		startDate: input.startDate,
		endDate: input.endDate,
		type: input.type,
	});
	const filters: Prisma.TransactionWhereInput[] = [];

	if (input.category) {
		filters.push(buildCategoryNameFilter(input.category, userId));
	}

	if (input.search) {
		filters.push({
			OR: [
				{
					description: { contains: input.search, mode: "insensitive" as const },
				},
				{
					originalDescription: {
						contains: input.search,
						mode: "insensitive" as const,
					},
				},
				{
					merchantName: {
						contains: input.search,
						mode: "insensitive" as const,
					},
				},
			],
		});
	}

	return {
		...baseWhere,
		...(filters.length > 0 && { AND: filters }),
		...(input.hashtag && {
			hashtags: {
				some: {
					hashtag: {
						normalizedName: input.hashtag.replace(/^#/, "").toLowerCase(),
					},
				},
			},
		}),
	};
}

export async function detectRetailTransactions(input: {
	db: PrismaClient;
	userId: string;
	filters?: RetailTransactionFilterInput;
}): Promise<RetailTransactionDetectionResponse> {
	const filters = input.filters ?? {};
	const transactions = await input.db.transaction.findMany({
		where: buildRetailDetectionWhere(input.userId, filters),
		select: {
			id: true,
			description: true,
			originalDescription: true,
			merchantName: true,
			retailOrderItems: { select: { id: true } },
		},
		take: 500,
	});

	const candidates = transactions
		.map((transaction) => {
			const detection = detectAmazonRetailTransaction(transaction);
			if (!detection.matched) return null;
			const linkedItemCount = transaction.retailOrderItems.length;
			return {
				transactionId: transaction.id,
				confidence: detection.confidence,
				linkedItemCount,
				needsSync: linkedItemCount === 0,
			};
		})
		.filter((candidate): candidate is NonNullable<typeof candidate> =>
			Boolean(candidate),
		);

	const linkedItemCount = candidates.reduce(
		(sum, candidate) => sum + candidate.linkedItemCount,
		0,
	);
	const unlinkedDetectedCount = candidates.filter(
		(candidate) => candidate.needsSync,
	).length;

	return {
		retailer: "amazon",
		detectedCount: candidates.length,
		unlinkedDetectedCount,
		linkedItemCount,
		hasActionableSync: unlinkedDetectedCount > 0,
		extensionStatus: "unknown",
		candidates,
	};
}

export async function runAmazonRetailMatching(input: {
	db: PrismaClient;
	userId: string;
	transactionIds?: string[];
}): Promise<RetailMatchingResult> {
	const orders = await input.db.retailOrder.findMany({
		where: {
			userId: input.userId,
			retailer: "amazon",
			items: { some: { transactionId: null } },
		},
		include: { items: true },
		orderBy: { orderDate: "desc" },
		take: 200,
	});

	let linkedItems = 0;
	let candidates = 0;
	let skipped = 0;
	const warnings: string[] = [];

	for (const order of orders) {
		const orderTotal = order.total;
		if (!order.orderDate || orderTotal == null) {
			skipped += order.items.filter((item) => !item.transactionId).length;
			continue;
		}

		const transactionCandidates = await input.db.transaction.findMany({
			where: {
				userId: input.userId,
				hidden: false,
				removedAt: null,
				type: "EXPENSE",
				...(input.transactionIds ? { id: { in: input.transactionIds } } : {}),
				date: {
					gte: subDays(order.orderDate, 7),
					lte: addDays(order.orderDate, 14),
				},
			},
			select: {
				id: true,
				amount: true,
				description: true,
				originalDescription: true,
				merchantName: true,
			},
		});

		const exactMatches = transactionCandidates.filter((transaction) => {
			const detection = detectAmazonRetailTransaction(transaction);
			return detection.matched && amountsMatch(transaction.amount, orderTotal);
		});
		candidates += exactMatches.length;

		if (exactMatches.length !== 1) {
			const nextStatus = exactMatches.length > 1 ? "ambiguous" : "unmatched";
			await input.db.retailOrderItem.updateMany({
				where: { retailOrderId: order.id, transactionId: null },
				data: {
					matchStatus: nextStatus,
					matchReason:
						exactMatches.length > 1
							? "multiple_exact_amount_candidates"
							: "no_exact_amount_candidate",
				},
			});
			skipped += order.items.filter((item) => !item.transactionId).length;
			continue;
		}

		const matchedTransaction = exactMatches[0];
		if (!matchedTransaction) continue;
		const matchedAt = new Date();
		const result = await input.db.retailOrderItem.updateMany({
			where: { retailOrderId: order.id, transactionId: null },
			data: {
				transactionId: matchedTransaction.id,
				matchStatus: "linked",
				matchConfidence: new Prisma.Decimal("1.0000"),
				matchedAt,
				matchReason: "amazon_order_total_exact_amount_date_window",
			},
		});
		linkedItems += result.count;
		if (result.count > 0) {
			await input.db.transaction.updateMany({
				where: {
					id: matchedTransaction.id,
					amazonRetailEnrichedAt: null,
				},
				data: { amazonRetailEnrichedAt: matchedAt },
			});
		}
	}

	return { linkedItems, candidates, skipped, warnings };
}

export async function listRetailItemsForTransactions(input: {
	db: PrismaClient;
	userId: string;
	transactionIds: string[];
}): Promise<RetailItemsForTransactionsResponse> {
	const items = await input.db.retailOrderItem.findMany({
		where: {
			transactionId: { in: input.transactionIds },
			retailOrder: { userId: input.userId, retailer: "amazon" },
		},
		include: { retailOrder: true },
		orderBy: { createdAt: "asc" },
	});

	const itemsByTransactionId: RetailItemsForTransactionsResponse["itemsByTransactionId"] =
		{};
	for (const item of items) {
		if (!item.transactionId) continue;
		const list = itemsByTransactionId[item.transactionId] ?? [];
		list.push({
			id: item.id,
			retailer: "amazon",
			title: item.title,
			quantity: item.quantity,
			totalPrice: moneyToNumber(item.totalPrice),
			unitPrice: moneyToNumber(item.unitPrice),
			imageUrl: item.imageUrl,
			orderDate: item.retailOrder.orderDate?.toISOString() ?? null,
			externalOrderId: item.retailOrder.externalOrderId,
		});
		itemsByTransactionId[item.transactionId] = list;
	}

	return { itemsByTransactionId };
}
