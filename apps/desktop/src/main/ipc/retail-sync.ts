import {
	type DetectAmazonRetailResponse,
	ListRetailOrdersInputSchema,
	RETAIL_SYNC_CHANNELS,
	type RetailDesktopSyncStatusResponse,
	type StartDesktopAmazonSyncResponse,
} from "@moat/contracts";
import { app, ipcMain, shell } from "electron";
import { isAmazonRetailSyncEnabled } from "../lib/amazon-retail-sync-flag";
import { getMoatWebBaseUrl } from "../lib/moat-web-url";
import { getConfiguredRetailExtensionId } from "../retail/extension-allowlist";
import { startRetailIngestServer } from "../retail/ingest-server";
import {
	createRetailIngestSession,
	getRetailIngestSessionById,
	RETAIL_INGEST_PORT,
} from "../retail/session-tokens";
import { assertVaultUnlocked } from "../vault/vault-service";
import { getUnlockedDesktopDb } from "./vault-guard";

function getMoatWebTransactionsSyncUrl(): string {
	const url = new URL("/transactions", getMoatWebBaseUrl());
	url.searchParams.set("retailSync", "amazon");
	url.searchParams.set("source", "desktop");
	return url.toString();
}

function buildExtensionTriggerUrl(input: {
	extensionId: string;
	port: number;
	sessionId: string;
}): string {
	const url = new URL(`chrome-extension://${input.extensionId}/popup.html`);
	url.searchParams.set("desktopSync", "1");
	url.searchParams.set("retailer", "amazon");
	url.searchParams.set("port", String(input.port));
	url.searchParams.set("sessionId", input.sessionId);
	url.searchParams.set("target", "desktop");
	return url.toString();
}

function getRetailRepository() {
	const { appCtx } = getUnlockedDesktopDb();
	const retail = appCtx.repositories.retail;
	if (!retail) {
		throw new Error("Retail repository is not available");
	}
	return { userId: appCtx.userId, retail };
}

function emptyAmazonRetailDetection(): DetectAmazonRetailResponse {
	return {
		retailer: "amazon",
		detectedCount: 0,
		unlinkedDetectedCount: 0,
		linkedItemCount: 0,
		hasActionableSync: false,
		candidates: [],
	};
}

export function registerRetailSyncHandlers(): void {
	ipcMain.handle(RETAIL_SYNC_CHANNELS.openAmazonWebSync, async () => {
		assertVaultUnlocked();
		const url = getMoatWebTransactionsSyncUrl();
		await shell.openExternal(url);
		return { url };
	});

	ipcMain.handle(RETAIL_SYNC_CHANNELS.isAmazonSyncEnabled, async () => {
		return isAmazonRetailSyncEnabled();
	});

	ipcMain.handle(
		RETAIL_SYNC_CHANNELS.detectAmazon,
		async (): Promise<DetectAmazonRetailResponse> => {
			assertVaultUnlocked();
			if (!(await isAmazonRetailSyncEnabled())) {
				return emptyAmazonRetailDetection();
			}
			const { userId, retail } = getRetailRepository();
			return retail.detectAmazonCandidates({ userId });
		},
	);

	ipcMain.handle(
		RETAIL_SYNC_CHANNELS.startDesktopAmazonSync,
		async (): Promise<StartDesktopAmazonSyncResponse> => {
			assertVaultUnlocked();
			const extensionId = getConfiguredRetailExtensionId();
			if (!extensionId) {
				return {
					sessionId: "",
					port: RETAIL_INGEST_PORT,
					expiresAt: "",
					extensionTriggerUrl: "",
					status: "extension_id_missing",
				};
			}

			await startRetailIngestServer();
			const session = createRetailIngestSession({
				userDataPath: app.getPath("userData"),
				retailer: "amazon",
			});

			const extensionTriggerUrl = buildExtensionTriggerUrl({
				extensionId,
				port: session.port,
				sessionId: session.sessionId,
			});
			await shell.openExternal(extensionTriggerUrl);

			return {
				sessionId: session.sessionId,
				port: session.port,
				expiresAt: session.expiresAt,
				extensionTriggerUrl,
				status: "started",
			};
		},
	);

	ipcMain.handle(
		RETAIL_SYNC_CHANNELS.getSyncStatus,
		async (_event, raw: unknown): Promise<RetailDesktopSyncStatusResponse> => {
			assertVaultUnlocked();
			const sessionId =
				raw &&
				typeof raw === "object" &&
				"sessionId" in raw &&
				typeof (raw as { sessionId: unknown }).sessionId === "string"
					? (raw as { sessionId: string }).sessionId
					: "";
			if (!sessionId) {
				return { sessionId: "", status: "unknown" };
			}

			const session = getRetailIngestSessionById(
				app.getPath("userData"),
				sessionId,
			);
			if (!session) {
				return { sessionId, status: "unknown" };
			}

			return {
				sessionId: session.id,
				status: session.status,
				errorMessage: session.errorMessage,
				created: session.created,
				updated: session.updated,
				skipped: session.skipped,
				ordersFound: session.ordersFound,
				linkedItems: session.linkedItems,
			};
		},
	);

	ipcMain.handle(
		RETAIL_SYNC_CHANNELS.listOrders,
		async (_event, raw: unknown) => {
			assertVaultUnlocked();
			const input = ListRetailOrdersInputSchema.parse(raw ?? {});
			const { userId, retail } = getRetailRepository();
			return retail.listOrders({
				userId,
				retailer: input.retailer,
				limit: input.limit,
				cursor: input.cursor,
			});
		},
	);
}

export { RETAIL_INGEST_PORT };
