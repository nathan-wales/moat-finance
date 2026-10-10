"use client";

import { detectRetailTransactions, runRetailMatching } from "@moat/client-ts";
import type { RetailSyncAdapter } from "@moat/features/transactions";

type ChromeRuntime = {
	sendMessage: (
		extensionId: string,
		message: unknown,
		callback: (response?: unknown) => void,
	) => void;
	lastError?: { message?: string };
};

type ChromeLike = {
	runtime?: ChromeRuntime;
};

type AmazonRetailSyncResult = {
	status: string;
	ordersFound: number;
	ordersUploaded: number;
	warnings: string[];
};

function getChromeRuntime(): ChromeRuntime | null {
	if (typeof window === "undefined") return null;
	const chromeLike = (window as Window & { chrome?: ChromeLike }).chrome;
	return chromeLike?.runtime ?? null;
}

async function triggerAmazonRetailSync(): Promise<AmazonRetailSyncResult> {
	const extensionId = process.env.NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID;
	if (!extensionId) {
		throw new Error("Moat Retail Sync extension is not configured");
	}

	const runtime = getChromeRuntime();
	if (!runtime?.sendMessage) {
		throw new Error("Moat Retail Sync extension is not connected");
	}

	return new Promise((resolve, reject) => {
		runtime.sendMessage(
			extensionId,
			{
				type: "MOAT_WEB_SYNC_RETAILER",
				retailer: "amazon",
				requestId: crypto.randomUUID(),
			},
			(response) => {
				const errorMessage = runtime.lastError?.message;
				if (errorMessage) {
					reject(new Error(errorMessage));
					return;
				}

				if (!response || typeof response !== "object") {
					reject(new Error("Moat Retail Sync extension returned no response"));
					return;
				}

				resolve(response as AmazonRetailSyncResult);
			},
		);
	});
}

export const webRetailSyncAdapter: RetailSyncAdapter = {
	async detect(input) {
		const response = await detectRetailTransactions(input);
		if (response.status !== 200 && response.status !== 304) {
			throw new Error("Failed to detect retail transactions");
		}
		return response.data.data;
	},
	async run() {
		const syncResult = await triggerAmazonRetailSync();
		if (syncResult.status !== "success") {
			return {
				status: syncResult.status,
				ordersFound: syncResult.ordersFound,
				warnings: syncResult.warnings,
			};
		}
		await runRetailMatching({ retailer: "amazon" });
		return {
			status: "success",
			ordersFound: syncResult.ordersFound,
			warnings: syncResult.warnings,
		};
	},
};
