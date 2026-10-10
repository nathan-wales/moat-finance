import type { Retailer } from "@moat/retail-sync";
import { browser } from "wxt/browser";
import { retailerConfigs, supportedRetailers } from "./retailers";

const LOG_PREFIX = "[Moat Retail Sync][content-scripts]";

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

function contentScriptId(retailer: Retailer): string {
	return `moat-retail-${retailer}`;
}

function contentScriptPath(retailer: Retailer): string {
	return `content-scripts/${retailer}.js`;
}

async function registeredScriptIds(): Promise<Set<string>> {
	const scripts = await browser.scripting.getRegisteredContentScripts();
	return new Set(scripts.map((script) => script.id));
}

export async function registerRetailerContentScript(
	retailer: Retailer,
): Promise<void> {
	const config = retailerConfigs[retailer];
	const id = contentScriptId(retailer);
	const existingIds = await registeredScriptIds();
	const registration = {
		id,
		js: [contentScriptPath(retailer)],
		matches: config.hostPermissions,
		persistAcrossSessions: true,
		runAt: "document_idle" as const,
	};

	if (existingIds.has(id)) {
		await browser.scripting.updateContentScripts([registration]);
		log("Updated retailer content script", { retailer, id });
		return;
	}

	await browser.scripting.registerContentScripts([registration]);
	log("Registered retailer content script", { retailer, id });
}

export async function unregisterRetailerContentScript(
	retailer: Retailer,
): Promise<void> {
	const id = contentScriptId(retailer);
	const existingIds = await registeredScriptIds();
	if (!existingIds.has(id)) return;

	await browser.scripting.unregisterContentScripts({ ids: [id] });
	log("Unregistered retailer content script", { retailer, id });
}

export async function syncRetailerContentScripts(): Promise<void> {
	for (const retailer of supportedRetailers) {
		const granted = await browser.permissions.contains({
			origins: retailerConfigs[retailer].hostPermissions,
		});
		try {
			if (granted) {
				await registerRetailerContentScript(retailer);
			} else {
				await unregisterRetailerContentScript(retailer);
			}
		} catch (error) {
			logError("Failed to sync retailer content script", error, {
				retailer,
				granted,
			});
		}
	}
}
