import type { Retailer, ScrapeResult } from "@moat/retail-sync";

export const SCRAPE_PORT_NAME = "MOAT_RETAIL_SCRAPE_PORT";
export const SCRAPE_HTML_CHUNK_SIZE = 64_000;

export type ScrapePortRequest = {
	type: "SCRAPE_RETAILER_PAGE";
	requestId: string;
	retailer: Retailer;
};

export type ScrapePortResultMetadata = Omit<ScrapeResult, "html">;

export type ScrapePortMessage =
	| {
			type: "SCRAPE_STREAM_STARTED";
			requestId: string;
			result: ScrapePortResultMetadata;
			htmlLength: number;
			chunkCount: number;
	  }
	| {
			type: "SCRAPE_STREAM_CHUNK";
			requestId: string;
			index: number;
			chunk: string;
	  }
	| {
			type: "SCRAPE_STREAM_DONE";
			requestId: string;
	  }
	| {
			type: "SCRAPE_STREAM_ERROR";
			requestId: string;
			message: string;
	  };

export function createScrapeRequestId(): string {
	return `scrape_${crypto.randomUUID()}`;
}

export function serializePortError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
