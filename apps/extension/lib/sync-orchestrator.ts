import {
	dedupeRetailOrders,
	type Retailer,
	type RetailOrderImport,
	type ScrapeResult,
	validateRetailOrders,
} from "@moat/retail-sync";
import { browser } from "wxt/browser";
import {
	addImportSnapshot,
	addSyncRun,
	getExtensionState,
	updateConnection,
	updateSyncRun,
} from "./chrome-storage";
import {
	checkDesktopIngestHealth,
	completeDesktopIngestSession,
	DESKTOP_INGEST_MAX_HTML_UPLOADS,
	type DesktopSyncTarget,
	ensureDesktopIngestPermission,
	uploadRetailHtmlImportToDesktop,
} from "./desktop-api";
import { scrapeRetailerTab } from "./messaging";
import { uploadRetailHtmlImport, uploadRetailImport } from "./moat-api";
import { hasRetailerPermission } from "./permissions";
import { retailerConfigs } from "./retailers";
import type {
	CancelSyncResult,
	RetailConnectionStatus,
	RetailSyncRun,
	SyncResult,
} from "./types";

type UploadHtmlResult = Awaited<ReturnType<typeof uploadRetailHtmlImport>>;

export type SyncRetailerOptions = {
	target?: "cloud" | "desktop";
	desktop?: DesktopSyncTarget;
};

const LOG_PREFIX = "[Moat Retail Sync]";

class SyncCancelledError extends Error {
	constructor() {
		super("Sync cancelled");
		this.name = "SyncCancelledError";
	}
}

type ActiveRetailerSync = {
	abort: AbortController;
	tabIds: Set<number>;
	previousStatus: RetailConnectionStatus;
	runId: string;
};

const activeRetailerSyncs = new Map<Retailer, ActiveRetailerSync>();

function previousStatusFromConnection(
	status: RetailConnectionStatus | undefined,
	lastSyncedAt: string | null | undefined,
): RetailConnectionStatus {
	if (!status || status === "syncing") {
		return lastSyncedAt ? "success" : "never_synced";
	}
	return status;
}

function throwIfSyncCancelled(retailer: Retailer): AbortSignal {
	const active = activeRetailerSyncs.get(retailer);
	if (!active || active.abort.signal.aborted) {
		throw new SyncCancelledError();
	}
	return active.abort.signal;
}

function registerSyncTab(retailer: Retailer, tabId: number): void {
	activeRetailerSyncs.get(retailer)?.tabIds.add(tabId);
}

function unregisterSyncTab(retailer: Retailer, tabId: number): void {
	activeRetailerSyncs.get(retailer)?.tabIds.delete(tabId);
}

function isCancelledSyncError(error: unknown): boolean {
	return (
		error instanceof SyncCancelledError ||
		(error instanceof Error && error.message === "Sync cancelled")
	);
}

async function restoreStatusAfterCancel(
	retailer: Retailer,
	previousStatus: RetailConnectionStatus,
): Promise<void> {
	const state = await getExtensionState();
	const connection = state.retailConnections.find(
		(item) => item.retailer === retailer,
	);
	await updateConnection(retailer, {
		lastStatus: previousStatusFromConnection(
			previousStatus === "never_synced"
				? (connection?.lastStatus ?? "syncing")
				: previousStatus,
			connection?.lastSyncedAt,
		),
	});
}

export async function cancelRetailerSync(
	retailer: Retailer,
): Promise<CancelSyncResult> {
	const active = activeRetailerSyncs.get(retailer);
	if (!active) {
		const state = await getExtensionState();
		const connection = state.retailConnections.find(
			(item) => item.retailer === retailer,
		);
		if (connection?.lastStatus !== "syncing") {
			return { cancelled: false };
		}
		await updateConnection(retailer, {
			lastStatus: previousStatusFromConnection(
				connection.lastStatus,
				connection.lastSyncedAt,
			),
		});
		logSync("info", "Cleared stuck syncing status", { retailer });
		return { cancelled: true };
	}

	if (!active.abort.signal.aborted) {
		active.abort.abort();
	}

	await restoreStatusAfterCancel(retailer, active.previousStatus);

	const tabIds = [...active.tabIds];
	active.tabIds.clear();
	await Promise.all(
		tabIds.map((tabId) => browser.tabs.remove(tabId).catch(() => undefined)),
	);
	logSync("info", "Sync cancelled by user", { retailer, runId: active.runId });
	return { cancelled: true };
}

function serializeError(error: unknown): { message: string; name?: string } {
	if (error instanceof Error) {
		return { message: error.message, name: error.name };
	}
	return { message: String(error) };
}

function safeTabUrl(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		const parsed = new URL(url);
		return `${parsed.origin}${parsed.pathname}`;
	} catch {
		return undefined;
	}
}

function logSync(
	level: "info" | "warn" | "error",
	message: string,
	context: Record<string, unknown> = {},
) {
	console[level](LOG_PREFIX, message, context);
}

function createId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID()}`;
}

async function waitForTabLoad(
	tabId: number,
	signal?: AbortSignal,
): Promise<void> {
	if (signal?.aborted) throw new SyncCancelledError();
	let tab: chrome.tabs.Tab;
	try {
		tab = await browser.tabs.get(tabId);
	} catch (error) {
		if (signal?.aborted) throw new SyncCancelledError();
		throw error;
	}
	if (tab.status === "complete") return;

	return new Promise((resolve, reject) => {
		function cleanup() {
			clearTimeout(timeoutId);
			browser.tabs.onUpdated.removeListener(listener);
			signal?.removeEventListener("abort", onAbort);
		}

		function onAbort() {
			cleanup();
			reject(new SyncCancelledError());
		}

		const timeoutId = setTimeout(() => {
			cleanup();
			reject(new Error("Retailer page did not finish loading in time"));
		}, 30_000);

		function listener(
			updatedTabId: number,
			changeInfo: chrome.tabs.TabChangeInfo,
		) {
			if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
			cleanup();
			resolve();
		}

		browser.tabs.onUpdated.addListener(listener);
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

async function scrapeRetailerTabWithRetry(
	tabId: number,
	retailer: Retailer,
	runId: string,
): Promise<ScrapeResult> {
	let lastError: unknown;
	const signal = throwIfSyncCancelled(retailer);

	for (let attempt = 0; attempt < 5; attempt += 1) {
		throwIfSyncCancelled(retailer);
		try {
			logSync("info", "Sending scrape message", {
				retailer,
				runId,
				tabId,
				attempt: attempt + 1,
			});
			return await scrapeRetailerTab(tabId, retailer, signal);
		} catch (error) {
			if (isCancelledSyncError(error) || signal.aborted) {
				throw new SyncCancelledError();
			}
			lastError = error;
			logSync("warn", "Scrape message failed", {
				retailer,
				runId,
				tabId,
				attempt: attempt + 1,
				error: serializeError(error),
			});
			await new Promise<void>((resolve, reject) => {
				const onAbort = () => {
					clearTimeout(timeoutId);
					reject(new SyncCancelledError());
				};
				const timeoutId = setTimeout(
					() => {
						signal.removeEventListener("abort", onAbort);
						resolve();
					},
					250 * (attempt + 1),
				);
				if (signal.aborted) {
					onAbort();
					return;
				}
				signal.addEventListener("abort", onAbort, { once: true });
			});
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Unable to reach retailer content script");
}

function orderNeedsInvoiceEnrichment(order: RetailOrderImport): boolean {
	return Boolean(
		order.retailer === "amazon" &&
			order.invoiceUrl &&
			(order.subtotal == null ||
				order.tax == null ||
				order.shipping == null ||
				order.items.some((item) => item.unitPrice == null)),
	);
}

async function scrapeAndUploadInvoicePage(input: {
	retailer: Retailer;
	runId: string;
	invoiceUrl: string;
	externalOrderId: string;
	uploadHtml: (payload: {
		retailer: Retailer;
		html: string;
		sourceUrl: string;
		syncRunId: string;
	}) => Promise<UploadHtmlResult>;
}): Promise<{
	orders: RetailOrderImport[];
	warnings: string[];
	created: number;
	updated: number;
	skipped: number;
}> {
	let invoiceTabId: number | undefined;
	try {
		logSync("info", "Opening invoice tab", {
			retailer: input.retailer,
			runId: input.runId,
			externalOrderId: input.externalOrderId,
			invoiceUrl: safeTabUrl(input.invoiceUrl),
		});
		const invoiceTab = await browser.tabs.create({
			url: input.invoiceUrl,
			active: false,
		});
		if (!invoiceTab.id) throw new Error("Unable to open invoice tab");
		invoiceTabId = invoiceTab.id;
		registerSyncTab(input.retailer, invoiceTabId);

		await waitForTabLoad(invoiceTabId, throwIfSyncCancelled(input.retailer));
		const loadedTab = await browser.tabs
			.get(invoiceTabId)
			.catch(() => undefined);
		logSync("info", "Invoice tab loaded", {
			retailer: input.retailer,
			runId: input.runId,
			externalOrderId: input.externalOrderId,
			tabId: invoiceTabId,
			url: safeTabUrl(loadedTab?.url),
			status: loadedTab?.status,
		});

		const scrapeResult = await scrapeRetailerTabWithRetry(
			invoiceTabId,
			input.retailer,
			input.runId,
		);
		if (!scrapeResult.html || !scrapeResult.diagnostics?.sourceUrl) {
			throw new Error("Invoice page HTML was not captured");
		}

		logSync("info", "Uploading invoice HTML import", {
			retailer: input.retailer,
			runId: input.runId,
			externalOrderId: input.externalOrderId,
			htmlLength: scrapeResult.html.length,
			sourceUrl: safeTabUrl(scrapeResult.diagnostics.sourceUrl),
		});

		const uploadResult = await input.uploadHtml({
			retailer: input.retailer,
			html: scrapeResult.html,
			sourceUrl: scrapeResult.diagnostics.sourceUrl,
			syncRunId: input.runId,
		});

		logSync("info", "Invoice HTML import processed", {
			retailer: input.retailer,
			runId: input.runId,
			externalOrderId: input.externalOrderId,
			pageState: uploadResult.pageState,
			ordersParsed: uploadResult.orders.length,
			created: uploadResult.created,
			updated: uploadResult.updated,
			skipped: uploadResult.skipped,
			warnings: uploadResult.warnings,
		});

		return {
			orders: uploadResult.orders,
			warnings: uploadResult.warnings,
			created: uploadResult.created,
			updated: uploadResult.updated,
			skipped: uploadResult.skipped,
		};
	} finally {
		if (invoiceTabId) {
			unregisterSyncTab(input.retailer, invoiceTabId);
			logSync("info", "Closing invoice tab", {
				retailer: input.retailer,
				runId: input.runId,
				externalOrderId: input.externalOrderId,
				tabId: invoiceTabId,
			});
			await browser.tabs.remove(invoiceTabId).catch(() => undefined);
		}
	}
}

async function enrichAmazonOrdersFromInvoices(input: {
	retailer: Retailer;
	runId: string;
	orders: RetailOrderImport[];
	uploadHtml: (payload: {
		retailer: Retailer;
		html: string;
		sourceUrl: string;
		syncRunId: string;
	}) => Promise<UploadHtmlResult>;
	/** When set, only enrich up to this many invoice pages (desktop ingest budget). */
	maxInvoicePages?: number;
}): Promise<{ orders: RetailOrderImport[]; warnings: string[] }> {
	if (input.retailer !== "amazon")
		return { orders: input.orders, warnings: [] };

	const ordersById = new Map(
		input.orders.map((order) => [order.externalOrderId, order]),
	);
	const warnings: string[] = [];
	const ordersNeedingInvoices = input.orders.filter(
		orderNeedsInvoiceEnrichment,
	);
	const invoiceBudget =
		input.maxInvoicePages === undefined
			? ordersNeedingInvoices.length
			: Math.max(0, input.maxInvoicePages);
	const invoicesToEnrich = ordersNeedingInvoices.slice(0, invoiceBudget);
	const skippedForBudget =
		ordersNeedingInvoices.length - invoicesToEnrich.length;

	logSync("info", "Amazon invoice enrichment planned", {
		retailer: input.retailer,
		runId: input.runId,
		orders: input.orders.length,
		ordersNeedingInvoices: ordersNeedingInvoices.length,
		invoicesToEnrich: invoicesToEnrich.length,
		skippedForBudget,
	});

	if (skippedForBudget > 0) {
		warnings.push(
			`Skipped invoice enrichment for ${skippedForBudget} order(s) to stay within the desktop ingest upload budget.`,
		);
	}

	for (const order of invoicesToEnrich) {
		if (!order.invoiceUrl) continue;
		throwIfSyncCancelled(input.retailer);
		try {
			const invoiceResult = await scrapeAndUploadInvoicePage({
				retailer: input.retailer,
				runId: input.runId,
				externalOrderId: order.externalOrderId,
				invoiceUrl: order.invoiceUrl,
				uploadHtml: input.uploadHtml,
			});
			for (const invoiceOrder of invoiceResult.orders) {
				ordersById.set(invoiceOrder.externalOrderId, invoiceOrder);
			}
			warnings.push(...invoiceResult.warnings);
		} catch (error) {
			if (error instanceof SyncCancelledError) throw error;
			const message =
				error instanceof Error ? error.message : "Invoice enrichment failed";
			warnings.push(
				`Invoice enrichment failed for ${order.externalOrderId}: ${message}`,
			);
			logSync("warn", "Invoice enrichment failed", {
				retailer: input.retailer,
				runId: input.runId,
				externalOrderId: order.externalOrderId,
				error: serializeError(error),
			});
		}
	}

	return { orders: Array.from(ordersById.values()), warnings };
}

function stateToStatus(scrapeResult: ScrapeResult): SyncResult["status"] {
	if (scrapeResult.pageState === "login_required") return "login_required";
	if (scrapeResult.pageState === "captcha_or_bot_check") return "parse_error";
	if (scrapeResult.pageState !== "orders_page") return "parse_error";
	return "success";
}

async function finalizeDesktopSync(input: {
	target: "cloud" | "desktop";
	desktop?: DesktopSyncTarget;
	result: SyncResult;
}): Promise<SyncResult> {
	if (input.target !== "desktop" || !input.desktop) return input.result;
	try {
		await completeDesktopIngestSession({
			target: input.desktop,
			status: input.result.status === "success" ? "success" : "failed",
			errorMessage: input.result.warnings[0],
		});
	} catch (error) {
		logSync("warn", "Desktop session complete failed", {
			error: serializeError(error),
		});
	}
	return input.result;
}

export async function syncRetailer(
	retailer: Retailer,
	options: SyncRetailerOptions = {},
): Promise<SyncResult> {
	const target = options.target ?? "cloud";
	const desktopTarget = options.desktop;
	const result = await runRetailerSync(retailer, options);
	return finalizeDesktopSync({
		target,
		desktop: desktopTarget,
		result,
	});
}

async function runRetailerSync(
	retailer: Retailer,
	options: SyncRetailerOptions = {},
): Promise<SyncResult> {
	const runId = createId("sync");
	const activeSync: ActiveRetailerSync = {
		abort: new AbortController(),
		tabIds: new Set(),
		previousStatus: "never_synced",
		runId,
	};
	activeRetailerSyncs.set(retailer, activeSync);

	try {
		return await executeRetailerSync(retailer, options, activeSync);
	} catch (error) {
		if (isCancelledSyncError(error)) {
			await restoreStatusAfterCancel(retailer, activeSync.previousStatus);
			return {
				status: activeSync.previousStatus,
				ordersFound: 0,
				ordersUploaded: 0,
				cancelled: true,
				warnings: ["Sync cancelled."],
			};
		}
		throw error;
	} finally {
		if (activeRetailerSyncs.get(retailer)?.runId === runId) {
			activeRetailerSyncs.delete(retailer);
		}
	}
}

async function executeRetailerSync(
	retailer: Retailer,
	options: SyncRetailerOptions,
	activeSync: ActiveRetailerSync,
): Promise<SyncResult> {
	const config = retailerConfigs[retailer];
	throwIfSyncCancelled(retailer);
	const state = await getExtensionState();
	throwIfSyncCancelled(retailer);
	const target = options.target ?? "cloud";
	const desktopTarget = options.desktop;
	const connection = state.retailConnections.find(
		(item) => item.retailer === retailer,
	);
	activeSync.previousStatus = previousStatusFromConnection(
		connection?.lastStatus,
		connection?.lastSyncedAt,
	);
	const previousStatus = activeSync.previousStatus;
	const runId = activeSync.runId;

	if (target === "cloud" && !state.auth) {
		throw new Error("Sign in to Moat before syncing retailer orders");
	}

	if (target === "desktop") {
		if (!desktopTarget?.token || !desktopTarget.port) {
			throw new Error(
				"Desktop sync requires a claimed local session token and port",
			);
		}
		const permissionGranted = await ensureDesktopIngestPermission(
			desktopTarget.port,
		);
		if (!permissionGranted) {
			return {
				status: "permission_required",
				ordersFound: 0,
				ordersUploaded: 0,
				warnings: [
					"Localhost permission is required to sync into the desktop app.",
				],
			};
		}
		const healthy = await checkDesktopIngestHealth(desktopTarget);
		if (!healthy) {
			return {
				status: "api_error",
				ordersFound: 0,
				ordersUploaded: 0,
				warnings: [
					"Desktop retail ingest is not reachable. Keep Moat Desktop unlocked and try again.",
				],
			};
		}
	}

	if (!config.enabledInV1) {
		throw new Error(`${config.name} sync is not enabled in V1`);
	}

	const permissionGranted = await hasRetailerPermission(retailer);
	throwIfSyncCancelled(retailer);
	if (!permissionGranted) {
		await updateConnection(retailer, {
			permissionGranted: false,
			lastStatus: "permission_required",
		});
		return {
			status: "permission_required",
			ordersFound: 0,
			ordersUploaded: 0,
			warnings: ["Retailer host permission is required before syncing."],
		};
	}

	let desktopHtmlUploads = 0;
	const uploadHtml = async (payload: {
		retailer: Retailer;
		html: string;
		sourceUrl: string;
		syncRunId: string;
	}) => {
		if (target === "desktop" && desktopTarget) {
			if (desktopHtmlUploads >= DESKTOP_INGEST_MAX_HTML_UPLOADS) {
				throw new Error(
					"Desktop ingest upload budget exhausted for this sync session",
				);
			}
			desktopHtmlUploads += 1;
			return uploadRetailHtmlImportToDesktop({
				target: desktopTarget,
				...payload,
			});
		}
		return uploadRetailHtmlImport(payload);
	};

	const startedAt = new Date().toISOString();
	logSync("info", "Sync started", { retailer, runId, target });
	const run: RetailSyncRun = {
		id: runId,
		retailer,
		startedAt,
		completedAt: null,
		status: "failed",
		ordersFound: 0,
		ordersUploaded: 0,
	};

	await addSyncRun(run);
	await updateConnection(retailer, {
		enabled: true,
		permissionGranted: true,
		lastStatus: "syncing",
	});

	let tabId: number | undefined;
	let shouldCloseTab = true;

	try {
		const tab = await browser.tabs.create({
			url: config.ordersUrl,
			active: false,
		});
		if (!tab.id) throw new Error("Unable to open retailer tab");
		tabId = tab.id;
		registerSyncTab(retailer, tabId);
		throwIfSyncCancelled(retailer);
		logSync("info", "Retailer tab opened", {
			retailer,
			runId,
			tabId,
			url: safeTabUrl(tab.url),
		});

		await waitForTabLoad(tabId, throwIfSyncCancelled(retailer));
		const loadedTab = await browser.tabs.get(tabId).catch(() => undefined);
		logSync("info", "Retailer tab loaded", {
			retailer,
			runId,
			tabId,
			url: safeTabUrl(loadedTab?.url),
			status: loadedTab?.status,
		});

		const scrapeResult = await scrapeRetailerTabWithRetry(
			tabId,
			retailer,
			runId,
		);
		let pageStatus = stateToStatus(scrapeResult);
		logSync("info", "Scrape result received", {
			retailer,
			runId,
			tabId,
			pageState: scrapeResult.pageState,
			status: pageStatus,
			ordersParsed: scrapeResult.orders.length,
			warnings: scrapeResult.warnings,
			parserVersion: scrapeResult.parserVersion,
			diagnostics: scrapeResult.diagnostics,
		});

		if (scrapeResult.html && scrapeResult.diagnostics?.sourceUrl) {
			logSync("info", "Uploading retail HTML import", {
				retailer,
				runId,
				target,
				htmlLength: scrapeResult.html.length,
				sourceUrl: safeTabUrl(scrapeResult.diagnostics.sourceUrl),
			});
			const uploadResult = await uploadHtml({
				retailer,
				html: scrapeResult.html,
				sourceUrl: scrapeResult.diagnostics.sourceUrl,
				syncRunId: runId,
			});
			throwIfSyncCancelled(retailer);
			const serverScrapeResult: ScrapeResult = {
				retailer,
				pageState: uploadResult.pageState,
				orders: uploadResult.orders,
				warnings: uploadResult.warnings,
				parserVersion: uploadResult.parserVersion,
				diagnostics: scrapeResult.diagnostics,
			};
			pageStatus = stateToStatus(serverScrapeResult);
			logSync("info", "Retail HTML import processed", {
				retailer,
				runId,
				target,
				pageState: uploadResult.pageState,
				status: pageStatus,
				ordersParsed: uploadResult.orders.length,
				created: uploadResult.created,
				updated: uploadResult.updated,
				skipped: uploadResult.skipped,
				warnings: uploadResult.warnings,
				parserVersion: uploadResult.parserVersion,
			});

			if (pageStatus !== "success") {
				shouldCloseTab = false;
				await browser.tabs
					.update(tabId, { active: true })
					.catch(() => undefined);
				const warning = `Kept ${config.name} tab open for inspection after server page state: ${uploadResult.pageState}.`;
				await updateConnection(retailer, { lastStatus: pageStatus });
				await updateSyncRun(runId, {
					completedAt: new Date().toISOString(),
					status: "failed",
					errorCode: uploadResult.pageState,
					errorMessage: warning,
				});

				return {
					status: pageStatus,
					ordersFound: 0,
					ordersUploaded: 0,
					warnings: [warning, ...uploadResult.warnings],
				};
			}

			const invoiceEnrichment = await enrichAmazonOrdersFromInvoices({
				retailer,
				runId,
				orders: uploadResult.orders,
				uploadHtml,
				maxInvoicePages:
					target === "desktop"
						? Math.max(0, DESKTOP_INGEST_MAX_HTML_UPLOADS - desktopHtmlUploads)
						: undefined,
			});
			const enrichedOrders = invoiceEnrichment.orders;
			const allWarnings = [
				...uploadResult.warnings,
				...invoiceEnrichment.warnings,
			];

			const snapshotId = createId("import");
			const ordersUploaded = uploadResult.created + uploadResult.updated;
			await addImportSnapshot({
				id: snapshotId,
				retailer,
				syncRunId: runId,
				createdAt: new Date().toISOString(),
				orders: enrichedOrders,
				warnings: allWarnings,
				uploaded: true,
			});
			await updateConnection(retailer, {
				lastSyncedAt: new Date().toISOString(),
				lastStatus: "success",
			});
			await updateSyncRun(runId, {
				completedAt: new Date().toISOString(),
				status: allWarnings.length > 0 ? "partial" : "success",
				ordersFound: enrichedOrders.length,
				ordersUploaded,
			});

			return {
				status: "success",
				ordersFound: enrichedOrders.length,
				ordersUploaded,
				warnings: allWarnings,
			};
		}

		if (pageStatus !== "success") {
			shouldCloseTab = false;
			await browser.tabs.update(tabId, { active: true }).catch(() => undefined);
			const warning = `Kept ${config.name} tab open for inspection after page state: ${scrapeResult.pageState}.`;
			logSync("warn", "Sync stopped before upload", {
				retailer,
				runId,
				tabId,
				pageState: scrapeResult.pageState,
			});
			await updateConnection(retailer, { lastStatus: pageStatus });
			await updateSyncRun(runId, {
				completedAt: new Date().toISOString(),
				status: "failed",
				errorCode: scrapeResult.pageState,
				errorMessage: `Retailer page state: ${scrapeResult.pageState}`,
			});

			return {
				status: pageStatus,
				ordersFound: 0,
				ordersUploaded: 0,
				warnings: [warning, ...scrapeResult.warnings],
			};
		}

		if (target === "desktop") {
			return {
				status: "parse_error",
				ordersFound: 0,
				ordersUploaded: 0,
				warnings: [
					"Desktop sync requires HTML capture. No HTML was available from the retailer page.",
				],
			};
		}

		const validation = validateRetailOrders(
			dedupeRetailOrders(scrapeResult.orders),
		);
		const warnings = [...scrapeResult.warnings, ...validation.warnings];
		const snapshotId = createId("import");
		logSync("info", "Retail orders validated", {
			retailer,
			runId,
			ordersParsed: scrapeResult.orders.length,
			validOrders: validation.validOrders.length,
			validationWarnings: validation.warnings.length,
			warnings,
		});

		await addImportSnapshot({
			id: snapshotId,
			retailer,
			syncRunId: runId,
			createdAt: new Date().toISOString(),
			orders: validation.validOrders,
			warnings,
			uploaded: false,
		});

		let ordersUploaded = 0;
		try {
			logSync("info", "Uploading retail import", {
				retailer,
				runId,
				orders: validation.validOrders.length,
			});
			const uploadResult = await uploadRetailImport({
				retailer,
				orders: validation.validOrders,
				syncRunId: runId,
			});
			ordersUploaded = uploadResult.created + uploadResult.updated;
			logSync("info", "Retail import uploaded", {
				retailer,
				runId,
				...uploadResult,
			});
		} catch (error) {
			logSync("error", "Retail import upload failed", {
				retailer,
				runId,
				error: serializeError(error),
			});
			await updateConnection(retailer, { lastStatus: "api_error" });
			await updateSyncRun(runId, {
				completedAt: new Date().toISOString(),
				status: validation.validOrders.length > 0 ? "partial" : "failed",
				ordersFound: validation.validOrders.length,
				ordersUploaded,
				errorCode: "api_error",
				errorMessage: error instanceof Error ? error.message : "Upload failed",
			});

			return {
				status: "api_error",
				ordersFound: validation.validOrders.length,
				ordersUploaded,
				warnings,
			};
		}

		await updateConnection(retailer, {
			lastSyncedAt: new Date().toISOString(),
			lastStatus: "success",
		});
		logSync("info", "Sync completed", {
			retailer,
			runId,
			ordersFound: validation.validOrders.length,
			ordersUploaded,
			warningCount: warnings.length,
		});
		await updateSyncRun(runId, {
			completedAt: new Date().toISOString(),
			status: warnings.length > 0 ? "partial" : "success",
			ordersFound: validation.validOrders.length,
			ordersUploaded,
		});

		return {
			status: "success",
			ordersFound: validation.validOrders.length,
			ordersUploaded,
			warnings,
		};
	} catch (error) {
		if (isCancelledSyncError(error)) {
			shouldCloseTab = true;
			logSync("info", "Sync cancelled", { retailer, runId, tabId });
			await restoreStatusAfterCancel(retailer, previousStatus);
			await updateSyncRun(runId, {
				completedAt: new Date().toISOString(),
				status: "failed",
				errorCode: "cancelled",
				errorMessage: "Sync cancelled",
			});
			return {
				status: previousStatus,
				ordersFound: 0,
				ordersUploaded: 0,
				cancelled: true,
				warnings: ["Sync cancelled."],
			};
		}

		const message = error instanceof Error ? error.message : "Sync failed";
		if (tabId) {
			shouldCloseTab = false;
			await browser.tabs.update(tabId, { active: true }).catch(() => undefined);
		}
		logSync("error", "Sync failed", {
			retailer,
			runId,
			tabId,
			error: serializeError(error),
		});
		await updateConnection(retailer, { lastStatus: "parse_error" });
		await updateSyncRun(runId, {
			completedAt: new Date().toISOString(),
			status: "failed",
			errorCode: "sync_error",
			errorMessage: message,
		});

		return {
			status: "parse_error",
			ordersFound: 0,
			ordersUploaded: 0,
			warnings: tabId
				? [
						`Kept ${config.name} tab open for inspection after sync failure.`,
						message,
					]
				: [message],
		};
	} finally {
		if (tabId) {
			unregisterSyncTab(retailer, tabId);
		}
		if (tabId && shouldCloseTab) {
			logSync("info", "Closing retailer tab", { retailer, runId, tabId });
			await browser.tabs.remove(tabId).catch(() => undefined);
		} else if (tabId) {
			logSync("info", "Leaving retailer tab open", { retailer, runId, tabId });
		}
	}
}
