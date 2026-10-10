import type { Retailer, ScrapeResult } from "@moat/retail-sync";
import { browser } from "wxt/browser";
import {
	createScrapeRequestId,
	SCRAPE_PORT_NAME,
	type ScrapePortMessage,
	type ScrapePortResultMetadata,
} from "./scrape-port";
import type { CancelSyncResult, ExtensionMessage, SyncResult } from "./types";

const LOG_PREFIX = "[Moat Retail Sync][messaging]";

function log(message: string, context: Record<string, unknown> = {}) {
	console.log(LOG_PREFIX, message, {
		...context,
		timestamp: new Date().toISOString(),
	});
}

function logError(
	message: string,
	error: unknown,
	context: Record<string, unknown> = {},
) {
	console.error(LOG_PREFIX, message, {
		...context,
		error:
			error instanceof Error
				? { name: error.name, message: error.message, stack: error.stack }
				: String(error),
		timestamp: new Date().toISOString(),
	});
}

export async function sendSyncRetailerMessage(
	retailer: Retailer,
	options?: {
		target?: "cloud" | "desktop";
		desktop?: { port: number; token: string; sessionId?: string };
	},
): Promise<SyncResult> {
	log("Sending SYNC_RETAILER message", {
		retailer,
		target: options?.target ?? "cloud",
	});
	const result = (await browser.runtime.sendMessage({
		type: "SYNC_RETAILER",
		retailer,
		target: options?.target,
		desktop: options?.desktop,
	} satisfies ExtensionMessage)) as SyncResult;
	log("SYNC_RETAILER message resolved", { retailer, result });
	return result;
}

export async function sendCancelSyncMessage(
	retailer: Retailer,
): Promise<CancelSyncResult> {
	log("Sending CANCEL_SYNC message", { retailer });
	const result = (await browser.runtime.sendMessage({
		type: "CANCEL_SYNC",
		retailer,
	} satisfies ExtensionMessage)) as CancelSyncResult;
	log("CANCEL_SYNC message resolved", { retailer, result });
	return result;
}

export async function scrapeRetailerTab(
	tabId: number,
	retailer: Retailer,
	signal?: AbortSignal,
): Promise<ScrapeResult> {
	const requestId = createScrapeRequestId();
	log("Opening scrape port", { tabId, retailer, requestId });

	return new Promise((resolve, reject) => {
		let resultMetadata: ScrapePortResultMetadata | null = null;
		let expectedChunks = 0;
		let expectedHtmlLength = 0;
		let isSettled = false;
		const chunks: string[] = [];
		const receivedChunkIndexes = new Set<number>();
		const port = browser.tabs.connect(tabId, { name: SCRAPE_PORT_NAME });
		const timeoutId = setTimeout(() => {
			settleReject(new Error("Timed out waiting for retailer scrape response"));
		}, 30_000);

		function cleanup() {
			clearTimeout(timeoutId);
			signal?.removeEventListener("abort", onAbort);
			try {
				port.disconnect();
			} catch {
				// The port may already be disconnected after an error.
			}
		}

		function onAbort() {
			settleReject(new Error("Sync cancelled"));
		}

		if (signal?.aborted) {
			onAbort();
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });

		function settleReject(error: unknown) {
			if (isSettled) return;
			isSettled = true;
			cleanup();
			logError("Scrape port failed", error, { tabId, retailer, requestId });
			reject(error);
		}

		function settleResolve(result: ScrapeResult) {
			if (isSettled) return;
			isSettled = true;
			cleanup();
			log("Scrape port resolved", {
				tabId,
				retailer,
				requestId,
				pageState: result.pageState,
				orders: result.orders.length,
				parserVersion: result.parserVersion,
				htmlLength: result.html?.length,
				diagnostics: result.diagnostics,
			});
			resolve(result);
		}

		port.onDisconnect.addListener(() => {
			if (isSettled) return;
			const lastError = browser.runtime.lastError;
			settleReject(
				new Error(lastError?.message ?? "Retailer scrape port disconnected"),
			);
		});

		port.onMessage.addListener((message: ScrapePortMessage) => {
			if (message.requestId !== requestId) {
				log("Ignoring scrape port message for different request", {
					tabId,
					retailer,
					requestId,
					messageRequestId: message.requestId,
					type: message.type,
				});
				return;
			}

			if (message.type === "SCRAPE_STREAM_STARTED") {
				resultMetadata = message.result;
				expectedChunks = message.chunkCount;
				expectedHtmlLength = message.htmlLength;
				log("Scrape stream started", {
					tabId,
					retailer,
					requestId,
					htmlLength: message.htmlLength,
					chunkCount: message.chunkCount,
					pageState: message.result.pageState,
				});
				return;
			}

			if (message.type === "SCRAPE_STREAM_CHUNK") {
				chunks[message.index] = message.chunk;
				receivedChunkIndexes.add(message.index);
				log("Scrape stream chunk received", {
					tabId,
					retailer,
					requestId,
					index: message.index + 1,
					expectedChunks,
					chunkLength: message.chunk.length,
					receivedChunks: receivedChunkIndexes.size,
				});
				return;
			}

			if (message.type === "SCRAPE_STREAM_DONE") {
				if (!resultMetadata) {
					settleReject(new Error("Scrape stream completed without metadata"));
					return;
				}

				if (receivedChunkIndexes.size !== expectedChunks) {
					settleReject(
						new Error(
							`Scrape stream missing chunks: received ${receivedChunkIndexes.size} of ${expectedChunks}`,
						),
					);
					return;
				}

				const html = chunks.join("");
				if (html.length !== expectedHtmlLength) {
					settleReject(
						new Error(
							`Scrape stream HTML length mismatch: received ${html.length}, expected ${expectedHtmlLength}`,
						),
					);
					return;
				}

				settleResolve({ ...resultMetadata, html });
				return;
			}

			settleReject(new Error(message.message));
		});

		try {
			port.postMessage({
				type: "SCRAPE_RETAILER_PAGE",
				requestId,
				retailer,
			});
			log("Scrape port request sent", { tabId, retailer, requestId });
		} catch (error) {
			settleReject(error);
		}
	});
}
