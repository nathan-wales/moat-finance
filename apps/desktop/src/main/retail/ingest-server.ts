import http from "node:http";
import type { RetailRepository } from "@moat/data-access";
import type { Retailer } from "@moat/retail-sync";
import {
	assertExtensionOrigin,
	getAllowedExtensionOrigin,
	getConfiguredRetailExtensionId,
	isAllowedRetailSourceUrl,
} from "./extension-allowlist";
import { importRetailHtmlToSqlite } from "./import-html";
import {
	claimRetailIngestSession,
	incrementRetailIngestImportCount,
	RETAIL_INGEST_PORT,
	RETAIL_SESSION_MAX_IMPORTS,
	resolveRetailIngestSession,
	updateRetailIngestSession,
} from "./session-tokens";

type RetailIngestDeps = {
	userDataPath: string;
	getRetailRepository: () => {
		userId: string;
		retail: RetailRepository;
	} | null;
	isVaultUnlocked: () => boolean;
};

const MAX_HTML_BYTES = 12 * 1024 * 1024;

let _server: http.Server | null = null;
let _deps: RetailIngestDeps | null = null;

function readJsonBody(
	req: http.IncomingMessage,
	maxBytes: number,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		req.on("data", (chunk: Buffer) => {
			total += chunk.length;
			if (total > maxBytes) {
				reject(new Error("Payload too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			try {
				const raw = Buffer.concat(chunks).toString("utf-8");
				resolve(raw ? JSON.parse(raw) : {});
			} catch (error) {
				reject(error);
			}
		});
		req.on("error", reject);
	});
}

function sendJson(
	res: http.ServerResponse,
	status: number,
	body: Record<string, unknown>,
	extraHeaders?: Record<string, string>,
) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Content-Length": Buffer.byteLength(payload),
		...extraHeaders,
	});
	res.end(payload);
}

function corsHeaders(allowedOrigin: string): Record<string, string> {
	return {
		"Access-Control-Allow-Origin": allowedOrigin,
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Authorization, Content-Type",
		"Access-Control-Max-Age": "600",
		Vary: "Origin",
	};
}

function getBearerToken(req: http.IncomingMessage): string {
	const authHeader = req.headers.authorization ?? "";
	if (!authHeader.startsWith("Bearer ")) return "";
	return authHeader.slice(7).trim();
}

function isRetailer(value: unknown): value is Retailer {
	return value === "amazon" || value === "walmart" || value === "target";
}

function requireExtensionOrigin(
	req: http.IncomingMessage,
	res: http.ServerResponse,
): { allowedOrigin: string } | null {
	const allowedOrigin = getAllowedExtensionOrigin();
	const check = assertExtensionOrigin({
		headers: req.headers,
		allowedOrigin,
	});
	if (!check.ok || !allowedOrigin) {
		sendJson(res, 403, {
			error: check.ok ? "Origin is not allowed" : check.error,
		});
		return null;
	}
	return { allowedOrigin };
}

async function handleRequest(
	req: http.IncomingMessage,
	res: http.ServerResponse,
) {
	if (!_deps) {
		sendJson(res, 503, { error: "Retail ingest is not initialized" });
		return;
	}

	if (!getConfiguredRetailExtensionId()) {
		sendJson(res, 503, { error: "Retail extension ID is not configured" });
		return;
	}

	const url = new URL(req.url ?? "/", `http://127.0.0.1:${RETAIL_INGEST_PORT}`);
	const method = req.method ?? "GET";

	const originGate = requireExtensionOrigin(req, res);
	if (!originGate) return;
	const { allowedOrigin } = originGate;
	const headers = corsHeaders(allowedOrigin);

	if (method === "OPTIONS") {
		res.writeHead(204, headers);
		res.end();
		return;
	}

	if (url.pathname === "/retail/claim" && method === "GET") {
		if (!_deps.isVaultUnlocked()) {
			sendJson(res, 503, { error: "Desktop vault is locked" }, headers);
			return;
		}
		const sessionId = url.searchParams.get("sessionId") ?? "";
		const claimed = claimRetailIngestSession(_deps.userDataPath, sessionId);
		if (!claimed) {
			sendJson(
				res,
				401,
				{ error: "Session is invalid, expired, or already claimed" },
				headers,
			);
			return;
		}
		sendJson(
			res,
			200,
			{
				token: claimed.token,
				retailer: claimed.retailer,
				expiresAt: claimed.expiresAt,
				port: RETAIL_INGEST_PORT,
			},
			headers,
		);
		return;
	}

	if (url.pathname === "/retail/health" && method === "GET") {
		const token = getBearerToken(req);
		const session = resolveRetailIngestSession(_deps.userDataPath, token);
		if (!session) {
			sendJson(
				res,
				401,
				{ error: "Invalid or missing session token" },
				headers,
			);
			return;
		}
		if (!_deps.isVaultUnlocked()) {
			sendJson(res, 503, { error: "Desktop vault is locked" }, headers);
			return;
		}
		sendJson(
			res,
			200,
			{
				ok: true,
				port: RETAIL_INGEST_PORT,
				sessionId: session.id,
				retailer: session.retailer,
			},
			headers,
		);
		return;
	}

	if (url.pathname === "/retail/complete" && method === "POST") {
		const token = getBearerToken(req);
		const session = resolveRetailIngestSession(_deps.userDataPath, token);
		if (!session) {
			sendJson(
				res,
				401,
				{ error: "Invalid or missing session token" },
				headers,
			);
			return;
		}
		if (!_deps.isVaultUnlocked()) {
			sendJson(res, 503, { error: "Desktop vault is locked" }, headers);
			return;
		}

		try {
			const body = (await readJsonBody(req, 64_000)) as {
				status?: unknown;
				errorMessage?: unknown;
			};
			const nextStatus =
				body.status === "failed" || body.status === "success"
					? body.status
					: "success";
			const errorMessage =
				typeof body.errorMessage === "string" ? body.errorMessage : undefined;
			updateRetailIngestSession(_deps.userDataPath, session.id, {
				status: nextStatus,
				errorMessage:
					nextStatus === "failed" ? (errorMessage ?? "Sync failed") : undefined,
			});
			sendJson(res, 200, { ok: true, status: nextStatus }, headers);
		} catch {
			sendJson(res, 400, { error: "Invalid complete payload" }, headers);
		}
		return;
	}

	if (url.pathname === "/retail/import-html" && method === "POST") {
		const token = getBearerToken(req);
		const session = resolveRetailIngestSession(_deps.userDataPath, token);
		if (!session) {
			sendJson(
				res,
				401,
				{ error: "Invalid or missing session token" },
				headers,
			);
			return;
		}
		if (!_deps.isVaultUnlocked()) {
			sendJson(res, 503, { error: "Desktop vault is locked" }, headers);
			return;
		}
		if (session.status === "failed") {
			sendJson(res, 409, { error: "Session already failed" }, headers);
			return;
		}
		if (session.importCount >= RETAIL_SESSION_MAX_IMPORTS) {
			sendJson(res, 429, { error: "Session import limit reached" }, headers);
			return;
		}

		const repo = _deps.getRetailRepository();
		if (!repo) {
			sendJson(res, 503, { error: "Local database is unavailable" }, headers);
			return;
		}

		try {
			const body = (await readJsonBody(req, MAX_HTML_BYTES + 64_000)) as {
				retailer?: unknown;
				html?: unknown;
				sourceUrl?: unknown;
				syncRunId?: unknown;
			};

			if (!isRetailer(body.retailer) || body.retailer !== session.retailer) {
				sendJson(res, 400, { error: "Invalid retailer for session" }, headers);
				return;
			}
			if (typeof body.html !== "string" || body.html.length === 0) {
				sendJson(res, 400, { error: "html is required" }, headers);
				return;
			}
			if (Buffer.byteLength(body.html, "utf-8") > MAX_HTML_BYTES) {
				sendJson(res, 413, { error: "html payload too large" }, headers);
				return;
			}
			if (typeof body.sourceUrl !== "string" || !body.sourceUrl) {
				sendJson(res, 400, { error: "sourceUrl is required" }, headers);
				return;
			}
			if (!isAllowedRetailSourceUrl(body.retailer, body.sourceUrl)) {
				sendJson(res, 400, { error: "sourceUrl is not allowed" }, headers);
				return;
			}
			if (typeof body.syncRunId !== "string" || !body.syncRunId) {
				sendJson(res, 400, { error: "syncRunId is required" }, headers);
				return;
			}

			const counted = incrementRetailIngestImportCount(
				_deps.userDataPath,
				session.id,
			);
			if (!counted) {
				sendJson(res, 429, { error: "Session import limit reached" }, headers);
				return;
			}

			const result = await importRetailHtmlToSqlite({
				retail: repo.retail,
				userId: repo.userId,
				retailer: body.retailer,
				html: body.html,
				sourceUrl: body.sourceUrl,
				syncRunId: body.syncRunId,
			});

			const failedPage =
				result.pageState !== "orders_page" ||
				(result.created === 0 &&
					result.updated === 0 &&
					result.orders.length === 0 &&
					result.warnings.length > 0);

			updateRetailIngestSession(_deps.userDataPath, session.id, {
				status: failedPage ? "failed" : "importing",
				errorMessage: failedPage ? `page_state:${result.pageState}` : undefined,
				created: (session.created ?? 0) + result.created,
				updated: (session.updated ?? 0) + result.updated,
				skipped: (session.skipped ?? 0) + result.skipped,
				ordersFound: Math.max(session.ordersFound ?? 0, result.orders.length),
				linkedItems: (session.linkedItems ?? 0) + result.linkedItems,
			});

			sendJson(
				res,
				200,
				{
					created: result.created,
					updated: result.updated,
					skipped: result.skipped,
					pageState: result.pageState,
					parserVersion: result.parserVersion,
					orders: result.orders,
					warnings: result.warnings,
					linkedItems: result.linkedItems,
				},
				headers,
			);
		} catch {
			updateRetailIngestSession(_deps.userDataPath, session.id, {
				status: "failed",
				errorMessage: "Import failed",
			});
			sendJson(res, 500, { error: "Import failed" }, headers);
		}
		return;
	}

	sendJson(res, 404, { error: "Not found" }, headers);
}

export function initRetailIngest(deps: RetailIngestDeps): void {
	_deps = deps;
}

export function isRetailIngestRunning(): boolean {
	return _server !== null;
}

export async function startRetailIngestServer(): Promise<{ port: number }> {
	if (!_deps) {
		throw new Error("Retail ingest is not initialized");
	}
	if (!getConfiguredRetailExtensionId()) {
		throw new Error(
			"MOAT_RETAIL_EXTENSION_ID must be set before starting retail ingest",
		);
	}
	if (!_deps.isVaultUnlocked()) {
		throw new Error("Unlock the vault before starting retail ingest");
	}
	if (_server) {
		return { port: RETAIL_INGEST_PORT };
	}

	const server = http.createServer((req, res) => {
		void handleRequest(req, res);
	});

	await new Promise<void>((resolve, reject) => {
		server.listen(RETAIL_INGEST_PORT, "127.0.0.1", () => resolve());
		server.on("error", reject);
	});

	_server = server;
	return { port: RETAIL_INGEST_PORT };
}

export async function stopRetailIngestServer(): Promise<void> {
	const server = _server;
	if (!server) return;
	_server = null;
	await new Promise<void>((resolve) => {
		server.close(() => resolve());
	});
}
