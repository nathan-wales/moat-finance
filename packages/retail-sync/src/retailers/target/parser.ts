import type { RetailerParser } from "../../normalized-types";

export const targetParser: RetailerParser = {
	retailer: "target",
	parserVersion: "target-v0-placeholder",
	canParse(url) {
		return /https:\/\/(www\.)?target\.com\//i.test(url);
	},
	detectState() {
		return "unsupported_page";
	},
	parseOrders() {
		return [];
	},
};
