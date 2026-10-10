import type { Retailer, RetailerParser } from "../normalized-types";
import { amazonParser } from "./amazon/parser";
import { targetParser } from "./target/parser";
import { walmartParser } from "./walmart/parser";

export const retailerParsers: Record<Retailer, RetailerParser> = {
	amazon: amazonParser,
	walmart: walmartParser,
	target: targetParser,
};

export function getRetailerParser(retailer: Retailer): RetailerParser {
	return retailerParsers[retailer];
}
