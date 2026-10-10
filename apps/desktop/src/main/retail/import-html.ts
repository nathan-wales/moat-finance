import type { RetailRepository } from "@moat/data-access";
import {
	dedupeRetailOrders,
	getRetailerParser,
	type Retailer,
	type RetailOrderImport,
} from "@moat/retail-sync";
import { parseHTML } from "linkedom";

export type ImportHtmlResult = {
	created: number;
	updated: number;
	skipped: number;
	pageState: string;
	parserVersion: string;
	orders: RetailOrderImport[];
	warnings: string[];
	linkedItems: number;
};

export async function importRetailHtmlToSqlite(input: {
	retail: RetailRepository;
	userId: string;
	retailer: Retailer;
	html: string;
	sourceUrl: string;
	syncRunId: string;
}): Promise<ImportHtmlResult> {
	const parser = getRetailerParser(input.retailer);
	const { document } = parseHTML(input.html);
	const pageState = parser.detectState(document);
	const parsedOrders =
		pageState === "orders_page"
			? parser.parseOrders(document, input.sourceUrl)
			: [];
	const warnings =
		pageState === "orders_page" && parsedOrders.length === 0
			? [`No visible ${input.retailer} orders parsed locally.`]
			: [];

	if (pageState !== "orders_page" || parsedOrders.length === 0) {
		return {
			created: 0,
			updated: 0,
			skipped: 0,
			pageState,
			parserVersion: parser.parserVersion,
			orders: [],
			warnings,
			linkedItems: 0,
		};
	}

	const orders = dedupeRetailOrders(parsedOrders).filter(
		(order) => order.retailer === input.retailer,
	);

	await input.retail.upsertConnection({
		userId: input.userId,
		retailer: input.retailer,
		status: "connected",
		lastSyncedAt: new Date(),
	});

	const saveResult = await input.retail.saveImport({
		userId: input.userId,
		retailer: input.retailer,
		orders,
	});

	let linkedItems = 0;
	if (input.retailer === "amazon" && saveResult.orders.length > 0) {
		const matchResult = await input.retail.runAmazonMatching({
			userId: input.userId,
		});
		linkedItems = matchResult.linkedItems;
	}

	return {
		created: saveResult.created,
		updated: saveResult.updated,
		skipped: saveResult.skipped,
		pageState,
		parserVersion: parser.parserVersion,
		orders: saveResult.orders as RetailOrderImport[],
		warnings,
		linkedItems,
	};
}
