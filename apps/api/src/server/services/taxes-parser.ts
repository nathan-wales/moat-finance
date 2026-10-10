import {
	DoclingLocalParser,
	HeuristicTaxDocumentParser,
	type TaxDocumentParser,
} from "@moat/domain";
import { logger } from "~/lib/logger";
import { DoclingCloudParser } from "./docling-cloud-parser";

export function createTaxDocumentParser(
	env: Record<string, string | undefined> = process.env,
): TaxDocumentParser {
	const parserUrl = env.DOCLING_PARSER_URL?.trim();
	if (parserUrl) {
		return new DoclingCloudParser(parserUrl, {
			allowInsecureLocal: env.DOCLING_PARSER_ALLOW_INSECURE_LOCAL === "true",
			parserVersion: env.DOCLING_PARSER_VERSION?.trim(),
		});
	}
	if (env.DOCLING_LOCAL_PARSER === "true") {
		return new DoclingLocalParser();
	}
	if (env.NODE_ENV === "production") {
		logger.warn("tax_parser_heuristic_fallback", {
			feature: "tax-parse",
			operation: "createTaxDocumentParser",
		});
	}
	return new HeuristicTaxDocumentParser();
}

export function isAsyncTaxParseEnabled(
	env: Record<string, string | undefined> = process.env,
): boolean {
	if (!env.DOCLING_PARSER_URL?.trim()) return false;
	if (env.TAX_PARSE_ASYNC === "false") return false;
	if (env.TAX_PARSE_ASYNC === "true") return true;
	return env.NODE_ENV === "production";
}
