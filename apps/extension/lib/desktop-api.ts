import type {
	Retailer,
	RetailerPageState,
	RetailOrderImport,
} from "@moat/retail-sync";

export type DesktopSyncTarget = {
	port: number;
	token: string;
	sessionId?: string;
};

/**
 * Keep in sync with `RETAIL_SESSION_MAX_IMPORTS` in desktop session-tokens.
 * Each HTML page (orders list or invoice) is one ingest POST.
 */
export const DESKTOP_INGEST_MAX_HTML_UPLOADS = 100;

function desktopOrigin(port: number): string {
	return `http://127.0.0.1:${port}`;
}

export async function ensureDesktopIngestPermission(
	port: number,
): Promise<boolean> {
	const origin = `${desktopOrigin(port)}/*`;
	const already = await chrome.permissions.contains({ origins: [origin] });
	if (already) return true;
	return chrome.permissions.request({ origins: [origin] });
}

async function desktopRequest<T>(input: {
	port: number;
	token?: string;
	path: string;
	method: "GET" | "POST";
	body?: unknown;
}): Promise<T> {
	const response = await fetch(`${desktopOrigin(input.port)}${input.path}`, {
		method: input.method,
		headers: {
			...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
			...(input.body ? { "Content-Type": "application/json" } : {}),
		},
		body: input.body ? JSON.stringify(input.body) : undefined,
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(
			`Desktop ingest failed (${response.status})${text ? `: ${text}` : ""}`,
		);
	}

	return (await response.json()) as T;
}

export async function claimDesktopIngestSession(input: {
	port: number;
	sessionId: string;
}): Promise<DesktopSyncTarget> {
	const claimed = await desktopRequest<{
		token: string;
		expiresAt: string;
		port: number;
	}>({
		port: input.port,
		path: `/retail/claim?sessionId=${encodeURIComponent(input.sessionId)}`,
		method: "GET",
	});
	return {
		port: claimed.port || input.port,
		token: claimed.token,
		sessionId: input.sessionId,
	};
}

export async function checkDesktopIngestHealth(
	target: DesktopSyncTarget,
): Promise<boolean> {
	try {
		const result = await desktopRequest<{ ok?: boolean }>({
			port: target.port,
			token: target.token,
			path: "/retail/health",
			method: "GET",
		});
		return result.ok === true;
	} catch {
		return false;
	}
}

export async function uploadRetailHtmlImportToDesktop(input: {
	target: DesktopSyncTarget;
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
	linkedItems?: number;
}> {
	return desktopRequest({
		port: input.target.port,
		token: input.target.token,
		path: "/retail/import-html",
		method: "POST",
		body: {
			retailer: input.retailer,
			html: input.html,
			sourceUrl: input.sourceUrl,
			syncRunId: input.syncRunId,
		},
	});
}

export async function completeDesktopIngestSession(input: {
	target: DesktopSyncTarget;
	status: "success" | "failed";
	errorMessage?: string;
}): Promise<void> {
	await desktopRequest({
		port: input.target.port,
		token: input.target.token,
		path: "/retail/complete",
		method: "POST",
		body: {
			status: input.status,
			errorMessage: input.errorMessage,
		},
	});
}
