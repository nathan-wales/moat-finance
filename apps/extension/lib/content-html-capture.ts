import type { Retailer, ScrapeResult } from "@moat/retail-sync";
import { browser } from "wxt/browser";
import {
	SCRAPE_HTML_CHUNK_SIZE,
	SCRAPE_PORT_NAME,
	type ScrapePortRequest,
	serializePortError,
} from "./scrape-port";

type ContentLogger = (
	message: string,
	context?: Record<string, unknown>,
) => void;

type RegisterHtmlCaptureInput = {
	retailer: Retailer;
	parserVersion: string;
	log: ContentLogger;
};

function getSafePageUrl(): string {
	return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

function createScrapeResult(
	retailer: Retailer,
	parserVersion: string,
	log: ContentLogger,
): ScrapeResult {
	const html = document.documentElement.outerHTML;
	const diagnostics = {
		sourceUrl: getSafePageUrl(),
		htmlLength: html.length,
	};
	const result: ScrapeResult = {
		retailer,
		pageState: "unknown",
		orders: [],
		warnings: [],
		parserVersion,
		html,
		diagnostics,
	};

	log("HTML captured", {
		retailer,
		parserVersion,
		...diagnostics,
	});
	log("Returning scrape response", {
		retailer,
		pageState: result.pageState,
		orders: result.orders.length,
		warnings: result.warnings.length,
		htmlLength: result.html?.length,
	});

	return result;
}

function isScrapePortRequest(message: unknown): message is ScrapePortRequest {
	return (
		typeof message === "object" &&
		message !== null &&
		"type" in message &&
		message.type === "SCRAPE_RETAILER_PAGE" &&
		"requestId" in message &&
		typeof message.requestId === "string" &&
		"retailer" in message
	);
}

export function registerHtmlCapture({
	retailer,
	parserVersion,
	log,
}: RegisterHtmlCaptureInput) {
	log("Content script loaded", {
		retailer,
		url: getSafePageUrl(),
		documentReadyState: document.readyState,
		parserVersion,
	});

	browser.runtime.onConnect.addListener((port) => {
		log("Port connected", { retailer, portName: port.name });

		if (port.name !== SCRAPE_PORT_NAME) {
			log("Port ignored", { retailer, portName: port.name });
			return;
		}

		port.onMessage.addListener((message: unknown) => {
			log("Port message received", {
				retailer,
				type:
					typeof message === "object" && message !== null && "type" in message
						? message.type
						: undefined,
			});

			if (!isScrapePortRequest(message)) {
				log("Port message ignored", { retailer });
				return;
			}

			if (message.retailer !== retailer) {
				log("Port scrape request ignored for different retailer", {
					configuredRetailer: retailer,
					requestRetailer: message.retailer,
					requestId: message.requestId,
				});
				return;
			}

			try {
				const result = createScrapeResult(retailer, parserVersion, log);
				const html = result.html ?? "";
				const { html: _html, ...resultMetadata } = result;
				const chunkCount = Math.ceil(html.length / SCRAPE_HTML_CHUNK_SIZE);

				log("Starting scrape response stream", {
					retailer,
					requestId: message.requestId,
					htmlLength: html.length,
					chunkSize: SCRAPE_HTML_CHUNK_SIZE,
					chunkCount,
				});

				port.postMessage({
					type: "SCRAPE_STREAM_STARTED",
					requestId: message.requestId,
					result: resultMetadata,
					htmlLength: html.length,
					chunkCount,
				});

				for (let index = 0; index < chunkCount; index += 1) {
					const start = index * SCRAPE_HTML_CHUNK_SIZE;
					const chunk = html.slice(start, start + SCRAPE_HTML_CHUNK_SIZE);
					port.postMessage({
						type: "SCRAPE_STREAM_CHUNK",
						requestId: message.requestId,
						index,
						chunk,
					});
					log("Scrape response chunk sent", {
						retailer,
						requestId: message.requestId,
						index: index + 1,
						chunkCount,
						chunkLength: chunk.length,
					});
				}

				port.postMessage({
					type: "SCRAPE_STREAM_DONE",
					requestId: message.requestId,
				});
				log("Scrape response stream completed", {
					retailer,
					requestId: message.requestId,
					htmlLength: html.length,
					chunkCount,
				});
			} catch (error) {
				log("Scrape response stream failed", {
					retailer,
					requestId: message.requestId,
					error: serializePortError(error),
				});
				port.postMessage({
					type: "SCRAPE_STREAM_ERROR",
					requestId: message.requestId,
					message: serializePortError(error),
				});
			}
		});
	});
}
