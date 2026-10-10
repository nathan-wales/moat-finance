import { browser } from "wxt/browser";
import { authStateFromExternalMessage } from "../lib/auth";
import { returnToOriginalTabAndCloseAuth } from "../lib/auth-flow";
import { setAuthState } from "../lib/chrome-storage";
import { syncRetailerContentScripts } from "../lib/register-retailer-scripts";
import { cancelRetailerSync, syncRetailer } from "../lib/sync-orchestrator";
import type { ExtensionMessage } from "../lib/types";

const LOG_PREFIX = "[Moat Retail Sync][background]";
const env = import.meta.env as Record<string, string | undefined>;
const allowedWebOrigin = new URL(
	env.WXT_MOAT_WEB_URL ?? "http://localhost:3000",
).origin;

function log(message: string, context: Record<string, unknown> = {}) {
	console.log(LOG_PREFIX, message, {
		...context,
		timestamp: new Date().toISOString(),
	});
}

function logError(message: string, error: unknown, context = {}) {
	console.error(LOG_PREFIX, message, {
		...context,
		error:
			error instanceof Error
				? { name: error.name, message: error.message, stack: error.stack }
				: String(error),
		timestamp: new Date().toISOString(),
	});
}

function isAllowedExternalSender(
	sender: chrome.runtime.MessageSender,
): boolean {
	const url = sender.url ?? sender.origin;
	if (!url) return false;
	try {
		return new URL(url).origin === allowedWebOrigin;
	} catch {
		return false;
	}
}

async function openSyncSurface(sender: chrome.runtime.MessageSender) {
	const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
	await chrome.sidePanel
		?.open({ windowId })
		.catch((error: unknown) =>
			logError("Failed to auto-open side panel", error, { windowId }),
		);
}

export default defineBackground(() => {
	log("Background worker initialized");
	void syncRetailerContentScripts().catch((error: unknown) => {
		logError("Failed to sync retailer content scripts", error);
	});

	browser.runtime.onInstalled.addListener(() => {
		log("Runtime installed event received");
		void syncRetailerContentScripts().catch((error: unknown) => {
			logError("Failed to sync retailer content scripts", error);
		});
		void browser.sidePanel
			?.setPanelBehavior({ openPanelOnActionClick: true })
			.then(() => log("Side panel behavior configured"))
			.catch((error) => logError("Failed to configure side panel", error));
	});

	browser.runtime.onStartup?.addListener(() => {
		log("Runtime startup event received");
		void syncRetailerContentScripts().catch((error: unknown) => {
			logError("Failed to sync retailer content scripts", error);
		});
	});

	browser.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
		log("Message received", {
			type: message.type,
			retailer: "retailer" in message ? message.retailer : undefined,
			senderTabId: sender.tab?.id,
			senderUrl: sender.url,
		});

		if (message.type === "SYNC_RETAILER") {
			log("Starting sync from runtime message", {
				retailer: message.retailer,
				target: message.target ?? "cloud",
			});
			return syncRetailer(message.retailer, {
				target: message.target,
				desktop: message.desktop,
			})
				.then((result) => {
					log("Sync message completed", {
						retailer: message.retailer,
						result,
					});
					return result;
				})
				.catch((error) => {
					logError("Sync message failed", error, {
						retailer: message.retailer,
					});
					throw error;
				});
		}

		if (message.type === "CANCEL_SYNC") {
			log("Cancelling sync from runtime message", {
				retailer: message.retailer,
			});
			return cancelRetailerSync(message.retailer)
				.then((result) => {
					log("Cancel sync message completed", {
						retailer: message.retailer,
						result,
					});
					return result;
				})
				.catch((error) => {
					logError("Cancel sync message failed", error, {
						retailer: message.retailer,
					});
					throw error;
				});
		}

		log("Message ignored", { type: message.type });
		return undefined;
	});

	browser.runtime.onMessageExternal.addListener((message, sender) => {
		log("External message received", {
			type:
				typeof message === "object" && message && "type" in message
					? message.type
					: undefined,
			senderUrl: sender.url,
			senderOrigin: sender.origin,
		});

		if (!isAllowedExternalSender(sender)) {
			log("External message rejected", {
				senderUrl: sender.url,
				senderOrigin: sender.origin,
				allowedWebOrigin,
			});
			throw new Error("External sender is not allowed");
		}

		const authState = authStateFromExternalMessage(message);
		if (authState) {
			log("External extension auth received", {
				senderTabId: sender.tab?.id,
			});
			return setAuthState(authState)
				.then(() => returnToOriginalTabAndCloseAuth(sender.tab?.id))
				.then(() => {
					log("External extension auth completed", {
						senderTabId: sender.tab?.id,
					});
					return { status: "ok" as const };
				})
				.catch((error) => {
					logError("External extension auth failed", error);
					throw error;
				});
		}

		if (
			typeof message !== "object" ||
			!message ||
			!("type" in message) ||
			message.type !== "MOAT_WEB_SYNC_RETAILER" ||
			!("retailer" in message) ||
			message.retailer !== "amazon"
		) {
			throw new Error("Unsupported external request");
		}

		return openSyncSurface(sender)
			.then(() => syncRetailer("amazon"))
			.then((result) => {
				log("External sync completed", { retailer: "amazon", result });
				return result;
			})
			.catch((error) => {
				logError("External sync failed", error, { retailer: "amazon" });
				throw error;
			});
	});
});
