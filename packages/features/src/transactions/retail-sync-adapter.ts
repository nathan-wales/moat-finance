import type {
	RetailTransactionDetection,
	TransactionCountInput,
} from "@moat/contracts";

export type RetailSyncResult = {
	status: string;
	ordersFound?: number;
	warnings?: string[];
};

export type RetailSyncAdapter = {
	detect(
		input: TransactionCountInput,
	): Promise<RetailTransactionDetection | null | undefined>;
	run(input: {
		retailer: "amazon" | "walmart" | "target";
	}): Promise<RetailSyncResult>;
};
