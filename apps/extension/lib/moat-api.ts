import type {
	Retailer,
	RetailerPageState,
	RetailOrderImport,
} from "@moat/retail-sync";
import { rememberExtensionAuthTabs } from "./auth-flow";
import { getExtensionState, setAuthState } from "./chrome-storage";
import type { AuthState } from "./types";

const env = import.meta.env as Record<string, string | undefined>;
const apiBaseUrl = (env.WXT_MOAT_API_URL ?? "http://localhost:3001").replace(
	/\/$/,
	"",
);
const webBaseUrl = (env.WXT_MOAT_WEB_URL ?? "http://localhost:3000").replace(
	/\/$/,
	"",
);

type ApiEnvelope<T> = { data: T } | { error: { message: string } };

export type MoatAccountProfile = {
	user: {
		id: string;
		email: string;
	};
	retailSyncTour?: {
		completed: boolean;
		version: number;
	};
};

type ApiRequestOptions = RequestInit & {
	auth?: boolean;
	retryOnUnauthorized?: boolean;
};

const LOG_PREFIX = "[Moat Retail Sync][api-client]";

function createRequestId(): string {
	return `api_${crypto.randomUUID()}`;
}

function getBodyLength(body: BodyInit | null | undefined): number | undefined {
	if (typeof body === "string") return body.length;
	if (body instanceof Blob) return body.size;
	if (body instanceof ArrayBuffer) return body.byteLength;
	if (ArrayBuffer.isView(body)) return body.byteLength;
	return undefined;
}

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

function isExpiringSoon(auth: NonNullable<AuthState>): boolean {
	return new Date(auth.expiresAt).getTime() <= Date.now() + 60_000;
}

async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
	const text = await response.text();
	if (!text) return { data: undefined as T };

	try {
		return JSON.parse(text) as ApiEnvelope<T>;
	} catch {
		return { error: { message: "Moat API returned an invalid response" } };
	}
}

async function refreshAuthState(
	auth: NonNullable<AuthState>,
): Promise<NonNullable<AuthState>> {
	if (!auth.refreshToken) throw new Error("No refresh token available");
	log("Refreshing extension auth token", {
		expiresAt: auth.expiresAt,
		hasRefreshToken: Boolean(auth.refreshToken),
	});

	const result = await apiRequest<{
		accessToken: string;
		expiresIn: number;
		tokenType: string;
		user?: {
			id: string;
			email: string;
		};
	}>("/api/v1/extensionAuth/refresh", {
		method: "POST",
		body: JSON.stringify({ refreshToken: auth.refreshToken }),
		auth: false,
		retryOnUnauthorized: false,
	});

	const nextAuth = {
		...auth,
		moatUserId: result.user?.id ?? auth.moatUserId,
		email: result.user?.email ?? auth.email,
		accessToken: result.accessToken,
		expiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
	};
	log("Extension auth token refreshed", { expiresAt: nextAuth.expiresAt });
	await setAuthState(nextAuth);
	return nextAuth;
}

async function apiRequest<T>(
	path: string,
	options: ApiRequestOptions = {},
): Promise<T> {
	const requestId = createRequestId();
	const state = await getExtensionState();
	const headers = new Headers(options.headers);
	headers.set("Content-Type", "application/json");
	const shouldAttachAuth = options.auth !== false;
	let auth = state.auth;
	const method = options.method ?? "GET";
	const url = `${apiBaseUrl}${path}`;

	log("API request preparing", {
		requestId,
		method,
		path,
		url,
		shouldAttachAuth,
		hasAuthState: Boolean(auth),
		bodyLength: getBodyLength(options.body),
	});

	if (shouldAttachAuth && auth?.refreshToken && isExpiringSoon(auth)) {
		log("API request needs auth refresh first", {
			requestId,
			path,
			expiresAt: auth.expiresAt,
		});
		auth = await refreshAuthState(auth).catch(async (error: unknown) => {
			logError("Auth refresh failed before API request", error, {
				requestId,
				path,
			});
			await setAuthState(null);
			throw error;
		});
	}

	if (shouldAttachAuth && auth?.accessToken) {
		headers.set("Authorization", `Bearer ${auth.accessToken}`);
	}

	log("API request sending", {
		requestId,
		method,
		path,
		hasAuthorizationHeader: headers.has("Authorization"),
		bodyLength: getBodyLength(options.body),
	});

	const response = await fetch(url, {
		...options,
		headers,
	});
	log("API response received", {
		requestId,
		method,
		path,
		status: response.status,
		ok: response.ok,
		contentType: response.headers.get("content-type"),
	});
	const envelope = await readApiEnvelope<T>(response);
	log("API envelope parsed", {
		requestId,
		method,
		path,
		hasError: "error" in envelope,
	});

	if (
		response.status === 401 &&
		options.retryOnUnauthorized !== false &&
		shouldAttachAuth &&
		auth?.refreshToken
	) {
		log("API request unauthorized; refreshing and retrying", {
			requestId,
			method,
			path,
		});
		const refreshedAuth = await refreshAuthState(auth).catch(async (error) => {
			logError("Auth refresh failed before retry", error, {
				requestId,
				path,
			});
			await setAuthState(null);
			throw error;
		});
		const retryHeaders = new Headers(options.headers);
		retryHeaders.set("Content-Type", "application/json");
		retryHeaders.set("Authorization", `Bearer ${refreshedAuth.accessToken}`);

		const retryResponse = await fetch(url, {
			...options,
			headers: retryHeaders,
		});
		log("API retry response received", {
			requestId,
			method,
			path,
			status: retryResponse.status,
			ok: retryResponse.ok,
		});
		const retryEnvelope = await readApiEnvelope<T>(retryResponse);
		if (!retryResponse.ok || "error" in retryEnvelope) {
			log("API retry failed", {
				requestId,
				method,
				path,
				status: retryResponse.status,
				error:
					"error" in retryEnvelope ? retryEnvelope.error.message : undefined,
			});
			throw new Error(
				"error" in retryEnvelope
					? retryEnvelope.error.message
					: "Moat API request failed",
			);
		}

		log("API retry succeeded", { requestId, method, path });
		return retryEnvelope.data;
	}

	if (!response.ok || "error" in envelope) {
		log("API request failed", {
			requestId,
			method,
			path,
			status: response.status,
			error: "error" in envelope ? envelope.error.message : undefined,
		});
		throw new Error(
			"error" in envelope ? envelope.error.message : "Moat API request failed",
		);
	}

	log("API request succeeded", { requestId, method, path });
	return envelope.data;
}

export function getMoatWebUrl(path = "/"): string {
	return `${webBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function startMoatAuth(): Promise<void> {
	const extensionId = chrome.runtime.id;
	const authUrl = getMoatWebUrl(
		`/extension/auth?extensionId=${encodeURIComponent(extensionId)}`,
	);
	const [returnTab] = await chrome.tabs.query({
		active: true,
		currentWindow: true,
	});
	log("Opening Moat auth tab", { extensionId, authUrl });
	const authTab = await chrome.tabs.create({ url: authUrl, active: true });
	await rememberExtensionAuthTabs({
		authTabId: authTab.id,
		returnTabId: returnTab?.id,
	});
}

export async function refreshMoatAuth(): Promise<void> {
	const state = await getExtensionState();
	if (!state.auth) throw new Error("No auth session available");
	await refreshAuthState(state.auth);
}

export async function getMoatAccount(): Promise<MoatAccountProfile> {
	return apiRequest<MoatAccountProfile>("/api/v1/extensionAuth/me");
}

export async function syncMoatAccountProfile(): Promise<MoatAccountProfile> {
	const account = await getMoatAccount();
	const state = await getExtensionState();

	if (state.auth) {
		const nextAuth = {
			...state.auth,
			moatUserId: account.user.id,
			email: account.user.email,
		};

		if (
			nextAuth.moatUserId !== state.auth.moatUserId ||
			nextAuth.email !== state.auth.email
		) {
			await setAuthState(nextAuth);
		}
	}

	return account;
}

export async function revokeMoatAuth(): Promise<void> {
	try {
		await apiRequest<{ message: string }>("/api/v1/extensionAuth/revoke", {
			method: "POST",
			body: JSON.stringify({ allDevices: false }),
		});
	} finally {
		await setAuthState(null);
	}
}

export async function completeRetailSyncTour(): Promise<{
	retailSyncTour: { completed: boolean; version: number };
}> {
	return apiRequest("/api/v1/extensionAuth/completeRetailSyncTour", {
		method: "POST",
		body: JSON.stringify({}),
	});
}

export async function upsertRetailConnection(
	retailer: Retailer,
): Promise<void> {
	await apiRequest("/api/v1/retail/upsertConnection", {
		method: "POST",
		body: JSON.stringify({ retailer, status: "connected" }),
	});
}

export async function disconnectRetailConnection(
	retailer: Retailer,
): Promise<void> {
	await apiRequest("/api/v1/retail/disconnectConnection", {
		method: "POST",
		body: JSON.stringify({ retailer }),
	});
}

export async function uploadRetailImport(input: {
	retailer: Retailer;
	orders: RetailOrderImport[];
	syncRunId: string;
}): Promise<{ created: number; updated: number; skipped: number }> {
	return apiRequest("/api/v1/retail/createImport", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export async function listRetailImports(input: {
	retailer?: Retailer;
	limit?: number;
	cursor?: number;
}): Promise<{
	orders: import("@moat/contracts").RetailOrderListItem[];
	nextCursor?: number | null;
}> {
	return apiRequest("/api/v1/retail/listImports", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export async function uploadRetailHtmlImport(input: {
	retailer: Retailer;
	html: string;
	sourceUrl: string;
	syncRunId: string;
}): Promise<{
	created: number;
	updated: number;
	skipped: number;
	pageState: RetailerPageState;
	parserVersion: string;
	orders: RetailOrderImport[];
	warnings: string[];
}> {
	log("Uploading retailer HTML import", {
		retailer: input.retailer,
		syncRunId: input.syncRunId,
		sourceUrl: input.sourceUrl,
		htmlLength: input.html.length,
	});
	return apiRequest("/api/v1/retail/createImportFromHtml", {
		method: "POST",
		body: JSON.stringify(input),
	});
}
