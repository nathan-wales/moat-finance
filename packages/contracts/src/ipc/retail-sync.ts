import { z } from "zod";
import { RETAIL_ORDER_LIST_PAGE_SIZE } from "../retail-orders";

export const RETAIL_SYNC_CHANNELS = {
	openAmazonWebSync: "retail-sync:openAmazonWebSync",
	detectAmazon: "retail-sync:detectAmazon",
	isAmazonSyncEnabled: "retail-sync:isAmazonSyncEnabled",
	startDesktopAmazonSync: "retail-sync:startDesktopAmazonSync",
	getSyncStatus: "retail-sync:getSyncStatus",
	listOrders: "retail-sync:listOrders",
} as const;

export type OpenAmazonWebSyncResponse = {
	url: string;
};

export type DetectAmazonRetailResponse = {
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
};

export type StartDesktopAmazonSyncResponse = {
	sessionId: string;
	port: number;
	expiresAt: string;
	extensionTriggerUrl: string;
	status: "started" | "extension_id_missing";
};

export type RetailDesktopSyncStatusResponse = {
	sessionId: string;
	status:
		| "pending"
		| "claimed"
		| "importing"
		| "success"
		| "failed"
		| "unknown";
	errorMessage?: string;
	created?: number;
	updated?: number;
	skipped?: number;
	ordersFound?: number;
	linkedItems?: number;
};

export const ListRetailOrdersInputSchema = z.object({
	retailer: z.enum(["amazon", "walmart", "target"]).optional(),
	limit: z.number().int().min(1).max(100).default(RETAIL_ORDER_LIST_PAGE_SIZE),
	cursor: z.number().int().min(0).default(0),
});

export type ListRetailOrdersInput = z.infer<typeof ListRetailOrdersInputSchema>;
