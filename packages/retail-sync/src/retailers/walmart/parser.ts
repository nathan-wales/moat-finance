import type { RetailerParser } from "../../normalized-types";

export const walmartParser: RetailerParser = {
	retailer: "walmart",
	parserVersion: "walmart-v0-placeholder",
	canParse(url) {
		return /https:\/\/(www\.)?walmart\.com\//i.test(url);
	},
	detectState() {
		return "unsupported_page";
	},
	parseOrders() {
		return [];
	},
};
