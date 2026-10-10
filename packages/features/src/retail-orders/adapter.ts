import type {
	RetailOrderListInput,
	RetailOrderListResponse,
} from "@moat/contracts";

export type RetailOrderListAdapter = {
	list(input: RetailOrderListInput): Promise<RetailOrderListResponse>;
};
