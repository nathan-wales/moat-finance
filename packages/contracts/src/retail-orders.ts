export const RETAIL_ORDER_LIST_PAGE_SIZE = 15;

export type RetailOrderLinkStatus =
	| "linked"
	| "partial"
	| "unmatched"
	| "ambiguous";

export type RetailOrderListRetailer = "amazon" | "walmart" | "target";

export type RetailOrderListItemPreview = {
	id: string;
	title: string;
	quantity: number | null;
	totalPrice: number | null;
	unitPrice: number | null;
	imageUrl: string | null;
	asin: string | null;
};

export type RetailOrderListItem = {
	id: string;
	retailer: RetailOrderListRetailer;
	externalOrderId: string;
	orderDate: string | null;
	total: number | null;
	itemCount: number;
	linkStatus: RetailOrderLinkStatus;
	items: RetailOrderListItemPreview[];
};

export type RetailOrderListInput = {
	retailer?: RetailOrderListRetailer;
	limit?: number;
	cursor?: number;
};

export type RetailOrderListResponse = {
	orders: RetailOrderListItem[];
	nextCursor?: number | null;
};

type LinkStatusSource = {
	transactionId: string | null;
	matchStatus: string;
};

export function deriveRetailOrderLinkStatus(
	items: LinkStatusSource[],
): RetailOrderLinkStatus {
	if (items.some((item) => item.matchStatus === "ambiguous")) {
		return "ambiguous";
	}
	if (items.length === 0) return "unmatched";
	const linkedCount = items.filter((item) => item.transactionId).length;
	if (linkedCount === 0) return "unmatched";
	if (linkedCount === items.length) return "linked";
	return "partial";
}

function moneyToNumber(
	value: number | string | { toNumber: () => number } | null | undefined,
): number | null {
	if (value == null || value === "") return null;
	if (typeof value === "object" && typeof value.toNumber === "function") {
		const parsed = value.toNumber();
		return Number.isFinite(parsed) ? parsed : null;
	}
	const parsed = typeof value === "number" ? value : Number(String(value));
	return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: Date | string | null | undefined): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

function asListRetailer(value: string): RetailOrderListRetailer {
	if (value === "walmart" || value === "target") return value;
	return "amazon";
}

export function mapRetailOrderListItem(order: {
	id: string;
	retailer: string;
	externalOrderId: string;
	orderDate: Date | string | null;
	total: number | string | { toNumber: () => number } | null;
	items: Array<{
		id: string;
		title: string;
		quantity: number | null;
		totalPrice: number | string | { toNumber: () => number } | null;
		unitPrice: number | string | { toNumber: () => number } | null;
		imageUrl: string | null;
		asin: string | null;
		transactionId: string | null;
		matchStatus: string;
	}>;
}): RetailOrderListItem {
	return {
		id: order.id,
		retailer: asListRetailer(order.retailer),
		externalOrderId: order.externalOrderId,
		orderDate: toIsoDate(order.orderDate),
		total: moneyToNumber(order.total),
		itemCount: order.items.length,
		linkStatus: deriveRetailOrderLinkStatus(order.items),
		items: order.items.slice(0, 5).map((item) => ({
			id: item.id,
			title: item.title,
			quantity: item.quantity,
			totalPrice: moneyToNumber(item.totalPrice),
			unitPrice: moneyToNumber(item.unitPrice),
			imageUrl: item.imageUrl,
			asin: item.asin,
		})),
	};
}
