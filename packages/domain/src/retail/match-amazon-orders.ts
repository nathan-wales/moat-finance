import { detectAmazonRetailTransaction } from "./amazon-transaction-detection";

export type AmazonMatchOrderInput = {
	id: string;
	orderDate: Date | null;
	total: number | null;
	unlinkedItemIds: string[];
};

export type AmazonMatchTransactionInput = {
	id: string;
	amount: number;
	date: Date;
	description: string | null;
	merchantName: string | null;
};

export type AmazonOrderMatchDecision =
	| {
			orderId: string;
			status: "linked";
			transactionId: string;
			itemIds: string[];
			matchReason: "amazon_order_total_exact_amount_date_window";
	  }
	| {
			orderId: string;
			status: "unmatched" | "ambiguous";
			itemIds: string[];
			matchReason:
				| "no_exact_amount_candidate"
				| "multiple_exact_amount_candidates";
	  }
	| {
			orderId: string;
			status: "skipped";
			itemIds: string[];
	  };

export type AmazonMatchingSummary = {
	linkedItems: number;
	candidates: number;
	skipped: number;
	decisions: AmazonOrderMatchDecision[];
};

function amountsMatch(left: number | null, right: number | null): boolean {
	if (left == null || right == null) return false;
	return Math.abs(Math.abs(left) - Math.abs(right)) <= 0.01;
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

/**
 * Deterministic Amazon order→transaction matching (same rules as cloud API).
 * Pure function — callers apply decisions to their store.
 */
export function matchAmazonOrdersToTransactions(input: {
	orders: AmazonMatchOrderInput[];
	transactions: AmazonMatchTransactionInput[];
}): AmazonMatchingSummary {
	let linkedItems = 0;
	let candidates = 0;
	let skipped = 0;
	const decisions: AmazonOrderMatchDecision[] = [];

	for (const order of input.orders) {
		const itemIds = order.unlinkedItemIds;
		if (itemIds.length === 0) continue;

		if (!order.orderDate || order.total == null) {
			skipped += itemIds.length;
			decisions.push({ orderId: order.id, status: "skipped", itemIds });
			continue;
		}

		const windowStart = addDays(order.orderDate, -7);
		const windowEnd = addDays(order.orderDate, 14);

		const exactMatches = input.transactions.filter((transaction) => {
			if (transaction.date < windowStart || transaction.date > windowEnd) {
				return false;
			}
			const detection = detectAmazonRetailTransaction({
				description: transaction.description,
				merchantName: transaction.merchantName,
			});
			return detection.matched && amountsMatch(transaction.amount, order.total);
		});
		candidates += exactMatches.length;

		if (exactMatches.length !== 1) {
			decisions.push({
				orderId: order.id,
				status: exactMatches.length > 1 ? "ambiguous" : "unmatched",
				itemIds,
				matchReason:
					exactMatches.length > 1
						? "multiple_exact_amount_candidates"
						: "no_exact_amount_candidate",
			});
			skipped += itemIds.length;
			continue;
		}

		const matchedTransaction = exactMatches[0];
		if (!matchedTransaction) continue;

		linkedItems += itemIds.length;
		decisions.push({
			orderId: order.id,
			status: "linked",
			transactionId: matchedTransaction.id,
			itemIds,
			matchReason: "amazon_order_total_exact_amount_date_window",
		});
	}

	return { linkedItems, candidates, skipped, decisions };
}
