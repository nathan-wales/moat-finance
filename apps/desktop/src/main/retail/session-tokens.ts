import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SESSION_FILE_NAME = "retail-ingest-sessions.json";
export const RETAIL_INGEST_PORT = 3031;
export const RETAIL_SESSION_TTL_MS = 15 * 60 * 1000;
/** Safety cap against abuse — extension budgets invoice enrichment under this. */
export const RETAIL_SESSION_MAX_IMPORTS = 100;

export type RetailIngestSessionRecord = {
	id: string;
	tokenHash: string;
	claimedAt?: string;
	importCount: number;
	retailer: "amazon";
	createdAt: string;
	expiresAt: string;
	status: "pending" | "claimed" | "importing" | "success" | "failed";
	errorMessage?: string;
	created?: number;
	updated?: number;
	skipped?: number;
	ordersFound?: number;
	linkedItems?: number;
};

type SessionFile = {
	sessions: RetailIngestSessionRecord[];
};

/** In-memory only until claimed — never persisted. */
const pendingTokens = new Map<string, string>();

function hashToken(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

function loadFile(userDataPath: string): SessionFile {
	const filePath = path.join(userDataPath, SESSION_FILE_NAME);
	if (!fs.existsSync(filePath)) return { sessions: [] };
	try {
		const parsed = JSON.parse(
			fs.readFileSync(filePath, "utf-8"),
		) as SessionFile;
		if (!parsed || !Array.isArray(parsed.sessions)) return { sessions: [] };
		return {
			sessions: parsed.sessions.map((session) => ({
				...session,
				importCount: session.importCount ?? 0,
			})),
		};
	} catch {
		return { sessions: [] };
	}
}

function saveFile(userDataPath: string, data: SessionFile): void {
	const filePath = path.join(userDataPath, SESSION_FILE_NAME);
	const now = Date.now();
	const active = data.sessions.filter(
		(session) => Date.parse(session.expiresAt) > now,
	);
	for (const [sessionId] of pendingTokens) {
		if (!active.some((session) => session.id === sessionId)) {
			pendingTokens.delete(sessionId);
		}
	}
	fs.writeFileSync(filePath, JSON.stringify({ sessions: active }, null, 2), {
		encoding: "utf-8",
		mode: 0o600,
	});
	try {
		fs.chmodSync(filePath, 0o600);
	} catch {
		// best-effort on platforms that ignore mode
	}
}

export function createRetailIngestSession(input: {
	userDataPath: string;
	retailer?: "amazon";
}): { sessionId: string; expiresAt: string; port: number } {
	const token = randomBytes(32).toString("base64url");
	const now = Date.now();
	const record: RetailIngestSessionRecord = {
		id: `retail_sess_${randomBytes(8).toString("hex")}`,
		tokenHash: hashToken(token),
		importCount: 0,
		retailer: input.retailer ?? "amazon",
		createdAt: new Date(now).toISOString(),
		expiresAt: new Date(now + RETAIL_SESSION_TTL_MS).toISOString(),
		status: "pending",
	};
	pendingTokens.set(record.id, token);
	const file = loadFile(input.userDataPath);
	file.sessions.push(record);
	saveFile(input.userDataPath, file);
	return {
		sessionId: record.id,
		expiresAt: record.expiresAt,
		port: RETAIL_INGEST_PORT,
	};
}

export function claimRetailIngestSession(
	userDataPath: string,
	sessionId: string,
): { token: string; retailer: "amazon"; expiresAt: string } | null {
	if (!sessionId) return null;
	const pendingToken = pendingTokens.get(sessionId);
	if (!pendingToken) return null;

	const file = loadFile(userDataPath);
	const index = file.sessions.findIndex((entry) => entry.id === sessionId);
	if (index < 0) {
		pendingTokens.delete(sessionId);
		return null;
	}
	const session = file.sessions[index];
	if (!session) return null;
	if (Date.parse(session.expiresAt) <= Date.now()) {
		pendingTokens.delete(sessionId);
		return null;
	}
	if (session.claimedAt || session.status !== "pending") {
		pendingTokens.delete(sessionId);
		return null;
	}
	if (session.tokenHash !== hashToken(pendingToken)) {
		pendingTokens.delete(sessionId);
		return null;
	}

	pendingTokens.delete(sessionId);
	const next: RetailIngestSessionRecord = {
		...session,
		claimedAt: new Date().toISOString(),
		status: "claimed",
	};
	file.sessions[index] = next;
	saveFile(userDataPath, file);
	return {
		token: pendingToken,
		retailer: next.retailer,
		expiresAt: next.expiresAt,
	};
}

export function resolveRetailIngestSession(
	userDataPath: string,
	rawToken: string,
): RetailIngestSessionRecord | null {
	if (!rawToken) return null;
	const tokenHash = hashToken(rawToken);
	const file = loadFile(userDataPath);
	const now = Date.now();
	const session = file.sessions.find(
		(entry) =>
			entry.tokenHash === tokenHash &&
			Date.parse(entry.expiresAt) > now &&
			Boolean(entry.claimedAt),
	);
	return session ?? null;
}

export function incrementRetailIngestImportCount(
	userDataPath: string,
	sessionId: string,
): RetailIngestSessionRecord | null {
	const file = loadFile(userDataPath);
	const index = file.sessions.findIndex((entry) => entry.id === sessionId);
	if (index < 0) return null;
	const current = file.sessions[index];
	if (!current) return null;
	if (current.importCount >= RETAIL_SESSION_MAX_IMPORTS) return null;
	const next = {
		...current,
		importCount: current.importCount + 1,
		status: "importing" as const,
	};
	file.sessions[index] = next;
	saveFile(userDataPath, file);
	return next;
}

export function updateRetailIngestSession(
	userDataPath: string,
	sessionId: string,
	patch: Partial<
		Pick<
			RetailIngestSessionRecord,
			| "status"
			| "errorMessage"
			| "created"
			| "updated"
			| "skipped"
			| "ordersFound"
			| "linkedItems"
		>
	>,
): RetailIngestSessionRecord | null {
	const file = loadFile(userDataPath);
	const index = file.sessions.findIndex((entry) => entry.id === sessionId);
	if (index < 0) return null;
	const current = file.sessions[index];
	if (!current) return null;
	const next = { ...current, ...patch };
	file.sessions[index] = next;
	saveFile(userDataPath, file);
	return next;
}

export function getRetailIngestSessionById(
	userDataPath: string,
	sessionId: string,
): RetailIngestSessionRecord | null {
	const file = loadFile(userDataPath);
	const session = file.sessions.find((entry) => entry.id === sessionId);
	if (!session) return null;
	if (Date.parse(session.expiresAt) <= Date.now()) return null;
	return session;
}

/** Test helper — clear in-memory pending tokens between tests. */
export function clearPendingRetailIngestTokensForTests(): void {
	pendingTokens.clear();
}
