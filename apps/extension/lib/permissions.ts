import type { Retailer } from "@moat/retail-sync";
import { browser } from "wxt/browser";
import {
	registerRetailerContentScript,
	unregisterRetailerContentScript,
} from "./register-retailer-scripts";
import { retailerConfigs } from "./retailers";

const LOG_PREFIX = "[Moat Retail Sync][permissions]";

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

export async function hasRetailerPermission(
	retailer: Retailer,
): Promise<boolean> {
	const config = retailerConfigs[retailer];
	return browser.permissions.contains({ origins: config.hostPermissions });
}

export async function requestRetailerPermission(
	retailer: Retailer,
): Promise<boolean> {
	const config = retailerConfigs[retailer];
	const granted = await browser.permissions.request({
		origins: config.hostPermissions,
	});
	if (!granted) return false;

	await registerRetailerContentScript(retailer).catch((error: unknown) => {
		logError("Failed to register retailer content script", error, {
			retailer,
		});
	});
	return true;
}

export async function removeRetailerPermission(
	retailer: Retailer,
): Promise<boolean> {
	const config = retailerConfigs[retailer];
	await unregisterRetailerContentScript(retailer).catch((error: unknown) => {
		logError("Failed to unregister retailer content script", error, {
			retailer,
		});
	});

	for (const origin of config.hostPermissions) {
		try {
			await browser.permissions.remove({ origins: [origin] });
		} catch (error) {
			logError("Failed to remove retailer host permission", error, {
				retailer,
			});
		}
	}

	return !(await hasRetailerPermission(retailer));
}
