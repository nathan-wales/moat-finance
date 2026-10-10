export type Retailer = "amazon" | "walmart" | "target";

export type RetailOrderImport = {
	retailer: Retailer;
	externalOrderId: string;
	orderDate: string | null;
	orderUrl?: string;
	orderDetailsUrl?: string | null;
	invoiceUrl?: string | null;
	currency: "USD";
	subtotal?: number | null;
	tax?: number | null;
	shipping?: number | null;
	discount?: number | null;
	total?: number | null;
	items: RetailOrderItemImport[];
	raw: {
		sourceUrl: string;
		scrapedAt: string;
		parserVersion: string;
		pageHash?: string;
	};
};

export type RetailOrderItemImport = {
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

export type RetailerPageState =
	| "orders_page"
	| "login_required"
	| "captcha_or_bot_check"
	| "unsupported_page"
	| "empty_orders"
	| "unknown";

export type RetailerParser = {
	retailer: Retailer;
	parserVersion: string;
	canParse: (url: string, document: Document) => boolean;
	detectState: (document: Document) => RetailerPageState;
	parseOrders: (document: Document, url: string) => RetailOrderImport[];
};

export type ScrapeResult = {
	retailer: Retailer;
	pageState: RetailerPageState;
	orders: RetailOrderImport[];
	warnings: string[];
	parserVersion: string;
	html?: string;
	diagnostics?: {
		sourceUrl: string;
		htmlLength: number;
	};
};
