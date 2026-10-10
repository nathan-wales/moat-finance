export type RetailOrderItemImportInput = {
	externalItemId?: string | null;
	title: string;
	quantity?: number | null;
	unitPrice?: number | null;
	totalPrice?: number | null;
	productUrl?: string | null;
	imageUrl?: string | null;
	sku?: string | null;
	asin?: string | null;
};

export type RetailOrderImportInput = {
	retailer: string;
	externalOrderId: string;
	orderDate?: string | null;
	orderUrl?: string | null;
	currency: string;
	subtotal?: number | null;
	tax?: number | null;
	shipping?: number | null;
	discount?: number | null;
	total?: number | null;
	items: RetailOrderItemImportInput[];
	raw: {
		sourceUrl: string;
		scrapedAt: string;
		parserVersion: string;
		pageHash?: string | null;
	};
};

export type RetailSaveResult = {
	created: number;
	updated: number;
	skipped: number;
	orders: RetailOrderImportInput[];
};

export type RetailMatchingApplyResult = {
	linkedItems: number;
	candidates: number;
	skipped: number;
};

export interface RetailRepository {
	upsertConnection(input: {
		userId: string;
		retailer: string;
		status: string;
		lastSyncedAt?: Date | null;
	}): Promise<void>;

	saveImport(input: {
		userId: string;
		retailer: string;
		orders: RetailOrderImportInput[];
	}): Promise<RetailSaveResult>;

	runAmazonMatching(input: {
		userId: string;
		transactionIds?: string[];
	}): Promise<RetailMatchingApplyResult>;

	detectAmazonCandidates(input: { userId: string; take?: number }): Promise<{
		retailer: "amazon";
		detectedCount: number;
		unlinkedDetectedCount: number;
		linkedItemCount: number;
		hasActionableSync: boolean;
		candidates: Array<{
			transactionId: string;
			confidence: "high" | "medium" | "low";
			linkedItemCount: number;
			needsSync: boolean;
		}>;
	}>;

	listItemsForTransactions(input: {
		userId: string;
		transactionIds: string[];
	}): Promise<
		Record<
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
		>
	>;

	listOrders(input: {
		userId: string;
		retailer?: string;
		limit: number;
		cursor: number;
	}): Promise<{
		orders: import("@moat/contracts").RetailOrderListItem[];
		nextCursor: number | null;
	}>;
}
