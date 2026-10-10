export { dedupeRetailOrders } from "./dedupe";
export type {
	Retailer,
	RetailerPageState,
	RetailerParser,
	RetailOrderImport,
	RetailOrderItemImport,
	ScrapeResult,
} from "./normalized-types";
export { getRetailerParser, retailerParsers } from "./retailers";
export { amazonParser } from "./retailers/amazon/parser";
export { targetParser } from "./retailers/target/parser";
export { walmartParser } from "./retailers/walmart/parser";
export type {
	CreateRetailHtmlImportRequest,
	CreateRetailImportRequest,
} from "./schemas";
export {
	createRetailHtmlImportRequestSchema,
	createRetailImportRequestSchema,
	retailConnectionUpsertSchema,
	retailerSchema,
	retailOrderImportSchema,
	retailOrderItemImportSchema,
} from "./schemas";
export type { RetailValidationResult } from "./validation";
export { validateRetailOrders } from "./validation";
