import type { Retailer } from "@moat/retail-sync";

export type RetailerConfig = {
	retailer: Retailer;
	name: string;
	ordersUrl: string;
	hostPermissions: string[];
	enabledInV1: boolean;
};

export const retailerConfigs: Record<Retailer, RetailerConfig> = {
	amazon: {
		retailer: "amazon",
		name: "Amazon",
		ordersUrl: "https://www.amazon.com/your-orders/orders",
		hostPermissions: ["https://www.amazon.com/*", "https://smile.amazon.com/*"],
		enabledInV1: true,
	},
	walmart: {
		retailer: "walmart",
		name: "Walmart",
		ordersUrl: "https://www.walmart.com/orders",
		hostPermissions: ["https://www.walmart.com/*"],
		enabledInV1: false,
	},
	target: {
		retailer: "target",
		name: "Target",
		ordersUrl: "https://www.target.com/orders",
		hostPermissions: ["https://www.target.com/*"],
		enabledInV1: false,
	},
};

export const supportedRetailers: Retailer[] = ["amazon", "walmart", "target"];
